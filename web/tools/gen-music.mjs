#!/usr/bin/env node
/**
 * gen-music.mjs — procedural chiptune soundtrack generator for Codysse.
 *
 * Renders the game's 6 music tracks (menu + one per zone) as seamless-loop
 * WAV files, then encodes them to OGG + MP3 with ffmpeg. All audio is
 * synthesized from scratch (pulse/triangle/noise channels, NES-style), so the
 * soundtrack is 100% original — no licensing constraints.
 *
 * Design notes:
 * - Deterministic: fixed-seed LCG, no Date/Math.random drift — re-running the
 *   script reproduces byte-identical WAVs.
 * - Seamless loops: track length is an exact bar multiple, and the echo/delay
 *   tail is baked in by rendering the loop twice and keeping the second pass
 *   (the tail of pass 1 bleeds into the head of pass 2 = the loop point).
 * - Each song: 16 bars of 4/4 — bars 1-8 (section A) arp+bass+drums,
 *   bars 9-16 (section B) add the authored lead melody.
 *
 * Usage: node tools/gen-music.mjs   (from web/; writes public/assets/audio/)
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100; // sample rate
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'audio');

// ── Deterministic PRNG (LCG) ────────────────────────────────────────────────
let seed = 0x2bad5eed;
function rand() {
  // Numerical Recipes LCG — plenty for velocity jitter / noise generation.
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}

// ── Note parsing ────────────────────────────────────────────────────────────
const NOTE_IDX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

/** Note name ("A4", "F#3") → MIDI number. */
function midi(name) {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note: ${name}`);
  return NOTE_IDX[m[1]] + (parseInt(m[2], 10) + 1) * 12;
}

/** MIDI number → frequency in Hz (A4 = 440). */
const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

/**
 * Parse a melody string into [{midi|null, len16}] events.
 * DSL: "E5:2 G5:2 r:4" — note-or-rest ':' duration in sixteenths.
 */
function seq(str) {
  return str.trim().split(/\s+/).map((tok) => {
    const [n, d] = tok.split(':');
    return { m: n === 'r' ? null : midi(n), len: parseInt(d, 10) };
  });
}

// ── Oscillators / voices ────────────────────────────────────────────────────
const pulse = (f, t, duty) => ((f * t) % 1 < duty ? 1 : -1);
const tri = (f, t) => 4 * Math.abs(((f * t) % 1) - 0.5) - 1;

/**
 * Render one melodic note into buf (additive).
 * Chip-style: 2ms attack, exponential decay, optional vibrato after 150ms.
 */
function renderNote(buf, startSec, durSec, f, { wave = 'pulse', duty = 0.25, gain = 0.2, decay = 1.2, vibrato = false }) {
  const s0 = Math.floor(startSec * SR);
  const n = Math.floor(durSec * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let fr = f;
    if (vibrato && t > 0.15) fr *= 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * t);
    const env = Math.min(t / 0.002, 1) * Math.exp(-t * decay) * Math.min((durSec - t) / 0.01, 1);
    const v = wave === 'tri' ? tri(fr, t) : pulse(fr, t, duty);
    const idx = s0 + i;
    if (idx < buf.length) buf[idx] += v * env * gain;
  }
}

/** Kick drum: sine sweep 130→42 Hz, 100ms. */
function renderKick(buf, startSec, gain) {
  const s0 = Math.floor(startSec * SR);
  const n = Math.floor(0.1 * SR);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 42 + 88 * Math.exp(-t * 35);
    phase += (2 * Math.PI * f) / SR;
    const idx = s0 + i;
    if (idx < buf.length) buf[idx] += Math.sin(phase) * Math.exp(-t * 28) * gain;
  }
}

/** Snare: noise burst + 190Hz triangle body, 130ms. */
function renderSnare(buf, startSec, gain) {
  const s0 = Math.floor(startSec * SR);
  const n = Math.floor(0.13 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const v = (rand() * 2 - 1) * 0.8 + tri(190, t) * 0.4;
    const idx = s0 + i;
    if (idx < buf.length) buf[idx] += v * Math.exp(-t * 32) * gain;
  }
}

/** Hi-hat: differentiated (high-passed) noise, 25ms. */
function renderHat(buf, startSec, gain) {
  const s0 = Math.floor(startSec * SR);
  const n = Math.floor(0.025 * SR);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const white = rand() * 2 - 1;
    const hp = white - prev; // crude one-zero highpass = metallic chip hat
    prev = white;
    const idx = s0 + i;
    if (idx < buf.length) buf[idx] += hp * Math.exp(-t * 120) * gain;
  }
}

// ── Song renderer ───────────────────────────────────────────────────────────
/**
 * Render one song spec to a mono Float64Array covering exactly `bars` bars.
 *
 * Spec fields:
 *  bpm, bars (16), chords: array of chord arrays (midi numbers, one per bar,
 *  cycled), bassStyle: 'root8'|'rootFifth'|'quarters'|'ostinato16',
 *  arp: {mode:'up8'|'up16'|'off', octave, duty, gain},
 *  lead: {melody (8-bar seq for section B), duty, gain, decay},
 *  drums: {kick, snare, hat: 16-char patterns, gains, enabled},
 *  echo: {time16, feedback, level} — applied to lead+arp bus.
 */
function renderSong(spec) {
  const { bpm, bars, chords } = spec;
  const sec16 = 60 / bpm / 4; // one sixteenth
  const barSec = sec16 * 16;
  const loopSamples = Math.round(bars * barSec * SR);
  const melodic = new Float64Array(loopSamples); // lead+arp bus (gets echo)
  const dryBus = new Float64Array(loopSamples); // bass+drums (no echo)

  for (let bar = 0; bar < bars; bar++) {
    const chord = chords[bar % chords.length];
    const barStart = bar * barSec;
    const sectionB = bar >= bars / 2;

    // — Bass (triangle) —
    const root = chord[0] - 12;
    const fifth = root + 7;
    const bassOpts = { wave: 'tri', gain: spec.bassGain ?? 0.2, decay: 0.8 };
    if (spec.bassStyle === 'root8') {
      for (let i = 0; i < 8; i++) renderNote(dryBus, barStart + i * 2 * sec16, sec16 * 1.7, freq(root), bassOpts);
    } else if (spec.bassStyle === 'rootFifth') {
      for (let i = 0; i < 8; i++) renderNote(dryBus, barStart + i * 2 * sec16, sec16 * 1.7, freq(i % 2 ? fifth : root), bassOpts);
    } else if (spec.bassStyle === 'quarters') {
      // Walking-ish: root, root, fifth, approach (chord 3rd)
      const steps = [root, root, fifth, chord[1] - 12];
      for (let i = 0; i < 4; i++) renderNote(dryBus, barStart + i * 4 * sec16, sec16 * 3.4, freq(steps[i]), bassOpts);
    } else if (spec.bassStyle === 'ostinato16') {
      // Driving synthwave 16ths: r r r5 r pattern, octave jump on beat 3
      const pat = [root, root, fifth, root, root + 12, root, fifth, root];
      for (let i = 0; i < 16; i++) renderNote(dryBus, barStart + i * sec16, sec16 * 0.85, freq(pat[i % 8]), bassOpts);
    }

    // — Arp (pulse) —
    if (spec.arp.mode !== 'off') {
      const tones = chord.map((m) => m + (spec.arp.octave ?? 0) * 12);
      const arpOpts = { duty: spec.arp.duty ?? 0.5, gain: spec.arp.gain ?? 0.11, decay: 2.5 };
      if (spec.arp.mode === 'up8') {
        for (let i = 0; i < 8; i++) renderNote(melodic, barStart + i * 2 * sec16, sec16 * 1.6, freq(tones[i % tones.length]), arpOpts);
      } else {
        // up16: up-down over 16ths
        const cycle = [...tones, tones[1] + 12, ...[...tones].reverse()];
        for (let i = 0; i < 16; i++) renderNote(melodic, barStart + i * sec16, sec16 * 0.9, freq(cycle[i % cycle.length]), arpOpts);
      }
    }

    // — Drums —
    if (spec.drums) {
      const { kick = '', snare = '', hat = '' } = spec.drums;
      for (let i = 0; i < 16; i++) {
        const t = barStart + i * sec16;
        if (kick[i] === 'x') renderKick(dryBus, t, spec.drums.kickGain ?? 0.5);
        if (snare[i] === 'x') renderSnare(dryBus, t, spec.drums.snareGain ?? 0.28);
        if (hat[i] === 'x') renderHat(dryBus, t, (spec.drums.hatGain ?? 0.1) * (i % 4 === 0 ? 1 : 0.7));
      }
    }

    // — Lead melody (section B only) —
    if (sectionB && spec.lead && bar === bars / 2) {
      // Render the whole 8-bar melody once, anchored at section B start.
      let cursor = barStart;
      const total = spec.lead.melody.reduce((a, e) => a + e.len, 0);
      if (total !== (bars / 2) * 16) throw new Error(`${spec.name}: melody is ${total} sixteenths, expected ${(bars / 2) * 16}`);
      for (const ev of spec.lead.melody) {
        if (ev.m !== null) {
          renderNote(melodic, cursor, ev.len * sec16 * 0.92, freq(ev.m), {
            duty: spec.lead.duty ?? 0.25,
            gain: spec.lead.gain ?? 0.2,
            decay: spec.lead.decay ?? 1.0,
            vibrato: true,
          });
        }
        cursor += ev.len * sec16;
      }
    }
  }

  // — Echo on the melodic bus, rendered over two loop passes so the tail
  //   wraps around the loop point (pass 2 is what we keep). —
  const echo = spec.echo ?? { time16: 3, feedback: 0.3, level: 0.35 };
  const delaySamples = Math.round(echo.time16 * sec16 * SR);
  const out = new Float64Array(loopSamples);
  const echoBuf = new Float64Array(delaySamples);
  let w = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < loopSamples; i++) {
      const dryV = melodic[i];
      const echoed = echoBuf[w];
      echoBuf[w] = dryV + echoed * echo.feedback;
      w = (w + 1) % delaySamples;
      if (pass === 1) out[i] = dryV + echoed * echo.level + dryBus[i];
    }
  }

  // — Normalize to peak 0.88 —
  let peak = 0;
  for (let i = 0; i < loopSamples; i++) peak = Math.max(peak, Math.abs(out[i]));
  const norm = peak > 0 ? 0.88 / peak : 1;
  const pcm = new Int16Array(loopSamples);
  for (let i = 0; i < loopSamples; i++) pcm[i] = Math.round(Math.max(-1, Math.min(1, out[i] * norm)) * 32767);
  return pcm;
}

// ── WAV writer ──────────────────────────────────────────────────────────────
function writeWav(path, pcm) {
  const dataSize = pcm.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  Buffer.from(pcm.buffer).copy(buf, 44);
  writeFileSync(path, buf);
}

// ── Chord helper: build triads from note names ──────────────────────────────
const chord = (...names) => names.map(midi);

// ── Songs ───────────────────────────────────────────────────────────────────
// Melodies are authored per song, 8 bars (128 sixteenths) each, chord tones on
// strong beats. Validated at render time.

const SONGS = [
  {
    // Menu — calm CRT glow. A minor, slow soft arp, no drums, no lead.
    name: 'menu',
    bpm: 92,
    bars: 16,
    chords: [chord('A3', 'C4', 'E4'), chord('F3', 'A3', 'C4'), chord('C4', 'E4', 'G4'), chord('G3', 'B3', 'D4')],
    bassStyle: 'quarters',
    bassGain: 0.16,
    arp: { mode: 'up8', octave: 1, duty: 0.5, gain: 0.12 },
    lead: {
      duty: 0.5,
      gain: 0.13,
      decay: 0.7,
      melody: seq(`
        E5:8 r:4 C5:4  D5:8 A4:8  G4:8 r:4 E4:4  B4:12 r:4
        E5:8 r:4 G5:4  A5:8 E5:8  D5:4 E5:4 C5:8  A4:12 r:4`),
    },
    echo: { time16: 4, feedback: 0.35, level: 0.4 },
  },
  {
    // Zone 1 — Les pionniers du web (1990s). Bright, optimistic. C major.
    name: 'zone_01',
    bpm: 118,
    bars: 16,
    chords: [chord('C4', 'E4', 'G4'), chord('G3', 'B3', 'D4'), chord('A3', 'C4', 'E4'), chord('F3', 'A3', 'C4')],
    bassStyle: 'rootFifth',
    arp: { mode: 'up8', octave: 1, duty: 0.5, gain: 0.1 },
    lead: {
      duty: 0.25,
      gain: 0.2,
      melody: seq(`
        E5:4 G5:2 E5:2 C5:4 E5:4  D5:4 B4:2 D5:2 G5:6 r:2
        C5:4 E5:2 C5:2 A4:4 C5:4  A4:2 C5:2 D5:2 E5:2 F5:6 r:2
        E5:4 G5:2 E5:2 C5:4 G5:4  B4:4 D5:2 B4:2 G4:6 r:2
        A4:2 C5:2 E5:2 A5:2 G5:4 E5:4  F5:2 E5:2 D5:2 B4:2 C5:8`),
    },
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
  },
  {
    // Zone 2 — Les fondations (1950s-70s). Mysterious, sparse. D Andalusian.
    name: 'zone_02',
    bpm: 84,
    bars: 16,
    chords: [chord('D3', 'F3', 'A3'), chord('C3', 'E3', 'G3'), chord('Bb2', 'D3', 'F3'), chord('A2', 'C#3', 'E3')],
    bassStyle: 'quarters',
    bassGain: 0.19,
    arp: { mode: 'up8', octave: 2, duty: 0.5, gain: 0.09 },
    lead: {
      duty: 0.5,
      gain: 0.17,
      decay: 0.8,
      melody: seq(`
        D5:6 F5:2 E5:4 D5:4  C5:8 G4:4 r:4
        F4:6 A4:2 D5:4 C5:4  A4:6 E4:2 A4:4 r:4
        D5:4 E5:4 F5:4 A5:4  G5:6 E5:2 C5:4 r:4
        F5:4 D5:4 E5:2 D5:2 C#5:4  D5:8 A4:4 r:4`),
    },
    drums: { kick: 'x.......x.......', snare: '........x.......', hat: '..x...x...x...x.', hatGain: 0.06, snareGain: 0.14 },
    echo: { time16: 6, feedback: 0.4, level: 0.45 },
  },
  {
    // Zone 3 — L'ère des systèmes (1980s). Synthwave chip, driving. A minor.
    name: 'zone_03',
    bpm: 112,
    bars: 16,
    chords: [chord('A3', 'C4', 'E4'), chord('F3', 'A3', 'C4'), chord('C4', 'E4', 'G4'), chord('G3', 'B3', 'D4')],
    bassStyle: 'ostinato16',
    bassGain: 0.21,
    arp: { mode: 'up16', octave: 1, duty: 0.25, gain: 0.08 },
    lead: {
      duty: 0.25,
      gain: 0.21,
      melody: seq(`
        A4:6 C5:2 E5:4 D5:2 C5:2  B4:6 D5:2 B4:4 G4:4
        C5:6 E5:2 G5:4 E5:4  D5:2 E5:2 D5:2 B4:2 G4:8
        A4:4 E5:4 A5:4 G5:2 E5:2  F5:6 E5:2 D5:4 C5:4
        E5:4 D5:2 C5:2 B4:4 D5:4  A4:2 B4:2 C5:2 B4:2 A4:8`),
    },
    drums: { kick: 'x...x...x...x..x', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', kickGain: 0.55 },
    echo: { time16: 3, feedback: 0.35, level: 0.4 },
  },
  {
    // Zone 4 — L'explosion du web (1990s-2000s). Energetic. E minor / G major.
    name: 'zone_04',
    bpm: 132,
    bars: 16,
    chords: [chord('E3', 'G3', 'B3'), chord('C4', 'E4', 'G4'), chord('G3', 'B3', 'D4'), chord('D4', 'F#4', 'A4')],
    bassStyle: 'root8',
    arp: { mode: 'up16', octave: 1, duty: 0.5, gain: 0.09 },
    lead: {
      duty: 0.25,
      gain: 0.2,
      melody: seq(`
        E5:2 G5:2 E5:2 B4:2 E5:4 D5:2 B4:2  C5:2 E5:2 G5:2 E5:2 G5:6 r:2
        B4:2 D5:2 G5:2 D5:2 B5:4 A5:2 G5:2  A5:2 F#5:2 D5:2 A4:2 D5:6 r:2
        E5:2 G5:2 B5:2 G5:2 E5:4 G5:4  G5:2 E5:2 C5:2 E5:2 G5:6 r:2
        B5:4 A5:2 G5:2 F#5:4 A5:4  G5:2 F#5:2 E5:2 D5:2 E5:8`),
    },
    drums: { kick: 'x...x...x...x...', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.xx' },
  },
  {
    // Zone 5 — L'ère moderne (2010s+). Airy, bright. F lydian flavour.
    name: 'zone_05',
    bpm: 124,
    bars: 16,
    chords: [chord('F3', 'A3', 'C4'), chord('G3', 'B3', 'D4'), chord('A3', 'C4', 'E4'), chord('C4', 'E4', 'G4')],
    bassStyle: 'rootFifth',
    arp: { mode: 'up16', octave: 1, duty: 0.5, gain: 0.1 },
    lead: {
      duty: 0.5,
      gain: 0.18,
      decay: 0.7,
      melody: seq(`
        A5:6 G5:2 F5:4 C5:4  B4:8 D5:4 r:4
        C5:6 E5:2 A5:4 G5:4  E5:8 G5:4 r:4
        F5:4 A5:4 C6:4 A5:4  B5:6 G5:2 D5:4 r:4
        A5:4 G5:2 E5:2 C5:4 E5:4  G5:2 E5:2 D5:2 E5:2 C5:8`),
    },
    drums: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', hatGain: 0.08 },
    echo: { time16: 4, feedback: 0.3, level: 0.38 },
  },
];

// ── Main ────────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
for (const song of SONGS) {
  seed = 0x2bad5eed; // reset PRNG per song → per-song determinism
  const pcm = renderSong(song);
  const wav = join(OUT_DIR, `${song.name}.wav`);
  writeWav(wav, pcm);
  const dur = (pcm.length / SR).toFixed(2);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', '4', join(OUT_DIR, `music-${song.name}.ogg`)]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '128k', join(OUT_DIR, `music-${song.name}.mp3`)]);
  rmSync(wav);
  console.log(`music-${song.name}: ${dur}s @ ${song.bpm} BPM`);
}
console.log('done.');

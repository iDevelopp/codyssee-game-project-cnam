import Phaser from 'phaser';
import { ContentLoader } from '@/systems/ContentLoader';
import { SaveSystem } from '@/systems/SaveSystem';
import { GameEvents } from '@/systems/GameEvents';
import type { AudioManifest, SynthRecipe } from '@/systems/ContentLoader';
import type { XpChange } from '@/systems/XpSystem';

/**
 * AudioManager — data-driven, event-wired audio system for Codyssey Web.
 *
 * Design goals (TASK-016):
 * - No hardcoded filenames: all sound keys and paths come from content/audio.json
 *   via ContentLoader.getAudioManifest(). The engine is fully decoupled from asset names.
 * - Graceful: if audio.json is missing, or a specific file fails to load, the
 *   manager logs once and continues — audio must never crash the game.
 * - Autoplay policy: music starts only after the first user interaction
 *   (pointerdown or keydown). Phaser's sound.unlock() handles the AudioContext
 *   resume; we track whether the context is already unlocked to avoid duplicate starts.
 * - Volume + mute: persisted in SaveSystem (codyssee.save.v1). Restored on boot.
 * - Mute toggle: M key. A settings UI can expose a slider later (J3+).
 *
 * Lifecycle:
 *  1. PreloadScene calls AudioManager.getInstance().queuePreload(scene)
 *     → queues all audio files from the manifest into Phaser's loader.
 *  2. After PreloadScene finishes, AudioManager.getInstance().init(scene)
 *     → binds GameEvents and restores saved volume/mute.
 *  3. Any scene can call AudioManager.getInstance().playMusic(key)
 *     → switches to that looping track (menu theme, per-zone theme). Safe to
 *     call before unlock; it will auto-start once the browser unlocks audio.
 *
 * Singleton: one instance per game session (matches SaveSystem pattern).
 */
export class AudioManager {
  private static instance: AudioManager | null = null;

  /** Phaser sound objects keyed by manifest key (e.g. 'sfx.interact'). */
  private sounds: Map<string, Phaser.Sound.BaseSound> = new Map();

  /** Manifest key of the music track currently playing (or requested), if any. */
  private currentMusicKey: string | null = null;

  /**
   * Music key requested before the browser unlocked audio. On unlock, this
   * track auto-starts (browser autoplay policy: no sound before user gesture).
   */
  private pendingMusicKey: string | null = null;

  /** True once the Phaser scene reference is available for sound operations. */
  private initialized = false;

  /** Phaser scene reference — stored so we can manipulate the sound manager. */
  private scene: Phaser.Scene | null = null;

  /** Whether we have already logged a "no manifest" warning (log-once guard). */
  private noManifestWarned = false;

  private constructor() {}

  /** Singleton accessor. */
  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  // ---------------------------------------------------------------------------
  // Phase 1 — Preload (called from PreloadScene.preload())
  // ---------------------------------------------------------------------------

  /**
   * Queues all audio files from content/audio.json into Phaser's loader.
   *
   * Must be called during PreloadScene.preload() — before the Phaser loader
   * starts, so all files are part of the same loading batch.
   *
   * Uses .ogg/.mp3 array format for automatic browser fallback:
   * Phaser tries the first format; if unsupported, falls back to the next.
   * This ensures Firefox (prefers OGG) and Safari/Edge (prefer MP3) both work.
   *
   * Graceful: if the manifest is null (audio.json missing) we log once and skip.
   *
   * @param scene - The PreloadScene instance (provides access to this.load)
   */
  queuePreload(scene: Phaser.Scene): void {
    const manifest = this._getManifest();
    if (!manifest) return; // warning already logged by _getManifest()

    const base = import.meta.env.BASE_URL;

    for (const [key, entry] of Object.entries(manifest)) {
      if (!Array.isArray(entry.files) || entry.files.length === 0) {
        console.warn(`AudioManager: manifest entry "${key}" has no files — skipping.`);
        continue;
      }

      // Build absolute URLs: manifest paths are relative to the web root
      // (e.g. "assets/audio/ambient.ogg") so we prepend BASE_URL.
      const urls = entry.files.map((f) => `${base}${f}`);

      try {
        // Phaser accepts an array of urls and picks the first it can decode.
        // This is the canonical OGG→MP3 fallback pattern for Phaser 3.
        scene.load.audio(key, urls);
      } catch (e) {
        // load.audio() is synchronous (just queues); catching defensively.
        console.warn(`AudioManager: failed to queue "${key}":`, e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 2 — Init (called from the first gameplay scene's create())
  // ---------------------------------------------------------------------------

  /**
   * Initializes the audio system: creates Phaser sound objects, restores saved
   * audio preferences, and wires up GameEvents → SFX.
   *
   * Safe to call even if queuePreload() was skipped (graceful no-op for missing sounds).
   * Should be called once after PreloadScene completes — e.g. from MainMenuScene.create().
   *
   * @param scene - Any active Phaser scene (for sound manager access)
   */
  init(scene: Phaser.Scene): void {
    if (this.initialized) return;
    this.initialized = true;
    this.scene = scene;

    const manifest = this._getManifest();
    if (!manifest) return;

    const save = SaveSystem.getInstance();

    // Create Phaser sound objects for every manifest key that was successfully loaded.
    for (const [key, entry] of Object.entries(manifest)) {
      if (!scene.sound.get(key) && !scene.cache.audio.exists(key)) {
        // Sound file failed to load (network error, missing file) — skip gracefully.
        console.warn(`AudioManager: audio "${key}" not in cache — skipping.`);
        continue;
      }

      const soundObj = scene.sound.add(key, {
        loop: entry.loop,
        volume: entry.volume,
      });

      this.sounds.set(key, soundObj);
    }

    // Restore saved volume and mute state.
    this._applyVolume(save.getMasterVolume());
    if (save.getMuted()) {
      this._applyMute(true);
    }

    // Wire GameEvents to SFX.
    this._bindEvents(scene);

    // Handle browser autoplay policy: Phaser emits 'unlocked' on the sound manager
    // once the AudioContext is resumed after a user gesture.
    scene.sound.once('unlocked', () => {
      if (this.pendingMusicKey) {
        const key = this.pendingMusicKey;
        this.pendingMusicKey = null;
        this._switchMusic(key);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Music
  // ---------------------------------------------------------------------------

  /**
   * Play a looping music track by manifest key (e.g. 'music.zone_01'),
   * stopping whichever track was playing before (hard cut, chiptune-style).
   *
   * - No-op if the requested track is already the current one.
   * - Graceful if the key is missing (file failed to load): current music keeps
   *   playing, a warning is logged in dev.
   * - Autoplay-safe: if the browser AudioContext is still suspended (no user
   *   gesture yet), the request is deferred and starts on Phaser's 'unlocked'.
   * - Mute-safe: a muted track still starts (at volume 0) so unmuting resumes
   *   music seamlessly without a restart.
   *
   * Scenes call this on entry: MainMenuScene → 'music.menu', ZoneScene → the
   * zone's `music` key from content/zones/zone_0X.json.
   */
  playMusic(key: string): void {
    if (!this.sounds.has(key)) {
      if (import.meta.env.DEV) {
        console.warn(`AudioManager.playMusic(): key "${key}" not found.`);
      }
      return;
    }

    // Dev/test hook — mirrors play()'s __audioCalls audit log (see play()).
    if (import.meta.env.DEV) {
      const w = window as unknown as { __audioCalls?: string[] };
      if (!w.__audioCalls) w.__audioCalls = [];
      w.__audioCalls.push(key);
      if (w.__audioCalls.length > 200) w.__audioCalls.shift();
    }

    const current = this.currentMusicKey ? this.sounds.get(this.currentMusicKey) : null;
    if (this.currentMusicKey === key && (current?.isPlaying || this.pendingMusicKey === key)) {
      return; // already playing (or already queued for unlock)
    }

    // Check if the AudioContext is ready (state === 'running').
    // On Web Audio, context.state is 'suspended' before first user gesture.
    const soundManager = this.scene?.sound as Phaser.Sound.WebAudioSoundManager | undefined;
    const contextReady = !soundManager?.context || soundManager.context.state === 'running';

    if (contextReady) {
      this._switchMusic(key);
    } else {
      // Defer until Phaser's 'unlocked' event fires (handler set in init()).
      this.pendingMusicKey = key;
      this.currentMusicKey = key;
    }
  }

  /**
   * Stop the current music track, if any. Safe to call when nothing plays.
   */
  stopMusic(): void {
    this.pendingMusicKey = null;
    if (this.currentMusicKey) {
      this.sounds.get(this.currentMusicKey)?.stop();
      this.currentMusicKey = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Volume & mute
  // ---------------------------------------------------------------------------

  /**
   * Set master volume and persist it.
   *
   * @param volume - Value in [0, 1]. Clamped automatically.
   */
  setMasterVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this._applyVolume(clamped);
    SaveSystem.getInstance().saveMasterVolume(clamped);
  }

  /**
   * Toggle global mute on/off and persist the new state.
   *
   * @returns The new muted state.
   */
  toggleMute(): boolean {
    const save = SaveSystem.getInstance();
    const nowMuted = save.toggleMuted();
    this._applyMute(nowMuted);
    return nowMuted;
  }

  /** Returns true if audio is currently muted. */
  isMuted(): boolean {
    return SaveSystem.getInstance().getMuted();
  }

  // ---------------------------------------------------------------------------
  // SFX playback
  // ---------------------------------------------------------------------------

  /**
   * Play a sound by its manifest key (e.g. 'sfx.interact').
   *
   * Graceful: logs a warning and returns silently if the key is not found
   * (avoids crashes when audio files are missing in development).
   *
   * Dev/test hook: every call to play() appends the key to window.__audioCalls
   * (initialised as an empty array on first use). This lets Playwright/headless
   * tests assert event→sound wiring even when the AudioContext is suspended and
   * no actual audio plays. The array is bounded to the last 200 entries to avoid
   * memory growth in long sessions. This block is compiled away in production
   * builds by Vite's dead-code elimination when import.meta.env.DEV is false.
   *
   * @param key - The manifest key from content/audio.json
   */
  play(key: string): void {
    // Dev-only audit log — lets Playwright assert event→sound wiring headless.
    if (import.meta.env.DEV) {
      const w = window as unknown as { __audioCalls?: string[] };
      if (!w.__audioCalls) w.__audioCalls = [];
      w.__audioCalls.push(key);
      // Keep the log bounded so it doesn't grow unboundedly in long sessions.
      if (w.__audioCalls.length > 200) w.__audioCalls.shift();
    }

    if (this.isMuted()) return;

    const sound = this.sounds.get(key);
    if (!sound) {
      // Not a file-based sound — try a procedural recipe (synth-sfx.json).
      const recipe = this._getSynthRecipe(key);
      if (recipe) {
        this._playSynth(recipe);
        return;
      }
      // Only warn in dev — in prod a missing SFX is not catastrophic.
      if (import.meta.env.DEV) {
        console.warn(`AudioManager.play(): key "${key}" not found.`);
      }
      return;
    }

    // For looping sounds (ambient), play() would restart — use start/stop instead.
    // SFX are non-looping so play() is correct (plays once from the beginning).
    try {
      sound.play();
    } catch (e) {
      console.warn(`AudioManager: could not play "${key}":`, e);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Retrieve the audio manifest from ContentLoader.
   * Returns null and logs once if the manifest is unavailable.
   */
  private _getManifest(): AudioManifest | null {
    try {
      const manifest = ContentLoader.getInstance().getAudioManifest();
      if (!manifest && !this.noManifestWarned) {
        this.noManifestWarned = true;
        console.warn('AudioManager: content/audio.json not found or failed to load. Audio disabled.');
      }
      return manifest;
    } catch {
      // ContentLoader not loaded yet (should not happen in normal flow).
      if (!this.noManifestWarned) {
        this.noManifestWarned = true;
        console.warn('AudioManager: ContentLoader not ready. Audio disabled.');
      }
      return null;
    }
  }

  /**
   * Wire GameEvents to SFX callbacks.
   * Called once during init(). All listeners are on game.events (global bus)
   * so they survive scene transitions (UIScene, MainMenuScene).
   *
   * Event→sound mapping:
   *  PLAYER_INTERACT → sfx.interact  (E press that starts NPC/door dialogue)
   *  NPC_RESOLVED    → sfx.correct   (correct card selected)
   *  ANSWER_WRONG    → sfx.wrong     (wrong card selected)
   *  DOOR_OPEN       → sfx.door      (door unlocks when all NPCs helped)
   *
   * @param scene - Scene whose game.events bus we listen on
   */
  private _bindEvents(scene: Phaser.Scene): void {
    const ev = scene.game.events;

    // E key triggers interaction → play interaction blip
    ev.on(GameEvents.PLAYER_INTERACT, () => {
      this.play('sfx.interact');
    });

    // Correct card picked → positive confirmation sound
    ev.on(GameEvents.NPC_RESOLVED, () => {
      this.play('sfx.correct');
    });

    // Wrong card picked → error/buzz sound
    ev.on(GameEvents.ANSWER_WRONG, () => {
      this.play('sfx.wrong');
    });

    // Door unlocks (all NPCs helped) → door-open sound
    ev.on(GameEvents.DOOR_OPEN, () => {
      this.play('sfx.door');
    });

    // ---- feat/sfx-feedback: one distinct cue per key action ----

    // Each dialogue line → short typewriter tick
    ev.on(GameEvents.DIALOGUE_OPEN, () => this.play('sfx.dialogueLine'));

    // Card selection opens → rising arpeggio
    ev.on(GameEvents.DECK_OPEN, () => this.play('sfx.deckOpen'));

    // ESC / close button left a conversation → falling two-note
    ev.on(GameEvents.DIALOGUE_CANCEL, () => this.play('sfx.cancel'));

    // XP gained / lost → coin / low buzz (refresh events have delta 0)
    ev.on(GameEvents.XP_CHANGED, (change: XpChange) => {
      if (change.delta > 0) this.play('sfx.xpGain');
      else if (change.delta < 0) this.play('sfx.xpLoss');
    });

    // Walking through an open door → upward sweep
    ev.on(GameEvents.ZONE_TRANSITION, () => this.play('sfx.zoneTransition'));

    // Timeline frieze open / close
    ev.on(GameEvents.TIMELINE_OPEN, () => this.play('sfx.timelineOpen'));
    ev.on(GameEvents.TIMELINE_CLOSE, () => this.play('sfx.timelineClose'));

    // Final zone cleared → fanfare
    ev.on(GameEvents.GAME_COMPLETE, () => this.play('sfx.victory'));

    // Any UI button (menu, end screen, deck close…) → click (file-based)
    ev.on(GameEvents.UI_CLICK, () => this.play('sfx.uiClick'));

    // Coffee → warm rising bubble
    ev.on(GameEvents.COFFEE_DRUNK, () => this.play('sfx.coffee'));

    // Action refused (e.g. not enough XP) → double low beep
    ev.on(GameEvents.ACTION_DENIED, () => this.play('sfx.denied'));
  }

  /** Look up a procedural recipe; null if content is not loaded or key unknown. */
  private _getSynthRecipe(key: string): SynthRecipe | null {
    try {
      return ContentLoader.getInstance().getSynthManifest()[key] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Play a procedural recipe with the Web Audio API: one oscillator per note,
   * scheduled back to back, with a short attack/release envelope to avoid
   * clicks. Honours master volume (mute is checked by play()).
   * Silently does nothing on non-WebAudio sound managers.
   */
  private _playSynth(recipe: SynthRecipe): void {
    const mgr = this.scene?.sound as Phaser.Sound.WebAudioSoundManager | undefined;
    const ctx = mgr && 'context' in mgr ? mgr.context : null;
    if (!ctx || ctx.state !== 'running') return;

    const gainValue = recipe.volume * SaveSystem.getInstance().getMasterVolume();
    if (gainValue <= 0) return;

    let t = ctx.currentTime;
    for (const [freq, ms] of recipe.notes) {
      const dur = Math.max(ms, 10) / 1000;
      if (freq > 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = recipe.wave;
        osc.frequency.setValueAtTime(freq, t);
        if (recipe.slideTo && recipe.slideTo > 0) {
          osc.frequency.exponentialRampToValueAtTime(freq * recipe.slideTo, t + dur);
        }
        const attack = Math.min(0.005, dur / 4);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(gainValue, t + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      }
      t += dur;
    }
  }

  /**
   * Apply a master volume multiplier to all sound objects.
   * Scales each sound relative to its authored volume from the manifest,
   * so relative volumes between SFX and music are preserved.
   *
   * @param masterVolume - [0, 1]
   */
  private _applyVolume(masterVolume: number): void {
    const manifest = this._getManifest();
    if (!manifest) return;

    for (const [key, sound] of this.sounds) {
      const authored = manifest[key]?.volume ?? 1;
      // Cast to typed sound: BaseSound has no volume property in the abstract type,
      // but both WebAudioSound and HTML5AudioSound do.
      (sound as unknown as { volume: number }).volume = authored * masterVolume;
    }
  }

  /**
   * Apply or clear the global mute.
   *
   * We mute all individual sounds rather than using scene.sound.mute so
   * we don't interfere with Phaser internals or other scenes' sound managers.
   *
   * @param muted - True to silence all sounds, false to restore volume.
   */
  private _applyMute(muted: boolean): void {
    const manifest = this._getManifest();
    const masterVolume = SaveSystem.getInstance().getMasterVolume();

    for (const [key, sound] of this.sounds) {
      const authored = manifest?.[key]?.volume ?? 1;
      (sound as unknown as { volume: number }).volume = muted ? 0 : authored * masterVolume;
    }
  }

  /**
   * Actually switch music tracks. Called once the AudioContext is ready.
   * Respects mute state: a muted track plays at volume 0 (set by _applyMute)
   * so it can seamlessly resume when unmuted (no gap/restart needed).
   */
  private _switchMusic(key: string): void {
    if (this.currentMusicKey && this.currentMusicKey !== key) {
      this.sounds.get(this.currentMusicKey)?.stop();
    }
    this.currentMusicKey = key;

    const track = this.sounds.get(key);
    if (!track || track.isPlaying) return;

    try {
      track.play();
    } catch (e) {
      console.warn(`AudioManager: could not start music "${key}":`, e);
    }
  }
}

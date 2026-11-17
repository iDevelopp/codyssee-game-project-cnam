/**
 * p3-zone-music.spec.js — E2E Playwright QA for phase 3 (zone music).
 *
 * Criteria:
 *  M1. All 6 music keys (menu + 5 zones) + 5 SFX keys present in Phaser cache.
 *  M2. Menu theme starts after first user gesture (autoplay unlock) and is
 *      the only music playing.
 *  M3. Entering zone_01 via "Jouer" switches music.menu → music.zone_01
 *      (old track stopped, new one playing).
 *  M4. Restarting ZoneScene with zoneId=zone_02 switches to music.zone_02
 *      (exercises the generic per-zone switch path).
 *  M5. Mute (M key) persists to the save and survives the music switch.
 *  M6. No console errors.
 *
 * Must run against `vite dev` (not preview): the __audioCalls audit hook in
 * AudioManager is compiled out of prod builds (import.meta.env.DEV).
 *
 * Run standalone: node web/tests/e2e/p3-zone-music.spec.js
 * (expects the dev server on http://localhost:5199/, started by the runner)
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:5199/play/';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const CANVAS_WAIT = 3500;
const TRANSITION_WAIT = 2200; // fade-out + scene init + fade-in + margin
const SHORT_WAIT = 500;

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const MUSIC_KEYS = [
  'music.menu',
  'music.zone_01',
  'music.zone_02',
  'music.zone_03',
  'music.zone_04',
  'music.zone_05',
];
const SFX_KEYS = ['sfx.interact', 'sfx.correct', 'sfx.wrong', 'sfx.door', 'sfx.uiClick'];

// ── Helpers ──────────────────────────────────────────────────────────────────

let screenshotIndex = 0;
const results = [];
const pageErrors = [];

async function screenshot(page, label) {
  screenshotIndex++;
  const name = `p3-${String(screenshotIndex).padStart(3, '0')}-${label}.png`;
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, name) });
  return name;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function check(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`  ${ok ? '✅' : '❌'} ${id}: ${detail}`);
}

/** Keys of all currently-playing sounds in the Phaser sound manager. */
async function playingKeys(page) {
  return page.evaluate(() =>
    window.__game.sound.sounds.filter((s) => s.isPlaying).map((s) => s.key)
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') pageErrors.push(m.text());
  });

  await page.goto(BASE_URL);
  await wait(CANVAS_WAIT);

  // ── M1: all audio keys in cache ──
  const cached = await page.evaluate(
    (keys) => keys.map((k) => [k, window.__game.cache.audio.exists(k)]),
    [...MUSIC_KEYS, ...SFX_KEYS]
  );
  const missing = cached.filter(([, ok]) => !ok).map(([k]) => k);
  check('M1', missing.length === 0, missing.length ? `missing from cache: ${missing}` : `${cached.length} audio keys cached`);

  // ── M2: menu theme after unlock ──
  const canvas = page.locator('canvas');
  await canvas.click({ position: { x: 400, y: 300 } }); // user gesture → unlock
  await wait(SHORT_WAIT);
  let playing = await playingKeys(page);
  check('M2', playing.length === 1 && playing[0] === 'music.menu', `playing after unlock: [${playing}]`);
  await screenshot(page, 'menu');

  // ── M3: Jouer → zone_01 music ──
  await canvas.click({ position: { x: 640, y: 418 } }); // "Jouer" button
  await wait(SHORT_WAIT);
  // New game shows the intro narrative overlay (4 slides) — one keypress per
  // slide; ZoneScene starts only after the last one is dismissed.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Space');
    await wait(SHORT_WAIT);
  }
  await wait(TRANSITION_WAIT);
  playing = await playingKeys(page);
  check('M3', playing.length === 1 && playing[0] === 'music.zone_01', `playing in zone 1: [${playing}]`);
  await screenshot(page, 'zone1');

  // ── M4: generic switch path — restart ZoneScene on zone_02 ──
  await page.evaluate(() => {
    const zs = window.__game.scene.getScenes(true).find((s) => s.zoneData);
    zs.scene.restart({ zoneId: 'zone_02' });
  });
  await wait(TRANSITION_WAIT);
  playing = await playingKeys(page);
  check('M4', playing.length === 1 && playing[0] === 'music.zone_02', `playing in zone 2: [${playing}]`);
  await screenshot(page, 'zone2');

  // ── M5: mute persists and music stays switched ──
  await canvas.click({ position: { x: 400, y: 300 } }); // refocus canvas
  await page.keyboard.down('m');
  await wait(80);
  await page.keyboard.up('m');
  await wait(SHORT_WAIT);
  const muted = await page.evaluate(() => {
    const raw = localStorage.getItem('codyssee.save.v1');
    return raw ? JSON.parse(raw).muted === true : false;
  });
  // Muted music keeps "playing" at volume 0 (seamless unmute) — check volume.
  const vol = await page.evaluate(
    () => window.__game.sound.sounds.find((s) => s.key === 'music.zone_02')?.volume
  );
  check('M5', muted && vol === 0, `muted=${muted}, zone_02 volume=${vol}`);

  // ── M6: no console errors ──
  check('M6', pageErrors.length === 0, pageErrors.length ? pageErrors.slice(0, 3).join(' | ') : 'console clean');

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? '\nALL CHECKS PASSED' : `\n${failed.length} CHECK(S) FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
})();

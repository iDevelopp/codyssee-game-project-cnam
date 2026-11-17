/**
 * p6-tuning.spec.js — E2E QA for playtest tuning (volume, speed, [E] highlight).
 *
 * Criteria:
 *  T1. Authored volumes lowered: music ≤ 0.20, SFX ≤ 0.60 in content/audio.json.
 *  T2. Player speed: velocity.x = 240 while holding right.
 *  T3. Proximity highlight: walking into range of an NPC shows the [E] prompt
 *      (and the outline glow), leaving range hides it.
 *  T4. No console errors.
 *
 * Run standalone: node web/tests/e2e/p6-tuning.spec.js
 * (expects the dev server on http://localhost:5199/, started by the runner)
 */

const { chromium } = require('playwright');

const BASE = 'http://localhost:5199';
const CANVAS_WAIT = 3500;
const TRANSITION_WAIT = 2200;
const SHORT_WAIT = 500;

const results = [];
const pageErrors = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function check(id, ok, detail) {
  results.push({ id, ok });
  console.log(`  ${ok ? '✅' : '❌'} ${id}: ${detail}`);
}

const zoneEval = (fn) => `
  (() => {
    const zs = window.__game.scene.getScenes(true).find((s) => s.zoneData);
    return (${fn})(zs);
  })()`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') pageErrors.push(m.text());
  });

  // ── T1: manifest volumes ──
  const manifest = await (await fetch(`${BASE}/content/audio.json`)).json();
  const musicOk = Object.entries(manifest).filter(([k]) => k.startsWith('music.')).every(([, e]) => e.volume <= 0.2);
  const sfxOk = Object.entries(manifest).filter(([k]) => k.startsWith('sfx.')).every(([, e]) => e.volume <= 0.6);
  check('T1', musicOk && sfxOk, `music ≤0.20: ${musicOk}, sfx ≤0.60: ${sfxOk}`);

  // Enter the game
  await page.goto(`${BASE}/play/`);
  await wait(CANVAS_WAIT);
  const canvas = page.locator('canvas');
  await canvas.click({ position: { x: 400, y: 300 } });
  await wait(SHORT_WAIT);
  await canvas.click({ position: { x: 640, y: 418 } });
  await wait(SHORT_WAIT);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Space');
    await wait(SHORT_WAIT);
  }
  await wait(TRANSITION_WAIT);

  // ── T2: speed while holding right ──
  await page.keyboard.down('ArrowRight');
  await wait(300);
  const vx = await page.evaluate(zoneEval("(zs) => zs.children.list.find(o => o.texture && o.texture.key === 'player').body.velocity.x"));
  await page.keyboard.up('ArrowRight');
  check('T2', vx === 240, `velocity.x while moving right: ${vx} (want 240)`);

  // ── T3: [E] prompt near an NPC ──
  const promptState = () =>
    page.evaluate(zoneEval("(zs) => { const t = zs.children.list.find(o => o.type === 'Text' && o.text === '[E]'); return t ? t.visible : null; }"));

  // Teleport next to npc_lea (2139, 296) — inside the 240px interaction radius
  await page.evaluate(zoneEval("(zs) => zs.children.list.find(o => o.texture && o.texture.key === 'player').body.reset(2000, 296)"));
  await wait(400);
  const near = await promptState();
  // Teleport back to spawn — out of range of everything
  await page.evaluate(zoneEval("(zs) => zs.children.list.find(o => o.texture && o.texture.key === 'player').body.reset(183, 231)"));
  await wait(400);
  const far = await promptState();
  check('T3', near === true && far === false, `[E] visible near NPC: ${near} (want true), after leaving: ${far} (want false)`);

  // ── T4: console clean ──
  check('T4', pageErrors.length === 0, pageErrors.length ? pageErrors.slice(0, 3).join(' | ') : 'console clean');

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? '\nALL CHECKS PASSED' : `\n${failed.length} CHECK(S) FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
})();

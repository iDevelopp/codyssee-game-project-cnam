/**
 * p4-gameplay-feedback.spec.js — E2E QA for the gameplay-feedback fixes.
 *
 * Criteria:
 *  G1. Progressive answer pool: zone_01 exposes 5 cards (its cardPool), not
 *      the full 19-card catalog.
 *  G2. Pool is cumulative: zone_02 exposes 9 (zone_01 ∪ zone_02),
 *      zone_05 exposes all 19.
 *  G3. Initial deck is restricted to zone_01's pool minus expected answers
 *      (html + python — no late-game rust/swift on a fresh save).
 *  G4. Moonwalk fix: moving right → flipX=false, moving left → flipX=true
 *      (side frames face right natively), anim key 'walk-side'.
 *  G5. No console errors.
 *
 * Run standalone: node web/tests/e2e/p4-gameplay-feedback.spec.js
 * (expects the dev server on http://localhost:5199/, started by the runner)
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:5199/play/';
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

/** Find the live ZoneScene instance. */
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

  await page.goto(BASE_URL);
  await wait(CANVAS_WAIT);

  // Enter the game: click canvas (unlock), Jouer, dismiss 4 intro slides.
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

  // ── G1: zone_01 pool = 5 cards ──
  const z1 = await page.evaluate(zoneEval('(zs) => ({ id: zs.zoneData.id, cards: zs.getAllCards().map(c => c.id) })'));
  check('G1', z1.id === 'zone_01' && z1.cards.length === 5, `${z1.id} pool: [${z1.cards}]`);

  // ── G2: cumulative pool in later zones ──
  await page.evaluate(zoneEval("(zs) => zs.scene.restart({ zoneId: 'zone_02' })"));
  await wait(TRANSITION_WAIT);
  const z2count = await page.evaluate(zoneEval('(zs) => zs.getAllCards().length'));
  await page.evaluate(zoneEval("(zs) => zs.scene.restart({ zoneId: 'zone_05' })"));
  await wait(TRANSITION_WAIT);
  const z5count = await page.evaluate(zoneEval('(zs) => zs.getAllCards().length'));
  check('G2', z2count === 9 && z5count === 19, `zone_02 pool=${z2count} (want 9), zone_05 pool=${z5count} (want 19)`);

  // ── G3: fresh initial deck = html + python only ──
  const deck = await page.evaluate(() => JSON.parse(localStorage.getItem('codyssee.save.v1') || '{}').deckCardIds);
  const deckOk = Array.isArray(deck) && deck.length === 2 && deck.includes('html') && deck.includes('python');
  check('G3', deckOk, `initial deck: [${deck}]`);

  // ── G4: side-facing directions ──
  await canvas.click({ position: { x: 400, y: 300 } }); // refocus
  await page.keyboard.down('ArrowRight');
  await wait(300);
  const right = await page.evaluate(zoneEval("(zs) => { const p = zs.children.list.find(o => o.texture && o.texture.key === 'player'); return { flipX: p.flipX, anim: p.anims.currentAnim?.key }; }"));
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowLeft');
  await wait(300);
  const left = await page.evaluate(zoneEval("(zs) => { const p = zs.children.list.find(o => o.texture && o.texture.key === 'player'); return { flipX: p.flipX, anim: p.anims.currentAnim?.key }; }"));
  await page.keyboard.up('ArrowLeft');
  const g4 = right.flipX === false && left.flipX === true && right.anim === 'walk-side' && left.anim === 'walk-side';
  check('G4', g4, `right: flipX=${right.flipX}/${right.anim} (want false/walk-side), left: flipX=${left.flipX}/${left.anim} (want true/walk-side)`);

  // ── G5: console clean ──
  check('G5', pageErrors.length === 0, pageErrors.length ? pageErrors.slice(0, 3).join(' | ') : 'console clean');

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? '\nALL CHECKS PASSED' : `\n${failed.length} CHECK(S) FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
})();

/**
 * p5-landing-exit.spec.js — E2E QA for landing button + in-game exit fixes.
 *
 * Criteria:
 *  L1. Landing hero JOUER button is clickable (hero__stars no longer swallows
 *      the click) and navigates to /play/.
 *  L2. Escape in a zone returns to the main menu (ZoneScene stopped,
 *      MainMenuScene active, UIScene/TimelineScene stopped).
 *  L3. Re-entering from the menu after Escape works (Continuer → ZoneScene,
 *      overlay scenes relaunched).
 *  L4. Controls hint (with Échap) is visible in the zone HUD.
 *  L5. Menu Quitter navigates back to the landing (/).
 *  L6. No console errors.
 *
 * Run standalone: node web/tests/e2e/p5-landing-exit.spec.js
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

const activeScenes = (page) =>
  page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') pageErrors.push(m.text());
  });

  // ── L1: landing hero button navigates ──
  await page.goto(`${BASE}/`);
  await wait(800);
  await page.locator('.btn-play').first().click({ timeout: 5000 });
  await wait(1000);
  check('L1', page.url().includes('/play'), `url after hero click: ${page.url()}`);

  // Enter the game (unlock, Jouer, 4 intro slides)
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

  // ── L4: controls hint visible in HUD ──
  const hint = await page.evaluate(() => {
    const ui = window.__game.scene.getScene('UIScene');
    const texts = ui.children.list.filter((o) => o.type === 'Text').map((o) => o.text);
    return texts.find((t) => t.includes('Échap')) || null;
  });
  check('L4', !!hint, `HUD hint: ${hint}`);

  // ── L2: Escape → main menu ──
  await page.keyboard.press('Escape');
  await wait(TRANSITION_WAIT);
  let scenes = await activeScenes(page);
  const l2 = scenes.includes('MainMenuScene') && !scenes.includes('ZoneScene') && !scenes.includes('UIScene');
  check('L2', l2, `active scenes after Escape: [${scenes}]`);

  // ── L3: Continuer re-enters the zone ──
  await canvas.click({ position: { x: 640, y: 418 } }); // Continuer (save exists → no intro)
  await wait(TRANSITION_WAIT);
  scenes = await activeScenes(page);
  const l3 = scenes.includes('ZoneScene') && scenes.includes('UIScene');
  check('L3', l3, `active scenes after Continuer: [${scenes}]`);

  // ── L5: menu Quitter → landing ──
  await page.keyboard.press('Escape');
  await wait(TRANSITION_WAIT);
  await canvas.click({ position: { x: 640, y: 504 } }); // Quitter at height*0.70
  await wait(1500);
  const backOnLanding = new URL(page.url()).pathname === '/';
  check('L5', backOnLanding, `url after Quitter: ${page.url()}`);

  // ── L6: console clean ──
  check('L6', pageErrors.length === 0, pageErrors.length ? pageErrors.slice(0, 3).join(' | ') : 'console clean');

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? '\nALL CHECKS PASSED' : `\n${failed.length} CHECK(S) FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
})();

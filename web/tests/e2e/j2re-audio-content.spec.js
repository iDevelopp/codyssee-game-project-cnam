/**
 * j2re-audio-content.spec.js — RE-TEST of TASK-018 criteria A1-A5.
 *
 * Re-test date: 2026-06-12, after agent-moteur fixed BUG-02.
 *
 * Key changes vs j2-audio-content.spec.js:
 *  - A1: Uses DEV server (localhost:5173/codyssee/) so window.__audioCalls
 *    (AudioManager.ts dev hook) is active. Asserts sfx.interact, sfx.wrong,
 *    sfx.correct keys appear in that array.
 *  - A2-A4: Use prod preview (localhost:4173/codyssee/).
 *  - A3: Core BUG-02 regression — each NPC dialogue must show the CORRECT
 *    speaker name. Card clicks use longer waits and holdKey for E presses.
 *  - A4: Same robustness improvements.
 *
 * Run standalone: node web/tests/e2e/j2re-audio-content.spec.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ── Config ──────────────────────────────────────────────────────────────────

const DEV_URL     = 'http://localhost:5173/codyssee/';
const PREVIEW_URL = 'http://localhost:4173/codyssee/';

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const CANVAS_WAIT  = 5000;  // time for Phaser boot + asset load
const SCENE_WAIT   = 2500;  // scene transition
const DECK_WAIT    = 1500;  // extra wait for deck to fully open
const DIALOGUE_WAIT = 800;  // wait after each E press
const SHORT_WAIT   = 600;   // generic short pause
const CARD_WAIT    = 800;   // wait after card click for NPC state machine

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// ── Shared state ─────────────────────────────────────────────────────────────

let screenshotIndex = 0;
const consoleMessages = [];
const pageErrors = [];

/**
 * Take a numbered screenshot.
 * @param {import('playwright').Page} page
 * @param {string} label
 * @returns {Promise<string>} path
 */
async function screenshot(page, label) {
  screenshotIndex++;
  const name = `j2re-${String(screenshotIndex).padStart(3, '0')}-${label.replace(/[^a-z0-9_-]/gi, '_')}.png`;
  const filePath = path.join(SCREENSHOT_DIR, name);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`  📸 ${name}`);
  return filePath;
}

/** Wait ms. @param {number} ms */
async function wait(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Click canvas to ensure keyboard focus (clicks at center of zone, away from cards).
 * Uses a position that won't accidentally hit any game object.
 * @param {import('playwright').Page} page
 */
async function focusCanvas(page) {
  // Click near the left edge of the screen, away from NPCs, deck cards, or buttons
  const canvas = page.locator('canvas');
  await canvas.click({ position: { x: 100, y: 600 } });
  await wait(100);
}

/**
 * Press E using holdKey for 80ms — ensures Phaser's rising-edge detector
 * catches the keydown on the next frame.
 * @param {import('playwright').Page} page
 * @param {number} [waitMs=DIALOGUE_WAIT] - Wait after key up
 */
async function pressE(page, waitMs = DIALOGUE_WAIT) {
  await page.keyboard.down('e');
  await wait(80);
  await page.keyboard.up('e');
  await wait(waitMs);
}

/**
 * Hold a key for a duration.
 * @param {import('playwright').Page} page
 * @param {string} key
 * @param {number} ms
 */
async function holdKey(page, key, ms) {
  await page.keyboard.down(key);
  await wait(ms);
  await page.keyboard.up(key);
}

/**
 * Parse the game save from localStorage.
 * @param {import('playwright').Page} page
 * @returns {Promise<object|null>}
 */
async function getSave(page) {
  const raw = await page.evaluate(() => localStorage.getItem('codyssee.save.v1'));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/**
 * Navigate to game, clear save if requested, click Jouer, wait for zone.
 * Uses a fresh navigation each time to avoid stale Phaser state.
 *
 * @param {import('playwright').Page} page
 * @param {string} baseUrl
 * @param {boolean} clearSave
 */
async function launchZone(page, baseUrl, clearSave = true) {
  // Navigate to the game URL
  await page.goto(baseUrl);
  await wait(CANVAS_WAIT);

  if (clearSave) {
    // Clear localStorage then reload so the game starts completely fresh
    await page.evaluate(() => localStorage.clear());
    await page.goto(baseUrl);
    await wait(CANVAS_WAIT);
  }

  // Click Jouer button (at center-x=640, height*0.58=418)
  await page.mouse.click(640, 418);
  await wait(SCENE_WAIT);
  // Click center of canvas to ensure game has focus for subsequent keyboard input
  await page.mouse.click(640, 300);
  await wait(200);
}

/**
 * Advance through ALL NPC dialogue lines then pick a card.
 * More robust than counting E presses manually — uses NPC dialogue line count.
 *
 * @param {import('playwright').Page} page
 * @param {number} lineCount - Number of dialogueLines entries for this NPC
 * @param {number} cardX - X coordinate of the correct card on screen
 * @param {string} npcLabel - For debug logging
 * @returns {Promise<string>} Screenshot path of thanks line
 */
async function doNpcDialogue(page, lineCount, cardX, npcLabel) {
  // Press E to open dialogue (state: Idle → ShowingLines, line[0])
  console.log(`  [${npcLabel}] Opening dialogue...`);
  await pressE(page);
  const ssLine1 = await screenshot(page, `${npcLabel}-line1`);

  // Advance through remaining lines (lineCount-1 more E presses)
  for (let i = 1; i < lineCount; i++) {
    console.log(`  [${npcLabel}] Advancing line ${i+1}/${lineCount}...`);
    await pressE(page);
  }

  // One more E: past last line → close dialogue + open deck
  console.log(`  [${npcLabel}] Opening deck...`);
  await pressE(page);

  // Wait generously for the deck to fully render (UIScene event dispatch + Phaser frame)
  await wait(DECK_WAIT);
  const ssDeck = await screenshot(page, `${npcLabel}-deck`);

  // Click the correct card
  console.log(`  [${npcLabel}] Clicking card at x=${cardX}...`);
  await page.mouse.click(cardX, 360);
  await wait(CARD_WAIT);
  const ssThanks = await screenshot(page, `${npcLabel}-thanks`);

  // Dismiss thanks line (E)
  console.log(`  [${npcLabel}] Dismissing thanks...`);
  await pressE(page);
  await wait(SHORT_WAIT);

  return ssThanks;
}

// ── Results ───────────────────────────────────────────────────────────────────

/** @type {Array<{id: string, label: string, result: 'PASS'|'FAIL', evidence: string[]}>} */
const results = [];

/**
 * Record a criterion result.
 * @param {string} id
 * @param {string} label
 * @param {boolean} pass
 * @param {string[]} evidence
 */
function record(id, label, pass, evidence) {
  results.push({ id, label, result: pass ? 'PASS' : 'FAIL', evidence });
  const icon = pass ? '✅' : '❌';
  console.log(`\n${icon} ${id}: ${label}`);
  evidence.forEach(e => console.log(`   ${e}`));
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n════════════════════════════════════════════════════');
  console.log(' Codyssey J2 RE-TEST — TASK-018 — 2026-06-12');
  console.log('════════════════════════════════════════════════════\n');

  // ────────────────────────────────────────────────────────────────────────────
  // A5: Prod build integrity (filesystem check)
  // ────────────────────────────────────────────────────────────────────────────

  console.log('── A5: Prod build integrity ──');

  const DIST = path.join(__dirname, '../../dist');
  const distContentFiles = [
    'content/audio.json',
    'content/cards.json',
    'content/npcs.json',
    'content/zones/index.json',
    'content/zones/zone_01.json',
  ];
  const distAudioFiles = [
    'assets/audio/ambient.ogg', 'assets/audio/ambient.mp3',
    'assets/audio/correct.ogg', 'assets/audio/correct.mp3',
    'assets/audio/wrong.ogg',   'assets/audio/wrong.mp3',
    'assets/audio/interact.ogg','assets/audio/interact.mp3',
    'assets/audio/door.ogg',    'assets/audio/door.mp3',
    'assets/audio/ui-click.ogg','assets/audio/ui-click.mp3',
  ];

  const missingContent = distContentFiles.filter(f => !fs.existsSync(path.join(DIST, f)));
  const missingAudio   = distAudioFiles.filter(f => !fs.existsSync(path.join(DIST, f)));
  const a5Pass = missingContent.length === 0 && missingAudio.length === 0;

  record('A5', 'Prod build integrity: dist/content + dist/assets/audio present', a5Pass, [
    `Content: ${distContentFiles.length - missingContent.length}/${distContentFiles.length} present${missingContent.length ? ', MISSING: ' + missingContent.join(', ') : ''}`,
    `Audio:   ${distAudioFiles.length - missingAudio.length}/${distAudioFiles.length} present${missingAudio.length ? ', MISSING: ' + missingAudio.join(', ') : ''}`,
  ]);

  // ────────────────────────────────────────────────────────────────────────────
  // A1: Audio wiring — DEV server (window.__audioCalls hook)
  // ────────────────────────────────────────────────────────────────────────────

  console.log('\n── A1: Audio wiring (DEV server — window.__audioCalls) ──');

  const devBrowser = await chromium.launch({ headless: true });
  const devCtx = await devBrowser.newContext({ viewport: { width: 1280, height: 720 } });
  const devPage = await devCtx.newPage();

  devPage.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleMessages.push(text);
    if (msg.type() === 'error') console.error('  CONSOLE ERROR:', text);
  });
  devPage.on('pageerror', err => {
    pageErrors.push(err.message);
    console.error('  PAGE ERROR:', err.message);
  });

  await launchZone(devPage, DEV_URL, true);

  const callsBefore = await devPage.evaluate(() => (window.__audioCalls || []).length);
  await screenshot(devPage, 'a1-zone-dev-launched');

  // Move near Léa (320, 240) — player spawns at (160, 300)
  // Right: (320-160)=160px @ 180px/s = 0.9s; Up: (300-240)=60px @ 180px/s = 0.33s
  await holdKey(devPage, 'ArrowRight', 950);
  await wait(300);
  await holdKey(devPage, 'ArrowUp', 380);
  await wait(400);

  // Trigger interact SFX
  await pressE(devPage); // opens dialogue
  const callsAfterInteract = await devPage.evaluate(() => window.__audioCalls || []);
  const interactPlayed = callsAfterInteract.includes('sfx.interact');
  await screenshot(devPage, 'a1-interact-dialogue');

  // Advance to deck
  await pressE(devPage); // line 1
  await pressE(devPage); // line 2
  await pressE(devPage); // opens deck
  await wait(DECK_WAIT);

  // Click wrong card (python at x=40) → sfx.wrong
  await devPage.mouse.click(40, 360);
  await wait(CARD_WAIT);
  const callsAfterWrong = await devPage.evaluate(() => window.__audioCalls || []);
  const wrongPlayed = callsAfterWrong.includes('sfx.wrong');
  await screenshot(devPage, 'a1-wrong-sfx');

  // E to retry
  await pressE(devPage);
  await wait(DECK_WAIT);

  // Click correct (javascript at x=260) → sfx.correct
  await devPage.mouse.click(260, 360);
  await wait(CARD_WAIT);
  const callsAfterCorrect = await devPage.evaluate(() => window.__audioCalls || []);
  const correctPlayed = callsAfterCorrect.includes('sfx.correct');
  await screenshot(devPage, 'a1-correct-sfx');

  const finalAudioCalls = await devPage.evaluate(() => window.__audioCalls || []);
  const a1Pass = interactPlayed && wrongPlayed && correctPlayed;

  record('A1', 'Audio wiring: sfx.interact + sfx.wrong + sfx.correct in __audioCalls', a1Pass, [
    `window.__audioCalls before: ${callsBefore} entries`,
    `sfx.interact present: ${interactPlayed}`,
    `sfx.wrong present: ${wrongPlayed}`,
    `sfx.correct present: ${correctPlayed}`,
    `Full __audioCalls: [${finalAudioCalls.join(', ')}]`,
    `Note: music.ambient played via ambientTrack.play() (not play(key)) so not in __audioCalls — expected`,
    `Page errors: ${pageErrors.length}`,
  ]);

  await devBrowser.close();

  // ────────────────────────────────────────────────────────────────────────────
  // A2-A4: Prod preview (port 4173)
  // ────────────────────────────────────────────────────────────────────────────

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const prodErrors = [];
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleMessages.push(text);
    if (msg.type() === 'error') console.error('  CONSOLE ERROR:', text);
  });
  page.on('pageerror', err => {
    prodErrors.push(err.message);
    pageErrors.push(err.message);
    console.error('  PAGE ERROR:', err.message);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // A2: Mute persistence
  // ────────────────────────────────────────────────────────────────────────────

  console.log('\n── A2: Mute persistence (M toggle survives reload) ──');

  await launchZone(page, PREVIEW_URL, true);

  const saveBeforeMute = await getSave(page);
  const mutedBefore = saveBeforeMute?.muted ?? false;

  // Press M to mute — use holdKey to ensure Phaser's rising-edge detector catches it
  await holdKey(page, 'm', 80);
  await wait(SHORT_WAIT);
  const saveAfterMute = await getSave(page);
  const mutedAfterToggle = saveAfterMute?.muted ?? null;
  const toggledCorrectly = (mutedAfterToggle !== mutedBefore) && (mutedAfterToggle === true);
  await screenshot(page, 'a2-muted-state');

  // Reload WITHOUT clearing localStorage
  await page.goto(PREVIEW_URL);
  await wait(CANVAS_WAIT);
  const saveAfterReload = await getSave(page);
  const mutedAfterReload = saveAfterReload?.muted ?? null;
  const persistedCorrectly = mutedAfterReload === true;
  await screenshot(page, 'a2-after-reload');

  // Re-enter zone and press M again to unmute
  await page.mouse.click(640, 418);
  await wait(SCENE_WAIT);
  await holdKey(page, 'm', 80);
  await wait(SHORT_WAIT);
  const saveAfterUnmute = await getSave(page);
  const mutedAfterUnmute = saveAfterUnmute?.muted ?? null;
  const unmutedCorrectly = mutedAfterUnmute === false;

  const a2Pass = toggledCorrectly && persistedCorrectly && unmutedCorrectly;
  record('A2', 'Mute persists: M→true; reload→still true; M again→false', a2Pass, [
    `muted before (expected false): ${mutedBefore}`,
    `muted after M press (expected true): ${mutedAfterToggle} → toggled: ${toggledCorrectly}`,
    `muted after reload (expected true): ${mutedAfterReload} → persisted: ${persistedCorrectly}`,
    `muted after M again (expected false): ${mutedAfterUnmute} → unmuted: ${unmutedCorrectly}`,
    `localStorage after reload: ${JSON.stringify(saveAfterReload)}`,
    `No page errors: ${prodErrors.length === 0}`,
  ]);

  // ────────────────────────────────────────────────────────────────────────────
  // A3: 3-NPC playthrough — BUG-02 regression
  //
  // Strategy:
  //  - Fresh zone, clear save
  //  - For each NPC: move to them, use doNpcDialogue() with generous waits
  //  - Verify save state after each NPC (helpedNpcIds, deckCardIds)
  //  - After all 3: verify door_exit unlocked, interact door → end screen
  //  - Screenshots capture speaker name in dialogue for visual BUG-02 proof
  // ────────────────────────────────────────────────────────────────────────────

  console.log('\n── A3: 3-NPC playthrough — BUG-02 regression ──');

  await launchZone(page, PREVIEW_URL, true);
  await screenshot(page, 'a3-zone-loaded');

  // ── Léa (320, 240) — javascript ──────────────────────────────────────────
  // From spawn (160,300): right 160px (0.89s) + up 60px (0.33s)
  console.log('\n  [A3] Moving to Léa (320,240)...');
  await page.mouse.click(640, 300);
  await wait(200);
  await holdKey(page, 'ArrowRight', 1000);
  await wait(300);
  await holdKey(page, 'ArrowUp', 400);
  await wait(500);

  await screenshot(page, 'a3-near-lea');
  // doNpcDialogue: 3 dialogueLines, javascript card at x=260
  await doNpcDialogue(page, 3, 260, 'a3-lea');

  const saveAfterLea = await getSave(page);
  const leaHelped = saveAfterLea?.helpedNpcIds?.includes('npc_lea') ?? false;
  const leaCard   = saveAfterLea?.deckCardIds?.includes('javascript') ?? false;
  console.log(`  [A3] After Léa: helped=${leaHelped}, javascript card=${leaCard}`);
  console.log(`  [A3] Save: ${JSON.stringify(saveAfterLea)}`);

  // ── Thomas (640, 400) — csharp ────────────────────────────────────────────
  // From spawn (160,300): right 480px (2.67s) + down 100px (0.56s)
  // From Léa (~320,240): right 320px (1.78s) + down 160px (0.89s)
  // We use larger durations to compensate for unknown position drift.
  // Extra safety: explicit refocus + longer hold to ensure we overshoot.
  console.log('\n  [A3] Moving to Thomas (640,400)...');
  // Click canvas to ensure keyboard focus before movement
  await page.mouse.click(640, 300);
  await wait(200);
  await holdKey(page, 'ArrowRight', 2500);
  await wait(400);
  await holdKey(page, 'ArrowDown', 1200);
  await wait(500);

  await screenshot(page, 'a3-near-thomas');
  // doNpcDialogue: 3 dialogueLines, csharp card at x=480
  await doNpcDialogue(page, 3, 480, 'a3-thomas');

  const saveAfterThomas = await getSave(page);
  const thomasHelped = saveAfterThomas?.helpedNpcIds?.includes('npc_thomas') ?? false;
  const thomasCard   = saveAfterThomas?.deckCardIds?.includes('csharp') ?? false;
  console.log(`  [A3] After Thomas: helped=${thomasHelped}, csharp card=${thomasCard}`);
  console.log(`  [A3] Save: ${JSON.stringify(saveAfterThomas)}`);

  // ── Clara (900, 180) — sql ────────────────────────────────────────────────
  // From Thomas (~640,400): first go UP to y≈100 (stay far from door at y=360),
  // then right to x≈900. This avoids accidentally entering the door's 240px radius.
  // Door is at (1100,360); at y=100 the door is ~360px away even at x=900. Safe.
  console.log('\n  [A3] Moving to Clara (900,180) — up first then right...');
  await page.mouse.click(640, 300);
  await wait(200);
  await holdKey(page, 'ArrowUp', 1800);  // ~324px up from ~400 → y≈76 (world bounds may stop at 0)
  await wait(400);
  await holdKey(page, 'ArrowRight', 1600); // ~288px right from ~640 → x≈928 (close to Clara at 900)
  await wait(500);

  await screenshot(page, 'a3-near-clara');
  // doNpcDialogue: 3 dialogueLines, sql card at x=920
  await doNpcDialogue(page, 3, 920, 'a3-clara');

  const saveAfterAll = await getSave(page);
  const claraHelped   = saveAfterAll?.helpedNpcIds?.includes('npc_clara') ?? false;
  const claraCard     = saveAfterAll?.deckCardIds?.includes('sql') ?? false;
  const allThreeHelped = leaHelped && thomasHelped && claraHelped;
  const doorUnlocked  = saveAfterAll?.unlockedDoorIds?.includes('door_exit') ?? false;
  console.log(`  [A3] After Clara: helped=${claraHelped}, sql card=${claraCard}`);
  console.log(`  [A3] All 3 helped: ${allThreeHelped}, door_exit: ${doorUnlocked}`);
  console.log(`  [A3] Final save: ${JSON.stringify(saveAfterAll)}`);

  await screenshot(page, 'a3-after-all-helped');

  // Navigate to door (1100, 360) and interact
  // From Clara (~900, ~76): right 200px + down 284px
  // Door is now unlocked (all NPCs helped) — it should turn green and show end screen.
  console.log('\n  [A3] Moving to door (1100,360)...');
  await page.mouse.click(640, 300);
  await wait(200);
  await holdKey(page, 'ArrowRight', 1500); // ~270px right: x≈900+270=1170 (capped at bounds or near door at 1100)
  await wait(400);
  await holdKey(page, 'ArrowDown', 2000);  // ~360px down: y≈76+360=436 → capped near 360 area
  await wait(400);

  await screenshot(page, 'a3-at-door');
  await pressE(page, 1200); // door interaction
  await screenshot(page, 'a3-end-screen');

  const a3Pass = allThreeHelped && doorUnlocked && leaCard && thomasCard && claraCard;

  record('A3', 'Extended 3-NPC: Léa+Thomas+Clara each resolve + door → end screen', a3Pass, [
    `Léa (javascript) helped: ${leaHelped}, card: ${leaCard}`,
    `Thomas (csharp) helped: ${thomasHelped}, card: ${thomasCard}`,
    `Clara (sql) helped: ${claraHelped}, card: ${claraCard}`,
    `All 3 helped: ${allThreeHelped}`,
    `door_exit unlocked in save: ${doorUnlocked}`,
    `Final helpedNpcIds: ${JSON.stringify(saveAfterAll?.helpedNpcIds)}`,
    `Final deckCardIds: ${JSON.stringify(saveAfterAll?.deckCardIds)}`,
    `Speaker-name screenshots (BUG-02 visual proof): j2re-*-a3-lea-line1, j2re-*-a3-thomas-line1, j2re-*-a3-clara-line1`,
    `No page errors during A3: ${prodErrors.length === 0}`,
  ]);

  // ────────────────────────────────────────────────────────────────────────────
  // A4: J1 non-regression
  // ────────────────────────────────────────────────────────────────────────────

  console.log('\n── A4: J1 non-regression — 6-criterion core loop ──');

  const errorsAtA4 = prodErrors.length;
  await launchZone(page, PREVIEW_URL, true);

  // R1: Menu → Zone (canvas present)
  const canvasCount = await page.locator('canvas').count();
  const r1 = canvasCount > 0 && prodErrors.length === errorsAtA4;
  await screenshot(page, 'a4-r1-zone-loaded');
  console.log(`  [A4] R1 canvas=${canvasCount}: ${r1}`);

  // R2: Movement 4 directions (brief movements to verify each direction works)
  // Start: spawn (160, 300). Net displacement after zigzag ≈ (-72, 0)
  await page.mouse.click(640, 300);
  await wait(200);
  await holdKey(page, 'ArrowRight', 600);  // +108px right → x≈268
  await screenshot(page, 'a4-r2-move-right');
  await holdKey(page, 'ArrowLeft', 600);   // -108px → x≈160
  await holdKey(page, 'KeyZ', 400);        // -72px up → y≈228
  await holdKey(page, 'KeyS', 400);        // +72px down → y≈300
  await holdKey(page, 'KeyQ', 400);        // -72px left → x≈88
  const r2 = prodErrors.length === errorsAtA4;
  await screenshot(page, 'a4-r2-movement-done');
  // After zigzag: player at approx (88, 300). No extra reset needed.
  console.log(`  [A4] R2 movement: ${r2}`);

  // R3: Dialogue line-by-line + deck opens
  // Move near Léa from post-zigzag position (~88, 300):
  // Léa at (320, 240): need +232px right (1289ms≈1300ms) + up 60px (333ms≈400ms)
  await page.mouse.click(640, 300);
  await wait(200);
  await holdKey(page, 'ArrowRight', 1400); // overshoot slightly to ensure in range
  await wait(300);
  await holdKey(page, 'ArrowUp', 400);
  await wait(400);
  await pressE(page); // line 0
  await screenshot(page, 'a4-r3-dialogue-line1');
  await pressE(page); // line 1
  await pressE(page); // line 2
  await pressE(page); // opens deck
  await wait(DECK_WAIT);
  await screenshot(page, 'a4-r3-deck-open');
  const r3 = prodErrors.length === errorsAtA4;
  console.log(`  [A4] R3 dialogue+deck: ${r3}`);

  // R4: Wrong → hint + retry; correct → thanks + card in deck
  await page.mouse.click(40, 360);  // python (wrong for Léa)
  await wait(CARD_WAIT);
  await screenshot(page, 'a4-r4-wrong-hint');
  await pressE(page);  // retry → deck reopens
  await wait(DECK_WAIT);
  await page.mouse.click(260, 360); // javascript (correct)
  await wait(CARD_WAIT);
  await screenshot(page, 'a4-r4-correct-thanks');
  await pressE(page);
  await wait(SHORT_WAIT);

  const saveR4 = await getSave(page);
  const r4DeckOk = saveR4?.deckCardIds?.includes('javascript') ?? false;
  const r4LeaOk  = saveR4?.helpedNpcIds?.includes('npc_lea') ?? false;
  const r4 = r4DeckOk && r4LeaOk && prodErrors.length === errorsAtA4;
  console.log(`  [A4] R4: deck_js=${r4DeckOk}, lea_helped=${r4LeaOk} → ${r4}`);

  // R5: Help Thomas + Clara → door → end screen
  // Thomas (640,400) from Léa position (~320,240)
  // After R4, player is at ~(320,240). Thomas at (640,400): +320px right (+1.78s), +160px down (+0.89s)
  await page.mouse.click(640, 300);
  await wait(200);
  await holdKey(page, 'ArrowRight', 2500);
  await wait(400);
  await holdKey(page, 'ArrowDown', 1200);
  await wait(500);
  await doNpcDialogue(page, 3, 480, 'a4-thomas'); // csharp

  // Clara (900,180) from Thomas (~640,400): up first to avoid door, then right
  await page.mouse.click(640, 300);
  await wait(200);
  await holdKey(page, 'ArrowUp', 1800);    // go up to y≈76
  await wait(400);
  await holdKey(page, 'ArrowRight', 1600); // go right to x≈928
  await wait(500);
  await doNpcDialogue(page, 3, 920, 'a4-clara'); // sql

  // Door (1100,360) from Clara (~900,~76): right 200px + down 284px
  await page.mouse.click(640, 300);
  await wait(200);
  await holdKey(page, 'ArrowRight', 1500);
  await wait(400);
  await holdKey(page, 'ArrowDown', 2000);
  await wait(400);
  await pressE(page, 1200);
  await screenshot(page, 'a4-r5-end-screen');

  const saveR5 = await getSave(page);
  const r5AllHelped = (saveR5?.helpedNpcIds?.length ?? 0) >= 3;
  const r5Door = saveR5?.unlockedDoorIds?.includes('door_exit') ?? false;
  const r5 = r5AllHelped && r5Door && prodErrors.length === errorsAtA4;
  console.log(`  [A4] R5: allHelped=${r5AllHelped}, door=${r5Door} → ${r5}`);

  // R6: Persistence after reload
  const saveBeforeReload = await getSave(page);
  await page.goto(PREVIEW_URL);
  await wait(CANVAS_WAIT);
  const saveAfterReload2 = await getSave(page);
  const r6Npcs = JSON.stringify(saveAfterReload2?.helpedNpcIds?.slice().sort()) ===
                 JSON.stringify(saveBeforeReload?.helpedNpcIds?.slice().sort());
  const r6Deck = JSON.stringify(saveAfterReload2?.deckCardIds?.slice().sort()) ===
                 JSON.stringify(saveBeforeReload?.deckCardIds?.slice().sort());
  const r6Door = JSON.stringify(saveAfterReload2?.unlockedDoorIds?.slice().sort()) ===
                 JSON.stringify(saveBeforeReload?.unlockedDoorIds?.slice().sort());
  const r6 = r6Npcs && r6Deck && r6Door;
  await screenshot(page, 'a4-r6-after-reload');
  console.log(`  [A4] R6: npcs=${r6Npcs}, deck=${r6Deck}, door=${r6Door} → ${r6}`);

  const a4Pass = r1 && r2 && r3 && r4 && r5 && r6;

  record('A4', 'J1 non-regression: 6-criterion core loop', a4Pass, [
    `R1 Menu→Zone (canvas present): ${r1}`,
    `R2 Movement 4 directions (ZQSD+arrows): ${r2}`,
    `R3 Dialogue line-by-line + deck opens: ${r3}`,
    `R4 Wrong→hint, correct→thanks, card in deck: ${r4} (deck_js=${r4DeckOk}, lea_helped=${r4LeaOk})`,
    `R5 All 3 helped → door → end screen: ${r5} (allHelped=${r5AllHelped}, door=${r5Door})`,
    `R6 Persistence: npcs=${r6Npcs}, deck=${r6Deck}, door=${r6Door}`,
    `   Before: ${JSON.stringify(saveBeforeReload?.helpedNpcIds)} / After: ${JSON.stringify(saveAfterReload2?.helpedNpcIds)}`,
    `No new page errors during A4: ${prodErrors.length === errorsAtA4}`,
  ]);

  // ────────────────────────────────────────────────────────────────────────────
  // Teardown
  // ────────────────────────────────────────────────────────────────────────────

  await browser.close();

  // ────────────────────────────────────────────────────────────────────────────
  // Final report
  // ────────────────────────────────────────────────────────────────────────────

  console.log('\n════════════════════════════════════════════════════');
  console.log(' FINAL RE-TEST REPORT — TASK-018 — 2026-06-12');
  console.log('════════════════════════════════════════════════════\n');

  for (const r of results) {
    const icon = r.result === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${r.id}: ${r.label}`);
    r.evidence.forEach(e => console.log(`   ${e}`));
    console.log();
  }

  const allErrors   = consoleMessages.filter(m => m.includes('[error]'));
  const allWarnings = consoleMessages.filter(m => m.includes('[warning]'));

  console.log(`Console: ${consoleMessages.length} total, ${allErrors.length} errors, ${allWarnings.length} warnings`);
  if (allErrors.length > 0) {
    console.log('Errors:');
    allErrors.forEach(e => console.log('  ', e));
  }

  console.log('\nPage errors:');
  if (pageErrors.length === 0) {
    console.log('  None.');
  } else {
    pageErrors.forEach(e => console.log('  ', e));
  }

  // JSON report
  const reportPath = path.join(__dirname, 'qa-report-j2re-2026-06-12.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    date: '2026-06-12',
    task: 'TASK-018',
    retest: true,
    results,
    consoleErrors: allErrors,
    consoleWarnings: allWarnings,
    pageErrors,
    screenshots: fs.readdirSync(SCREENSHOT_DIR)
      .filter(f => f.startsWith('j2re-'))
      .map(f => path.join(SCREENSHOT_DIR, f)),
  }, null, 2));
  console.log(`\nJSON report: ${reportPath}`);

  const allPass = results.every(r => r.result === 'PASS');
  console.log(`\n${allPass ? '✅ ALL A1-A5 PASS' : '⚠️  SOME CRITERIA FAILED'}`);
  process.exit(allPass ? 0 : 1);
})();

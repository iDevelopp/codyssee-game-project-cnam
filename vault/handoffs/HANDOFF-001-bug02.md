# HANDOFF-001 — BUG-02 fix (agent-moteur → review)

**Date:** 2026-06-12
**From:** agent-moteur
**Status:** fix applied, tsc ✓, build ✓, status remains `review`

---

## What was done

### Root cause (confirmed)

`ZoneScene.update()` maintained its own `wasEDown` edge detector for the E key,
independent of the one in `InteractionSystem`. On a single E press while unlocked:

1. `interaction.update(px, py)` fires, calls the nearest NPC's `interact()` →
   `_beginDialogue()` → emits `DIALOGUE_OPEN` → UIScene opens DialogueBox →
   **`InputLock.lock()` synchronously** within the same frame.
2. ZoneScene then reads its own `eJustPressed` (also a rising edge on this frame),
   sees `InputLock.isLocked()` is now true (locked by step 1), and enters the
   advance loop — `!npc.canInteract()` returns true for ALL idle NPCs because
   `canInteract()` includes `&& !InputLock.isLocked()`. It picks `this.npcs[0]`
   (always Léa, the first registered NPC) and calls `Léa.interact()`.

Result: a single E press near Clara or Thomas opened Léa's dialogue.

### Fix: three coordinated changes

**1. `NPC.isBusy()` — state-only predicate (NPC.ts)**

Added a method that returns `this.npcState !== 'Idle'`, independent of InputLock.
The advance loop in ZoneScene uses this to find the genuinely active NPC without
being confused by the lock that the just-opened dialogue itself set.

**2. `InteractionSystem.update()` returns `boolean` (InteractionSystem.ts)**

Returns `true` when it triggered an interaction, `false` otherwise. ZoneScene
skips the advance branch entirely when `interaction.update()` returned true,
preventing the same E press from being consumed by both branches.

**3. `ZoneScene.update()` advance loop fixed (ZoneScene.ts)**

- Guards the advance branch: `eJustPressed && InputLock.isLocked() && !interactionFired`.
- Replaces `!npc.canInteract()` with `npc.isBusy()` in the NPC search loop.
- Comments updated to explain the invariant.

### Audio test hook (AudioManager.ts)

`AudioManager.play()` now appends the sound key to `window.__audioCalls: string[]`
when `import.meta.env.DEV` is true. Array is bounded at 200 entries. Vite's
dead-code elimination removes this block from production bundles. Playwright
can assert `await page.evaluate(() => window.__audioCalls)` includes expected keys.

### Mute persistence (A2)

Confirmed correct: M press → `AudioManager.toggleMute()` → `SaveSystem.toggleMuted()`
→ `localStorage.setItem('codyssee.save.v1', ...)`. On reload, `MainMenuScene.create()`
calls `SaveSystem.load()` → `AudioManager.init()` → `save.getMuted()` restores mute.
The A2 QA failure was a side-effect of BUG-02 (Léa dialogue locked input during the M test).

---

## Files changed

| File | Change |
|------|--------|
| `web/src/entities/NPC.ts` | Added `isBusy(): boolean` |
| `web/src/systems/InteractionSystem.ts` | `update()` returns `boolean` |
| `web/src/scenes/ZoneScene.ts` | Uses `interactionFired` guard + `npc.isBusy()` |
| `web/src/systems/AudioManager.ts` | Dev hook: `window.__audioCalls` in `play()` |

---

## 3-NPC correctness argument

Zone_01 has NPCs registered in order: Léa (320,240), Thomas (640,400), Clara (900,180).

**Approach Thomas (world ~640,400), press E (unlocked):**
- `_findNearest(640,400)`: Léa dist=sqrt(320²+160²)≈358px (>240 RADIUS), Thomas dist=0px (0<240), Clara dist=sqrt(260²+220²)≈341px (>240). Thomas wins.
- `Thomas.interact()` called → `_beginDialogue()` → InputLock.lock().
- ZoneScene: `interactionFired=true` → advance branch skipped. No double-fire.
- Subsequent E presses: `interactionFired=false`, InputLock.isLocked()=true, `Thomas.isBusy()=true` → `Thomas.interact()` advances dialogue. Léa is never touched.

**Approach Clara (world ~900,180), press E (unlocked):**
- `_findNearest(900,180)`: Léa dist≈619px (>240), Thomas dist≈341px (>240), Clara dist=0px (0<240). Clara wins.
- Same invariant holds.

**All 3 helped → door opens:**
- ProgressionSystem tracks resolved count vs questNPCCount=3.
- ALL_NPCS_HELPED emitted → door turns green → door.interact() shows EndScreen.

---

## tsc / build

- `pnpm exec tsc --noEmit`: 0 errors ✓
- `pnpm build`: success (7.36s), dist/assets/audio 12 files, dist/content 6 files ✓

---

## Points of attention for orchestrateur

- TASK-016 status stays `review` per protocol.
- A1 (audio SFX headless) remains a testing limitation (AudioContext suspended).
  The `window.__audioCalls` hook enables a workaround: Playwright asserts the array
  instead of AudioBufferSourceNode.start calls. QA should update the A1 test spec.
- A2 should pass after BUG-02 fix (M key was never broken, just masked).
- A3 and A4/R5 should pass after BUG-02 fix.

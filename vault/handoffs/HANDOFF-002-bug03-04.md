# HANDOFF-002 — BUG-03 + BUG-04 fixes

**Date**: 2026-06-12  
**Agent**: agent-moteur  
**Source task**: TASK-021 (QA J3 review)  
**Branch**: web (no commit)

---

## BUG-04 — Zombie NPCs across zone transitions

### Root cause
`ZoneScene` is a Phaser singleton — `scene.start('ZoneScene', { zoneId })` re-invokes `create()` on the SAME instance. TypeScript field initializers (`private npcs: NPC[] = []`, `private doors: Door[] = []`) run only once at construction, so across restarts the arrays retained stale references to GameObjects from the previous zone (destroyed by Phaser's display list clear, but still referenced by the arrays). The `InputLock` advance loop in `update()` iterated over `this.npcs` and could call `.interact()` / `.isBusy()` on dead objects.

### Fix — `ZoneScene.create()` reset block
Added an explicit reset at the very top of `create()`, before any other code runs:

```ts
this.npcs = [];
this.doors = [];
this.transitioning = false;
this.wasEDown = false;
this.wasMDown = false;
```

`transitioning` was already reset later in `create()` but is now reset immediately (belt-and-suspenders). `wasEDown` and `wasMDown` are edge-detection flags that could carry a `true` from the last frame of the previous zone, causing a phantom key press on the first frame of the new zone.

All other instance fields (`player`, `interaction`, `deck`, `progression`, `cursors`, `wasd`, `eKey`, `mKey`, `zoneData`) are reassigned unconditionally later in `create()` — no reset needed.

### Files modified
- `web/src/scenes/ZoneScene.ts` — top of `create()`

---

## BUG-03 — Cross-zone progression count

### Root cause
`ProgressionSystem.restoreResolved(helpedNpcIds)` received the GLOBAL helped-NPC array from `SaveSystem` and added ALL of them to `resolvedIds`, regardless of zone. If the player had helped 3 NPCs in zone_01, and zone_02's `questNPCCount` was also 3, then `resolvedIds.size(3) >= questNPCCount(3)` triggered `ALL_NPCS_HELPED` immediately on entry, opening the door before Ernst/Grace/John were helped.

The same flaw applied to the runtime `NPC_RESOLVED` handler: any NPC resolution event (even from a zombie listener of a prior zone) would count toward the current zone.

### Fix — zone-scoped NPC id whitelist

**`ProgressionSystem` constructor** now takes a third argument: `zoneQuestNpcIds: Set<string>`.

- `restoreResolved()`: only adds an id to `resolvedIds` if `zoneQuestNpcIds.has(id)`. Zone_01 ids are invisible to zone_02's counter.
- `_onNpcResolved()`: returns early if `!zoneQuestNpcIds.has(npcId)`. Runtime events for out-of-zone NPCs are silently ignored.
- Completion check is unchanged: `resolvedIds.size >= questNPCCount` — but `resolvedIds` now only contains current-zone ids.

**`ZoneScene.create()`** builds `zoneQuestNpcIdSet` while counting `questNPCCount` (a single loop replacing the previous separate count loop):

```ts
const zoneQuestNpcIdSet = new Set<string>();
let questNPCCount = 0;
for (const npcId of questNPCIds) {
  const npcData = cl.getNpc(npcId);
  if (npcData?.question) {
    questNPCCount++;
    zoneQuestNpcIdSet.add(npcId);
  }
}
this.progression = new ProgressionSystem(this.game.events, questNPCCount, zoneQuestNpcIdSet);
```

### Correctness: revisit case
If a player revisits a zone whose NPCs were ALL already helped in a prior session, `restoreResolved()` will add all of them (they are in `zoneQuestNpcIdSet`) and emit `ALL_NPCS_HELPED` via `setTimeout`. Door correctly shows green on entry. This is the desired behavior.

### Files modified
- `web/src/systems/ProgressionSystem.ts` — constructor signature, `restoreResolved()`, `_onNpcResolved()`
- `web/src/scenes/ZoneScene.ts` — NPC loop + `ProgressionSystem` instantiation

---

## tsc / build
- `pnpm exec tsc --noEmit` → 0 errors
- `pnpm build` → success (5.95s)

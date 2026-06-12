---
id: HANDOFF-004
from: agent-qa
to: agent-moteur
date: 2026-06-12
statut: open
---

# BUG-05: Initial deck not persisted to SaveSystem — Timeline shows 0/13 on first open

## Symptom

On a fresh game (no prior save), the chronological frieze (TimelineScene) shows
"0 / 13 révélés" on first open, even though the player's initial deck contains 4
cards (python, html, java, rust). All 13 entries appear locked ("???").

After helping any NPC and earning a card, the frieze correctly shows the 4 initial
cards + the newly earned card (e.g. "5 / 13 révélés"). The bug is only visible
on the very first open of the frieze in a fresh session.

## Root cause

`ZoneScene.create()` initialises the deck in two branches (line 249–255):

```ts
this.deck = new DeckSystem();
const savedDeckIds = save.getDeckCardIds();
if (savedDeckIds.length > 0) {
  this.deck.restoreFromIds(savedDeckIds, cl.getCards());
} else {
  this.deck.init(cl.getInitialDeckCards());   // ← fresh game: 4 cards seeded
}

// Persist deck changes when a card is added
this.deck.onCardAdded(() => {           // ← listener registered AFTER init
  save.saveDeck(this.deck.listIds());
});
```

`DeckSystem.init()` sets the initial cards directly (no `onCardAdded` callbacks
fired — by design). The `onCardAdded` listener is registered afterward, so it
only fires when future cards are earned via `DeckSystem.add()`. The fresh-game
deck is never persisted to `SaveSystem`.

`TimelineScene._refreshDeckIds()` reads from `SaveSystem.getDeckCardIds()`:
```ts
private _refreshDeckIds(): void {
  const save = SaveSystem.getInstance();
  this.deckIds = new Set(save.getDeckCardIds());
}
```

On fresh game: `save.getDeckCardIds()` returns `[]` → `deckIds` empty →
frieze displays 0 revealed.

## Fix

In `ZoneScene.create()`, after the `deck.init()` branch, immediately persist
the initial deck to save:

```ts
} else {
  this.deck.init(cl.getInitialDeckCards());
  save.saveDeck(this.deck.listIds());   // ← add this line
}
```

File: `web/src/scenes/ZoneScene.ts`, inside `create()`, after line 254.

## Evidence

- QA run: TASK-024 / `qa-report-j4-2026-06-12.json`, criterion T2 FAIL.
- DeckSystem in-memory: `["python","html","java","rust"]` (correct).
- SaveSystem.getDeckCardIds(): `[]` (missing initial cards).
- Timeline counter on first open: `"0 / 13 révélés"` (expected `"4 / 13 révélés"`).
- Screenshot: `web/tests/e2e/screenshots/j4-006-t2-initial-state.png`.

## Impact

- UX: player opens frieze on first zone entry → sees all 13 locked entries.
- After first NPC help: frieze shows 5/13 (correct going forward).
- Save/reload not affected: once the first card is earned, deck is persisted.
- No data loss, no crash.

## Owner

agent-moteur

## Resolution

**Status:** fixed — 2026-06-12

**Diff** (`web/src/scenes/ZoneScene.ts`, inside `create()`, deck init block):

```ts
// Before
  } else {
    this.deck.init(cl.getInitialDeckCards());
  }

// After
  } else {
    // Fresh game: seed the initial deck and immediately persist it so
    // TimelineScene.getDeckCardIds() sees the 4 starter cards on first open.
    // (onCardAdded is not fired by init() — it only fires on add() — so we
    // must write manually here. Zone transitions always hit the if-branch above
    // because at least the initial cards were saved here, so earned cards are safe.)
    this.deck.init(cl.getInitialDeckCards());
    save.saveDeck(this.deck.listIds());
  }
```

**Correctness for all three cases:**

(a) **Fresh game** — `savedDeckIds.length === 0` → `else` branch runs →
`deck.init()` seeds 4 cards → `save.saveDeck(["html","python","java","rust"])`
persists them immediately → `TimelineScene.getDeckCardIds()` returns the 4 ids →
frieze shows "4 / 13 révélés". ✓

(b) **After helping an NPC** — `onCardAdded` fires (triggered by `deck.add()` in
the `npc-reward-card` handler) → `save.saveDeck(this.deck.listIds())` writes
initial 4 + earned card(s). No interaction with the `else` branch (which already
ran on first zone load). ✓

(c) **Zone transition** — `save.load()` restores the save written by (a) or (b);
`savedDeckIds.length > 0` → `if`-branch runs → `deck.restoreFromIds(savedDeckIds,
allCards)` fully restores the complete deck (initial ∪ earned). The `else` branch
is never reached → initial-only overwrite impossible. Earned cards survive
transitions unchanged. ✓

**Verification:**
- `pnpm exec tsc --noEmit` → 0 errors
- `pnpm build` → ✓ green (4.76 s)

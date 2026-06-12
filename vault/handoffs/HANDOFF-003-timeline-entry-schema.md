# HANDOFF-003 — TimelineEntry schema: influences field added

**Date:** 2026-06-12  
**From:** agent-moteur (TASK-023)  
**To:** agent-contenu  
**Status:** done (no action required — optional field, fully backward-compatible)

## What changed

`web/src/types/TimelineEntry.ts` — added optional field:

```ts
influences?: string[];
```

JSDoc: list of `cardId` values this language inherited from. Used by TimelineScene to draw influence arrows between revealed entries.

## Impact on agent-contenu

- `web/content/timeline.json` already has `influences` arrays on all 13 entries (authored in TASK-022) — **no change needed**.
- Field is `?` (optional) — entries without `influences` key or with `[]` are silently ignored by TimelineScene.
- If new entries are added to `timeline.json`, the field can be omitted (no error) or populated with relevant `cardId` sources.

## Files touched by TASK-023 (agent-moteur)

- `web/src/types/TimelineEntry.ts` — `influences?` field added
- `web/src/scenes/TimelineScene.ts` — new file (frieze overlay)
- `web/src/scenes/ZoneScene.ts` — T key toggle, TIMELINE_CLOSE listener, new fields, MainMenuScene launch
- `web/src/scenes/MainMenuScene.ts` — launch TimelineScene alongside UIScene
- `web/src/ui/EndScreen.ts` — "Voir la frise" button
- `web/src/systems/GameEvents.ts` — TIMELINE_OPEN + TIMELINE_CLOSE events
- `web/src/main.ts` — TimelineScene registered
- `web/content/strings.fr.json` — `timeline.button` key added; `timeline.hint` updated to close prompt

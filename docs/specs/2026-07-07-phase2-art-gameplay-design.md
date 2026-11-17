# Codysse phase 2 — art & gameplay overhaul (design contract)

Date: 2026-07-07 · Branch: `feat/graphics-gameplay-overhaul`
Goal: replace every placeholder with real art and close the GDD gaps (tilemaps,
collisions, NPC sprites, UI identity) while staying 100% data-driven (ADR-002)
and save-compatible (`codyssee.save.v1`).

## Generated assets (done, in `web/public/assets/sprites/`)

- `npcs/<npcId>.png` — 15 sheets, 96×96, 3×3 frames of 32×32 (rows: down/up/left,
  cols: step/idle/step — same layout as `player.png`). Right = left + flipX.
- `portraits/<npcId>.png` — 15 portraits, 160×160, era-accent framed.
- `gate.png` — 128×96, two 64×96 frames: 0 = locked (red), 1 = open (green).
  Replaces the Door rectangle. Display scale ×2.5 → 160×240 (close to the old
  160×320 rectangle; keep interaction center on the door position).

## Zone map schema (new, per `content/zones/zone_0X.json`)

```json
"theme": { "background": "0b1420", "ambient": "102030", "ambientAlpha": 0.22, "accent": "3dfc8e" },
"map": {
  "tileSize": 32, "tileScale": 2, "width": 40, "height": 23,
  "ground": [[40 ints] × 23],
  "walls":  [[40 ints, -1 = empty] × 23],
  "decor":  [[40 ints, -1 = empty] × 23],
  "props":  [{ "rect": [x, y, w, h], "x": 512, "y": 300, "solid": true }]
}
```

- Tile indices reference `tiles/neo_zero_tiles_and_buildings_01.png` (10×10 grid
  of 32×32, index = row*10+col).
- World size = 40·32·2 × 23·32·2 = **2560×1472 px** (matches existing 2× viewport
  camera bounds; update physics/camera bounds from map dims, not hardcoded ×2).
- `ground` renders below everything; `decor` renders above ground, below
  entities, never collides; `walls` collide (`setCollisionByExclusion([-1])`).
- `props.rect` = pixel rect in `sprites/neo_zero_props_and_items_01.png`
  (160×160). Engine registers a custom texture frame per rect. `solid: true` →
  static arcade body. Props draw at ×2, y-sorted like entities (depth = feet y).
- `theme` replaces the hardcoded `ERA_BACKGROUND` / `ERA_TILE_SHADES` dicts:
  camera background = `background`; optional full-screen `ambient` tint rect at
  `ambientAlpha` with depth above tiles/below UI. Placeholder checkerboard stays
  as fallback ONLY when `map` is absent.

## Engine (agent A) — owns `src/scenes/ZoneScene.ts`, `src/scenes/PreloadScene.ts`, `src/entities/*`, `src/systems/*`, `src/types/*`

1. PreloadScene: load 15 `npc_<id>` spritesheets (32×32 frames), 15
   `portrait_<id>` images, `gate` spritesheet (64×96 frames). Keys from
   npcs.json — no hardcoded ids.
2. ZoneScene: build layers from `map` (two `make.tilemap({data})` maps — ground
   and walls — plus decor), scale ×2, collider player↔walls, colliders
   player↔solid props, world/camera bounds from map size. Keep camera follow
   lerp 0.15. Zone banner/save/door logic unchanged.
3. NPC: `Phaser.GameObjects.Sprite` with `npc_<id>` sheet (scale 5, frame 1
   idle-down). Face the player when dialogue starts (down/up/left frames 1/4/7 +
   flipX for right). Subtle idle bob tween (±2px, ~1.6s, yoyo). Keep y-sort,
   name label, interaction contract, `restoreResolved`.
4. Door: sprite `gate` frame 0/1 instead of rectangle (scale 2.5), same
   position/behavior/events. Small green glow pulse when open (tween alpha on a
   matching rectangle or the sprite tint).
5. Player: unchanged (already sprite+anims). Spawn from zone JSON `spawn`.
6. Delete ERA_* dicts once `theme` lands (fallback default theme if missing).

## Content (agent B) — owns `content/zones/*.json`, `content/npcs.json` positions

Author real maps for the 5 zones per the schema above, era-distinct:
- z1 pioneers-of-web 1990s (accent 3dfc8e) · z2 foundations 50s–70s (ffc857) ·
  z3 systems 80s (c8102e→use e05561 readable) · z4 web explosion 90s–2000s
  (5fd7f5) · z5 modern 2010s+ (b48cfa).
- Street/plaza compositions: building facades as top walls, floors 41/44
  variants, cracked 43 accents, awnings/decor rows 1–3, props (stalls, vending
  machines, lamps, trees, tables) spread for exploration.
- Rules: NPC spacing ≥300px, interaction radius 240px (one NPC captable at a
  time), spawn + door + every NPC on walkable ground ≥64px from any collidable,
  door reachable, no walls enclosing dead zones. Update `spawn`, `doors[].position`,
  and npcs.json positions to use the full 2560×1472 world.

## UI (agent C) — owns `src/ui/*`, `MainMenuScene.ts`, `TimelineScene.ts`, `UIScene.ts`, `BootScene.ts`, `play/index.html`

Reskin to the codysse.fr identity (see `src/landing/landing.css`): deep space
`#070b14`/`#0c1322`, green `#3dfc8e`, amber `#ffc857`, cyan `#5fd7f5`, line
`#1c2a3a`. Tokens live in `src/ui/theme.ts` (created — import it, never inline
hex). Press Start 2P for titles/buttons, IBM Plex Mono for body (loaded via
play/index.html Google Fonts link + `document.fonts.load` await in BootScene,
graceful monospace fallback). DialogueBox gains the NPC portrait
(`portrait_<npcId>`, left side, 96px). Menu = landing-style hero (title glow,
pixel button states). CRT scanline overlay optional at low alpha.

## Out of scope

Music/SFX changes, new gameplay systems, mobile/touch, save format changes.

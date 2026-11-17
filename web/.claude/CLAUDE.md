# Codysse Web — Stack memo

## Stack
- Phaser 3 + TypeScript + Vite 6
- pnpm (not npm/yarn)
- Static multipage build: `dist/` served by nginx at `codysse.fr` — landing at `/` (index.html), game at `/play/` (play/index.html)
- Vite `base: '/'` — domain root deploy (supersedes ADR-004's ohvenus.fr/codyssee sub-path)
- Landing source: `src/landing/` (main.ts + landing.css), French copy, CRT/arcade aesthetic

## Conventions
- **Code language**: English (identifiers, comments, commits)
- **Game strings / UI copy**: French (player-facing text lives in `/content/*.json`)
- **Pixel-art**: `pixelArt: true`, `render.antialias: false` — never change these
- **Data-driven**: no hardcoded game content in engine code; load from `/web/content/`
- **Assets**: loaded via paths relative to `import.meta.env.BASE_URL` (Vite handles base in prod)

## Directory layout
```
web/
  src/
    scenes/    — Phaser scenes (BootScene, MainMenuScene, ZoneScene, …)
    systems/   — reusable systems (DialogueSystem, DeckSystem, …)
    entities/  — player, NPCs
    ui/        — HUD, panels, overlays
    data/      — loaders / parsers for /content JSON
    types/     — shared TypeScript interfaces
  content/     — JSON data (maps, NPCs, dialogues, timeline) — agent-contenu owns this
  public/assets/
    sprites/   — spritesheets / atlas (agent-art)
    tiles/     — tilemaps (agent-art)
    audio/     — CC0 sounds (agent-art)
```

## Vault pointers
- Coordination protocol: `vault/README.md`
- Task board: `vault/index.md`
- This agent's state: `vault/agents/agent-infra.md`
- Stack decision: `vault/decisions/ADR-001-stack-phaser.md`
- Deploy decision: `vault/decisions/ADR-004-web-adaptations.md`

## Hard rules
- No commit or push without Arthur's explicit go-ahead
- No backend — static only
- `pnpm build` must stay green at all times

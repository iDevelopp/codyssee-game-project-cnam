# Codysse.fr — ARKHYA product launch (landing + deploy)

Date: 2026-07-07 · Status: approved by Arthur

## Decisions

- **Repo**: one-way import of the school repo (`iDevelopp/codyssee-game-project-cnam`,
  branch `web`) into `KCVenus/codysse` (private), full git history kept so
  contributors stay credited. School repo frozen; push back manually only if
  CNAM delivery requires it.
- **Layout**: `~/dev/codysse` (dev, feature branches) + `~/projects/codysse`
  (prod, main only) — AURORA dual-clone pattern.
- **Stack**: static Vite multipage. Landing at `/` (`web/index.html`), game at
  `/play/` (`web/play/index.html`). `base: '/'` (supersedes ADR-004's
  ohvenus.fr/codyssee sub-path). One build → `web/dist/`, nginx serves static
  files. No Node service.
- **Landing**: CRT/arcade aesthetic (Press Start 2P + IBM Plex Mono, phosphor
  green/amber on deep space). Hero + pitch, language-timeline marquee, 4
  feature cards, contributors ("L'équipage": Arthur, Egor, Ivan, Rayhan,
  Baptiste, Valentin, Mateo, Anthony, Romain), Play CTA, ARKHYA footer.
  French copy (player-facing convention).
- **Deploy**: nginx vhost `codysse.fr` + `www` → `~/projects/codysse/web/dist`,
  real file in sites-enabled. DNS (OVH, user-side): A records `@`/`www` →
  149.202.61.166, then certbot.
- **Product wiring**: aurora-bot CODYSSE product (config.ts PRODUCTS +
  CHANNEL_CODYSSE + redeploy), `second-brain/projects/REGISTRY.md`, vault note
  `projects/codysse/`.

## Out of scope (phase 2)

Game content work: sprites (NPCs are placeholder rectangles), tilesets, art,
audio, polish. Own design cycle after launch.

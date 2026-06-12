---
id: TASK-001
titre: Scaffold Vite + Phaser 3 + TypeScript
owner: agent-infra
statut: done
depends_on: []
artefacts: [web/package.json, web/vite.config.ts, web/tsconfig.json, web/index.html, web/src/main.ts, web/.claude/CLAUDE.md]
jalon: J0
---

## Objectif
Initialiser le projet web (`/web`) : Vite + Phaser 3 + TypeScript, arborescence cible (`src/scenes`, `src/systems`, `src/entities`, `src/ui`, `src/data`, `src/types`, `content/`, `public/assets/{sprites,tiles,audio}`). Pixel-art : `pixelArt: true`, `render.antialias: false`. Mémo permanent `web/.claude/CLAUDE.md` (stack, conventions, pointeurs vault).

## Critères d'acceptation
- `pnpm install && pnpm dev` lance un serveur local, Phaser démarre une scène vide (canvas visible, fond uni, FPS counter dev OK).
- `pnpm build` produit `dist/` sans erreur.
- Config pixel-art active (nearest, pas d'antialiasing).
- Arborescence conforme au brief §3.

## Notes
pnpm (cf. layout dev Aurora). **Vite `base: '/codyssee/'`** (déploiement en sous-chemin, ADR-004) — charger les assets via base-relative / `import.meta.env.BASE_URL`. Ne pas hardcoder de contenu. Aucun commit sans feu vert Arthur.

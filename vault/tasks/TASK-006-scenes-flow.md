---
id: TASK-006
titre: Squelette de scènes + flux (Preload, MainMenu, Zone, UIScene)
owner: agent-moteur
statut: review
depends_on: [TASK-005]
artefacts: [web/src/scenes/PreloadScene.ts, web/src/scenes/MainMenuScene.ts, web/src/scenes/ZoneScene.ts, web/src/scenes/UIScene.ts, web/src/main.ts]
jalon: J1
---

## Objectif
Mettre en place les scènes Phaser et leur enchaînement. `PreloadScene` charge les assets (`player.png` 32×32, tiles, portraits) ET le contenu via `ContentLoader.load()`. `MainMenuScene` (titre + Jouer + Quitter). `ZoneScene` (rend la zone depuis `zones/zone_01.json`). `UIScene` = scène superposée (overlay) pour dialogue/deck/fin (équivalent des singletons UI Unity). Flux : Boot→Preload→MainMenu→(Jouer)→Zone+UI.

## Critères d'acceptation
- Boot→Preload→MainMenu s'enchaînent ; "Jouer" lance ZoneScene avec UIScene lancée en parallèle (`scene.launch`).
- Assets + contenu chargés avant MainMenu (pas de fetch en plein gameplay).
- player.png chargé en spritesheet `frameWidth:32, frameHeight:32`, filtrage nearest.
- `tsc --noEmit` vert. Pas de contenu en dur.

## Notes
Réf : `gdd/01-boucle-reference.md`, `gdd/02-assets.md`. Quitter→MainMenu (ADR-004).

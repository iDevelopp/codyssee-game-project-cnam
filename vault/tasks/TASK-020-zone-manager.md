---
id: TASK-020
titre: ZoneManager — transitions, déblocage, progression cross-zone
owner: agent-moteur
statut: done
depends_on: [TASK-018]
artefacts: [web/src/systems/ZoneManager.ts, web/src/scenes/ZoneScene.ts, web/src/entities/Door.ts, web/src/systems/SaveSystem.ts]
jalon: J3
---

## Objectif
Enchaîner plusieurs zones : la porte mène à la zone suivante (`nextZoneId`) au lieu de toujours afficher l'écran de fin. Gérer déblocage, spawn, persistance du deck et de la progression à travers les zones.

## Critères d'acceptation
- `ZoneScene` paramétrée par un `zoneId` (passé via `scene.start('ZoneScene', { zoneId })`), charge la zone correspondante depuis le contenu (plus de "première zone en dur").
- Porte ouverte : si la zone a `nextZoneId` → transition vers la zone suivante (avec effet de fondu) au spawn de celle-ci ; si pas de `nextZoneId` (zone finale) → `EndScreen` (fin de jeu).
- Déblocage : une zone n'est accessible que si `unlockCondition` remplie ; zones débloquées persistées (`SaveSystem` : liste `unlockedZoneIds`). Reprise sur la dernière zone atteinte au reload (ou menu → reprend la progression).
- Deck persistant et PNJ aidés conservés à travers les zones (déjà global dans la save ; vérifier).
- `EndScreen` "Rejouer" : définir (rejouer la zone courante vs recommencer) ; "Menu" → MainMenu.
- `tsc --noEmit` vert ; non-régression de la boucle mono-zone.

## Notes
S'appuie sur les types `ZoneData` (nextZoneId, unlockCondition, themeEra) existants. Appliquer `themeEra` à un fond/teinte distinct par zone (data-driven) en attendant les vraies tilemaps (J5). Coordonner schéma avec TASK-019.

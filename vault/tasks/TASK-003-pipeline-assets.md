---
id: TASK-003
titre: Pipeline d'assets de base (atlas perso, tiles, portraits)
owner: agent-art
statut: done
depends_on: [TASK-001]
artefacts: [web/public/assets/sprites/, web/public/assets/tiles/, vault/gdd/02-assets.md]
jalon: J0
---

## Objectif
Importer les sprites depuis `dev-Egor/Assets/Sprites` vers `/web/public/assets` et produire les spritesheets/atlas Phaser exploitables.

## Critères d'acceptation
- **Investiguer et documenter la grille exacte** de `neo_zero_char_01.png` (96×288) : confirmer taille de frame réelle et index par direction (bas 0,1,2 / haut 3,4,5 / gauche 6,7,8, milieu=immobile). Documenter dans `vault/gdd/02-assets.md`.
- Spritesheet perso chargeable en Phaser avec les anims `walk-down/up/left` + idle, droite = flipX. Cycle `[1,0,1,2]` à 8 fps.
- Tiles (`neo_zero_tiles_and_buildings_01.png`) découpées pour tilemap. Props dispo.
- Portraits placeholder (`zelda_portrait.png`, `link.png`) importés et redimensionnés raisonnablement.
- Filtrage nearest garanti.

## Notes
Bloquant pour l'anim joueur (J1). Si la grille 16×25 ne colle pas, proposer la grille réelle et la valider via une capture.

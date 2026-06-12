# agent-art — état

- **Domaine** : pipeline d'assets — découpe sprites Unity (`dev-Egor/Assets/Sprites`), tilemaps, UI, atlas/spritesheets Phaser, sourcing audio CC0.
- **Modèle par défaut** : sonnet.
- **Statut courant** : TASK-003 → `review`.
- **Tâches assignées** : TASK-003 (done, pending orchestrateur review).
- **Blocages** : —
- **Todo perso** : audio CC0 (TASK future).

## Notes
- **Grille char confirmée** : cellules 32×32, mais contenu réel 16×25 px centré dans chaque cellule. La spritesheet source 96×288 contient 3 skins × 3 directions × 3 frames. On extrait les 9 premiers frames (skin néo-zero, rouge), rangés en 3 cols × 3 rows.
- Frame layout : row 0 = down (0,1,2), row 1 = up (3,4,5), row 2 = left (6,7,8). Frame centrale = idle. Right = flipX.
- Walk cycle : `[1, 0, 1, 2]` @8fps (GDD confirmé).
- **Artefacts produits** :
  - `web/public/assets/sprites/player.png` — 96×96 px, 9 frames 32×32
  - `web/public/assets/tiles/neo_zero_tiles_and_buildings_01.png` — 320×320 (10×10 tiles de 32px)
  - `web/public/assets/sprites/neo_zero_props_and_items_01.png` — 160×160
  - `web/public/assets/sprites/portraits/zelda_portrait.png` — 162×256
  - `web/public/assets/sprites/portraits/link.png` — 256×256
- Filtrage nearest : à configurer dans Phaser (`pixelArt: true` déjà dans la config Vite/Phaser via agent-infra).
- Tiles: `neo_zero_tiles_and_buildings_01.png` est un atlas 320×320 = 10 cols × 10 rows de 32×32 — directement utilisable comme tileset Phaser.
- Portraits: scalés via NEAREST depuis sources haute résolution (zelda_portrait 1048×1649→162×256, link 1200×1200→256×256).
- Doc complète : `vault/gdd/02-assets.md`.
</content>
</invoke>
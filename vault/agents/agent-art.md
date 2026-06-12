# agent-art — état

- **Domaine** : pipeline d'assets — découpe sprites Unity (`dev-Egor/Assets/Sprites`), tilemaps, UI, atlas/spritesheets Phaser, sourcing audio CC0.
- **Modèle par défaut** : sonnet.
- **Statut courant** : TASK-015 → `review`. TASK-003 → `review` (pending orchestrateur).
- **Tâches assignées** : TASK-003 (done, pending orchestrateur review), TASK-015 (review).
- **Blocages** : —
- **Todo perso** : remplacer `ambient.ogg` (placeholder synthétisé) par une vraie piste cyberpunk CC0.

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

### TASK-015 — Audio CC0 (2026-06-12)
- Sources : Kenney Sci-Fi Sounds + Interface Sounds (CC0). Ambient : synthétisé ffmpeg.
- Artefacts :
  - `web/public/assets/audio/ambient.ogg` + `.mp3` (30 s loop, placeholder synthétisé)
  - `web/public/assets/audio/interact.ogg` + `.mp3` (laserSmall_000, 0.24 s)
  - `web/public/assets/audio/correct.ogg` + `.mp3` (confirmation_001, 0.29 s)
  - `web/public/assets/audio/wrong.ogg` + `.mp3` (error_001, 0.16 s)
  - `web/public/assets/audio/door.ogg` + `.mp3` (doorOpen_000, 0.53 s)
  - `web/public/assets/audio/ui-click.ogg` + `.mp3` (click_001, 0.10 s)
  - `web/content/audio.json` (manifeste data-driven, clés compatibles TASK-016)
</content>
</invoke>
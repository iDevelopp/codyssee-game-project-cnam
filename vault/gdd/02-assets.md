# GDD — Assets pipeline (02)

> Owner: agent-art. Dernière mise à jour : 2026-06-12.

## 1. Spritesheet joueur — grille confirmée

### Investigation

Source : `dev-Egor/Assets/Sprites/neo_zero_char_01.png` — 96×288 px, RGBA.

La mention « 16×25 frames » dans le GDD initial était la taille du contenu visible de chaque frame, **pas** la taille de cellule de grille. Le fichier `.meta` Unity (mode `spriteMode: 2` = multiple auto-slice) révèle 27 sprites indépendants, chacun de **16×25 px**, positionnés avec des offsets variables (colonne 0 ≈ x=8, colonne 1 ≈ x=40, colonne 2 ≈ x=72).

Candidats testés sur 96×288 :

| Cellule | Cols | Rows | Total | Valide ? |
|---------|------|------|-------|----------|
| 32×32   | 3    | 9    | 27    | ✓ retenu |
| 16×32   | 6    | 9    | 54    | ✗ (trop fragmenté) |
| 32×96   | 3    | 3    | 9     | ✗ (pas assez) |
| 96×32   | 1    | 9    | 9     | ✗ |
| 16×16   | 6    | 18   | 108   | ✗ |

**Grille retenue : 32×32, 3 cols × 9 rows = 27 frames.**

Le contenu visible (16×25 px) est centré dans la cellule 32×32. La normalisation produit un spritesheet uniforme directement chargeable via `this.load.spritesheet()` Phaser.

### Contenu de la sheet (3 skins × 3 directions × 3 frames)

| Rows | Skin | Direction |
|------|------|-----------|
| 0–2  | Néo-Zero (rouge) | down / up / left |
| 3–5  | Teal (bleu-vert) | down / up / left |
| 6–8  | Blonde | down / up / left |

Seuls les rows 0–2 (skin Néo-Zero) sont extraits pour le joueur.

### Fichier produit : `web/public/assets/sprites/player.png`

- Dimensions : **96×96 px** (3 cols × 3 rows × 32×32)
- Frame size Phaser : `{ frameWidth: 32, frameHeight: 32 }`
- Frames 0–8 :

| Frame | Row | Col | Direction | Rôle |
|-------|-----|-----|-----------|------|
| 0     | 0   | 0   | down      | pas gauche |
| 1     | 0   | 1   | down      | **idle** |
| 2     | 0   | 2   | down      | pas droit |
| 3     | 1   | 0   | up        | pas gauche |
| 4     | 1   | 1   | up        | **idle** |
| 5     | 1   | 2   | up        | pas droit |
| 6     | 2   | 0   | left      | pas gauche |
| 7     | 2   | 1   | left      | **idle** |
| 8     | 2   | 2   | left      | pas droit |

### Animations Phaser

```typescript
// Chargement
this.load.spritesheet('player', 'assets/sprites/player.png', {
  frameWidth: 32,
  frameHeight: 32,
});

// Animations (à créer dans la scène ou un système dédié)
this.anims.create({ key: 'walk-down',  frames: [{ key: 'player', frame: 1 }, { key: 'player', frame: 0 }, { key: 'player', frame: 1 }, { key: 'player', frame: 2 }], frameRate: 8, repeat: -1 });
this.anims.create({ key: 'walk-up',   frames: [{ key: 'player', frame: 4 }, { key: 'player', frame: 3 }, { key: 'player', frame: 4 }, { key: 'player', frame: 5 }], frameRate: 8, repeat: -1 });
this.anims.create({ key: 'walk-left', frames: [{ key: 'player', frame: 7 }, { key: 'player', frame: 6 }, { key: 'player', frame: 7 }, { key: 'player', frame: 8 }], frameRate: 8, repeat: -1 });
// walk-right : même que walk-left avec sprite.setFlipX(true)
this.anims.create({ key: 'idle-down',  frames: [{ key: 'player', frame: 1 }], frameRate: 1 });
this.anims.create({ key: 'idle-up',   frames: [{ key: 'player', frame: 4 }], frameRate: 1 });
this.anims.create({ key: 'idle-left', frames: [{ key: 'player', frame: 7 }], frameRate: 1 });
// idle-right : idle-left + flipX
```

Walk cycle : `[1, 0, 1, 2]` → indices locaux dans chaque groupe de 3 frames, @8fps. Droite = flipX du groupe gauche.

---

## 2. Tiles

### `web/public/assets/tiles/neo_zero_tiles_and_buildings_01.png`

- Source : `dev-Egor/Assets/Sprites/neo_zero_tiles_and_buildings_01.png`
- Dimensions : **320×320 px** (copie directe, pas de repack)
- Grille : 10 cols × 10 rows de **32×32 px** = 100 tiles
- Usage Phaser : `this.load.image('tiles', 'assets/tiles/neo_zero_tiles_and_buildings_01.png')` puis `this.make.tilemap(...)` avec tileWidth/tileHeight = 32.

---

## 3. Props

### `web/public/assets/sprites/neo_zero_props_and_items_01.png`

- Source : `dev-Egor/Assets/Sprites/neo_zero_props_and_items_01.png`
- Dimensions : **160×160 px** (copie directe)
- Grille probable : 5 cols × 5 rows de 32×32 = 25 props
- Usage : spritesheet ou atlas selon besoin (agent-moteur).

---

## 4. Portraits

| Fichier | Source size | Web size | Méthode |
|---------|-------------|----------|---------|
| `portraits/zelda_portrait.png` | 1048×1649 | **162×256** | NEAREST downscale (max 256px) |
| `portraits/link.png` | 1200×1200 | **256×256** | NEAREST downscale (max 256px) |

Chemin Phaser : `assets/sprites/portraits/zelda_portrait.png`, idem `link.png`.

Note : ces portraits sont des placeholders. Les portraits définitifs des PNJ Codyssey sont à créer (agent-contenu).

---

## 5. Règles pixel-art

- Filtrage **NEAREST** partout — déjà enforced par `pixelArt: true` dans la config Phaser (agent-infra, TASK-001).
- Échelle ×5 sur le joueur → `player.setScale(5)` en jeu.
- Aucun PNG produit n'a subi de resampling bilinéaire/bicubique. Toutes les opérations Python/Pillow utilisent `Image.NEAREST`.

---

## 6. Carte source → web path

| Source (`dev-Egor/Assets/Sprites/`) | Web path (`web/public/assets/`) |
|--------------------------------------|----------------------------------|
| `neo_zero_char_01.png` (96×288, 27 frames) | `sprites/player.png` (96×96, 9 frames normalisés 32×32) |
| `neo_zero_tiles_and_buildings_01.png` | `tiles/neo_zero_tiles_and_buildings_01.png` |
| `neo_zero_props_and_items_01.png` | `sprites/neo_zero_props_and_items_01.png` |
| `zelda_portrait.png` | `sprites/portraits/zelda_portrait.png` |
| `link.png` | `sprites/portraits/link.png` |

---

## 7. Licence / provenance

- `neo_zero_*` : assets du prototype Unity Codyssey (Egor), usage interne au projet. Pas de licence tierce connue — à confirmer avec Arthur si redistribution publique prévue.
- `zelda_portrait.png`, `link.png` : assets NES Zelda/Link issus de spritesheets publiques (gamebanana/spriters-resource). **Usage placeholder uniquement** — à remplacer par assets originaux avant toute publication.
- Audio CC0 : non encore sourcé — tâche future.
</content>

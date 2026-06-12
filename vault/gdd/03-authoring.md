# Guide d'authoring — Codyssey Web

> Référence pour ajouter du contenu sans toucher au moteur (ADR-002). Tous les fichiers JSON vivent dans `web/content/`. Ajout = fichier de données uniquement.

---

## 1. Ajouter une carte (`cards.json`)

**Fichier** : `web/content/cards.json` — tableau JSON, une entrée par carte.

### Schéma

```json
{
  "id": "string (unique, snake_case)",
  "displayName": "string (nom affiché dans le deck UI)",
  "description": "string (courte description, ~80 caractères max)",
  "usage": "string (exemples d'usage, ~50 caractères max)",
  "era": "string (ex: \"1990s\", \"2000s\" — alimente la frise)"
}
```

### Exemple

```json
{
  "id": "sql",
  "displayName": "SQL",
  "description": "Langage de requêtes pour les bases de données relationnelles.",
  "usage": "Bases de données, back-end",
  "era": "1970s"
}
```

### Règles

- `id` doit être unique dans `cards.json`. Toute référence `expectedCardId` dans `npcs.json` doit correspondre à cet id.
- Le ContentLoader valide les cross-références en dev (`pnpm dev`) : une typo lève une erreur explicite.
- Pas de modif moteur nécessaire.

---

## 2. Ajouter un PNJ (`npcs.json`)

**Fichier** : `web/content/npcs.json` — tableau JSON, un objet par PNJ.

### Schéma

```json
{
  "id": "string (unique, snake_case)",
  "name": "string (nom affiché dans le DialogueBox)",
  "position": { "x": number, "y": number },
  "dialogueLines": ["string", "..."],
  "resolvedLines": ["string", "..."],
  "question": {
    "expectedCardId": "string (id d'une carte existante dans cards.json)",
    "thanksLine": "string (ligne affichée si bonne carte choisie)",
    "hintLine": "string (ligne affichée si mauvaise carte)"
  }
}
```

> `question` peut être `null` pour un PNJ sans question (PNJ narratif uniquement — ne bloque pas la porte).

### Exemple

```json
{
  "id": "npc_alice",
  "name": "Alice",
  "position": { "x": 500, "y": 300 },
  "dialogueLines": [
    "Je cherche un langage pour analyser des données scientifiques.",
    "Il doit être simple à écrire et avoir des bibliothèques de calcul.",
    "Lequel me conseilles-tu ?"
  ],
  "resolvedLines": [
    "Python, bien sûr ! Merci, c'est exactement ce qu'il me faut.",
    "Avec NumPy et Pandas, mes analyses vont aller beaucoup plus vite."
  ],
  "question": {
    "expectedCardId": "python",
    "thanksLine": "Python ! Ses bibliothèques scientifiques sont incroyables. Merci !",
    "hintLine": "C'est un langage interprété, très populaire en data science et IA…"
  }
}
```

### Règles

- `expectedCardId` doit exister dans `cards.json` (validé en dev).
- `dialogueLines` : la dernière ligne est la question posée au joueur (affichée juste avant l'ouverture du deck).
- `resolvedLines` : joués après résolution (si vide, `dialogueLines` sont rejoués sans rouvrir le deck).
- Ajouter le `id` du PNJ dans le tableau `npcs` de la zone concernée (voir §3).

---

## 3. Ajouter une zone

Ajouter une zone = 2 étapes : créer le fichier zone, puis l'enregistrer dans l'index.

### Étape 1 — Fichier zone

**Fichier** : `web/content/zones/<id>.json`

#### Schéma

```json
{
  "id": "string (unique, ex: \"zone_02\")",
  "displayName": "string (nom affiché dans l'UI, ex: \"Zone 2 — L'ère d'Internet\")",
  "tilemap": "string (nom du fichier Tiled JSON dans assets/tiles/, ex: \"zone_02.json\")",
  "spawn": { "x": number, "y": number },
  "npcs": ["npc_id_1", "npc_id_2"],
  "doors": [
    {
      "id": "string (unique dans la zone, ex: \"door_exit\")",
      "position": { "x": number, "y": number },
      "lockedMessageKey": "string (clé dans strings.fr.json)",
      "exitMessageKey": "string (clé dans strings.fr.json)",
      "leadsToZoneId": "string (id zone suivante, optionnel)"
    }
  ],
  "unlockCondition": "all_quest_npcs_helped",
  "nextZoneId": "string (optionnel — id zone suivante si multi-zones)",
  "themeEra": "string (ex: \"2000s\")"
}
```

#### Exemple

```json
{
  "id": "zone_02",
  "displayName": "Zone 2 — L'ère d'Internet",
  "tilemap": "zone_02.json",
  "spawn": { "x": 160, "y": 300 },
  "npcs": ["npc_alice", "npc_bob"],
  "doors": [
    {
      "id": "door_exit_02",
      "position": { "x": 1100, "y": 360 },
      "lockedMessageKey": "door.locked",
      "exitMessageKey": "door.exit"
    }
  ],
  "unlockCondition": "all_quest_npcs_helped",
  "themeEra": "2000s"
}
```

### Étape 2 — Enregistrer dans l'index

**Fichier** : `web/content/zones/index.json`

```json
{
  "zones": ["zone_01", "zone_02"],
  "version": 1
}
```

Ajouter l'id de la nouvelle zone dans le tableau `zones` (ordre = ordre de jeu). Le ContentLoader charge toutes les zones listées au démarrage. Aucune modif moteur.

### Règles

- `id` du fichier doit correspondre à l'entrée `"id"` dans le JSON et à l'entrée dans `index.json`.
- Tous les `npc_id` dans `npcs[]` doivent exister dans `npcs.json`.
- Les `lockedMessageKey` / `exitMessageKey` doivent exister dans `strings.fr.json`.
- Validation complète en dev (ContentLoader lance une erreur explicite sinon).

---

## 4. Ajouter une string UI (`strings.fr.json`)

**Fichier** : `web/content/strings.fr.json` — objet JSON plat `clé → texte`.

### Convention de clés

```
<contexte>.<token>
```

Exemples : `menu.title`, `door.locked`, `hud.interactPrompt`, `end.congrats`.

### Schéma

```json
{
  "clé.token": "Texte affiché au joueur (français)"
}
```

### Exemple

```json
{
  "zone.zone_02": "Zone 2 — L'ère d'Internet",
  "door.locked_02": "La porte est verrouillée. Aide Alice et Bob d'abord."
}
```

### Accès dans le moteur

```typescript
ContentLoader.getInstance().getString('zone.zone_02')
// → "Zone 2 — L'ère d'Internet"
```

Si la clé est absente, `getString()` retourne la clé elle-même et log un warning dans la console — utile pour détecter les oublis sans crasher.

---

## Validation rapide

```bash
cd web
pnpm exec tsc --noEmit   # vérification types
pnpm dev                 # lancer le serveur dev → erreurs ContentLoader en console si données invalides
pnpm build               # build prod
```

En dev, toute incohérence (id manquant, cross-ref cassée, format JSON invalide) lève une erreur explicite avec le chemin exact du problème.

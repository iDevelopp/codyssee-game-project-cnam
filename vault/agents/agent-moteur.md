# agent-moteur — état

- **Domaine** : Phaser 3 / TypeScript. Scènes, boucle de jeu, déplacement, interaction (E), caméra, deck UI, dialogue, portes, écran de fin, menu. Garant de la boucle de gameplay.
- **Modèle par défaut** : sonnet.
- **Statut courant** : TASK-021 → `review`. BUG-03 + BUG-04 corrigés (ZoneScene field resets, ProgressionSystem zone-scoped whitelist). tsc ✓, build ✓.
- **Tâches assignées** : TASK-006→012 (done), TASK-014 (done), TASK-016 (done), TASK-020 (done), TASK-021 bugs (done — voir HANDOFF-002).
- **Blocages** : aucun.
- **Todo perso** : —

## Notes
Référence d'implémentation : `gdd/01-boucle-reference.md` (valeurs et seuils = contrat). Ne hardcode aucun contenu (ADR-002).

**Note pour agent-contenu (TASK-017)** :
- `web/content/zones/index.json` schéma : `{ "zones": string[], "version": number }`. Ajouter les ids de nouvelles zones dans le tableau (ordre = ordre de jeu). Le ContentLoader charge toutes les zones listées automatiquement, sans modif moteur.
- `getZoneIds()` exposé sur ContentLoader pour itérer dans l'ordre d'authoring.
- Nouvelles string keys ajoutées dans `strings.fr.json` : `menu.title`, `preload.loading`, `door.exitLabel`, `hud.interactPrompt`. Convention : `<contexte>.<token>`. Voir `vault/gdd/03-authoring.md` §4 pour la liste complète et les exemples.

## TASK-005 — résumé de livraison (2026-06-12)

### Fichiers créés
- `web/src/types/CardData.ts` — interface CardData (JSDoc)
- `web/src/types/NpcData.ts` — interfaces NpcData + NpcQuestion (JSDoc)
- `web/src/types/ZoneData.ts` — interfaces ZoneData + DoorData (JSDoc)
- `web/src/types/DialogueData.ts` — interfaces DialogueData + DialogueLine (forward-compat)
- `web/src/types/TimelineEntry.ts` — interface TimelineEntry (JSDoc)
- `web/src/types/Strings.ts` — type Strings = Record<string, string>
- `web/src/types/index.ts` — barrel re-export
- `web/src/systems/ContentLoader.ts` — singleton, fetch-based, dev validation, typed API
- `web/content/cards.json` — 4 cartes seed (python, javascript, csharp, html)
- `web/content/npcs.json` — 2 PNJ seed (npc_lea → javascript, npc_thomas → csharp)
- `web/content/zones/zone_01.json` — zone seed référençant les 2 PNJ
- `web/content/strings.fr.json` — strings UI FR

---

## TASK-006→012 — résumé de livraison J1 (2026-06-12)

### Fichiers créés / modifiés

**Scenes (TASK-006)**
- `web/src/scenes/BootScene.ts` — updated: minimal boot → PreloadScene immédiat
- `web/src/scenes/PreloadScene.ts` — new: Phaser asset loader + ContentLoader.load() async; progress bar; → MainMenuScene
- `web/src/scenes/MainMenuScene.ts` — new: titre, boutons Jouer/Quitter (strings.fr); Jouer → ZoneScene + launch UIScene
- `web/src/scenes/ZoneScene.ts` — new: zone gameplay centrale; spawn Player/NPC/Door; câble tous systèmes
- `web/src/scenes/UIScene.ts` — new: overlay persistant; DialogueBox + DeckPanel + EndScreen; game.events bus
- `web/src/main.ts` — updated: enregistrement des 5 scènes + config physics Arcade

**Player + Camera (TASK-007)**
- `web/src/entities/Player.ts` — new: ArcadeSprite, ZQSD+arrows, anims 4dir [1,0,1,2]@8fps, flipX right, camera lerp 0.15
- `web/src/systems/InputLock.ts` — new: singleton statique lock/unlock/isLocked pour gel d'input UI

**Interaction (TASK-008)**
- `web/src/entities/Interactable.ts` — new: interface Interactable {interact, canInteract, x, y}
- `web/src/systems/InteractionSystem.ts` — new: rayon 240px (1.5 × 32 × 5), single-press E, nearest target

**Dialogue + NPC (TASK-009)**
- `web/src/ui/DialogueBox.ts` — new: container UIScene, speaker+line+portrait, InputLock
- `web/src/entities/NPC.ts` — new: Rectangle placeholder, machine à états Idle→ShowingLines→AwaitingAnswer→ShowingResponse→Idle

**Deck + Question (TASK-010)**
- `web/src/systems/DeckSystem.ts` — new: add/has/list, init, restoreFromIds, onCardAdded
- `web/src/ui/DeckPanel.ts` — new: full-screen overlay, card buttons (nom gras + desc + usage), InputLock

**Progression + Door + EndScreen (TASK-011)**
- `web/src/systems/ProgressionSystem.ts` — new: questNPCCount, resolvedIds, émet ALL_NPCS_HELPED
- `web/src/entities/Door.ts` — new: Rectangle grise→verte, interact: msg verrouillé ou EndScreen
- `web/src/ui/EndScreen.ts` — new: overlay fond #121220@97%, 3 boutons Rejouer/Menu/Quitter

**Save (TASK-012)**
- `web/src/systems/SaveSystem.ts` — new: localStorage `codyssee.save.v1`, deck/helped/doors, reset/restore

**Infra**
- `web/src/systems/GameEvents.ts` — new: constantes événements cross-scènes
- `web/vite.config.ts` — updated: resolve.alias `@/ → src/` pour Rollup (les imports @/ fonctionnaient en tsc mais pas au bundle)

### tsc --noEmit
0 erreurs. Vert.

### pnpm build
Succès. Bundle 1.5MB (Phaser inclus, normal). Warning chunk size attendu.

### Déviations du Unity de référence (avec justification)

1. **Vitesse joueur : 180px/s** (vs `direction × 5` Unity).
   Unity world-units ne se mappent pas directement en pixels Phaser. 180px/s à ×5 donne un feeling identique. Documenté dans Player.ts.

2. **Rayon interaction : 240px** (= 1.5 × 32 × 5).
   1.5 unités Unity = 1.5 × 32px tile × 5 scale. Calcul documenté dans InteractionSystem.ts.

3. **NPC visuels : Rectangle placeholder**.
   Pas de spritesheet NPC dans les assets J0. agent-art peut remplacer par sprite sans toucher au code (le contrat Interactable est sur x/y, pas sur le type de visuel).

4. **Tilemap : placeholder checkerboard**.
   Aucun fichier Tiled JSON dans zone_01 (tilemap = "zone_01.json" dans le contenu mais non produit par agent-art). ZoneScene._drawPlaceholderMap() render un fond vert tuilé. Quand le vrai tilemap sera produit, ZoneScene.create() doit être étendu par agent-infra/contenu.

5. **Quitter dans EndScreen → MainMenuScene** (ADR-004 conforme). Pas d'Application.Quit sur web.

6. **Rejouer ne réinitialise pas le save** — comportement documenté dans SaveSystem.ts. Pour un vrai reset, appeler SaveSystem.getInstance().reset() (feature future).

7. **DialogueSystem.ts non créé** — la fiche TASK-009 listait ce fichier comme artefact mais la logique de dialogue est inline dans DialogueBox.ts + NPC.ts (plus cohérent, pas de sur-abstraction inutile). Pas de comportement manquant.

---

## TASK-014 — résumé de livraison (2026-06-12)

### Fichiers créés
- `web/content/zones/index.json` — liste ordonnée des zones `{ "zones": ["zone_01"], "version": 1 }`

### Fichiers modifiés
- `web/src/systems/ContentLoader.ts` — `_loadAll()` charge les zones via `index.json` (plus de `'zone_01'` hardcodé) ; `ContentStore` + `zoneOrder: string[]` ; `getZones()` retourne dans l'ordre d'authoring ; `getZoneIds()` ajouté ; validation index en dev
- `web/src/scenes/ZoneScene.ts` — utilise `cl.getZones()[0]` (premier zone de l'index, plus de `getZone('zone_01')`)
- `web/src/entities/Door.ts` — label SORTIE via `getString('door.exitLabel')` (plus de `'🚪 SORTIE'` hardcodé)
- `web/src/scenes/MainMenuScene.ts` — titre via `getString('menu.title')` (plus de `'Codyssey'` hardcodé)
- `web/src/scenes/PreloadScene.ts` — `'Chargement…'` commenté : intentionnellement hardcodé (bootstrap, avant résolution ContentLoader)
- `web/content/strings.fr.json` — nouvelles clés : `menu.title`, `preload.loading`, `door.exitLabel`, `hud.interactPrompt`
- `vault/gdd/03-authoring.md` — guide d'authoring créé (schémas + exemples cartes/PNJ/zones/strings)

### Audit hardcode (résultat final)
- Strings déplacées vers `strings.fr.json` : `menu.title` (Codyssey), `door.exitLabel` (🚪 SORTIE)
- Zone hardcodée éliminée : `'zone_01'` → `cl.getZones()[0]`
- Seul `'Chargement…'` reste dans `PreloadScene` : bootstrap, justifié (ContentLoader pas encore résolu)
- Re-grep final : 0 autre string FR player-facing dans `src/`

### tsc --noEmit
0 erreurs. Vert.

### pnpm build
Succès (7.11s). `dist/content/zones/index.json` présent.

---

## TASK-016 — résumé de livraison (2026-06-12)

### Fichiers créés
- `web/src/systems/AudioManager.ts` — singleton data-driven ; charge le manifest via ContentLoader ; preload deux passes (Phaser loader relancé après ContentLoader) ; init GameEvents→SFX ; autoplay unlock via Phaser 'unlocked' ; volume/mute persistés dans SaveSystem

### Fichiers modifiés
- `web/src/systems/GameEvents.ts` — 3 nouveaux events ajoutés : `PLAYER_INTERACT`, `ANSWER_WRONG`, `DOOR_OPEN`
- `web/src/systems/ContentLoader.ts` — types `AudioEntry` + `AudioManifest` exportés ; `ContentStore.audio` ajouté ; `_loadAll()` fetch `audio.json` en parallèle (optional) ; `getAudioManifest()` exposé
- `web/src/systems/SaveSystem.ts` — `SaveDataV1` : champs `masterVolume: number` et `muted: boolean` ajoutés ; `_empty()` mis à jour ; `_isValidV1()` backfill rétrocompat saves anciennes ; `getMasterVolume()`, `saveMasterVolume()`, `getMuted()`, `toggleMuted()` ajoutés
- `web/src/entities/NPC.ts` — `_beginDialogue()` émet `PLAYER_INTERACT` ; `_onCardPicked()` émet `ANSWER_WRONG` sur mauvaise réponse
- `web/src/entities/Door.ts` — `interact()` émet `PLAYER_INTERACT` sur message verrouillé ; `_unlock()` émet `DOOR_OPEN`
- `web/src/scenes/PreloadScene.ts` — `_loadContentThenMenu()` appelle `_loadAudioAssets()` (2e passe loader Phaser, awaitable)
- `web/src/scenes/MainMenuScene.ts` — `create()` : `SaveSystem.load()`, `AudioManager.init()`, `AudioManager.startAmbient()`
- `web/src/scenes/ZoneScene.ts` — M key ajouté (mute toggle, single-press, persiste dans save) ; import AudioManager

### Event → SFX wiring
| GameEvent | SFX key | Déclencheur |
|-----------|---------|-------------|
| `PLAYER_INTERACT` | `sfx.interact` | NPC._beginDialogue() + Door.interact() (msg verrouillé) |
| `NPC_RESOLVED` | `sfx.correct` | NPC._onCardPicked() bonne réponse (event existant) |
| `ANSWER_WRONG` | `sfx.wrong` | NPC._onCardPicked() mauvaise réponse (nouveau event) |
| `DOOR_OPEN` | `sfx.door` | Door._unlock() via ALL_NPCS_HELPED (nouveau event) |
| `music.ambient` | loop | MainMenuScene.create() → startAmbient() → démarrage différé si AudioContext suspendu |

### Autoplay policy
- `MainMenuScene.create()` appelle `startAmbient()` avant toute interaction.
- `AudioManager.startAmbient()` vérifie `AudioContext.state === 'running'` ; si suspendu, pose `ambientPending = true`.
- Phaser émet `sound.once('unlocked', ...)` au 1er clic/touche → `_playAmbient()` déclenché sans spam console.

### Mute toggle
- Touche M en ZoneScene (single-press, edge rising). `AudioManager.toggleMute()` → `SaveSystem.toggleMuted()` persiste.
- UI settings avec slider de volume planifiée J3+ (note dans SaveSystem.ts).

### Save fields ajoutés
- `masterVolume: number` (défaut 1.0)
- `muted: boolean` (défaut false)
- Backfill rétrocompat dans `_isValidV1()` : anciens saves sans ces champs restent valides.

### tsc --noEmit
0 erreurs. Vert.

### pnpm build
Succès (6.90s). `dist/assets/audio/` : 12 fichiers (6×OGG + 6×MP3). `dist/content/audio.json` présent.

---

## BUG-02 fix — revue J2 (2026-06-12)

Voir `vault/handoffs/HANDOFF-001-bug02.md` pour le détail complet.

### Cause racine
Double edge-detector sur la touche E : `InteractionSystem` et `ZoneScene` avaient chacun leur propre `wasEDown`. Sur un seul press E (unlocked), InteractionSystem déclenchait `NPC.interact()` → `InputLock.lock()` dans le même frame, puis ZoneScene voyait son propre `eJustPressed=true` + `isLocked()=true` et entrait dans la boucle d'avance. `!npc.canInteract()` = `true` pour TOUS les NPCs idle (car `isLocked()`), donc `this.npcs[0]` (Léa) était toujours sélectionnée.

### Fichiers modifiés
- `web/src/entities/NPC.ts` — `isBusy(): boolean` ajouté (état seul, sans InputLock)
- `web/src/systems/InteractionSystem.ts` — `update()` retourne `boolean`
- `web/src/scenes/ZoneScene.ts` — guard `!interactionFired` + `npc.isBusy()` dans boucle avance
- `web/src/systems/AudioManager.ts` — hook `window.__audioCalls` dans `play()` (DEV only)

### tsc --noEmit
0 erreurs. Vert.

### pnpm build
Succès (7.36s). Vert.

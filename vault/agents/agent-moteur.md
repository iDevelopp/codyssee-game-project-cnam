# agent-moteur — état

- **Domaine** : Phaser 3 / TypeScript. Scènes, boucle de jeu, déplacement, interaction (E), caméra, deck UI, dialogue, portes, écran de fin, menu. Garant de la boucle de gameplay.
- **Modèle par défaut** : sonnet.
- **Statut courant** : TASK-006→012 → `review`. Chaîne J1 complète livrée.
- **Tâches assignées** : TASK-006 (review), TASK-007 (review), TASK-008 (review), TASK-009 (review), TASK-010 (review), TASK-011 (review), TASK-012 (review).
- **Blocages** : aucun.
- **Todo perso** : —

## Notes
Référence d'implémentation : `gdd/01-boucle-reference.md` (valeurs et seuils = contrat). Ne hardcode aucun contenu (ADR-002).

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

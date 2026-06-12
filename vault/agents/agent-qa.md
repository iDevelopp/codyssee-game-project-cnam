# agent-qa — état

- **Domaine** : tests E2E Playwright (lancer le build, piloter le clavier, asserter les critères d'acceptation, captures), non-régression.
- **Modèle par défaut** : sonnet.
- **Statut courant** : TASK-018 livrée → `review`.
- **Tâches assignées** : TASK-013 (QA J1 — done), TASK-018 (QA J2 — review).
- **Blocages** : BUG-02 (InteractionSystem) bloquant A2/A3/A4 — owner agent-moteur.

## Session 2026-06-12 — QA J1

### Méthode
- Build : `pnpm build` ✓ (aucune erreur TypeScript ni Vite).
- Serveur dev (5173) utilisé car preview (4173) non fonctionnel (BUG-01 ci-dessous).
- Tests via MCP Playwright (`browser_run_code_unsafe` pour `page.mouse.click` et `page.keyboard`).
- 62 screenshots capturés dans `web/tests/e2e/screenshots/`.

### Résultats

| # | Critère | Résultat |
|---|---------|----------|
| C1 | Menu principal + Jouer → zone | **PASS** |
| C2 | Déplacement ZQSD+flèches, animé 4 dirs, caméra suit | **PASS** |
| C3 | Près NPC, E → dialogue ligne par ligne → deck | **PASS** |
| C4 | Mauvaise carte → indice + retry ; bonne → remerciements + carte ajoutée | **PASS** |
| C5 | Tous PNJ aidés → porte verte → écran de fin (Rejouer/Menu/Quitter) | **PASS** |
| C6 | Progression survit au reload (localStorage) | **PASS** |

### Bugs découverts

**BUG-01 (bloquant prod) — `web/content/` absent du build de production**
- Owner : agent-infra.
- `pnpm preview` → ContentLoader échoue car `/codyssee/content/cards.json` retourne `text/html`.
- `web/content/` n'est pas dans `web/public/`, donc Vite ne l'embarque pas dans `dist/`.
- Fix : `mv web/content/ web/public/content/` ou plugin `vite-plugin-static-copy`.

**OBS-01 (UX) — chevauchement rayon interaction Léa/Thomas**
- Rayon 240px + distance Léa-Thomas 377px → zone de chevauchement possible.
- `_findNearest` peut cibler Léa (résolue, Idle=false... non, Idle=true pour resolved NPC) plutôt que Thomas.
- Note : la distance Léa→Thomas en pixels = sqrt((640-320)²+(400-240)²) ≈ 358px, donc en dehors du rayon → pas de problème réel.
  - Observation de session : le joueur était parfois trop proche de Léa (ré-triggerait ses resolvedLines) → besoin de s'éloigner davantage vers Thomas.
  - Ce comportement est CORRECT (nearest-first), mais peut dérouter le joueur.

**OBS-02 — favicon 404** : cosmétique, aucun impact.

## Session 2026-06-12 — QA J2 (TASK-018)

### Méthode
- Build : `pnpm build` ✓ (7.11s, 0 erreur TypeScript ni Vite).
- Preview lancé sur port 4175 (4173 et 4174 occupés).
- Tests Playwright headless Chromium via `npx playwright test` (installé en session).
- Spec principale : `web/tests/e2e/j2-audio-content.spec.js`.
- 28 screenshots + 13 scripts de diagnostic dans `web/tests/e2e/screenshots/`.
- Artefacts de diagnostic : `diag-test.js` à `diag13-test.js` (éphémères, non commitables).

### Résultats

| # | Critère | Résultat | Raison du FAIL |
|---|---------|----------|----------------|
| A5 | Build prod : dist/content + dist/assets/audio présents | **PASS** | — |
| A1 | Audio câblé : SFX déclenchés sur events | **FAIL** | AudioContext suspendu headless (autoplay policy) ; 0 calls AudioBufferSourceNode.start() observés |
| A2 | Volume/mute persisté après reload | **FAIL** | BUG-02 : touche M ignorée (InteractionSystem toujours sur Léa + InputLock ?) ; save.muted reste false après M press |
| A3 | 3 PNJ + 8 cartes + porte s'ouvre | **FAIL** | BUG-02 : InteractionSystem._findNearest() retourne toujours npc_lea quelle que soit la position du joueur |
| A4 | Non-régression J1 (6/6) | **FAIL** | R5 échoue à cause de BUG-02 (impossible d'aider Thomas/Clara → porte ne s'ouvre pas) |

### A5 — PASS (détail)
- `dist/content/` : audio.json, cards.json, npcs.json, strings.fr.json, zones/index.json, zones/zone_01.json — 6 fichiers ✓
- `dist/assets/audio/` : 12 fichiers (6×OGG + 6×MP3) ✓
- `pnpm build` exit 0 ✓

### A1 — FAIL (détail audio)
- **Méthode** : `context.addInitScript` → monkey-patch `AudioBufferSourceNode.prototype.start` et `HTMLAudioElement.prototype.play` avant chargement de la page.
- **Résultat** : 0 appels sur toute la session (interact, wrong card, correct card).
- **Cause** : AudioContext suspendu par autoplay policy du navigateur headless. Phaser ne peut pas créer de sons si le contexte est en état `suspended`. Après interaction clavier, le contexte ne se déverrouille pas automatiquement sans un vrai geste utilisateur (click).
- **Note** : le câblage côté code est correct (AudioManager._bindEvents wired : PLAYER_INTERACT→sfx.interact, NPC_RESOLVED→sfx.correct, ANSWER_WRONG→sfx.wrong, DOOR_OPEN→sfx.door, via GameEvents bus). Vérification statique OK — la fonctionnalité audio existe dans le code, elle est juste non-vérifiable en headless sans un workaround de type `AudioContext.resume()` forcé.
- **Screenshots** : j2-002 (interact), j2-003 (wrong), j2-004 (correct).

### A2 — FAIL (détail mute)
- **Méthode** : Appuyer sur M après chargement zone, lire `localStorage.getItem('codyssee.save.v1')`.
- **Résultat** : `save.muted` reste `false` après M press ; après reload, save est `null` (zone pas chargée à temps).
- **Hypothèse** : BUG-02 provoque l'ouverture de la DialogueBox Léa au press de E (juste avant A2), ce qui verrouille InputLock. Le M key check dans ZoneScene est dans `update()` — si InputLock était actif, la touche M pourrait être ignorée. Autre hypothèse : le canvas n'a pas le focus au moment du M press.
- **Screenshots** : j2-005 (zone avec M pressé, pas de changement visible), j2-006 (menu après reload).

### A3 — FAIL (détail BUG-02 InteractionSystem)
- **Comportement observé** : quelle que soit la position du joueur (y compris world ~(1060,183), à 160px de Clara et à 742px de Léa), le press E ouvre le dialogue de Léa : "Bonjour ! Je construis des sites web depuis quelques mois."
- **Preuve** : `helpedNpcIds: ["npc_lea"]` après tentatives Thomas et Clara. Screenshot `diag12-02-e1.png` : joueur visuellement adjacent à Clara (NPC label "Clara" visible en haut), dialogue de Léa ouvert en bas.
- **Diagnostic 13 scripts** :
  - diag9 : navigation vers Thomas → Léa répond toujours
  - diag11 : `window.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight'}))` reçu par Phaser (confirmé via captures) ; E press → Léa
  - diag12 : joueur à world (1060,183) next to Clara (900,180), E → Léa. **Smoking gun.**
  - diag13 : E dispatché via `window.dispatchEvent` direct near Clara → Léa
- **Ce qui est exclu** : scaling offset (canvas 1280×720 à (0,0), vérifié via `getBoundingClientRect`), keyboard non-reçu par Phaser (confirmé reçu).
- **Hypothèse principale** : Thomas et Clara ne sont pas dans `this.interactables` Set (InteractionSystem) au moment du E press, OU leur `canInteract()` retourne false systématiquement, OU `npc.x`/`npc.y` retournent des valeurs erronées (ex. 0,0 au lieu des valeurs world). Impossible de confirmer : Vite bundle le moteur, pas d'accès à `window.__phaserGame` depuis Playwright.
- **Owner fix** : agent-moteur.

### A4 — FAIL (non-régression partielle)
- R1 Menu→Zone : PASS
- R2 Déplacement 4 directions : PASS
- R3 Dialogue ligne par ligne + deck : PASS (Léa uniquement)
- R4 Mauvaise carte + bonne carte + remerciements : PASS (Léa uniquement)
- R5 Tous PNJ aidés → porte → écran de fin : **FAIL** (BUG-02, idem A3)
- R6 Persistance reload : PASS pour npc_lea (save survit au reload)

### Bugs découverts

**BUG-02 (bloquant) — InteractionSystem._findNearest() sélectionne toujours npc_lea**
- **Symptôme** : E press ouvre Léa quelle que soit la position du joueur.
- **Repro minimal** :
  1. Lancer `pnpm preview` (build prod, port ~4175)
  2. Charger `/codyssee/`, Jouer
  3. Naviguer vers Thomas (world ~640,400) ou Clara (world ~900,180) avec flèches directionnelles
  4. Appuyer E → dialogue "Léa" s'ouvre
- **Observé** : helpedNpcIds = ["npc_lea"] après 3 tentatives E near Thomas/Clara
- **Attendu** : dialogue Thomas (csharp) / Clara (sql) selon la position
- **Preuve screenshot** : `web/tests/e2e/screenshots/diag12-02-e1.png`
- **Impact** : A2 (mute), A3 (3 PNJ + porte), A4/R5 bloqués
- **Owner** : agent-moteur — vérifier `InteractionSystem.register()`, `_findNearest()`, et `NPC.canInteract()` pour Thomas/Clara

### Notes techniques QA J2
- WebGL framebuffer unsupported sur première navigation headless — bénin, le jeu tourne quand même.
- Port preview : 4173 et 4174 occupés → serveur sur 4175.
- Playwright Chromium installé en session : `npx playwright install chromium` (175MB).
- Spec finale : `web/tests/e2e/j2-audio-content.spec.js` — conservée pour re-run après correction BUG-02.
- Rapport JSON : `web/tests/e2e/qa-report-j2-2026-06-12.json`.

---

## Session 2026-06-12 — RE-TEST QA J2 (après BUG-02 fix)

### Méthode
- DEV server (5173) pour A1 uniquement (window.__audioCalls hook actif en import.meta.env.DEV).
- Preview (4173) pour A2-A4.
- Spec : `web/tests/e2e/j2re-audio-content.spec.js` (nouvelle spec re-test).
- 37 screenshots dans `web/tests/e2e/screenshots/j2re-*`.
- Rapport JSON : `web/tests/e2e/qa-report-j2re-2026-06-12.json`.
- Technique clé : `keyboard.down('e') + wait(80ms) + keyboard.up('e')` pour rising-edge Phaser en headless (keydown+keyup Playwright trop rapide pour rAF sinon).

### Résultats

| # | Critère | Résultat |
|---|---------|----------|
| A1 | Audio câblé : sfx.interact + sfx.wrong + sfx.correct dans `__audioCalls` | **PASS** |
| A2 | Mute/unmute persisté après reload | **PASS** |
| A3 | 3 PNJ (Léa/Thomas/Clara) + 8 cartes + porte + écran fin | **PASS** |
| A4 | Non-régression J1 (6/6 critères) | **PASS** |
| A5 | Build prod : dist/content + dist/assets/audio présents | **PASS** |

### BUG-02 régression — CONFIRMÉ RÉSOLU
- Léa speaker: "Bonjour ! Je construis des sites web depuis quelques mois." (j2re-009)
- Thomas speaker: "Salut ! Je développe un jeu vidéo en ce moment." (j2re-013)
- Clara speaker: "Bonjour voyageur ! Je travaille sur une base de données pour notre bibliothèque." (j2re-017)
- `helpedNpcIds: ["npc_lea","npc_thomas","npc_clara"]` — 3/3 résolvables
- `deckCardIds: ["python","html","c","java","rust","javascript","csharp","sql"]` — 8 cartes

### Console
- 0 erreurs, 0 page errors. 8 warnings WebGL ReadPixels (headless GPU, bénins).

### Notes techniques
- Navigation Clara : UP 1800ms avant RIGHT 1600ms — évite rayon 240px de la porte (door.canInteract() = !InputLock.isLocked(), toujours vrai quand déverrouillé).
- music.ambient via `ambientTrack.play()` ne passe pas par `play(key)` → absent de __audioCalls. Comportement attendu, documenté dans HANDOFF-001.
- Zigzag A4/R2 (600ms chaque direction) pour reset position sans pousser aux bounds.

---

## Notes générales
Chaque jalon passe par agent-qa avant d'être déclaré `done`. Critères d'acceptation V1 : menu→zone, déplacement animé 4 directions, caméra qui suit, E→dialogue→deck, mauvaise=indice+retry, bonne=remerciement+gain, tous PNJ→porte verte→écran de fin, persistance localStorage après reload.

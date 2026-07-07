---
id: HANDOFF-005
titre: Bugs visuels prod (deck/timeline/intro/depth) — investigation orchestrateur
date: 2026-06-12
from: orchestrateur
to: agent-moteur (fix Fable 5)
severity: high
---

## Contexte
Arthur signale "ça bug de fou" en jouant. Reproduction live via Playwright MCP sur build prod (`vite preview`), observation VISUELLE (screenshots). **Les QA J4/J5 étaient aveugles** : elles s'appuyaient sur `window.__phaserGame`, **jamais défini dans le bundle** (`grep` vide dans src/) → introspection nulle, verdicts non fiables, régressions visuelles non détectées. Les layouts J4 (deck, frise) tournaient pour peu d'éléments ; l'expansion J5 (19 cartes, 19 entrées) les a cassés.

## Bugs confirmés (avec captures /home/ubuntu/dbg-*.png)

### BUG-06 — DeckPanel déborde de l'écran (CRITIQUE) — dbg-09
`DeckPanel.open()` affiche TOUTES les cartes (19) en UNE ligne horizontale : `startX + i*(200+20)` = 4160px, `startX` clampé à 40 → 1re carte (origine centre) coupée à gauche (centre x=40 → bord gauche -60), reste hors écran à droite. Commentaire obsolète : "scroll not needed for J1 with 4 cards".
**Fix** : layout GRILLE responsive (colonnes calculées pour tenir dans 1280×720, plusieurs lignes, taille carte réduite si besoin, grille centrée). Doit tenir jusqu'à 19 cartes. Garder clic-pour-choisir + hover.

### BUG-07 — Frise chronologique cassée/illisible (CRITIQUE) — dbg-12
Touche T : les labels de nœuds (langage+année, "???" pour verrouillé) flottent SUR la zone de jeu (NPC jaunes/joueur/porte visibles à travers) — **le fond sombre n'apparaît pas** alors que `bg` (depth 400, alpha .93) et TimelineScene est dernière dans la scene list (donc censée être au-dessus). De plus 19 nœuds tassés sur ~1120px (~59px d'écart) → labels qui se chevauchent.
Données OK (années 1957–2016, pas de valeur aberrante).
**À investiguer au runtime** (le sous-agent doit reproduire visuellement) :
- Ordre de rendu des scènes : vérifier `game.scene.scenes` order après `scene.start('ZoneScene')`. Soupçon : TimelineScene n'est pas réellement au-dessus, OU `bg.setVisible(true)` inopérant. Si labels (créés dans `_rebuild`, non gérés par `_setVisible`) s'affichent mais pas `bg`/`gfx`, c'est incohérent dans une seule scène → creuser. Piste : appeler `this.scene.bringToTop()` dans `_open()`.
- Layout 19 entrées : élargir l'espacement (axe plus large + scroll, OU 2 rangées, OU labels alternés plus espacés) pour lisibilité.
**Vérifier visuellement** : fond sombre couvre, frise lisible, 19 nœuds non chevauchants, flèches d'influence OK.

### BUG-08 — Menu principal visible derrière l'intro — dbg-02
Nouvelle partie : `MainMenuScene` lance UIScene+TimelineScene puis émet `INTRO_SHOW` (NarrativeOverlay) et ne `start('ZoneScene')` qu'au callback. Pendant l'intro, MainMenuScene rend encore titre+boutons derrière l'overlay semi-transparent.
**Fix** : masquer MainMenuScene (display objects ou `scene.sleep`) pendant l'intro, OU rendre le fond de NarrativeOverlay opaque. S'assurer que le callback `scene.start('ZoneScene')` fonctionne toujours.

### BUG-09 — Joueur rendu derrière les PNJ (depth) — dbg-04
Le joueur passe DERRIÈRE les rectangles PNJ. Aucun `setDepth` sur NPC/Player.
**Fix** : depth par Y (tri top-down) ou joueur au-dessus des PNJ. Mineur mais visible.

## Résolutions (agent-moteur, 2026-06-12)

Tous les bugs reproduits au runtime (Playwright + `window.__game`) puis vérifiés visuellement après fix. `pnpm exec tsc --noEmit` 0 erreur, `pnpm build` vert.

### Introspection QA débloquée
`web/src/main.ts` expose désormais `(window as any).__game` (gardé en prod, lecture seule). Les futures QA peuvent lire `__game.scene.scenes` / état interne au lieu d'être aveugles.

### BUG-06 — RÉSOLU (`web/src/ui/DeckPanel.ts`)
Grille responsive : itération sur le nombre de colonnes, scale = min(1, fitW, fitH), choix du meilleur scale. 19 cartes → 5×4 à scale 1, dernière rangée centrée, grille centrée verticalement. Hover + clic conservés. Bonus : `wordWrap` sur la ligne usage (débordait sur les cartes voisines). Vérifié : 19 cartes lisibles dans 1280×720, hover bleu OK, pick OK.

### BUG-07 — RÉSOLU (`web/src/scenes/TimelineScene.ts` + `web/src/scenes/ZoneScene.ts`)
Causes réelles confirmées au runtime (3, aucune n'était l'ordre des scènes — TimelineScene était bien au-dessus, `renderOrder=[Zone, UI, Timeline]`) :
1. **`BG_ALPHA 0.93`** : les placeholders jaunes vifs traversaient le fond → impression de fond absent. Fix : alpha 1 (opaque). + `scene.bringToTop()` défensif dans `_open()`.
2. **Race T toggle** : le keydown T peut arriver ENTRE `ZoneScene.update` et `TimelineScene.update` du même frame → la frise se fermait et se rouvrait sur la même pression (instrumenté : 1 pression = `_close`+`_open`). Fix : suppression d'edge des deux côtés (`wasTDown = true` dans `TimelineScene._open()` et dans le handler `TIMELINE_CLOSE` de ZoneScene) → une pression = un toggle, release obligatoire entre deux.
3. **`_setVisible` incomplet** : ne masquait pas `nodeZones`/`nodeLabelTexts` (créés dans `_rebuild`) → labels fantômes flottant sur le jeu après fermeture (= exactement dbg-12, produit par la race nº2 : open crée les labels, close immédiat cache bg/gfx mais pas les labels). Fix : `_setVisible` couvre désormais ces listes.
Layout 19 nœuds : espacement uniforme par index (l'échelle linéaire par année empilait le cluster 1993/1995×3 sur la même colonne), stagger 4 niveaux (`NODE_TIERS`), année dans chaque label, marqueurs décennies supprimés (redondants). Vérifié : fond couvre tout, 19 nœuds sans chevauchement, flèche d'influence Rust→Swift visible, panneau détail au survol OK, fermeture T propre + mouvement rendu.

### BUG-08 — RÉSOLU (`web/src/scenes/MainMenuScene.ts`)
Pendant l'intro : `cameras.main.setVisible(false)` + `input.enabled = false` (les boutons restaient cliquables sous l'overlay → un clic "avancer l'intro" pouvait re-déclencher Jouer). Reset défensif des deux dans `create()` (singleton réutilisé au retour menu). Vérifié : intro sur fond noir propre, avance au clic, `scene.start('ZoneScene')` au callback OK.

### BUG-09 — RÉSOLU (`web/src/entities/Player.ts`, `web/src/entities/NPC.ts`)
Y-sort top-down : `depth = y + displayHeight/2` (pieds). NPC + label nom au constructeur, Player synchronisé chaque frame dans `move()`. Vérifié : joueur devant Léa au sud, derrière au nord.

## Notes
- PNJ = gros rectangles jaunes placeholder (dette art connue, pas un bug). NPCs énormes (32×48 ×5). Optionnel : réduire l'échelle placeholder.
- Vérifier non-régression boucle complète après fixes (menu→intro→zone→dialogue→deck→frise→transitions→fin).
- Préview de debug tourne déjà sur `http://localhost:4199/codyssee/`.

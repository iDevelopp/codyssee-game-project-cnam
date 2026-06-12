# Boucle de gameplay de référence (parité Unity `dev-Egor`)

> Cartographie exacte du prototype Unity à reproduire fidèlement en Phaser (jalon J1). Extrait des 15 scripts C#. Valeurs et seuils = contrat d'implémentation.

## Vue d'ensemble

Menu principal → bouton **Jouer** charge Zone_1 → joueur se déplace → s'approche d'un PNJ → **E** → dialogue ligne par ligne → ouverture du deck → choix d'une carte-réponse → bonne réponse (remerciement + gain carte) / mauvaise (indice + retry) → tous les PNJ à question aidés → la porte passe gris→vert → **E** sur la porte → écran de fin (Rejouer / Menu / Quitter).

## Déplacement (`move.cs`)

- Vitesse : **5** unités (vélocité = direction × 5, appliquée en FixedUpdate).
- Touches : gauche `←`/`A`(Q azerty), droite `→`/`D`, haut `↑`/`W`(Z azerty), bas `↓`/`S`. (ZQSD + flèches.)
- Input gelé quand UI ouverte : `DialogueBox.IsOpen || DeckUI.IsOpen || EndScreenUI.IsOpen`.

## Animation joueur (`move.cs`)

- Sheet `neo_zero_char_01.png` (96×288 px). ⚠️ Découpe exacte à confirmer par agent-art (16×25 annoncé mais ne divise pas proprement 96×288 — investiguer).
- Index logiques : bas `0,1,2` / haut `3,4,5` / gauche `6,7,8`. Frame milieu (1/4/7) = immobile.
- Droite = gauche en miroir (`flipX`).
- Cycle de marche : `[1, 0, 1, 2]` (immobile → pas gauche → immobile → pas droit), en boucle.
- Vitesse : `framesPerSecond = 8` → 0.125 s/frame. À l'arrêt : frame immobile.
- Échelle ×5, filtrage nearest (pixel-art, pas d'antialiasing).

## Interaction (`PlayerInteraction.cs`)

- Touche **E**.
- Rayon **1.5** unité (overlap circle autour du joueur).
- Cible = `IInteractable` le plus proche avec `CanInteract() == true`.

## Dialogue (`DialogueBox.cs` + `NPC.cs`)

- Singleton overlay (nom locuteur, ligne, portrait optionnel, jusqu'à 3 choix).
- Avance ligne par ligne à chaque **E**.
- Machine à états PNJ : `Idle → ShowingLines → (AwaitingAnswer | ShowingChoices) → ShowingResponse → Idle`.
- Dernière ligne de `dialogueLines` = la question. Après la dernière ligne : si question non résolue → ouverture deck ; sinon fin.
- `CanInteract()` PNJ = false pendant choix/attente de réponse.

## Deck & cartes (`Deck.cs`, `CardData.cs`, `CardDatabase.cs`, `DeckUI.cs`)

- `CardData` : `displayName`, `description`, `usage`, `icon` (icon inutilisé côté logique).
- Deck initial (`GameManager.Start`) = **toutes les cartes SAUF les `expectedAnswer` des PNJ** (`GetComplement`). Chaque bonne réponse est donc une carte réellement nouvelle.
- `DeckUI.Open(cartes, onPicked, titre)` : N cartes en boutons horizontaux (nom gras, description, usage italique gris). Clic → callback → fermeture.
- `Deck.Add(carte)` : ajoute si absente, émet `OnCardAdded`.

## Question / réponse (`NPC.cs`)

- `Question { expectedAnswer, thanksLine, hintLine }`.
- Présentation : `DeckUI.Open(toutes les cartes, OnCardPicked, "Quelle carte répond à sa question ?")`.
- Bonne carte (`picked == expectedAnswer`) : `IsResolved = true` ; `playerDeck.Add(picked)` ; affiche `thanksLine` ; émet `OnQuestionResolved`.
- Mauvaise : affiche `hintLine` ; retour `ShowingResponse` ; **E** rouvre la question (retry illimité).
- `resolvedLines` joués après résolution (fallback `dialogueLines` si vide) ; la question n'est plus reposée.

## Progression (`GameManager.cs`)

- `questNPCCount` = nb de PNJ ayant une `expectedAnswer` (PNJ sans question ne bloquent pas).
- `HandleNPCResolved` : `NPCsHelped++` ; si `NPCsHelped >= questNPCCount` → émet `OnAllNPCsHelped`.

## Porte (`Door.cs`)

- `IInteractable`, toujours `CanInteract() == true`.
- Couleurs : fermée `(0.3,0.3,0.3)` gris ; ouverte `(0.4,1,0.4)` vert.
- S'abonne à `OnAllNPCsHelped` → `Open()` (couleur verte, sprite optionnel).
- **E** fermée → `lockedMessage` via dialogue (2e E ferme). **E** ouverte → `EndScreenUI.Show(exitMessage)`.

## Écran de fin (`EndScreenUI.cs`)

- Overlay plein écran (fond `(0.07,0.07,0.12,0.97)`), message centré + 3 boutons :
  - **Rejouer** → recharge la zone courante.
  - **Menu principal** → charge MainMenu.
  - **Quitter** → quitte (web : pas d'équivalent natif — masquer/retour menu, cf. décision à prendre).

## Menu principal (`MainMenuController.cs`)

- Titre + tagline + boutons **Jouer** (→ Zone_1) et **Quitter**.

## Caméra (`CameraFollow.cs`)

- Suit le joueur (tag), `smoothTime = 0.15`, offset `(0,0)` (SmoothDamp / lerp lissé).

## Cartes existantes (à reprendre)

| id | displayName | description | usage |
|---|---|---|---|
| python | Python | Langage interprété, syntaxe lisible, polyvalent. | Scripts, data science, IA |
| javascript | JavaScript | Langage du web, exécuté dans le navigateur. | Sites web interactifs |
| csharp | C# | Langage orienté objet de Microsoft. | Unity, applications Windows |
| html | HTML | Langage de balisage pour structurer les pages web. | Pages web |

> SQL retiré au prototype de base — à réintroduire et étendre vers l'ensemble des langages de la frise (agent-contenu).

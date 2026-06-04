# SETUP — Prototype Codyssey (Zone_01)

Guide complet pour monter le prototype jouable de A à Z depuis un clone frais du repo. Toute la partie code est déjà commitée — il reste à faire le setup dans l'éditeur Unity (création de ScriptableObjects, configuration des GameObjects de la scène, drag & drop de références dans l'Inspector).

## 0. Prérequis

- Unity (version dans `ProjectSettings/ProjectVersion.txt`)
- Le projet ouvert dans l'éditeur Unity
- Une fois le projet ouvert, attendre la fin de la première compilation (Unity recompile les `.cs` et importe les assets)

## 1. ScriptableObjects — déjà prêts ✅

Pour le play test « projet de base », les cartes et la database sont **déjà créées et remplies** dans le repo — rien à faire dans l'éditeur ici. SQL a été retiré pour rester simple : **4 cartes**.

| Asset | DisplayName | Description | Usage |
|---|---|---|---|
| `Cards/Python.asset` | `Python` | Langage interprété, syntaxe lisible, polyvalent. | Scripts, data science, IA |
| `Cards/JS.asset` | `JavaScript` | Langage du web, exécuté dans le navigateur. | Sites web interactifs |
| `Cards/CSharp.asset` | `C#` | Langage orienté objet de Microsoft. | Unity, applications Windows |
| `Cards/HTML.asset` | `HTML` | Langage de balisage pour structurer les pages web. | Pages web |

`CardDatabase.asset` référence déjà ces 4 cartes (`All Cards`, Size = 4). `Icon` laissé vide (l'art arrivera plus tard).

> Chaque PNJ déclare sa carte-réponse dans l'Inspector (voir §2.3). Le joueur démarre avec **toutes les cartes sauf** celles que les PNJ vont lui apprendre — donc chaque bonne réponse est une carte réellement nouvelle. Exemple : PNJ_1 → `JavaScript`, PNJ_2 → `C#` ⇒ deck initial = `Python`, `HTML`.

## 2. Setup de la scène Zone_01

### 2.1 Création / ouverture de la scène

Renomme `Assets/Scenes/SampleScene.unity` en `Zone_01.unity` (ou duplique-la). Double-clique pour l'ouvrir.

Ajoute la scène à `File` > `Build Settings` (bouton `Add Open Scenes`) en première position.

### 2.2 Player

Crée un GameObject vide nommé `Player`. Dans l'Inspector :

| Composant | Configuration |
|---|---|
| `Tag` (en haut) | `Player` |
| `Sprite Renderer` | Assigne le sprite Link (ou un placeholder coloré) |
| `Box Collider 2D` ou `Circle Collider 2D` | Non-trigger, dimensions ajustées au sprite |
| `Player` (script) | Drag le script `Player.cs` dessus — il auto-ajoute `Rigidbody2D`, `move`, `PlayerInteraction`, `Deck` via `[RequireComponent]` |
| `Rigidbody2D` (auto-ajouté) | `Gravity Scale = 0`, `Freeze Rotation Z = coché` |
| `move` (auto-ajouté) | Drag les 4 sprites de direction dans `Sprite Haut/Bas/Gauche/Droite` |
| `PlayerInteraction` (auto-ajouté) | `Interaction Radius` : 1.5 par défaut (modifiable) |
| `Deck` (auto-ajouté) | Liste vide — le `GameManager` la remplit au lancement |

### 2.3 PNJ (créer NPC_01 et NPC_02)

Crée un premier GameObject vide `NPC_01`, puis duplique-le (`Ctrl+D`) pour `NPC_02`.

Pour chacun :

| Composant | Configuration |
|---|---|
| `Sprite Renderer` | Sprite placeholder (couleur/sprite distinct pour différencier les 2 PNJ) |
| `Box Collider 2D` ou `Circle Collider 2D` | **`Is Trigger = coché`** (pour ne pas bloquer le joueur) |
| `NPC` (script) | Voir détails ci-dessous |

Champs du composant `NPC` :

- **`Npc Name`** : nom affiché (ex. `Léo le dev web`, `Anna l'analyste`)
- **`Portrait`** : sprite affiché dans la boîte de dialogue (optionnel)
- **`Dialogue Lines`** : tableau de lignes d'intro + la question en dernière ligne. Exemple :
  - Ligne 0 : `Salut ! Je suis bloqué sur un truc.`
  - Ligne 1 : `Je veux faire un site web interactif, quel langage je dois apprendre ?`
- **`Choices`** : laisser `Size = 0` (mode question prioritaire)
- **`Question`** :
  - `Expected Answer` : **drag la carte attendue** (ex. la carte `JS` si la question parle de site web interactif). C'est cette carte que le joueur doit choisir, et qu'il gagne en répondant juste.
  - `Thanks Line` : ex. `Exactement, merci pour ton aide !`
  - `Hint Line` : ex. `Hmm non, c'est plutôt un langage qui tourne dans le navigateur...`
- **`Card Database`** : **laisser vide** (le GameManager le pousse au lancement)

> **Note sur les questions** : la réponse de chaque PNJ est **fixe** (`Expected Answer`). Écris donc la dernière ligne de `Dialogue Lines` pour qu'elle colle à cette carte. Suggestion pour 2 PNJ : PNJ_1 → `JavaScript` (« Je veux faire un site web interactif, quel langage j'apprends ? »), PNJ_2 → `C#` (« Quel langage est utilisé pour développer dans Unity ? »). Donne-leur **deux réponses différentes** : le joueur démarrera alors avec `Python` + `HTML`.

### 2.4 Door

Crée un GameObject vide `Door`. Ajoute le script `Door` (auto-ajoute un `SpriteRenderer`).

| Champ | Valeur |
|---|---|
| `Sprite Renderer` > `Sprite` | Un sprite carré ou autre (placeholder) |
| `Door` > `Closed Color` | Gris foncé (défaut `R:0.3 G:0.3 B:0.3`) |
| `Door` > `Open Color` | Vert clair (défaut `R:0.4 G:1 B:0.4`) |
| `Door` > `Open Sprite` | Optionnel : sprite alternatif quand ouverte |

Place la porte à un endroit visible dans la zone (ex. en haut, comme une sortie).

### 2.5 GameManager

Crée un GameObject vide `GameManager`. Ajoute le script `GameManager`.

| Champ | Valeur |
|---|---|
| `Card Database` | Drag `CardDatabase.asset` |
| `NPCs` > `Size` | `2` |
| `NPCs > Element 0` | Drag `NPC_01` depuis la Hierarchy |
| `NPCs > Element 1` | Drag `NPC_02` depuis la Hierarchy |

### 2.6 Main Camera

Sur la `Main Camera` existante : ajoute le script `CameraFollow`.

| Champ | Valeur |
|---|---|
| `Target` | Laisser vide (auto-trouvé par tag `Player`) ou drag le Player |
| `Offset` | `(0, 0)` |
| `Smooth Time` | `0.15` (ajuste au feeling) |

### 2.7 Background (optionnel)

Crée un GameObject `Ground` avec un `SpriteRenderer`, sprite carré, couleur unie (ex. vert foncé), `Order in Layer = -10`, scale ~`20x20` pour couvrir la zone.

## 3. Test du prototype

▶ Play. Ouvre la `Console` (`Window` > `General` > `Console`).

Logs attendus au lancement (avec PNJ_1 → JavaScript et PNJ_2 → C#) :
```
[GameManager] Deck initial : Python, HTML
[GameManager] Réponses attendues (PNJ) : JavaScript, C#
```

Critères d'acceptation :

1. Le joueur bouge avec ZQSD ou flèches
2. La caméra suit avec un léger smooth
3. En s'approchant d'un PNJ et en appuyant sur **E** : dialogue ligne par ligne, puis le DeckUI s'ouvre avec les 4 cartes
4. Sélection d'une mauvaise carte : `hintLine` du PNJ s'affiche, **E** rouvre le DeckUI pour retry
5. Sélection de la bonne carte : `thanksLine`, log `[GameManager] X/2 PNJ aidés.`, la carte est ajoutée au deck du joueur
6. Une fois les 2 PNJ aidés : log `[GameManager] Tous les PNJ ont été aidés !` + log `[Door] Porte ouverte !` + la porte passe du gris au vert

## 4. Dépannage

| Symptôme | Cause probable | Fix |
|---|---|---|
| `NullReferenceException` sur `DialogueBox.Instance` | Auto-spawn pas encore exécuté (rare) | Vérifie que `DialogueBox.cs` compile sans erreur |
| Le joueur passe à travers les PNJ | Collider du PNJ marqué `Is Trigger` (normal) ou collider du joueur manquant | OK pour les PNJ ; vérifie le collider Player |
| Le joueur tombe vers le bas | `Gravity Scale` ≠ 0 sur le Rigidbody2D du Player | Mettre `Gravity Scale = 0` |
| E ne déclenche rien | Pas de `Collider2D` sur le PNJ, ou hors du `Interaction Radius` | Ajoute un collider, ajuste le rayon |
| Le DeckUI ne s'ouvre pas | `Card Database` non assignée au PNJ ou `Expected Answer` non assignée | Vérifie qu'un `GameManager` existe ET que le PNJ est dans sa liste `NPCs` |
| Les boutons UI ne réagissent pas au clic | Pas d'EventSystem | `DialogueBox` en auto-spawn un, vérifie qu'il n'y en a pas de doublon |
| `Codyssey` n'apparaît pas dans `Create` menu | Compilation en cours ou erreur de compilation | Attends, vérifie la Console |

## 5. Améliorations possibles (post-prototype)

- **Banque de questions par carte** : chaque PNJ a un dict `CardData -> question` pour que la question colle à la carte assignée
- **Récompense différente** : actuellement la "récompense" est la carte de la réponse (déjà dans le DeckUI choisi). Pourrait donner une carte bonus distincte
- **TextMeshPro** : remplacer `UnityEngine.UI.Text` par TMP pour un rendu typo plus propre
- **Refactor structure** : déplacer les scripts dans des sous-dossiers (`Player/`, `NPC/`, `Cards/`...) et ajouter les namespaces `Codyssey.*` selon `CLAUDE.md`
- **Sortie de zone** : la `Door` pourrait ajouter un trigger qui charge `Zone_02.unity` (pas dans le scope prototype)
- **Sauvegarde** : sérialiser le deck du joueur entre sessions (pas dans le scope prototype)

## 6. Architecture des scripts (référence rapide)

```
Assets/Scripts/
├── Player.cs              # Composant racine du joueur (RequireComponent les autres)
├── move.cs                # Déplacement 4 directions + flip + freeze quand UI ouverte
├── PlayerInteraction.cs   # Détecte IInteractable proche, déclenche sur E
├── Deck.cs                # Collection de cartes du joueur
├── CameraFollow.cs        # Caméra suit le Player (tag-based)
│
├── NPC.cs                 # PNJ avec dialogue + choix + mode question/réponse
├── DialogueBox.cs         # UI singleton auto-spawn (nom, ligne, portrait, choix)
├── DeckUI.cs              # UI singleton auto-spawn pour sélection de carte
│
├── CardData.cs            # ScriptableObject : 1 langage de programmation
├── CardDatabase.cs        # ScriptableObject : liste de toutes les cartes
│
├── GameManager.cs         # Orchestration : deck initial, assignation questions, comptage
├── Door.cs                # Réagit à OnAllNPCsHelped
│
├── Interface/
│   └── IInteractable.cs   # Contrat d'interaction
├── chest.cs               # Stub (à implémenter ou supprimer)
└── Trigger.cs             # Cassé (en Collider 3D, à fixer ou supprimer)
```

**Singletons UI auto-spawn** : `DialogueBox.Instance` et `DeckUI.Instance` se créent au `RuntimeInitializeOnLoadMethod(BeforeSceneLoad)`. Pas besoin de les placer dans la scène.

**GameManager** : également un singleton (`GameManager.Instance`), mais celui-là doit être placé manuellement dans chaque scène (config dépend de la scène).

# Guide pas-à-pas — Monter la scène `Zone_01` dans Unity

Guide à suivre **à côté de Unity**, clic par clic, pour rendre le play test jouable de bout en bout. Le code et les cartes sont déjà prêts dans le repo — il ne reste que l'assemblage dans l'éditeur.

> Tu peux **garder ta scène actuelle** (`SampleScene`, qui contient déjà un Player, 2 PNJ, des `InteractCube` et la caméra) et la compléter : à chaque étape je dis « vérifie / ajoute si absent ». Coche les cases au fur et à mesure.

**Rappel touches** : déplacement = `ZQSD` ou flèches · interagir = `E`.

---

## 0. Avant de commencer

- [ ] Ouvre le projet dans Unity et **attends la fin de la compilation** (roue en bas à droite).
- [ ] Ouvre la **Console** : `Window > General > Console`. Elle doit être **sans erreur rouge**. S'il y en a, corrige-les avant d'aller plus loin (préviens-moi).
- [ ] Ouvre la scène : double-clic sur `Assets/Scenes/SampleScene.unity`.

> ⚠️ L'UI (boîte de dialogue + sélection de carte) et l'`EventSystem` se créent **tout seuls** au lancement (auto-spawn). **Ne crée rien pour l'UI.**

---

## 1. Préparer la scène

- [ ] (Recommandé) Renomme `SampleScene.unity` en `Zone_01.unity` dans la fenêtre `Project` (clic droit > `Rename`), puis rouvre-la.
- [ ] Pour le play test en éditeur, **pas besoin** de toucher aux Build Profiles : la scène ouverte est celle qui se lance quand tu appuies sur ▶.

---

## 2. Le sol (placeholder, optionnel mais conseillé)

Juste pour avoir un repère visuel au sol.

- [ ] `GameObject > 2D Object > Sprites > Square`. Renomme-le `Ground`.
- [ ] Dans le `Sprite Renderer` : mets une couleur unie (ex. vert foncé) et `Order in Layer = -10`.
- [ ] Mets son `Scale` à environ `20, 20, 1` pour couvrir la zone.

---

## 3. Le Player

But : un personnage qui bouge, taggé `Player`, avec un `Deck`.

### 3.1 Le GameObject
- [ ] Si tu as déjà un objet `Player` dans la scène, **sélectionne-le**. Sinon : `GameObject > 2D Object > Sprites > Square`, renomme-le `Player`.

### 3.2 Le tag (CRITIQUE)
- [ ] En haut de l'Inspector, déroule **`Tag`** et choisis **`Player`**.
  > Sans ce tag, la caméra ne suit pas, le deck est introuvable et la récompense ne marche pas. C'est l'erreur n°1.

### 3.3 Les composants
Vérifie la présence de chacun (sinon `Add Component` en bas de l'Inspector et tape son nom) :

| Composant | Réglage |
|---|---|
| `Sprite Renderer` | Un sprite visible (ex. `link.png` depuis `Assets/Sprites/`, ou le carré par défaut) |
| `Box Collider 2D` (ou `Circle Collider 2D`) | **`Is Trigger` décoché** (le joueur est solide) |
| `Player` (script) | L'ajouter **ajoute automatiquement** `Rigidbody 2D`, `move`, `Player Interaction` et `Deck` (via `[RequireComponent]`) |
| `Rigidbody 2D` | **`Gravity Scale = 0`** · `Constraints > Freeze Rotation Z` **coché** |
| `move` | Le champ `Rb` peut rester **vide** (rempli automatiquement au lancement). Les champs `Sprite Haut/Bas/Gauche/Droite` sont **optionnels** (pas encore utilisés par le code). |
| `Player Interaction` | `Interaction Radius = 1.5` (rayon de détection des PNJ) |
| `Deck` | Liste `Cards` **vide** — le `GameManager` la remplit au lancement |

> 🔧 **Si `Deck` est absent** alors que le script `Player` est là (ça arrive sur un vieux GameObject) : clique `Add Component > Deck` à la main. Vérifie aussi que `Rigidbody 2D` et un `Collider 2D` sont bien présents.

---

## 4. Les 2 PNJ

But : 2 personnages qui posent chacun une question, avec une **carte-réponse fixe**.

- [ ] Repère tes 2 PNJ existants (`NPC_1` et `NPC`). Sinon, crée-en un (`GameObject > 2D Object > Sprites > Square`, renomme `NPC_1`) puis duplique-le avec `Ctrl+D` en `NPC_2`.

Pour **chaque** PNJ :

| Composant | Réglage |
|---|---|
| `Sprite Renderer` | Sprite/couleur **distincts** entre les 2 PNJ pour les différencier |
| `Box Collider 2D` (ou `Circle Collider 2D`) | **`Is Trigger` COCHÉ** (sinon le joueur reste bloqué contre lui) |
| `NPC` (script) | Voir les champs ci-dessous |

Champs du script **`NPC`** :

- [ ] **`Npc Name`** : le nom affiché (ex. `Léo le dev web`, `Anna l'ingénieure`).
- [ ] **`Portrait`** : optionnel (ex. `zelda_portrait.png`). Laisse vide si tu n'as rien.
- [ ] **`Dialogue Lines`** : mets `Size` au nombre de lignes. La **dernière ligne = la question**. Exemple à 2 lignes :
  - Element 0 : `Salut ! J'ai besoin d'un coup de main.`
  - Element 1 : *(la question — voir tableau ci-dessous)*
- [ ] **`Choices`** : `Size = 0` (on est en mode question).
- [ ] **`Question`** (déplie-le) :
  - **`Expected Answer`** : **glisse la carte attendue** depuis `Assets/ScriptableObjects/Cards/` ⚠️ étape clé.
  - `Thanks Line` : ex. `Exactement, merci pour ton aide !`
  - `Hint Line` : ex. `Hmm, ce n'est pas la bonne carte, réessaie...`
- [ ] **`Card Database`** : **laisser vide** (le `GameManager` le pousse au lancement).

### Pairing conseillé (cohérent et déterministe)

Donne **deux réponses différentes** aux 2 PNJ :

| PNJ | Dernière ligne de `Dialogue Lines` (la question) | `Expected Answer` |
|---|---|---|
| `NPC_1` | `Je veux faire un site web interactif, quel langage j'apprends ?` | carte **`JS`** |
| `NPC_2` (ou `NPC`) | `Quel langage est utilisé pour développer dans Unity ?` | carte **`CSharp`** |

➡️ Conséquence : le joueur démarre avec `Python` + `HTML`, gagne `JavaScript` puis `C#`.

- [ ] **Placement** : pose les 2 PNJ à des endroits accessibles, pas collés l'un à l'autre (rappel : il faut s'approcher à moins de `1.5` unité pour que `E` fonctionne).

---

## 5. La Door (mécanisme de fin de zone)

- [ ] `GameObject > Create Empty`, renomme `Door`.
- [ ] `Add Component > Door` — ça ajoute automatiquement un `Sprite Renderer`.
- [ ] Dans le `Sprite Renderer`, assigne un sprite carré (placeholder).
- [ ] Le script `Door` a déjà ses couleurs par défaut : `Closed Color` (gris) → `Open Color` (vert). Laisse tel quel.
- [ ] Place la porte à un endroit visible (ex. en haut, comme une sortie).

> Au lancement elle est grise ; elle passe au vert quand les 2 PNJ sont aidés.

---

## 6. Le GameManager (le chef d'orchestre)

- [ ] `GameObject > Create Empty`, renomme `GameManager`.
- [ ] `Add Component > Game Manager`.
- [ ] Renseigne :

| Champ | Valeur |
|---|---|
| `Card Database` | Glisse `Assets/ScriptableObjects/CardDatabase.asset` |
| `Npcs > Size` | `2` |
| `Npcs > Element 0` | Glisse `NPC_1` depuis la **Hierarchy** |
| `Npcs > Element 1` | Glisse `NPC_2` (ou `NPC`) depuis la **Hierarchy** |

> Il n'y a **pas** de champ « Initial Deck Size » : le deck initial se déduit tout seul (toutes les cartes sauf les réponses des PNJ).

---

## 7. La caméra

- [ ] Sélectionne la `Main Camera` existante.
- [ ] `Add Component > Camera Follow`.

| Champ | Valeur |
|---|---|
| `Target` | Laisse **vide** (trouvé automatiquement par le tag `Player`) |
| `Offset` | `0, 0` |
| `Smooth Time` | `0.15` |

---

## 8. Nettoyage (optionnel)

- [ ] Les anciens objets `InteractCube` (s'ils sont là) sont inoffensifs mais inutiles : tu peux les **supprimer** pour garder la scène propre.
- [ ] Sauvegarde la scène : `Ctrl+S`.

---

## 9. Tester ▶

Appuie sur **Play**. Dans la `Console`, tu dois voir (avec le pairing conseillé) :

```
[GameManager] Deck initial : Python, HTML
[GameManager] Réponses attendues (PNJ) : JavaScript, C#
```

Checklist d'acceptation :

- [ ] 1. Le joueur bouge avec `ZQSD` / flèches.
- [ ] 2. La caméra le suit avec un léger lissage.
- [ ] 3. Près d'un PNJ, **E** affiche le dialogue ligne par ligne, puis ouvre la sélection des **4 cartes**.
- [ ] 4. **Mauvaise carte** → le PNJ affiche son `Hint Line` ; **E** rouvre la sélection pour réessayer.
- [ ] 5. **Bonne carte** → `Thanks Line`, log `[GameManager] 1/2 PNJ aidés.`, la carte rejoint le deck.
- [ ] 6. Les **2 PNJ aidés** → logs `Tous les PNJ ont été aidés !` + `[Door] Porte ouverte !`, et la porte passe **au vert**. 🎉

Si les 6 cases sont cochées, le play test est validé.

---

## 10. Dépannage

| Symptôme | Cause probable | Fix |
|---|---|---|
| Le joueur ne bouge pas | Pas de `Rigidbody 2D`, ou script `Player` absent | Vérifie les composants du Player (étape 3.3) |
| Le joueur tombe vers le bas | `Gravity Scale ≠ 0` | Mets `Gravity Scale = 0` sur le `Rigidbody 2D` |
| La caméra ne suit pas | Player **non taggé `Player`** | Étape 3.2 |
| `E` ne fait rien | Trop loin du PNJ, pas de `Collider 2D` sur le PNJ, ou PNJ trop loin | Approche-toi (< 1.5), vérifie le collider du PNJ |
| Erreur Console `Pas de GameObject taggé 'Player' avec un composant Deck` | Player non taggé **ou** `Deck` absent | Tag `Player` (3.2) + `Add Component > Deck` (3.3) |
| `Le PNJ '...' n'a pas de réponse attendue assignée` | `Expected Answer` vide sur un PNJ | Glisse une carte dans `Question > Expected Answer` (étape 4) |
| La sélection de cartes ne s'ouvre pas | Le PNJ n'est pas dans la liste `Npcs` du `GameManager` | Vérifie l'étape 6 |
| La porte ne s'ouvre jamais | Les 2 PNJ ont la **même** `Expected Answer`, ou un PNJ sans réponse | Donne 2 réponses **différentes** (étape 4) |
| Le joueur reste bloqué contre un PNJ | Collider du PNJ **non** en trigger | Coche `Is Trigger` sur le collider du PNJ |

---

## Récap de la Hierarchy attendue

```
Zone_01 (scène)
├── Main Camera        → + Camera Follow
├── Global Light 2D    (déjà là)
├── Ground             (optionnel, placeholder)
├── Player             [Tag: Player] → Sprite Renderer, Collider2D, Rigidbody2D, move, PlayerInteraction, Deck, Player
├── NPC_1              → Sprite Renderer, Collider2D (trigger), NPC (Expected Answer = JS)
├── NPC_2 (ou NPC)     → Sprite Renderer, Collider2D (trigger), NPC (Expected Answer = CSharp)
├── Door               → Sprite Renderer, Door
└── GameManager        → GameManager (CardDatabase + liste des 2 PNJ)
```

L'UI (`[DialogueBox]`, `[DeckUI]`, `[EventSystem]`) apparaît automatiquement au lancement — normal qu'elle ne soit pas dans la Hierarchy avant le Play.

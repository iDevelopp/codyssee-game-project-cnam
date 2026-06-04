# CLAUDE.md — Contexte du projet Codyssey

> Ce fichier est lu automatiquement par Claude Code au démarrage de chaque session. Il établit le contexte permanent du projet. Mets-le à la racine du repo (`codyssee-game-project-cnam/CLAUDE.md`).

## Projet

**Codyssey** est un jeu narratif d'exploration et de collection en 2D top-down, à la croisée de *Animal Crossing* (exploration, interaction PNJ) et d'un jeu de cartes (collection, deck). Le joueur incarne un ingénieur informatique dans un futur cyberpunk où les IA défaillent. Il parcourt des zones, aide des PNJ en répondant à leurs questions à l'aide de **cartes représentant des langages de programmation**, et débloque progressivement de nouvelles zones jusqu'à révéler une frise chronologique de l'histoire des langages.

**Équipe** : Valentin, Egor, Arthur — CNAM
**Échéance prototype jouable** : fin S4

## Stack technique

- **Moteur** : Unity (version exacte dans `ProjectSettings/ProjectVersion.txt` — toujours s'y référer)
- **Langage** : C#
- **VCS** : Git (repo `git@github.com:iDevelopp/codyssee-game-project-cnam.git`)
- **2D** : pipeline 2D standard d'Unity, art pixel art (placeholders gris/colorés acceptables pour le prototype)
- **Input** : ancien Input Manager par défaut (passer au new Input System uniquement si demandé explicitement)

## Piliers de conception (rappel GDD)

1. Découverte et exploration
2. Apprentissage ludique (sans pression)
3. Narration interactive via PNJ
4. Collection et progression via cartes
5. Liens logiques entre langages
6. Accessibilité et plaisir

Toute décision de gameplay ou d'UX doit servir au moins un de ces piliers.

## Architecture cible

```
Assets/
├── Scripts/
│   ├── Player/            # Déplacement, interaction
│   ├── NPC/               # Comportement PNJ, dialogue
│   ├── Cards/             # Données carte (ScriptableObject), deck, UI carte
│   ├── Dialogue/          # Système de dialogue + question/réponse
│   ├── Zone/              # Gestion de zone, transition, déclencheur de progression
│   ├── UI/                # HUD, menus, inventaire de cartes
│   └── Core/              # GameManager, SaveState, events
├── ScriptableObjects/
│   ├── Cards/             # Une .asset par langage (C#, Python, JS, etc.)
│   └── NPCs/              # Données PNJ (nom, sprite, questions)
├── Scenes/
│   ├── MainMenu.unity
│   └── Zone_01.unity      # Première zone (prototype vertical slice)
├── Prefabs/
│   ├── Player.prefab
│   ├── NPC.prefab
│   └── UI/                # CardView, DialogueBox, DeckPanel
└── Sprites/               # Placeholders OK pour le prototype
```

## Conventions de code

- **Namespaces** : `Codyssey.Player`, `Codyssey.Cards`, etc.
- **Naming** : PascalCase pour classes/méthodes, _camelCase pour champs privés, camelCase pour paramètres locaux
- **MonoBehaviour** : champs sérialisés en `[SerializeField] private` plutôt que `public`
- **Events** : préférer C# `event Action` ou ScriptableObject events plutôt que `UnityEvent` dans l'inspector (sauf pour l'UI où c'est plus pratique)
- **Données de gameplay** : ScriptableObject (cartes, PNJ, questions, zones) plutôt que valeurs en dur
- **Pas de Singletons sauvages** : un seul `GameManager` central, instances passées par référence ailleurs
- **Pas de `FindObjectOfType` en runtime hot path** : à l'init OK, dans `Update` non

## Règles de collaboration avec Claude Code

1. **Ne jamais committer ou pousser sans validation explicite de l'humain.** Tu peux proposer des messages de commit mais l'humain exécute `git commit/push`.
2. **Toujours proposer un plan court avant d'écrire du code** quand la tâche fait plus que modifier un fichier.
3. **Tester mentalement** : après avoir écrit un script Unity, lister ce que l'utilisateur doit faire dans l'éditeur (créer GameObject, attacher composant, assigner références dans l'Inspector). Tu ne peux pas piloter l'éditeur Unity, donc tu compenses avec des instructions précises.
4. **Garder les commits petits et thématiques** : un commit = une fonctionnalité ou un refactor.
5. **Ne pas casser ce qui marche** : avant de refactorer une zone du code existant, demander confirmation.
6. **Documenter les ScriptableObjects** : pour chaque type, expliquer dans un commentaire de classe comment créer une instance dans l'éditeur (`[CreateAssetMenu]`).

## État actuel

À compléter au fur et à mesure. Liste ici ce qui est implémenté pour que les futures sessions Claude Code sachent où elles en sont.

- [x] Déplacement joueur top-down — `move.cs` (4 directions, freeze quand UI ouverte)
- [x] Système de cartes (ScriptableObject + data) — `CardData.cs` + `CardDatabase.cs` + **4 cartes `.asset` remplies** (Python, JavaScript, C#, HTML) + `CardDatabase.asset` peuplée (SQL retiré pour le play test de base)
- [x] PNJ interactif basique — `NPC.cs` + `PlayerInteraction.cs` + `IInteractable`
- [x] Système de dialogue — `DialogueBox.cs` (auto-spawn, portrait, lignes multiples, choix optionnels)
- [x] UI deck — `DeckUI.cs` (auto-spawn, affiche N cartes en boutons, callback à la sélection)
- [x] Question/réponse via cartes — `NPC` mode `Question` (réponse fixée par PNJ dans l'Inspector) + `GameManager` construit le deck initial = complément des réponses PNJ
- [x] Récompense (ajout de carte au deck) — bonne réponse → `Deck.Add(carte)` sur le joueur
- [x] Dialogue post-aide — `NPC.resolvedLines` : une fois le PNJ aidé (`IsResolved`), il joue un dialogue différent et ne repose plus sa question
- [x] Mécanisme de progression de zone — `GameManager.OnAllNPCsHelped` → `Door` change de couleur. Le comptage se base sur les PNJ **qui ont une question** (`questNPCCount`), pas `npcs.Count`
- [x] Sortie de zone — `Door` est `IInteractable` : verrouillée → message d'info ; ouverte → `EndScreenUI` (message de fin + boutons Rejouer / Menu principal / Quitter)
- [x] Menu principal — `MainMenuController.cs` (UI construite en code) dans la scène `MainMenu`, bouton Jouer → charge `Zone_1`
- [x] Scène `Zone_1` jouable de bout en bout — boucle complète testée : menu → zone → aider les PNJ → porte → écran de fin
- [ ] **Build Settings** : `MainMenu` (index 0) et `Zone_1` (index 1) doivent rester ajoutées ; sinon les boutons Jouer/Menu lèvent « scene not in build settings »

## Voir aussi

- `SETUP.md` à la racine : guide complet pour monter le prototype depuis un clone frais (création des ScriptableObjects, configuration des GameObjects de la scène, dépannage).

## Déviations acceptées (session 2026-05-28)

Décisions prises explicitement avec Arthur pour livrer le prototype plus vite, à reprendre **post-prototype** :

- **Input System** : on utilise le **nouveau** Input System (`UnityEngine.InputSystem`) au lieu de l'ancien Input Manager prévu dans `Stack technique` — déjà installé dans `Packages/manifest.json` et utilisé par `move.cs` / `PlayerInteraction.cs`.
- **Structure de dossiers** : tous les scripts sont à la racine de `Assets/Scripts/` (pas dans les sous-dossiers `Player/`, `NPC/`, `Cards/`, etc. prévus dans `Architecture cible`). Refactor à faire dans une session dédiée.
- **Namespaces** : aucun script n'a de namespace `Codyssey.*`. Refactor à faire en même temps que la réorganisation des dossiers.
- **Singletons UI** : `DialogueBox.Instance` et `DeckUI.Instance` sont des singletons auto-spawn via `RuntimeInitializeOnLoadMethod`. Justifiés comme singletons UI globaux, mais à reconsidérer si on veut tout passer par `GameManager` selon la règle "Pas de Singletons sauvages".
- **Renames PascalCase** : les classes existantes `move` et `chest` (lowercase) n'ont pas été renommées en `Move` / `Chest`. À faire avec le refactor structure.

## Play test de base (session 2026-06-02)

Décisions pour livrer un play test « projet de base » (art ajouté plus tard) :

- **4 cartes au lieu de 5** : SQL retiré. Cartes = Python, JavaScript, C#, HTML. `CardDatabase.asset` peuplée en conséquence.
- **Réponses fixes par PNJ (option B)** : chaque PNJ déclare sa carte-réponse dans l'Inspector (`Question > Expected Answer`). `GameManager` ne tire plus au hasard ; il lit `npc.ExpectedAnswer` et construit le deck initial = **toutes les cartes sauf** celles des PNJ (chaque bonne réponse est donc une carte nouvelle). Le champ `initialDeckSize` a été supprimé. Questions et réponses sont maintenant cohérentes.
- **`chest.cs` neutralisé** : `CanInteract()` renvoie `false` (était un `throw NotImplementedException` → plantait l'interaction près des `InteractCube`). À implémenter ou retirer les cubes plus tard.
- **`Trigger.cs` corrigé** : passé en callbacks 2D (`OnTriggerEnter2D`/`OnTriggerExit2D`) + new Input System (`Keyboard.current.spaceKey`). Était en 3D + ancien `Input` (aurait jeté une exception, le projet est en New Input System only).

## Flux de sortie + menu (session 2026-06-04)

- **Dialogue post-aide** : `NPC` a un champ `resolvedLines` joué quand `IsResolved == true` (retombe sur `dialogueLines` si vide).
- **Porte de sortie** : `Door` est désormais `IInteractable`. Fermée → `lockedMessage` via `DialogueBox` ; ouverte → `EndScreenUI.Show(exitMessage)`. Tous les textes sont éditables dans l'Inspector de la porte.
- **`EndScreenUI.cs`** (nouveau) : overlay plein écran auto-spawn (`sortingOrder 200`), boutons Rejouer (recharge la scène) / Menu principal (charge `MainMenu`) / Quitter.
- **`MainMenuController.cs`** (nouveau) : menu construit en code, à poser sur un GameObject de la scène `MainMenu`. Bouton Jouer → `SceneManager.LoadScene("Zone_1")`. **Les deux scènes doivent être dans les Build Settings.**
- **`GameManager`** : le seuil d'ouverture de la porte se base sur `questNPCCount` (PNJ ayant une `Expected Answer`) et non plus sur `npcs.Count`, sinon un PNJ sans question bloquait l'ouverture à vie. Logs ajoutés pour le debug.
- **Bug `DeckUI` corrigé** : le voile « Dim » était créé actif et jamais masqué → comme `DeckUI` est `DontDestroyOnLoad` (`sortingOrder 150`), il interceptait tous les clics des canvas en dessous (ex. les boutons du `MainMenu`). Le Dim est maintenant activé/désactivé avec le panel.
- **`move.cs`** : `IsUIBlockingInput()` gèle aussi le joueur quand `EndScreenUI` est ouvert.
- **Noms de scènes en dur** : `EndScreenUI` charge `"MainMenu"` en constante. Si on renomme la scène, mettre à jour la constante.

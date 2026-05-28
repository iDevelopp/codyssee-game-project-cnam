# Prompt de lancement Claude Code — Prototype Codyssey

> Copie tout ce qui suit (à partir de la ligne de séparation) et colle-le dans Claude Code comme **premier message** d'une nouvelle session, depuis le dossier `codyssee-game-project-cnam`. Assure-toi que `CLAUDE.md` est à la racine du repo avant de lancer.

---

Salut. Je travaille sur **Codyssey**, un prototype Unity 2D top-down (contexte complet dans `CLAUDE.md` à la racine). Lis-le avant de commencer.

## Objectif de cette session

Construire un **prototype jouable d'une seule zone** (`Zone_01`) qui couvre la boucle de gameplay principale du GDD :

1. Le joueur se déplace librement dans la zone (top-down, 4 directions, ZQSD + flèches).
2. Il rencontre **2 PNJ** stationnaires. Chacun pose **une question** sur un langage de programmation.
3. Le joueur ouvre son **deck de cartes** (chaque carte = un langage de programmation) et **sélectionne une carte** comme réponse.
4. **Bonne réponse** : le PNJ remercie le joueur, le joueur reçoit une **nouvelle carte**. **Mauvaise réponse** : feedback (le PNJ donne un indice), le joueur peut réessayer.
5. Quand **les 2 PNJ ont été aidés**, un **mécanisme** (porte / portail) s'active visuellement dans la zone. Pour le prototype, déclencher la porte suffit — pas besoin de transition vers une `Zone_02`.

C'est la **vertical slice** : si cette zone unique tourne de bout en bout, le concept est validé.

## Hors scope (ne fais PAS dans cette session)

- Pas d'art final, pas de pixel art cyberpunk. Placeholders : sprites carrés colorés, Unity primitives, ou shapes 2D simples.
- Pas de musique, pas de SFX.
- Pas de multi-zones, pas de transition de scène, pas de save sur disque.
- Pas de menu principal complexe (un bouton "Play" qui charge `Zone_01` suffit, ou directement `Zone_01` au lancement).
- Pas de frise chronologique finale.
- Pas de new Input System (rester sur l'ancien Input Manager pour aller vite).

## Données de départ pour les cartes

Crée 5 cartes ScriptableObject (un `.asset` chacune) :

| Nom carte | Description courte (1 phrase) | Usage typique |
|---|---|---|
| **Python** | Langage interprété, syntaxe lisible, polyvalent. | Scripts, data science, IA |
| **JavaScript** | Langage du web, exécuté dans le navigateur. | Sites web interactifs |
| **C#** | Langage orienté objet de Microsoft. | Unity, applications Windows |
| **HTML** | Langage de balisage pour structurer les pages web. | Pages web |
| **SQL** | Langage de requête pour bases de données. | Manipulation de données |

Le joueur **commence avec 3 cartes au hasard** parmi ces 5. Les 2 PNJ posent chacun une question dont la bonne réponse est l'une des **2 cartes manquantes du deck initial** (à toi de gérer ça proprement : tirer le deck initial puis générer les questions des PNJ à partir du complément).

Exemples de questions PNJ :
- "J'ai besoin d'interroger ma base de données clients, quel langage j'utilise ?" → **SQL**
- "Je veux faire un site web interactif, quel langage je dois apprendre ?" → **JavaScript**
- "Quel langage est utilisé pour développer dans Unity ?" → **C#**

## Méthode de travail attendue

1. **D'abord, lis `CLAUDE.md`** et inspecte la structure actuelle du repo (`Assets/`, `ProjectSettings/`, etc.) pour comprendre ce qui existe déjà.
2. **Propose-moi un plan court** (liste numérotée, 8–15 étapes max) avant d'écrire la moindre ligne de code. Attends ma validation.
3. **Implémente étape par étape**, en me disant à chaque étape :
   - Quels fichiers tu crées/modifies
   - **Ce que je dois faire dans l'éditeur Unity** (créer GameObject X, attacher script Y, assigner la référence Z dans l'Inspector) — sois exhaustif, je ne peux pas deviner.
4. **Ne touche pas à Git** sans validation. Propose des messages de commit, je les exécuterai.
5. Quand le prototype est jouable, **mets à jour la checklist dans `CLAUDE.md`** avec ce qui est fait.

## Critère d'acceptation final

Je dois pouvoir, depuis Unity Editor :
1. Ouvrir `Assets/Scenes/Zone_01.unity`
2. Cliquer Play
3. Déplacer le joueur jusqu'au premier PNJ
4. Appuyer sur **E** pour interagir, lire la question, ouvrir le deck, choisir une carte, voir la réponse validée et recevoir une nouvelle carte
5. Faire pareil avec le second PNJ
6. Voir la porte s'ouvrir / s'éclairer une fois les deux aidés

Si tout ça marche, on a notre prototype. On itérera ensuite (art, deuxième zone, etc.) dans d'autres sessions.

Vas-y, commence par lire le contexte et propose-moi ton plan.

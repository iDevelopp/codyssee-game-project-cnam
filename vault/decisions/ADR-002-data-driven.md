# ADR-002 — Architecture data-driven

- **Statut** : accepté (arrêté par Arthur dans le brief)
- **Date** : 2026-06-12

## Contexte

Cible = vision complète du GDD (multi-zones, frise, narration). Hardcoder le contenu rendrait l'extension coûteuse et fragile.

## Décision

Le moteur ne sait **rien** du contenu en dur. Tout (cartes, PNJ, dialogues, questions, zones, transitions, frise, textes) vit dans `/web/content` (JSON), chargé au runtime. Ajouter zone/carte/langage = ajouter un fichier de données.

## Modèle de données (à affiner avec agent-contenu)

- **Card** : `id, displayName, description, usage, icon?, era?` (`era` alimente la frise).
- **NPC** : `id, name, portrait?, position, dialogueLines[], resolvedLines[], question { expectedCardId, thanksLine, hintLine }, rewardCardId?`.
- **Zone** : `id, displayName, tilemap, spawn, npcs[], doors[], unlockCondition, nextZoneId?, themeEra`.
- **Timeline** : `[{ year, language, cardId, blurb, unlockedBy }]` (frise révélée à la progression).
- **Strings** : table clé→texte FR (`strings.fr.json`).

## Conséquences

- Types TS dans `/web/src/types` reflètent ce modèle ; les loaders valident (au moins en dev) les fichiers `/content`.
- `ProgressionSystem` + `SaveSystem` (localStorage) suivent : zones débloquées, deck, PNJ aidés, frise révélée.
- Seuil portes/zones : même logique que `GameManager` Unity (PNJ porteurs de question).
- Tout texte affiché passe par `strings.fr.json` (i18n-ready, FR only en V1).

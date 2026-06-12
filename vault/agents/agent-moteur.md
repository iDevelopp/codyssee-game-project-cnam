# agent-moteur — état

- **Domaine** : Phaser 3 / TypeScript. Scènes, boucle de jeu, déplacement, interaction (E), caméra, deck UI, dialogue, portes, écran de fin, menu. Garant de la boucle de gameplay.
- **Modèle par défaut** : sonnet.
- **Statut courant** : TASK-005 → `review`.
- **Tâches assignées** : TASK-005 (review), prochaines J1 à venir.
- **Blocages** : —
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

### tsconfig.json modifié
Ajout de `"types": ["vite/client"]` pour résoudre `import.meta.env` (requis par ContentLoader).

### tsc --noEmit
Aucune erreur. Build type-check vert.

### Choix: fetch vs Vite JSON import
fetch() retenu (ADR-002 data-driven) : les imports Vite JSON sont bundlés à la compilation, ce qui casse l'architecture data-driven (modifier une carte nécessiterait un rebuild). fetch() charge au runtime depuis `/content` servi en statique.

### Handoff agent-contenu
- Ownership de `/web/content/` transfère à agent-contenu pour extension.
- Ajouter `content/timeline.json` (array TimelineEntry) quand la frise est prête.
- Ajouter un `content/zones/index.json` (array de zone ids) pour piloter le chargement dynamique des zones (le ContentLoader charge actuellement `zone_01` en dur — prévu pour être remplacé).
- Format NpcData.question.expectedCardId doit matcher exactement un CardData.id (validation dev en place).

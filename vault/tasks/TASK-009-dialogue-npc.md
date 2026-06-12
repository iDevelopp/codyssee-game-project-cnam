---
id: TASK-009
titre: Système de dialogue + DialogueBox UI + entité NPC (lignes)
owner: agent-moteur
statut: review
depends_on: [TASK-008]
artefacts: [web/src/systems/DialogueSystem.ts, web/src/ui/DialogueBox.ts, web/src/entities/NPC.ts]
jalon: J1
---

## Objectif
PNJ qui affichent un dialogue ligne par ligne dans une boîte de dialogue (UIScene). Reproduit `DialogueBox.cs` + machine à états `NPC.cs` (partie dialogue, hors deck).

## Critères d'acceptation
- DialogueBox dans UIScene : nom locuteur, ligne, portrait optionnel. Marque "UI ouverte".
- NPC `Interactable` : E avance ligne par ligne (`dialogueLines` chargées depuis `npcs.json`). Dernière ligne = la question (déclenche le deck en TASK-010 si non résolu).
- Machine à états : Idle→ShowingLines→(suite TASK-010)→...→Idle.
- `resolvedLines` jouées si PNJ résolu (fallback dialogueLines).
- PNJ positionnés selon `position` du contenu ; portraits chargés.
- `tsc --noEmit` vert. Textes via contenu/strings, rien en dur.

## Notes
Réf boucle. Le branchement question/réponse complet est en TASK-010.

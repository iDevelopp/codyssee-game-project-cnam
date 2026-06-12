---
id: TASK-008
titre: Système d'interaction (E, rayon, IInteractable le plus proche)
owner: agent-moteur
statut: review
depends_on: [TASK-007]
artefacts: [web/src/systems/InteractionSystem.ts, web/src/entities/Interactable.ts]
jalon: J1
---

## Objectif
Détecter et déclencher l'`IInteractable` le plus proche sur **E**. Reproduit `PlayerInteraction.cs` + `IInteractable`.

## Critères d'acceptation
- Interface/contrat `Interactable` { `interact()`, `canInteract(): boolean` }.
- Touche **E** : cible l'interactable le plus proche dans un rayon **1.5** (échelle monde cohérente avec ×5), avec `canInteract() === true`.
- Ignoré si une UI est ouverte (réutilise le flag de TASK-007).
- `tsc --noEmit` vert.

## Notes
NPC (TASK-009) et Door (TASK-011) implémenteront `Interactable`.

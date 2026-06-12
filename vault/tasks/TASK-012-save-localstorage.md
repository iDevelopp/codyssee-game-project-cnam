---
id: TASK-012
titre: SaveSystem (localStorage) — persistance de la progression
owner: agent-moteur
statut: review
depends_on: [TASK-011]
artefacts: [web/src/systems/SaveSystem.ts]
jalon: J1
---

## Objectif
Persister la progression en localStorage et la restaurer au rechargement. Nouveau vs Unity (hors scope proto, demandé par le brief web).

## Critères d'acceptation
- Sauvegarde : deck du joueur, PNJ aidés, (zones débloquées / frise révélée — préparer le schéma même si J1 = 1 zone).
- Restauration au chargement : un PNJ déjà aidé reste résolu (joue resolvedLines, pas de question) ; deck conservé ; porte ouverte si déjà débloquée.
- Clé localStorage versionnée (ex. `codyssee.save.v1`) pour migration future.
- Bouton "Rejouer"/nouvelle partie : définir le comportement (reset zone vs reset save) — documenter le choix.
- `tsc --noEmit` vert.

## Notes
Schéma de save extensible (J3 multi-zones, J4 frise). Survie au reload = critère d'acceptation V1.

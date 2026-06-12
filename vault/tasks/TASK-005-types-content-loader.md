---
id: TASK-005
titre: Types TS + loader /content (squelette data-driven)
owner: agent-moteur
statut: done
depends_on: [TASK-001]
artefacts: [web/src/types/, web/src/systems/ContentLoader.ts, web/content/cards.json, web/content/npcs.json, web/content/zones/zone_01.json, web/content/strings.fr.json]
jalon: J0
---

## Objectif
Poser les interfaces TS (`CardData`, `NpcData`, `ZoneData`, `DialogueData`, `TimelineEntry`, `Strings`) selon ADR-002, et un `ContentLoader` qui charge/valide les fichiers `/content` au runtime. Seed minimal : 4 cartes existantes + 2 PNJ + zone_01 + strings FR, repris de `gdd/01-boucle-reference.md`.

## Critères d'acceptation
- Types TS complets et commentés (JSDoc) reflétant le modèle ADR-002.
- `ContentLoader` charge les JSON `/content` et expose un accès typé ; échoue clairement si un fichier est invalide (dev).
- Seed `/content` : `cards.json` (python, javascript, csharp, html), `npcs.json` (2 PNJ avec question/expectedCardId/thanks/hint), `zones/zone_01.json`, `strings.fr.json`.
- Aucun texte/contenu en dur dans le code moteur.

## Notes
Co-conçu avec agent-contenu pour le modèle de données. Base de J1.

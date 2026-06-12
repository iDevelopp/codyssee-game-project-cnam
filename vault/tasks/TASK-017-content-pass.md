---
id: TASK-017
titre: Passe de contenu — externalisation complète + preuve "ajouter = un fichier"
owner: agent-contenu
statut: done
depends_on: [TASK-014]
artefacts: [web/content/cards.json, web/content/npcs.json, web/content/zones/, web/content/strings.fr.json, vault/gdd/]
jalon: J2
---

## Objectif
Prendre l'ownership de `/web/content`. Vérifier que tout le contenu/texte FR est externalisé. Démontrer l'extensibilité data-driven : ajouter des cartes / un PNJ / (option) une 2e zone SANS toucher au moteur.

## Critères d'acceptation
- Toutes les strings FR du jeu présentes et cohérentes dans `strings.fr.json` (collaboration audit TASK-014).
- Démonstration : ajouter ≥2 cartes-langages supplémentaires (vers la cible frise ~15-20, ADR-004) et ≥1 PNJ, uniquement via fichiers `/content` (+ `zones/index.json` si nouvelle zone). Le ContentLoader valide (ids cohérents).
- Cohérence pédagogique : question ↔ carte attendue alignées ; respect des piliers de conception.
- MAJ `vault/gdd/` (cartes/PNJ ajoutés, plan d'extension frise).
- Pas de régression : le jeu charge et tourne avec le contenu étendu.

## Notes
Ne pas modifier le moteur (`src/`). Si un besoin moteur émerge, ouvrir un handoff vers agent-moteur. Schéma index.json défini en TASK-014.

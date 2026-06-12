---
id: TASK-014
titre: Chargement de zones data-driven (zones/index.json) + audit anti-hardcode
owner: agent-moteur
statut: done
depends_on: [TASK-013]
artefacts: [web/content/zones/index.json, web/src/systems/ContentLoader.ts, vault/gdd/03-authoring.md]
jalon: J2
---

## Objectif
Finir le "tout data-driven" côté moteur. Le ContentLoader charge actuellement `zone_01` en dur → piloter la liste des zones par `content/zones/index.json`. Auditer le code moteur pour éliminer tout contenu/texte de jeu codé en dur (titre, tagline, libellés porte/HUD, messages) → tout via `strings.fr.json` ou `/content`.

## Critères d'acceptation
- `content/zones/index.json` = liste ordonnée d'ids de zones ; ContentLoader charge toutes les zones listées (plus de `zone_01` en dur).
- Audit : aucune string de jeu en dur dans `src/` (grep documenté). Titre/tagline du menu, libellés boutons, "SORTIE", prompt "E", messages → `strings.fr.json`.
- Ajouter une zone/carte = ajouter un fichier (zone) ou une entrée (index) sans toucher au moteur. Démontré.
- `vault/gdd/03-authoring.md` : guide "comment ajouter une carte / un PNJ / une zone" (schémas + exemple).
- `tsc --noEmit` vert ; non-régression J1.

## Notes
Coordonner le schéma `index.json` avec agent-contenu (TASK-017). Réf handoff agent-moteur dans `agents/agent-moteur.md`.

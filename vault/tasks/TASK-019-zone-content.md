---
id: TASK-019
titre: Contenu multi-zones (zone_02[+zone_03], PNJ/cartes, chaînage)
owner: agent-contenu
statut: done
depends_on: [TASK-018]
artefacts: [web/content/zones/, web/content/npcs.json, web/content/cards.json, web/content/strings.fr.json, vault/gdd/04-content.md]
jalon: J3
---

## Objectif
Créer ≥1 nouvelle zone jouable (zone_02, idéalement zone_03) avec ses PNJ et cartes, chaînées via `nextZoneId`, pour démontrer le multi-zones data-driven. Respecte le plan de `vault/gdd/04-content.md` (ères, ~15-20 langages cible).

## Critères d'acceptation
- `zones/zone_02.json` (et zone_03 si possible) : `displayName`, `spawn`, `npcs[]`, `doors[]`, `unlockCondition`, `nextZoneId` (chaînage ; dernière zone `nextZoneId` absent → fin de jeu), `themeEra`.
- Ajout dans `zones/index.json` (ordre).
- Nouveaux PNJ (questions cohérentes, FR, dernière ligne = question, expectedCardId existant), nouvelles cartes-langages thématisées par ère (champ `era`).
- PNJ espacés (>240px, OBS-01). Strings ajoutées si besoin.
- ContentLoader valide (ids cohérents, nextZoneId pointe vers une zone existante).
- MAJ `vault/gdd/04-content.md` (zones + cartes ajoutées).

## Notes
Ne pas toucher `src/`. Le schéma porte→zone suivante (nextZoneId, unlockCondition) est consommé par TASK-020. Coordonner le vocabulaire `unlockCondition` avec agent-moteur si nouveau cas.

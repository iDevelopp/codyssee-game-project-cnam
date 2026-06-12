---
id: TASK-025
titre: J5 — Expansion contenu (zones 4-5, ~19 langages) + narration cyberpunk
owner: agent-contenu
statut: done
depends_on: [TASK-022]
artefacts: [web/content/cards.json, web/content/npcs.json, web/content/zones/*, web/content/timeline.json, web/content/strings.fr.json, web/content/narrative.json]
jalon: J5
---

## Objectif
Atteindre la vision complète du GDD (ADR-004 : 4-6 zones, ~15-20 langages) et poser la trame narrative cyberpunk.

## A. Expansion contenu (data-driven, zéro code moteur)
Suivre le plan de `vault/gdd/04-content.md` :
- **Zone 4 — L'explosion du web (1990s–2000s)** : cartes `php` (1994), `ruby` (1995) ajoutées ; réutilise java/csharp. 3 PNJ (ex. Rasmus→php, Yukihiro→ruby, + 1 réutilisant java ou csharp). themeEra `2000s`.
- **Zone 5 — L'ère moderne (2010s+)** : cartes `go` (2009), `kotlin` (2016), `typescript` (2012), `swift` (2014) ajoutées ; réutilise rust. 3-4 PNJ. themeEra `2010s`.
- Chaînage : zone_03.nextZoneId → zone_04 → zone_05 → fin. Mettre à jour chaque `leadsToZoneId`/`nextZoneId` ET `zones/index.json`.
- `cards.json` : +6 cartes (id, displayName, era, description, usage). `npcs.json` : +6-7 PNJ (espacement ≥300px, OBS-01). `timeline.json` : +6 entrées (year, language, cardId, blurb, unlockedBy=cardId, influences factuelles : ex. go←c, kotlin←java, typescript←javascript/java, swift←cpp/rust).
- Cible finale : **5 zones, ~19 langages**.

## B. Narration cyberpunk
Créer `web/content/narrative.json` (chargé optionnel — coordonner clé avec agent-moteur TASK-026) :
```jsonc
{
  "intro": ["ligne 1", "ligne 2"],        // écran d'intro nouvelle partie
  "zoneIntros": { "zone_01": ["…"], … },   // bandeau à l'entrée de chaque zone
  "outro": ["…"]                            // fin de jeu
}
```
Trame : un ingénieur dans un futur où les IA défaillent ; restaurer/transmettre l'histoire des langages répare la mémoire des systèmes. Chaque zone = une strate temporelle. Ton : cyberpunk sobre, court, FR. Cohérent avec les piliers (narration, apprentissage sans pression).
- Garder les dialogues PNJ existants fonctionnels ; tu peux enrichir leur saveur narrative (rester court).

## Critères
- 5 zones chaînées, ~19 cartes, ~19 entrées timeline, tous cardId/influences valides.
- `narrative.json` cohérent (intro/zoneIntros pour les 5 zones/outro).
- `pnpm build` vert ; dist reflète tout le contenu.
- `vault/gdd/04-content.md` mis à jour (inventaire final). Ligne `vault/log.md`. Fiche → review.

## Règles
Code/identifiers English ; strings/contenu joueur FR. Ne pas toucher au code moteur. Ne pas committer.

# GDD vivant — Vision

> Source de vérité fonctionnelle d'origine : `dev-Egor/CLAUDE.md`. Ce GDD vivant la reprend et l'étend vers la version web complète. Maintenu par **agent-contenu**.

## Pitch

**Codyssey** — jeu narratif d'exploration et de collection 2D top-down. Croisement *Animal Crossing* (exploration libre, PNJ) × jeu de cartes (collection, deck). Le joueur incarne un ingénieur informatique dans un futur cyberpunk où les IA défaillent. Il parcourt des zones, aide des PNJ en répondant à leurs questions à l'aide de **cartes = langages de programmation**, débloque des zones, et révèle progressivement une **frise chronologique de l'histoire des langages**.

## Piliers de conception

Toute décision gameplay/UX doit servir ≥ 1 pilier :

1. Découverte et exploration
2. Apprentissage ludique (sans pression)
3. Narration interactive via PNJ
4. Collection et progression via cartes
5. Liens logiques entre langages
6. Accessibilité et plaisir

## Périmètre cible

Vision complète du GDD : multi-zones, frise chronologique des langages, narration cyberpunk. Atteinte via une **architecture data-driven** (cf. `ADR-002`) : ajouter une zone / carte / langage = ajouter un fichier dans `/web/content`, zéro code moteur.

## Contraintes techniques arrêtées

- Moteur : **Phaser 3 + TypeScript + Vite** (`ADR-001`).
- Déploiement : build statique → nginx VPS. Pas de backend.
- Sauvegarde : **localStorage** (zones débloquées, deck, PNJ aidés, frise révélée). Pas de comptes.
- Langue jeu : **français**. Textes isolés dans `/web/content/strings.fr.json`.
- Cible : desktop d'abord (clavier/souris), responsive correct. Pas de tactile complet en V1.
- Art : réutiliser les sprites `dev-Egor`. Pas d'art IA en V1.
- Audio : CC0/libre de droits.

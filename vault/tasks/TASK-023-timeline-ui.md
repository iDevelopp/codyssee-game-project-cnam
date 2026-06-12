---
id: TASK-023
titre: Frise chronologique — UI + reveal (TimelineScene)
owner: agent-moteur
statut: done
depends_on: [TASK-022]
artefacts: [web/src/scenes/TimelineScene.ts, web/src/types/TimelineEntry.ts, web/src/scenes/ZoneScene.ts, web/src/ui/EndScreen.ts, web/src/main.ts]
jalon: J4
---

## Objectif
Afficher la frise chronologique des langages, révélée progressivement à mesure que les cartes entrent dans le deck. Liens logiques (influences) rendus visuellement.

## Reveal — règle (aucune modif SaveSystem)
Une entrée est **révélée ⟺ `entry.cardId ∈ deckCardIds`** (deck = source de vérité, déjà persisté).
Deck initial = cartes hors-réponses-PNJ → ces entrées révélées d'emblée ; les cartes-réponses se révèlent en aidant les PNJ. Pas de nouveau champ de save.

## Travail
- Étendre `TimelineEntry` : `influences?: string[]` (cardIds dont ce langage a hérité). Doc JSDoc.
- `TimelineScene` (overlay, enregistrée dans `main.ts`, lancée par-dessus ZoneScene) :
  - Axe temporel horizontal, entrées triées par `year`, repères de décennie.
  - Entrée révélée : displayName + année + blurb (au survol / panneau détail).
  - Entrée verrouillée : silhouette "???" (`timeline.locked`), position visible (on devine qu'il en manque).
  - Liens `influences` : trait/flèche entre l'entrée et ses sources, **uniquement si les deux sont révélées**.
  - Compteur "X / N révélés".
- Ouverture : touche **T** depuis ZoneScene (toggle), **ESC**/T pour fermer ; pause des entrées au-dessous. Bouton "Voir la frise" sur `EndScreen`. Optionnel : entrée depuis MainMenu si save existe.
- Reveal live : sur `DeckSystem.onCardAdded` (ou event), pulse/anim de la nouvelle entrée si la frise est ouverte ; sinon état correct à l'ouverture.
- Respecter conventions : data-driven (aucun langage en dur), strings via `getString`, pixelArt, English code / FR strings.

## Critères d'acceptation
- T ouvre/ferme la frise en jeu ; déplacement joueur figé quand ouverte.
- À l'entrée du jeu : exactement les cartes du deck initial sont révélées ; les autres verrouillées.
- Aider un PNJ → son langage se révèle (live si frise ouverte, sinon à la prochaine ouverture).
- Liens d'influence affichés entre entrées révélées.
- `tsc --noEmit` vert, `pnpm build` vert. Non-régression J1–J3.

## Notes
`ContentLoader.getTimeline()` existe déjà (charge timeline.json optionnel). Si timeline vide → frise affiche `timeline.empty`, pas d'erreur.
HANDOFF si tu modifies un schéma partagé. Mettre à jour `vault/log.md`.

---
id: TASK-010
titre: Deck (UI + sélection) + question/réponse (récompense, indice/retry, résolu)
owner: agent-moteur
statut: review
depends_on: [TASK-009]
artefacts: [web/src/systems/DeckSystem.ts, web/src/ui/DeckPanel.ts]
jalon: J1
---

## Objectif
Deck du joueur + panneau de sélection de cartes + logique question/réponse. Reproduit `Deck.cs`, `DeckUI.cs`, partie question de `NPC.cs`, et le deck initial de `GameManager.cs`.

## Critères d'acceptation
- Deck initial = `ContentLoader.getInitialDeckCards()` (toutes les cartes SAUF les `expectedCardId` des PNJ). Vérifié au lancement de la zone.
- DeckPanel (UIScene) : cartes en boutons (nom gras, description, usage), titre "Quelle carte répond à sa question ?". Marque "UI ouverte". Affiche **toutes** les cartes (comme Unity), pas seulement le deck.
- Bonne carte (== expectedCardId) : `thanksLine`, ajout de la carte au deck joueur (récompense), PNJ `IsResolved`, émet l'event résolution.
- Mauvaise carte : `hintLine`, retry (E rouvre le deck), pas de récompense.
- `tsc --noEmit` vert.

## Notes
Décision Unity reprise : le DeckPanel propose toutes les cartes de la base, la bonne réponse est une carte nouvelle gagnée. Réf `gdd/01-boucle-reference.md`.

---
id: TASK-024
titre: QA J4 — frise chronologique
owner: agent-qa
statut: done
depends_on: [TASK-023]
artefacts: [web/tests/e2e/j4-timeline.spec.js, web/tests/e2e/qa-report-j4-*.json]
jalon: J4
---

## Objectif
Vérifier la frise chronologique de bout en bout via Playwright sur build de prod (vite preview, base `/codyssee/`).

## Critères (PASS/FAIL, captures à l'appui)
- **T1** Touche T ouvre la frise ; T/ESC la ferme. Joueur figé quand ouverte.
- **T2** État initial : seules les entrées du deck initial sont révélées (les cartes-réponses PNJ verrouillées "???").
- **T3** Aider un PNJ (réponse correcte) → l'entrée du langage correspondant passe de verrouillée à révélée.
- **T4** Persistance : après reload (deck persisté), les entrées révélées le restent.
- **T5** Liens d'influence visibles entre entrées révélées ; ordre chronologique correct (year croissant).
- **T6** Non-régression : boucle J1–J3 intacte (dialogue, deck, transitions zones, fin), 0 erreur console/page.
- **T7** `pnpm build` vert.

## Sortie
`j4-timeline.spec.js` + `qa-report-j4-2026-06-12.json`, captures préfixe `j4-*`. Bugs → fiche/handoff, owner agent-moteur ou agent-contenu.

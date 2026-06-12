---
id: TASK-028
titre: QA J5 — finale (5 zones, narration, responsive, perf)
owner: agent-qa
statut: done
depends_on: [TASK-025, TASK-026, TASK-027]
artefacts: [web/tests/e2e/j5-final.spec.js, web/tests/e2e/qa-report-j5-*.json]
jalon: J5
---

## Objectif
QA finale de bout en bout sur build de prod (vite preview, base `/codyssee/`). Valide la vision complète du GDD.

## Critères (PASS/FAIL + captures)
- **F1** Nouvelle partie : écran d'intro narratif affiché (intro[]), passable au clic/touche, puis entrée zone_01.
- **F2** Reprise (reload avec save) : PAS d'intro, reprise directe à la zone courante.
- **F3** Bandeau d'entrée de zone affiché à chaque zone (zoneIntros), non bloquant.
- **F4** Playthrough complet 5 zones : zone_01→02→03→04→05→fin, 15 PNJ aidables, transitions OK.
- **F5** Outro narratif (outro[]) affiché sur l'EndScreen.
- **F6** Frise : à la fin, 19/19 langages révélés ; liens d'influence des nouveaux langages présents ; ordre chronologique.
- **F7** Responsive : rendu correct à 1366×768 ET 1920×1080 (pas de débordement, canvas centré/scalé). Captures aux 2 résolutions.
- **F8** Perf : build émet ≥2 chunks (vendor-phaser séparé). 
- **F9** Non-régression : 0 erreur console, 0 erreur page sur tout le parcours. Favicon 200 (plus de 404).
- **F10** `pnpm build` vert.

## Sortie
`j5-final.spec.js` + `qa-report-j5-2026-06-12.json`, captures `j5-*`. Bugs → handoff + owner. Nommer tout script jetable `diag-*.js` (gitignoré).

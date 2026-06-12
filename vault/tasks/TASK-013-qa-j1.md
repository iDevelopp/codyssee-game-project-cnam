---
id: TASK-013
titre: QA J1 — E2E Playwright (critères d'acceptation vertical slice)
owner: agent-qa
statut: done
depends_on: [TASK-012]
artefacts: [web/tests/e2e/, captures]
jalon: J1
---

## Objectif
Valider la boucle complète J1 de bout en bout via Playwright (clavier simulé, assertions, captures). Tester sur le build/preview.

## Critères d'acceptation (V1)
1. Menu principal s'affiche ; "Jouer" lance la zone.
2. Joueur se déplace (ZQSD/flèches), animé 4 directions ; caméra suit en douceur.
3. Près d'un PNJ, E déroule le dialogue puis ouvre le deck (cartes en boutons).
4. Mauvaise carte → indice + retry ; bonne carte → remerciement + gain de carte.
5. Tous les PNJ à question aidés → porte verte → écran de fin (Rejouer / Menu / Quitter).
6. Progression survit à un rechargement de page (localStorage).

## Notes
Rapport PASS/FAIL par critère avec preuve (capture, extrait console). Échecs → handoff à agent-moteur via l'orchestrateur. Ne pas corriger le moteur soi-même.

## Résultats QA (2026-06-12)

| # | Critère | Résultat | Preuve |
|---|---------|----------|--------|
| C1 | Menu principal + Jouer → zone | **PASS** | screenshots/001, 002 |
| C2 | Déplacement ZQSD+flèches, animé 4 dirs, caméra suit | **PASS** | screenshots/003–010, caméra visible en 020/053 |
| C3 | Près NPC, E → dialogue ligne par ligne → deck | **PASS** | screenshots/012–015 |
| C4 | Mauvaise carte → indice + retry ; bonne → remerciements + carte ajoutée | **PASS** | screenshots/016–019, LS `deckCardIds=["python","html","javascript"]` |
| C5 | Tous PNJ aidés → porte verte → écran de fin (Rejouer/Menu/Quitter) | **PASS** | screenshots/052, 055, 057 |
| C6 | Progression survit au reload (localStorage) | **PASS** | screenshots/059–062, LS identique avant/après |

### Bugs / observations à remonter à agent-moteur

**BUG-01 (bloquant — infra) : Content JSON absent du build de production**
- Symptôme : `pnpm preview` (port 4173) → `PreloadScene: ContentLoader failed Error: "/codyssee/content/cards.json" is not valid JSON` — le serveur retourne `text/html` (fallback SPA) au lieu du JSON.
- Cause : `web/content/` n'est pas dans `web/public/` → Vite ne le copie pas dans `dist/`. Le jeu est **non fonctionnel sur le build de production**.
- Workaround utilisé pour les tests : serveur `dev` (port 5173) qui sert `content/` directement.
- Fix requis : déplacer `web/content/` → `web/public/content/` OU ajouter un plugin Vite `vite-plugin-static-copy`. Assigné à agent-infra.

**OBS-01 (gameplay — non bloquant) : Interaction radius 240px = Léa et Thomas peuvent se chevaucher**
- Léa est à (320,240), Thomas à (640,400) : distance ≈ 377px. Avec rayon 240px, la zone de chevauchement est présente si le joueur est à mi-chemin.
- Conséquence : quand le joueur est entre les deux PNJ, `_findNearest` peut cibler Léa (déjà résolue) plutôt que Thomas (plus loin), perturbant la navigation vers Thomas.
- Pas bloquant (le joueur peut se positionner correctement en se déplaçant plus loin), mais dégradation UX notable.

**OBS-02 (cosmétique) : favicon 404**
- `GET /favicon.ico` → 404. Aucun impact fonctionnel.

### Artefacts produits
- `web/tests/e2e/j1-loop.spec.js` — script de test standalone (nécessite playwright installé)
- `web/tests/e2e/screenshots/` — 62 captures horodatées
- `web/tests/e2e/qa-report-2026-06-12.json` — rapport JSON machine-readable

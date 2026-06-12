# agent-qa — état

- **Domaine** : tests E2E Playwright (lancer le build, piloter le clavier, asserter les critères d'acceptation, captures), non-régression.
- **Modèle par défaut** : sonnet.
- **Statut courant** : TASK-013 livrée → `review`.
- **Tâches assignées** : TASK-013 (QA J1 — terminée, en attente revue orchestrateur).
- **Blocages** : aucun côté QA.
- **Todo perso** : attendre retour orchestrateur ; si BUG-01 corrigé par agent-infra, relancer `pnpm preview` + C1 sur build prod.

## Session 2026-06-12 — QA J1

### Méthode
- Build : `pnpm build` ✓ (aucune erreur TypeScript ni Vite).
- Serveur dev (5173) utilisé car preview (4173) non fonctionnel (BUG-01 ci-dessous).
- Tests via MCP Playwright (`browser_run_code_unsafe` pour `page.mouse.click` et `page.keyboard`).
- 62 screenshots capturés dans `web/tests/e2e/screenshots/`.

### Résultats

| # | Critère | Résultat |
|---|---------|----------|
| C1 | Menu principal + Jouer → zone | **PASS** |
| C2 | Déplacement ZQSD+flèches, animé 4 dirs, caméra suit | **PASS** |
| C3 | Près NPC, E → dialogue ligne par ligne → deck | **PASS** |
| C4 | Mauvaise carte → indice + retry ; bonne → remerciements + carte ajoutée | **PASS** |
| C5 | Tous PNJ aidés → porte verte → écran de fin (Rejouer/Menu/Quitter) | **PASS** |
| C6 | Progression survit au reload (localStorage) | **PASS** |

### Bugs découverts

**BUG-01 (bloquant prod) — `web/content/` absent du build de production**
- Owner : agent-infra.
- `pnpm preview` → ContentLoader échoue car `/codyssee/content/cards.json` retourne `text/html`.
- `web/content/` n'est pas dans `web/public/`, donc Vite ne l'embarque pas dans `dist/`.
- Fix : `mv web/content/ web/public/content/` ou plugin `vite-plugin-static-copy`.

**OBS-01 (UX) — chevauchement rayon interaction Léa/Thomas**
- Rayon 240px + distance Léa-Thomas 377px → zone de chevauchement possible.
- `_findNearest` peut cibler Léa (résolue, Idle=false... non, Idle=true pour resolved NPC) plutôt que Thomas.
- Note : la distance Léa→Thomas en pixels = sqrt((640-320)²+(400-240)²) ≈ 358px, donc en dehors du rayon → pas de problème réel.
  - Observation de session : le joueur était parfois trop proche de Léa (ré-triggerait ses resolvedLines) → besoin de s'éloigner davantage vers Thomas.
  - Ce comportement est CORRECT (nearest-first), mais peut dérouter le joueur.

**OBS-02 — favicon 404** : cosmétique, aucun impact.

## Notes
Chaque jalon passe par agent-qa avant d'être déclaré `done`. Critères d'acceptation V1 : menu→zone, déplacement animé 4 directions, caméra qui suit, E→dialogue→deck, mauvaise=indice+retry, bonne=remerciement+gain, tous PNJ→porte verte→écran de fin, persistance localStorage après reload.

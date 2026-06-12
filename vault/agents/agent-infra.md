# agent-infra — état

- **Domaine** : Vite config, scripts de build, déploiement statique nginx (VPS), optimisation bundle, workflow git branche `web`.
- **Modèle par défaut** : sonnet.
- **Statut courant** : TASK-004 exécutée → `review`.
- **Tâches assignées** : TASK-001 (scaffold) — `done` | TASK-004 (deploy) — `review`
- **Blocages** : aucun.
- **Todo perso** : aucun.

## Notes
- Build `vite build` → `dist/` servi par nginx. Pas de backend.
- nginx VPS : `sites-enabled` = vrais fichiers (pas symlinks), jamais de `.bak` dedans (dup server) — cf. mémoire infra Arthur.
- Commits/push : seulement après feu vert d'Arthur. Conventional Commits.
- URL/vhost de déploiement : `ohvenus.fr/codyssee` — `location /codyssee/ { ... try_files }` sous le vhost `ohvenus.fr`.

## Historique TASK-004 (2026-06-12)
- `pnpm build` ✓ (4.75s) — `dist/index.html` référence `/codyssee/assets/index-DNQewVMM.js`.
- Répertoire servi : `/var/www/codyssee/` (rsync --delete depuis `dist/`).
- Bloc `location ^~ /codyssee/ { alias /var/www/codyssee/; try_files ... }` ajouté dans `/etc/nginx/sites-enabled/ohvenus.fr`.
- `sudo nginx -t` ✓ — `sudo systemctl reload nginx` ✓.
- Vérification curl : `https://ohvenus.fr/codyssee/` → 200, asset JS → 200.
- TASK-004 → `review`.

## Historique TASK-001 (2026-06-12)
- Arborescence `web/` créée (src/{scenes,systems,entities,ui,data,types}, content/, public/assets/{sprites,tiles,audio}).
- `package.json` + `vite.config.ts` (base: '/codyssee/') + `tsconfig.json`.
- `index.html` + `src/main.ts` + `src/scenes/BootScene.ts` (scène vide, fond uni, texte centré).
- `web/.claude/CLAUDE.md` (mémo stack/conventions).
- `web/.gitignore`.
- `pnpm install` OK (phaser 3.90.0, vite 6.4.3, ts 5.9.3).
- `pnpm build` ✓ — produit `dist/` en 4.76s.
- `pnpm dev` ✓ — démarre `http://localhost:5173/codyssee/` sans erreur.
- Chunk size warning (Phaser ~1.5 MB) : attendu, adresser via `build.rollupOptions.output.manualChunks` dans une prochaine tâche.

---
id: TASK-004
titre: Build statique + déploiement nginx (page vide jouable)
owner: agent-infra
statut: done
depends_on: [TASK-001]
artefacts: [web/dist/, nginx vhost, /var/www/codyssee/]
jalon: J0
---

## Objectif
Servir le build statique Phaser via nginx sur le VPS à **`ohvenus.fr/codyssee`** (sous-chemin du vhost existant). Valider la chaîne build→deploy avec une scène vide.

## Critères d'acceptation
- `vite build` (avec `base: '/codyssee/'`) → `dist/` servi sous `location /codyssee/` du vhost `ohvenus.fr`.
- La page charge Phaser (canvas visible) depuis `https://ohvenus.fr/codyssee`.
- `location` ajouté au vrai fichier `sites-enabled/ohvenus.fr` (pas symlink), `try_files $uri $uri/ /codyssee/index.html`, pas de `.bak` (cf. mémoire infra).
- Procédure de déploiement (build + rsync/copy vers la racine servie) documentée dans la fiche.

## Notes
ADR-004. `nginx -t` puis reload après modif. Pas de commit/push sans feu vert.

## Procédure de déploiement (2026-06-12)

**Build :**
```bash
cd /home/ubuntu/dev/codyssee/web
pnpm build
# → dist/ avec base=/codyssee/ dans les assets
```

**Copie vers le répertoire servi :**
```bash
sudo rsync -av --delete /home/ubuntu/dev/codyssee/web/dist/ /var/www/codyssee/
```
Répertoire servi : `/var/www/codyssee/`

**Bloc nginx ajouté** dans `/etc/nginx/sites-enabled/ohvenus.fr` (avant `location /`) :
```nginx
# Codyssey — Phaser static SPA (agent-infra, 2026-06-12, TASK-004)
location ^~ /codyssee/ {
    alias /var/www/codyssee/;
    try_files $uri $uri/ /codyssee/index.html;
    # SPA fallback: unknown routes → index.html (Phaser handles routing)
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|otf|mp3|ogg|wav)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Reload :**
```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Vérification (2026-06-12) :**
- `https://ohvenus.fr/codyssee/` → HTTP 200 ✓
- `https://ohvenus.fr/codyssee/assets/index-DNQewVMM.js` → HTTP 200 ✓
- index.html référence `/codyssee/assets/index-DNQewVMM.js` ✓

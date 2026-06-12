# ADR-004 — Adaptations web (décisions Arthur 2026-06-12)

- **Statut** : accepté
- **Date** : 2026-06-12

## Décisions

1. **Frise (J4)** : périmètre **médium ~15-20 langages**, 4-6 zones thématiques. Couvre les grandes ères (Fortran → Python/JS/Rust). Extensible ensuite par data (zéro code).
2. **Bouton « Quitter »** (pas d'`Application.Quit` sur web) : **retour au menu principal**. L'écran de fin propose Rejouer / Menu / Quitter, où Quitter = `MainMenuScene`.
3. **Déploiement** : **`ohvenus.fr/codyssee`** (sous-chemin du vhost `ohvenus.fr` existant via un `location` block).
   - Conséquence : Vite **`base: '/codyssee/'`** obligatoire ; tous les chemins d'assets relatifs au base.
   - vhost `ohvenus.fr` présent dans `sites-enabled` (vrai fichier).

## Conséquences

- agent-infra : config Vite `base`, build → `dist/`, `location /codyssee/ { ... try_files }` sous `ohvenus.fr`.
- agent-moteur : Quitter → MainMenuScene ; charger les assets via base-relative (Vite gère si chemins relatifs / `import.meta.env.BASE_URL`).
- agent-contenu : cibler ~15-20 langages pour la timeline (cadrage à produire dans `vault/gdd/`).

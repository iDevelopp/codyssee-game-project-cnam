# ADR-005 — Le contenu `/web/content` est copié dans le build via vite-plugin-static-copy

- **Statut** : accepté
- **Date** : 2026-06-12
- **Contexte** : revue J1 (QA BUG-01)

## Problème

Le contenu data-driven vit dans `web/content/` (emplacement documenté, éditable sans toucher au moteur — ADR-002). Le `ContentLoader` fetch `${BASE_URL}content/*.json` au runtime. Or Vite ne copie QUE `public/` dans `dist/`. Sur un build de production, le fetch tombait sur le fallback SPA (`index.html`, `text/html`) → `ContentLoader failed` → **jeu cassé en prod** (OK en dev car le serveur Vite sert les fichiers du projet).

## Options

- A) Déplacer `web/content/` → `web/public/content/`. Zéro dépendance, mais change l'emplacement documenté partout (brief §3, ADR-002, handoffs).
- B) **Garder `web/content/` et le copier dans `dist/content/` via `vite-plugin-static-copy`.** Honore l'arborescence documentée et la story « contenu éditable ».

## Décision

**Option B.** `vite.config.ts` → `viteStaticCopy({ targets: [{ src: 'content', dest: '.' }] })`. `pnpm build` produit `dist/content/`.

## Conséquences

- Ne PAS déplacer `web/content/` dans `public/`. Le plugin gère la copie.
- Toute nouvelle arborescence sous `content/` (ex. `zones/`, `timeline.json` futur) est copiée automatiquement.
- Vérifié en revue J1 : build prod → `dist/content/*` présent, preview `ohvenus.fr`-like sert le JSON, menu FR rendu (strings chargées), plus d'erreur ContentLoader.

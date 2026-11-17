# Codysse

Jeu web d'exploration et de collection sur l'histoire des langages de
programmation. En ligne sur [codysse.fr](https://codysse.fr). Produit ARKHYA.

Le joueur parcourt cinq zones en vue de dessus, aide des PNJ en jouant des
cartes qui représentent des langages, et révèle au fil de la partie une frise
chronologique de dix-neuf langages et de leurs filiations. La progression est
enregistrée en local, dans le navigateur. Il n'y a ni compte ni serveur de jeu.

## Origine

Le projet vient d'un travail scolaire mené au CNAM, dont ce dépôt garde le nom
d'origine (`codyssee-game-project-cnam`) et une partie des assets. Le prototype
Unity a depuis été réécrit en jeu web, et le produit publié sous le nom
**Codysse**. Les orthographes `codyssee` et `Codyssey` sont des traces de cette
période ; le nom du produit est **Codysse**.

## Stack

- Phaser 3, TypeScript, Vite 6
- pnpm
- Build statique multipage servi par nginx : landing sur `/`, jeu sur `/play/`
- Pas de backend

## Développement

```bash
cd web
pnpm install
pnpm dev      # serveur de développement
pnpm build    # tsc + vite build
pnpm preview  # sert le build
```

Le contenu du jeu (zones, PNJ, dialogues, cartes, frise) est en JSON dans
`web/content/`. Ajouter une zone ou un langage se fait par les données, sans
toucher au moteur.

## Repères

- `web/src/` — moteur : scènes, systèmes, entités, UI
- `web/content/` — données de jeu
- `web/public/assets/` — sprites, tuiles, audio
- `docs/specs/` — spécifications
- `vault/` — journal de projet, décisions (ADR), suivi des tâches

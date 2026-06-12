---
id: TASK-027
titre: J5 — Polish art & audio (placeholders → final)
owner: agent-art
statut: done
depends_on: []
artefacts: [web/public/assets/*, web/content/audio.json]
jalon: J5
---

## Objectif
Remplacer les placeholders signalés au backlog par des assets CC0/libres présentables. Indépendant du contenu (peut tourner en parallèle de TASK-025).

## Travail (priorité décroissante)
1. **Ambient cyberpunk** : remplacer `ambient.ogg/mp3` (drone synthétisé) par un vrai loop CC0 ambient/cyberpunk (sources : Kenney, Free Music Archive CC0, OpenGameArt CC0). Mettre à jour `audio.json` si nom change. Garder OGG+MP3, loopable, volume modéré.
2. **Fonds par ère** : un fond/tile-set distinct et lisible par `themeEra` (1950s→2010s) — au minimum des palettes/textures cohérentes améliorant le damier actuel. Rester pixel-art, fichiers légers.
3. **Favicon** : `web/public/favicon.ico` (+ lien dans index.html si nécessaire) — supprime le 404 OBS-02. Thème Codyssey.
4. **Portraits** : si temps, remplacer les rips NES Zelda par des placeholders neutres CC0 ou silhouettes générées. Sinon documenter et laisser.

## Critères
- Aucune régression de chargement (`pnpm build` vert, assets présents dans dist).
- Licences CC0/libres uniquement (tracer la source dans `vault/gdd/02-assets.md`).
- Pas de code moteur modifié (assets + audio.json + index.html favicon link only).

## Règles
Ne pas committer. Documenter sources/licences. Ligne `vault/log.md`. Fiche → review.

---
id: TASK-015
titre: Sourcing audio CC0 (musique ambiance + SFX) + manifeste
owner: agent-art
statut: done
depends_on: [TASK-013]
artefacts: [web/public/assets/audio/, web/content/audio.json, vault/gdd/02-assets.md]
jalon: J2
---

## Objectif
Réunir des assets audio CC0/libres de droits et les décrire pour le moteur. Ambiance cyberpunk + SFX de boucle.

## Critères d'acceptation
- Musique d'ambiance (loop) cyberpunk pour menu et/ou zone.
- SFX : interaction (E), bonne carte, mauvaise carte, ouverture de porte. (UI click optionnel.)
- Formats web (`.ogg` + `.mp3` fallback recommandé), normalisés, taille raisonnable.
- `content/audio.json` (data-driven) : mapping clé→fichier(s) + volume par défaut (ex. `{ "sfx.correct": {...}, "music.ambient": {...} }`).
- Licences : chaque asset documenté (source + licence CC0) dans `vault/gdd/02-assets.md`. STRICTEMENT CC0/libre.

## Notes
Pas d'art/audio IA. Coordonner les clés avec agent-moteur (TASK-016). Télécharger depuis sources CC0 (ex. freesound CC0, OpenGameArt CC0, Kenney).

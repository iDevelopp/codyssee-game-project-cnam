---
id: TASK-007
titre: Joueur animé (déplacement 4 directions) + caméra qui suit
owner: agent-moteur
statut: review
depends_on: [TASK-006]
artefacts: [web/src/entities/Player.ts, web/src/systems/MovementSystem.ts]
jalon: J1
---

## Objectif
Joueur top-down déplaçable et animé, caméra lissée. Reproduit `move.cs` + `CameraFollow.cs`.

## Critères d'acceptation
- Déplacement ZQSD + flèches, vitesse **5** (équiv. Arcade : ~ vitesse à calibrer pour un feeling identique, échelle ×5).
- Anim 4 directions : down (0,1,2)/up (3,4,5)/left (6,7,8), milieu=immobile, right=flipX gauche. Cycle `[1,0,1,2]` @ **8 fps**. À l'arrêt : frame immobile.
- Caméra suit le joueur, lissage (équiv. smoothTime 0.15).
- Input gelé quand une UI est ouverte (dialogue/deck/fin) — hook à exposer pour les systèmes UI.
- `tsc --noEmit` vert.

## Notes
Sprite ×5, nearest. Centraliser l'état "UI ouverte" (ex. registre/flag) pour le gel d'input.

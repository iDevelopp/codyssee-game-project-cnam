---
id: TASK-011
titre: Progression + Porte + Écran de fin + câblage Menu
owner: agent-moteur
statut: review
depends_on: [TASK-010]
artefacts: [web/src/systems/ProgressionSystem.ts, web/src/entities/Door.ts, web/src/ui/EndScreen.ts]
jalon: J1
---

## Objectif
Boucler la zone : compter les PNJ aidés, ouvrir la porte, écran de fin. Reproduit `GameManager` (comptage), `Door.cs`, `EndScreenUI.cs`, `MainMenuController.cs`.

## Critères d'acceptation
- ProgressionSystem : `questNPCCount` = PNJ ayant une question ; à chaque résolution, incrément ; quand tous aidés → émet "all helped".
- Door `Interactable` : grise au départ, passe **verte** sur "all helped". E fermée → message verrouillé (dialogue) ; E ouverte → EndScreen.
- EndScreen (UIScene) : message + boutons **Rejouer** (recharge la zone), **Menu principal** (MainMenuScene), **Quitter** (→ MainMenuScene, ADR-004).
- MainMenu "Jouer" → Zone ; cohérent avec le flux TASK-006.
- `tsc --noEmit` vert.

## Notes
Couleurs porte : gris `(0.3,0.3,0.3)` → vert `(0.4,1,0.4)`. Réf boucle.

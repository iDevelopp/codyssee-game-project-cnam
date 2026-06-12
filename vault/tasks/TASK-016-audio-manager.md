---
id: TASK-016
titre: AudioManager + câblage SFX/musique sur les events
owner: agent-moteur
statut: done
depends_on: [TASK-014, TASK-015]
artefacts: [web/src/systems/AudioManager.ts]
jalon: J2
---

## Objectif
Système audio data-driven : charge les sons depuis `content/audio.json`, les joue sur les events de jeu, gère volume/mute persistés.

## Critères d'acceptation
- Preload des audios listés dans `content/audio.json`.
- Musique d'ambiance en loop (menu et/ou zone), démarrée après la 1re interaction utilisateur (politique autoplay navigateur).
- SFX joués sur : interaction E, bonne réponse, mauvaise réponse, ouverture de porte (via GameEvents existants).
- Volume + mute réglables et persistés dans la save (`codyssee.save.v1`).
- Aucun nom de fichier audio en dur dans le moteur (tout via clés `audio.json`).
- `tsc --noEmit` vert ; non-régression J1.

## Notes
Gérer le déverrouillage autoplay (Phaser `sound.unlock` / 1er clic). Réf clés avec agent-art (TASK-015).

## Note de revue — fix BUG-02 (2026-06-12)

BUG-02 diagnostiqué et corrigé dans le cadre de la revue J2. Voir `vault/handoffs/HANDOFF-001-bug02.md`.

Changements appliqués sans changer le statut (`review`) :
- `NPC.isBusy()` ajouté (état seul, indépendant d'InputLock).
- `InteractionSystem.update()` retourne `boolean` (consumed press flag).
- `ZoneScene.update()` : guard `!interactionFired` + `npc.isBusy()` dans la boucle d'avance.
- `AudioManager.play()` : hook `window.__audioCalls` (DEV only, dead-code eliminated en prod).
- Mute persistence A2 : chemin confirmé correct, échec QA était un effet de bord de BUG-02.
- `tsc --noEmit` ✓, `pnpm build` ✓ (7.36s).

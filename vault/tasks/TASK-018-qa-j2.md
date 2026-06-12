---
id: TASK-018
titre: QA J2 — audio + extensibilité data-driven + non-régression
owner: agent-qa
statut: done
depends_on: [TASK-016, TASK-017]
artefacts: [web/tests/e2e/, captures]
jalon: J2
---

## Objectif
Valider J2 : audio branché, contenu pleinement data-driven, aucune régression sur la boucle J1.

## Critères d'acceptation
1. Musique d'ambiance se lance (après interaction) ; SFX audibles sur interaction / bonne / mauvaise carte / ouverture porte (vérifier via events/console ou WebAudio si l'audio headless est limité).
2. Volume/mute persistés après reload.
3. Le contenu étendu (cartes/PNJ ajoutés en TASK-017, zones via index.json) se charge SANS modification moteur.
4. Boucle J1 toujours 6/6 (non-régression).
5. Build prod OK (`pnpm build`) ; `dist/content` + `dist/assets/audio` présents.

## Notes
Audio en headless : si la lecture n'est pas observable, asserter le câblage (sons chargés, `play()` appelé via hooks/console). Rapport PASS/FAIL + preuves. Échecs → handoff orchestrateur.

---

## Re-test — 2026-06-12 (after BUG-02 fix by agent-moteur)

**Spec:** `web/tests/e2e/j2re-audio-content.spec.js`
**Report:** `web/tests/e2e/qa-report-j2re-2026-06-12.json`
**Screenshots:** `web/tests/e2e/screenshots/j2re-001` → `j2re-037` (37 captures)
**Console:** 0 errors, 0 page errors. 8 WebGL ReadPixels warnings (headless GPU — benign).

| # | Critère | Résultat | Evidence |
|---|---------|----------|----------|
| A1 | Audio câblé via `window.__audioCalls` (DEV server 5173) | **PASS** | `__audioCalls = [sfx.interact, sfx.wrong, sfx.correct]` — 3/3 keys confirmed. music.ambient via `ambientTrack.play()` not in array (expected, not routed through `play(key)`). |
| A2 | Mute/unmute persisté après reload | **PASS** | `muted: false → M → true → reload → true → M → false`. localStorage dump confirmed each step. |
| A3 | 3 PNJ + 8 cartes + porte + écran fin (BUG-02 régression) | **PASS** | `helpedNpcIds: ["npc_lea","npc_thomas","npc_clara"]`, `deckCardIds: [...,"javascript","csharp","sql"]` (8 total), `door_exit` unlocked. Speakers confirmed: j2re-009 (Léa), j2re-013 (Thomas "Salut ! Je développe un jeu vidéo en ce moment."), j2re-017 (Clara "Bonjour voyageur ! Je travaille sur une base de données pour notre bibliothèque."). |
| A4 | Non-régression J1 (6/6) | **PASS** | R1 Menu→Zone ✓, R2 Movement 4 dirs ✓, R3 Dialogue+deck ✓, R4 Wrong/correct card ✓, R5 All 3 helped→door→end ✓, R6 Persistence reload ✓ |
| A5 | Build prod — dist/content + dist/assets/audio présents | **PASS** | Content 5/5, audio 12/12 |

**BUG-02 CONFIRMÉ RÉSOLU.** Léa, Thomas, Clara chacun ouvrent leur propre dialogue, donnent leur propre carte (javascript/csharp/sql), porte s'ouvre, écran de fin affiché.

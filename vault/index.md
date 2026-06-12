# Codyssey Web — Tableau de bord

> Seule vue d'ensemble. Tenue par l'orchestrateur. Doit toujours refléter la réalité.

**Dernière MAJ** : 2026-06-12
**Branche** : `web` (depuis `main`, base propre). Unity intact sur `dev-Egor`.
**Phase** : **J2 terminé** ✅ (QA 5/5 PASS après fix BUG-02). Data-driven complet (zones index, 8 cartes, 3 PNJ) + audio CC0 câblé. J0+J1 committés/déployés ; **J2 non committé / non redéployé** (attente feu vert). Prochain : J3.

## État global

| Volet | État |
|---|---|
| Exploration `dev-Egor` | ✅ fait (boucle cartographiée dans `gdd/01-boucle-reference.md`) |
| Vault + protocole | ✅ initialisé |
| Sous-agents définis | ✅ `.claude/agents/` (5) |
| Plan jalons + tâches | ✅ validé |
| Scaffold Vite+Phaser+TS | ✅ done (phaser 3.90, vite 6.4, base=/codyssee/) |
| Pipeline assets de base | ✅ done (player.png 32×32, tiles, portraits ; grille char confirmée) |
| Types TS + ContentLoader + seed /content | ✅ done (tsc vert, fetch data-driven) |
| Déploiement nginx | ✅ J1 live (https://ohvenus.fr/codyssee → jeu jouable, content JSON 200) |
| Boucle jouable web (J1) | ✅ done (QA 6/6, build prod OK après fix ADR-005) |

## Roadmap (jalons)

| Jalon | Objectif | État |
|---|---|---|
| **J0** | Fondations : scaffold Vite+Phaser+TS, vault, agents, pipeline assets de base, build statique déployé nginx (page vide jouable) | ✅ terminé |
| **J1** | Vertical slice parité Unity : 1 zone, joueur animé, 2 PNJ, deck 4 cartes, dialogue, Q/R, porte, écran de fin, menu, save localStorage | ✅ terminé |
| **J2** | Moteur data-driven : tout le contenu en `/content` ; audio (musique+SFX) | ✅ terminé |
| **J3** | Multi-zones + progression : zones enchaînées, déblocage, deck persistant, transitions | 🟡 prochain |
| **J4** | Frise chronologique : `timeline.json`, UI frise révélée, liens logiques langages | ⛔ |
| **J5** | Narration & polish : trame cyberpunk, équilibrage, responsive, perf, déploiement final | ⛔ |

## Qui fait quoi (à l'activation)

| Agent | Modèle | Charge initiale |
|---|---|---|
| agent-infra | sonnet | TASK-001, TASK-004 |
| agent-art | sonnet | TASK-003 |
| agent-moteur | sonnet | TASK-005 (puis J1) |
| agent-contenu | sonnet | TASK-005 (types/contenu) puis J2 |
| agent-qa | sonnet | à partir de J1 |

## Tâches actives

| ID | Titre | Owner | Statut | Jalon |
|---|---|---|---|---|
| TASK-001 | Scaffold Vite + Phaser 3 + TS | agent-infra | done | J0 |
| TASK-002 | Init vault + agents | orchestrateur | done | J0 |
| TASK-003 | Pipeline assets de base (atlas perso, tiles) | agent-art | done | J0 |
| TASK-004 | Build statique + déploiement nginx | agent-infra | done | J0 |
| TASK-005 | Types TS + loader `/content` (squelette) | agent-moteur | done | J0 |
| TASK-006 | Scènes + flux (Preload/Menu/Zone/UI) | agent-moteur | done | J1 |
| TASK-007 | Joueur animé + caméra | agent-moteur | done | J1 |
| TASK-008 | Système d'interaction (E) | agent-moteur | done | J1 |
| TASK-009 | Dialogue + DialogueBox + NPC | agent-moteur | done | J1 |
| TASK-010 | Deck + question/réponse | agent-moteur | done | J1 |
| TASK-011 | Progression + porte + écran de fin | agent-moteur | done | J1 |
| TASK-012 | SaveSystem localStorage | agent-moteur | done | J1 |
| TASK-013 | QA J1 (E2E Playwright) | agent-qa | done | J1 |
| TASK-014 | Zones data-driven (index.json) + audit anti-hardcode | agent-moteur | done | J2 |
| TASK-015 | Sourcing audio CC0 + manifeste | agent-art | done | J2 |
| TASK-016 | AudioManager + câblage events | agent-moteur | done | J2 |
| TASK-017 | Passe contenu (externalisation + extension) | agent-contenu | done | J2 |
| TASK-018 | QA J2 (audio + extensibilité + non-régression) | agent-qa | done | J2 |

## Décisions (ADR)

- ADR-001 — Stack Phaser 3 + TS + Vite
- ADR-002 — Architecture data-driven
- ADR-003 — Coordination via vault
- ADR-004 — Adaptations web (frise, Quitter→menu, deploy sous-chemin)
- ADR-005 — Contenu copié dans le build (vite-plugin-static-copy)

## Backlog / dette (à traiter)

- **OBS-01** (UX, agent-moteur/contenu) : rayon d'interaction 240px peut cibler un PNJ résolu proche au lieu du PNJ voulu. Espacer les PNJ dans le contenu ou affiner la sélection. Non bloquant.
- **OBS-02** (cosmétique, agent-infra) : `favicon.ico` 404. Ajouter un favicon.
- **Bundle** : Phaser ~1.5 MB (347 kB gzip). `manualChunks` plus tard (agent-infra).
- **Audio ambient placeholder** : `ambient.ogg/mp3` = synth généré (TASK-015), remplacer par un vrai loop CC0 cyberpunk avant release (agent-art, J5).
- **Placeholders art** : PNJ = rectangle, tilemap = damier, portraits = rips NES Zelda → remplacer avant release (agent-art, J5).
- **DialogueSystem.ts** non créé (logique dans DialogueBox+NPC) — écart mineur assumé vs fiche TASK-009.

## Décisions Arthur (2026-06-12) — voir ADR-004

1. Déploiement : `ohvenus.fr/codyssee` (sous-chemin, Vite `base: '/codyssee/'`). ✅
2. Bouton « Quitter » → retour menu principal. ✅
3. Frise : ~15-20 langages, 4-6 zones. ✅
4. Polices/typo : non tranché → libre (Google Fonts), à cadrer par agent-art au J5 polish.

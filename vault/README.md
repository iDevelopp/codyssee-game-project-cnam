# Vault Codyssey Web — Protocole de coordination

> **Tout agent lit ce fichier EN PREMIER.** Le vault est l'unique canal de coordination. Pas de mémoire implicite, pas de décision orale. Si ce n'est pas écrit ici, ça n'existe pas.

## Rôles

- **Orchestrateur** (Mira) : découpe en tâches, tient le vault à jour, assigne, fait les revues, escalade les décisions à l'humain (Arthur), propose les commits. Ne délègue une tâche que si elle a une fiche `tasks/TASK-XXX.md`.
- **agent-moteur** : Phaser/TS — scènes, boucle de jeu, déplacement, interaction, deck, dialogue, portes, fin, menu.
- **agent-contenu** : GDD vivant + données `/web/content` (cartes, PNJ, dialogues FR, zones, frise, narration).
- **agent-art** : pipeline d'assets — découpe sprites Unity, tilemaps, UI, atlas Phaser, audio CC0.
- **agent-infra** : Vite, build, déploiement nginx, bundle, workflow git branche `web`.
- **agent-qa** : tests E2E Playwright, critères d'acceptation, captures, non-régression.

## Avant d'agir, un agent lit

1. `index.md` — tableau de bord (état global, qui fait quoi).
2. Sa fiche `agents/<nom>.md`.
3. La/les `tasks/TASK-XXX.md` qui lui sont assignées.
4. Les ADR `decisions/` pertinents.

## Format d'une tâche (`tasks/TASK-XXX.md`)

Front-matter YAML obligatoire :

```yaml
---
id: TASK-014
titre: Système de deck (UI + sélection de carte)
owner: agent-moteur
statut: todo            # todo | in_progress | review | done | blocked
depends_on: [TASK-007]
artefacts: [web/src/systems/DeckSystem.ts, web/src/ui/DeckPanel.ts]
jalon: J1
---
```

Corps : `## Objectif` · `## Critères d'acceptation` · `## Notes`.

## Cycle de vie d'une tâche

`todo` → agent passe en `in_progress` (et met à jour sa fiche + ajoute une ligne à `log.md`) → travail → `review` (jamais `done` directement) → l'orchestrateur revoit → `done`. Bloqué → `blocked` + note la cause dans la fiche tâche ET `agents/<nom>.md`.

## Règles d'or (NON NÉGOCIABLES)

1. Un agent **n'écrase jamais** le fichier d'un autre agent. Chacun n'écrit que dans `agents/<son-nom>.md`, ses artefacts code, et les tâches qui lui sont assignées.
2. `log.md` est **append-only**. Jamais réécrire, seulement ajouter (horodaté).
3. `index.md` est la **seule vue d'ensemble** et doit toujours refléter la réalité. L'orchestrateur le tient à jour.
4. Toute décision structurante → un **ADR** dans `decisions/ADR-XXX.md`. Jamais une décision cachée dans le code.
5. Toute passation entre agents → `handoffs/HANDOFF-XXX.md` (fait / reste / points d'attention / refs fichiers).
6. Pas de contenu de jeu en dur dans le moteur : tout vit dans `/web/content`.
7. Pas de commit/push sans validation explicite d'Arthur.
8. Langue du jeu et du contenu : **français**. Code (identifiants, commentaires, commits) : **anglais**.

## Convention de commits

Conventional Commits : `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`. Petits, thématiques. Proposés par l'orchestrateur, exécutés après feu vert d'Arthur.

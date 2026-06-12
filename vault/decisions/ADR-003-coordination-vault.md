# ADR-003 — Coordination des agents via vault markdown

- **Statut** : accepté (arrêté par Arthur dans le brief)
- **Date** : 2026-06-12

## Contexte

5 sous-agents spécialisés + orchestrateur. Besoin d'une coordination explicite, traçable, sans mémoire implicite ni décision perdue.

## Décision

Toute coordination passe par `/vault` (markdown only). Protocole complet dans `vault/README.md`. Sous-agents définis dans `.claude/agents/*.md`.

## Règles clés

- Avant d'agir : lire `index.md` + `agents/<nom>.md` + tâches assignées.
- Tâche = `tasks/TASK-XXX.md` avec front-matter YAML ; cycle `todo→in_progress→review→done`.
- `log.md` append-only ; `index.md` = seule vue d'ensemble, toujours à jour.
- Un agent n'écrase jamais le fichier d'un autre.
- Décision structurante → ADR. Passation → `handoffs/HANDOFF-XXX.md`.

## Conséquences

- Latence de coordination (lecture vault) acceptée en échange de traçabilité.
- L'orchestrateur est le seul à écrire `index.md` et à valider le passage en `done`.
- Choix des modèles sous-agents (CLAUDE.md global) : `haiku` exploration, `sonnet` standard, `opus` rare. Voir fiches agents.

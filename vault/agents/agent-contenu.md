---
name: agent-contenu
description: Living GDD + data. Cards, NPCs, French dialogue, zones, chronological timeline of languages, cyberpunk narrative. Produces and maintains /web/content and the GDD docs in vault/gdd. French game content, English code/keys.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

You are **agent-contenu** for Codyssey Web.

## Read first, every time
1. `vault/README.md` · 2. `vault/index.md` · 3. `vault/agents/agent-contenu.md` · 4. your assigned `vault/tasks/TASK-XXX.md` · 5. `vault/gdd/` (vision + reference loop) · 6. relevant ADRs (esp. ADR-002 data model).

## Scope
`/web/content/*` (cards.json, npcs.json, zones/*.json, timeline.json, strings.fr.json) and `vault/gdd/*`. Design pillars + cyberpunk coherence. Extend the 4 existing cards toward the full set of languages in the timeline.

## Hard rules
- Data must match the TS types defined by agent-moteur (coordinate via handoff). Stable English `id`/keys; French display text.
- Every displayed string goes through `strings.fr.json`.
- Each gameplay/UX content decision must serve ≥1 design pillar (list in `vault/gdd/00-vision.md`).
- Keep questions and expected answers coherent (the last dialogue line = the question; expectedCardId matches it).
- Structural decisions → propose an ADR to the orchestrator. Update your vault state + append to `log.md`. Tasks: `in_progress` → `review`.
- Never overwrite another agent's vault file. No git commit/push.

Final message = report for the orchestrator (files, what changed, open content questions).

## État courant

- **Statut courant** : review (TASK-019 livrée)
- **Tâches assignées** : TASK-019 (statut: review)
- **Blocages** : aucun
- **Dernière action** : 2026-06-12 — TASK-019 multi-zones complète

## Artefacts livrés (TASK-019)

### cards.json — 13 cartes (8 → 13)
Ajoutées : `fortran` (1950s), `cobol` (1950s), `lisp` (1950s), `cpp` (1980s), `perl` (1980s)

### npcs.json — 9 PNJ (3 → 9)
Zone 02 ajoutés :
- `npc_ernst` (Ernst, zone_02, question → `fortran`, position 280,320)
- `npc_grace` (Grace, zone_02, question → `cobol`, position 620,200)
- `npc_john` (John, zone_02, question → `lisp`, position 950,400)

Zone 03 ajoutés :
- `npc_bjarne` (Bjarne, zone_03, question → `cpp`, position 300,260)
- `npc_larry` (Larry, zone_03, question → `perl`, position 660,420)
- `npc_ada` (Ada, zone_03, question → `c`, position 960,260)

### zones/zone_01.json
Ajout : `nextZoneId: "zone_02"`, `leadsToZoneId: "zone_02"` sur la porte.

### zones/zone_02.json — NOUVEAU
Thème 1950s–1970s (fondations). NPCs: ernst, grace, john. Porte → zone_03.

### zones/zone_03.json — NOUVEAU
Thème 1980s (systèmes). NPCs: bjarne, larry, ada. Porte finale (pas de nextZoneId → écran fin).

### zones/index.json
Mis à jour : ["zone_01", "zone_02", "zone_03"]

### strings.fr.json
Ajoutées : `zone.zone_02`, `zone.zone_03`, `door.exit_02`, `door.exit_03`

### vault/gdd/04-content.md
Inventaire mis à jour (13 cartes, 9 PNJ, 3 zones).

## Notes
Tous les textes affichés → `strings.fr.json`. Cohérence FR et piliers de conception.
Chaining zone_01 → zone_02 → zone_03 → (fin). `unlockCondition: "all_quest_npcs_helped"` utilisé pour toutes les zones.
agent-moteur (TASK-020) doit implémenter le chargement de la zone suivante via `nextZoneId`/`leadsToZoneId`.
OBS-01 : espacement PNJ vérifié — minimum ~300px entre PNJ dans chaque zone.

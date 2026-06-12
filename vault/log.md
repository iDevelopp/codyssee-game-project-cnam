# Journal (append-only)

> Une ligne horodatée par événement. Ne jamais réécrire. Format : `YYYY-MM-DD HH:MM — [agent] message`.

- 2026-06-12 — [orchestrateur] Clone du repo, exploration de `dev-Egor` (CLAUDE.md, SETUP.md, GUIDE_SCENE_ZONE01.md, PROMPT_PROTOTYPE.md, 15 scripts C#, 4 cartes, sprites). Boucle de gameplay de référence cartographiée.
- 2026-06-12 — [orchestrateur] Branche `web` créée depuis `main` (base propre, Unity reste sur `dev-Egor`).
- 2026-06-12 — [orchestrateur] Vault initialisé (README/protocole, index, gdd, agents, log) + 5 sous-agents définis dans `.claude/agents/`.
- 2026-06-12 — [orchestrateur] Plan en jalons J0–J5 + tâches proposé à Arthur. EN ATTENTE DE VALIDATION avant tout code.
- 2026-06-12 — [orchestrateur] Plan VALIDÉ par Arthur. Décisions : frise ~15-20 langages, Quitter→menu, déploiement ohvenus.fr/codyssee (Vite base=/codyssee/). ADR-004 créé. J0 démarre en parallèle.
- 2026-06-12 — [orchestrateur] Toolchain OK (node 22.22, pnpm 10.33, playwright 1.60). Dispatch agent-infra sur TASK-001 (scaffold).
- 2026-06-12 — [agent-infra] TASK-001 exécutée → statut `review`. web/ scaffoldé : Vite 6 + Phaser 3.90 + TS 5.9, base='/codyssee/', pixel-art config, arborescence complète, pnpm build ✓ (4.76s), pnpm dev ✓ (localhost:5173/codyssee/).
- 2026-06-12 — [orchestrateur] TASK-001 revue & validée (done). Build vert, base=/codyssee/. Fan-out J0 : TASK-003 (art) ∥ TASK-005 (moteur) ∥ TASK-004 (deploy).
- 2026-06-12 — [agent-infra] TASK-004 exécutée → statut `review`. pnpm build ✓, rsync → /var/www/codyssee/, location ^~ /codyssee/ ajouté au vhost ohvenus.fr, nginx -t ✓, reload ✓. https://ohvenus.fr/codyssee/ → 200, asset JS → 200.
- 2026-06-12 — [agent-art] TASK-003 exécutée → statut `review`. Grille char confirmée (32×32, contenu 16×25 centré, meta Unity). player.png 96×96 (9 frames, 3 dirs). Tiles, props, portraits en place. vault/gdd/02-assets.md créé.
- 2026-06-12 — [agent-moteur] TASK-005 exécutée → statut `review`. Types TS (CardData, NpcData, ZoneData, DoorData, DialogueData, TimelineEntry, Strings) + barrel index. ContentLoader singleton (fetch, dev validation, typed API). Seed content: cards.json (4 cartes), npcs.json (2 PNJ: npc_lea→javascript, npc_thomas→csharp), zones/zone_01.json, strings.fr.json. tsconfig.json: ajout vite/client types. tsc --noEmit ✓ (0 erreur).
- 2026-06-12 — [orchestrateur] TASK-003/004/005 revues & validées (done). QA live : https://ohvenus.fr/codyssee rend le canvas Phaser, 0 erreur console (warnings WebGL headless bénins). J0 TERMINÉ.
- 2026-06-12 — [orchestrateur] Grille char résolue : cellules 32×32, contenu 16×25 centré (source Unity .meta). player.png 96×96 = 9 frames 32×32.
- 2026-06-12 — [orchestrateur] J0 committé (4 commits thématiques, branche web, pas de push) : vault, scaffold, assets, content layer.
- 2026-06-12 — [orchestrateur] J1 découpé : TASK-006→013. Dispatch agent-moteur sur la chaîne moteur 006→012 (couplée, un seul agent). QA TASK-013 ensuite.
- 2026-06-12 14:00 — [agent-moteur] TASK-006→012 démarrées → in_progress. Lecture GDD, assets, types, ADR. Architecture planifiée.
- 2026-06-12 14:30 — [agent-moteur] TASK-006→012 livrées → statut `review`. Slice J1 complet : 5 scènes, Player (ZQSD+anims+camera), InteractionSystem (rayon 240px), NPC (FSM), DialogueBox, DeckSystem, DeckPanel, ProgressionSystem, Door, EndScreen, SaveSystem (localStorage v1), GameEvents bus, InputLock. vite.config.ts : alias @/ ajouté pour Rollup. tsc --noEmit ✓ (0 erreur), pnpm build ✓ (6.11s, 1.5MB bundle attendu avec Phaser).
- 2026-06-12 — [agent-qa] TASK-013 exécutée → statut `review`. QA J1 complet via MCP Playwright sur serveur dev (5173). 6/6 critères PASS. BUG-01 bloquant prod découvert : web/content/ absent de dist/ (agent-infra à corriger). 62 screenshots + rapport JSON produits dans web/tests/e2e/.
- 2026-06-12 — [orchestrateur] J1 moteur livré par agent-moteur (TASK-006→012, build vert, tsc vert). QA agent-qa : 6/6 critères PASS sur dev (68 captures).
- 2026-06-12 — [orchestrateur] BUG-01 (bloquant prod) corrigé en revue : web/content absent du build → vite-plugin-static-copy ajouté (ADR-005). Build prod re-vérifié : dist/content présent, menu FR rendu sur preview, plus d'erreur ContentLoader. TASK-006→013 done.
- 2026-06-12 — [orchestrateur] Backlog noté (OBS-01 rayon interaction, OBS-02 favicon, bundle, placeholders art). J1 prêt à committer + redéployer (attente feu vert Arthur).

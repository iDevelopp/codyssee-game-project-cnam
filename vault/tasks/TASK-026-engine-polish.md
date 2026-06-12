---
id: TASK-026
titre: J5 — Narration affichée + responsive + perf
owner: agent-moteur
statut: done
depends_on: [TASK-025]
artefacts: [web/src/scenes/*, web/src/systems/ContentLoader.ts, web/vite.config.ts]
jalon: J5
---

## Objectif
Afficher la narration cyberpunk, rendre le jeu responsive, améliorer la perf de chargement. Le contenu (5 zones, ~19 langages, narrative.json) est livré par TASK-025 et doit fonctionner sans hardcode.

## Travail
### A. Narration (data-driven depuis `narrative.json`)
- `ContentLoader` : charger `content/narrative.json` (optionnel, défaut `{intro:[],zoneIntros:{},outro:[]}` si absent — pas d'erreur). API `getNarrative()`.
- **Intro nouvelle partie** : écran/overlay affichant `intro[]` (clic/touche pour passer) avant d'entrer en zone_01, uniquement en nouvelle partie (pas sur reprise reload).
- **Bandeau d'entrée de zone** : à chaque entrée de zone, afficher `zoneIntros[zoneId]` en bandeau temporaire (fade), non bloquant. 
- **Outro** : afficher `outro[]` sur l'EndScreen (au-dessus/avant les boutons).
- Tout via getString/contenu, FR, jamais en dur.

### B. Responsive
- Config Phaser Scale : `Scale.FIT` + `autoCenter`, garder l'aspect, fonctionner de ~1280×720 à plein écran et fenêtres plus petites. Vérifier que la frise et les overlays restent lisibles.

### C. Perf (OBS bundle)
- `vite.config.ts` : `build.rollupOptions.output.manualChunks` pour isoler Phaser dans un chunk vendor séparé (réduire le warning 500kB, améliorer le cache). Vérifier que le build produit ≥2 chunks et que le jeu tourne toujours.
- Favicon (OBS-02) : ajouter un `favicon` (peut venir de TASK-027 art ; sinon placeholder) pour supprimer le 404.

## Critères
- Intro affichée en nouvelle partie, sautée en reprise ; bandeau zone à chaque entrée ; outro en fin.
- 5 zones jouables d'affilée (zone_01→…→zone_05→fin), frise atteint ~19/19 en fin.
- Responsive : pas de débordement/scroll cassé à 1366×768 et 1920×1080.
- Build vert, bundle splitté (Phaser chunk distinct), `tsc --noEmit` vert. Non-régression J1-J4.

## Règles
English code, FR strings. HANDOFF si schéma partagé modifié. Ne pas committer. Coordonner la clé `narrative.json` avec TASK-025.

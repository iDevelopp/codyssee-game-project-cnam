---
id: TASK-022
titre: Contenu frise chronologique (timeline.json)
owner: agent-contenu
statut: done
depends_on: [TASK-019]
artefacts: [web/content/timeline.json, web/content/strings.fr.json]
jalon: J4
---

## Objectif
Créer `web/content/timeline.json` : une entrée par langage existant (13), ordonnée par année réelle d'apparition, avec liens logiques (influences) entre langages — pilier 5 du GDD.

## Schéma (aligné `src/types/TimelineEntry.ts`, champ `influences` ajouté par agent-moteur TASK-023)
```jsonc
{
  "year": 1972,                 // année réelle d'apparition
  "language": "C",              // displayName FR (= cards.json displayName)
  "cardId": "c",                // CardData.id
  "blurb": "…",                 // 1-2 phrases : importance historique + héritage
  "unlockedBy": "c",            // = cardId (révélé quand la carte est au deck)
  "influences": ["fortran"]     // cardIds dont CE langage a hérité (flèches entrantes)
}
```

## Couverture (13 langages, années réelles)
fortran 1957, lisp 1958, cobol 1959, c 1972, sql 1974, cpp 1985, perl 1987, python 1991, html 1993, java 1995, javascript 1995, csharp 2000, rust 2010.

## Liens logiques (influences — à affiner, rester factuel)
- c ← fortran/algol (héritage procédural)
- cpp ← c ; java ← c, cpp ; csharp ← c, cpp, java ; perl ← c, sql
- python ← c, lisp ; rust ← cpp, c ; javascript ← java (syntaxe), c
- fortran/lisp/cobol/sql/html = racines (influences vide ou minimal)

## Critères d'acceptation
- 13 entrées, `cardId` valides (existent dans cards.json), `influences` ne référencent que des cardIds présents.
- Ordre chronologique par `year`.
- `blurb` FR, factuel, ≤ ~160 caractères, mentionne l'usage/héritage.
- Clés strings ajoutées : `timeline.title`, `timeline.locked`, `timeline.hint` (ouvrir avec T), `timeline.empty`.
- `pnpm build` vert, `dist/content/timeline.json` présent.

## Notes
Reveal = `cardId ∈ deck`. Deck initial = cartes hors-réponses-PNJ (html, python, java, rust révélés d'emblée) ; les 9 cartes-réponses se révèlent en aidant les PNJ. Fin de J3 → 13/13.
Mettre à jour `vault/gdd/04-content.md` (section frise) et `vault/log.md`.

# Inventaire du contenu — Codyssey Web

> Document vivant maintenu par **agent-contenu**. Dernière mise à jour : 2026-06-12 (TASK-017).

---

## Cartes actuelles (8 / ~15-20 cibles)

| id | displayName | era | usage |
|---|---|---|---|
| `python` | Python | 1990s | Scripts, data science, IA |
| `javascript` | JavaScript | 1990s | Sites web interactifs |
| `csharp` | C# | 2000s | Unity, applications Windows |
| `html` | HTML | 1990s | Pages web |
| `sql` | SQL | 1970s | Bases de données, back-end |
| `c` | C | 1970s | Systèmes d'exploitation, embarqué |
| `java` | Java | 1990s | Applications d'entreprise, Android |
| `rust` | Rust | 2010s | WebAssembly, systèmes embarqués, CLI |

---

## PNJ actuels (3)

| id | name | zone | expectedCardId | position |
|---|---|---|---|---|
| `npc_lea` | Léa | zone_01 | `javascript` | (320, 240) |
| `npc_thomas` | Thomas | zone_01 | `csharp` | (640, 400) |
| `npc_clara` | Clara | zone_01 | `sql` | (900, 180) |

**Note espacement OBS-01** : les trois PNJ de zone_01 sont espacés d'au moins 260px en coordonnées monde. Le rayon d'interaction est 240px (InteractionSystem). Les positions actuelles garantissent qu'un seul PNJ est captable à la fois.

---

## Zones actuelles (1)

| id | displayName | themeEra | NPCs | Porte |
|---|---|---|---|---|
| `zone_01` | Zone 1 — Les pionniers du web | 1990s | npc_lea, npc_thomas, npc_clara | door_exit → (1100, 360) |

---

## Plan d'extension frise chronologique (~15-20 langages, J4)

Cible ADR-004 : 4-6 zones thématiques, ~15-20 langages couvrant les grandes ères.

### Langages planifiés par zone

#### Zone 1 — Les pionniers du web (1990s, actuelle)
Cartes présentes : `javascript`, `html`, `python`, `csharp`
Cards supplémentaires déjà en base (utilisables en zone 2+) : `sql`, `c`, `java`, `rust`

#### Zone 2 — Les fondations (1950s–1970s) — à créer J4
Thème : langages pionniers, bas niveau, académiques.
Langages cibles :
- `fortran` — Fortran (1957) — calcul scientifique
- `cobol` — COBOL (1959) — gestion d'entreprise
- `lisp` — Lisp (1958) — IA, programmation fonctionnelle
- `c` — C (1972) — systèmes, déjà en base
- `sql` — SQL (1974) — déjà en base

#### Zone 3 — L'ère des systèmes (1980s) — à créer J4
Thème : langages orientés objet, scripts, productivité.
Langages cibles :
- `cpp` — C++ (1985) — orienté objet haute performance
- `perl` — Perl (1987) — scripts, traitement texte
- `objectivec` — Objective-C (1984) — Apple / macOS
- `ada` — Ada (1980) — sûreté, embarqué critique

#### Zone 4 — L'explosion du web (1990s–2000s) — à créer J4
Thème : web dynamique, enterprise, mobile.
Langages cibles :
- `java` — Java (1995) — déjà en base
- `php` — PHP (1994) — web back-end
- `ruby` — Ruby (1995) — productivité, Rails
- `csharp` — C# (2000) — déjà en base

#### Zone 5 — L'ère moderne (2010s+) — à créer J5
Thème : cloud, sécurité, IA, WebAssembly.
Langages cibles :
- `rust` — Rust (2015) — déjà en base
- `go` — Go (2009) — cloud, microservices
- `kotlin` — Kotlin (2016) — Android moderne
- `typescript` — TypeScript (2012) — web typé
- `swift` — Swift (2014) — iOS/macOS

### Roadmap d'ajout

Chaque langage = 1 entrée dans `cards.json` (id + displayName + description + usage + era).
Chaque zone = 1 fichier `zones/zone_XX.json` + entrée dans `zones/index.json`.
Chaque PNJ = 1 entrée `npcs.json` + référence dans la zone.
**Zéro ligne de code moteur requise** (preuve faite par TASK-017).

Ordre de priorité pour J4 :
1. Ajouter langages manquants dans `cards.json` (fortran, cobol, lisp, cpp, perl, php, ruby, go, kotlin, typescript, swift)
2. Créer zone_02 (fondations) + ses PNJ
3. Créer zone_03 (systèmes) + ses PNJ
4. Étendre zone_01 avec la porte vers zone_02 (champ `leadsToZoneId` dans door)
5. Zones 04 et 05 en J5

### Bilan cartes par ère

| Ère | Langages actuels | Langages J4 planifiés |
|---|---|---|
| 1950s | — | fortran, cobol, lisp |
| 1970s | c, sql | ada |
| 1980s | — | cpp, perl, objectivec |
| 1990s | python, javascript, html, java | php, ruby |
| 2000s | csharp | — |
| 2010s | rust | go, kotlin, typescript, swift |

Total J4 : ~19 langages. Dans la cible ADR-004 (~15-20).

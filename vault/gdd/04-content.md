# Inventaire du contenu — Codyssey Web

> Document vivant maintenu par **agent-contenu**. Dernière mise à jour : 2026-06-12 (TASK-019).

---

## Cartes actuelles (13 / ~15-20 cibles)

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
| `fortran` | Fortran | 1950s | Calcul scientifique, simulations |
| `cobol` | COBOL | 1950s | Banques, administration, mainframes |
| `lisp` | Lisp | 1950s | Intelligence artificielle, recherche |
| `cpp` | C++ | 1980s | Jeux vidéo, logiciels haute performance |
| `perl` | Perl | 1980s | Administration système, bioinformatique |

---

## PNJ actuels (9)

| id | name | zone | expectedCardId | position |
|---|---|---|---|---|
| `npc_lea` | Léa | zone_01 | `javascript` | (320, 240) |
| `npc_thomas` | Thomas | zone_01 | `csharp` | (640, 400) |
| `npc_clara` | Clara | zone_01 | `sql` | (900, 180) |
| `npc_ernst` | Ernst | zone_02 | `fortran` | (280, 320) |
| `npc_grace` | Grace | zone_02 | `cobol` | (620, 200) |
| `npc_john` | John | zone_02 | `lisp` | (950, 400) |
| `npc_bjarne` | Bjarne | zone_03 | `cpp` | (300, 260) |
| `npc_larry` | Larry | zone_03 | `perl` | (660, 420) |
| `npc_ada` | Ada | zone_03 | `c` | (960, 260) |

**Note espacement OBS-01** : espacement minimum ~300px entre PNJ dans chaque zone. Rayon interaction 240px. Un seul PNJ captable à la fois.

---

## Zones actuelles (3)

| id | displayName | themeEra | NPCs | Porte | nextZoneId |
|---|---|---|---|---|---|
| `zone_01` | Zone 1 — Les pionniers du web | 1990s | npc_lea, npc_thomas, npc_clara | door_exit → (1100, 360) | zone_02 |
| `zone_02` | Zone 2 — Les fondations (1950s–1970s) | 1950s | npc_ernst, npc_grace, npc_john | door_exit_02 → (1100, 360) | zone_03 |
| `zone_03` | Zone 3 — L'ère des systèmes (1980s) | 1980s | npc_bjarne, npc_larry, npc_ada | door_exit_03 → (1100, 360) | — (fin) |

**Chaînage** : zone_01 → zone_02 → zone_03 → écran de fin.

---

## Frise chronologique (timeline.json) — TASK-022 ✓

`web/content/timeline.json` créé (2026-06-12, agent-contenu). 13 entrées ordonnées chronologiquement (1957–2010). Champs : `year`, `language` (FR), `cardId`, `blurb` (FR, ≤160 car.), `unlockedBy` (= cardId), `influences` (cardIds héritage). Révélation = carte dans le deck. `dist/content/timeline.json` présent après build.

| cardId | year | influences |
|---|---|---|
| `fortran` | 1957 | — |
| `lisp` | 1958 | — |
| `cobol` | 1959 | — |
| `c` | 1972 | fortran |
| `sql` | 1974 | — |
| `cpp` | 1985 | c |
| `perl` | 1987 | c, sql |
| `python` | 1991 | c, lisp |
| `html` | 1993 | — |
| `java` | 1995 | c, cpp |
| `javascript` | 1995 | java, c |
| `csharp` | 2000 | c, cpp, java |
| `rust` | 2010 | cpp, c |

Strings ajoutées dans `strings.fr.json` : `timeline.title`, `timeline.locked`, `timeline.hint`, `timeline.empty`.

---

## Plan d'extension frise chronologique (~15-20 langages, J5)

Cible ADR-004 : 4-6 zones thématiques, ~15-20 langages couvrant les grandes ères.

### Langages planifiés par zone

#### Zone 1 — Les pionniers du web (1990s, actuelle)
Cartes présentes : `javascript`, `html`, `python`, `csharp`
Cards supplémentaires déjà en base : `sql`, `c`, `java`, `rust`

#### Zone 2 — Les fondations (1950s–1970s, actuelle)
Cartes présentes : `fortran`, `cobol`, `lisp`, `c` (réutilisée), `sql` (réutilisée)

#### Zone 3 — L'ère des systèmes (1980s, actuelle)
Cartes présentes : `cpp`, `perl`, `c` (réutilisée)
Langages possibles J5 :
- `objectivec` — Objective-C (1984) — Apple / macOS
- `ada` (langage, distinct de npc_ada) — Ada (1980) — sûreté, embarqué critique

#### Zone 4 — L'explosion du web (1990s–2000s) — à créer J5
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
**Zéro ligne de code moteur requise** (preuve faite par TASK-017/019).

### Bilan cartes par ère

| Ère | Langages actuels | Langages J5 planifiés |
|---|---|---|
| 1950s | fortran, cobol, lisp | — |
| 1970s | c, sql | ada (langage) |
| 1980s | cpp, perl | objectivec |
| 1990s | python, javascript, html, java | php, ruby |
| 2000s | csharp | — |
| 2010s | rust | go, kotlin, typescript, swift |

Total actuel : 13 langages. Cible J5 : ~19. Dans la cible ADR-004 (~15-20).

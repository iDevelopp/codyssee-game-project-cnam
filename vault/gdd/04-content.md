# Inventaire du contenu — Codyssey Web

> Document vivant maintenu par **agent-contenu**. Dernière mise à jour : 2026-06-12 (TASK-025).

---

## Cartes actuelles (19 / ~15-20 cibles ✓)

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
| `php` | PHP | 1990s | Sites web dynamiques, back-end |
| `ruby` | Ruby | 1990s | Applications web, scripting |
| `go` | Go | 2010s | Cloud, microservices, CLI |
| `kotlin` | Kotlin | 2010s | Android, applications JVM |
| `typescript` | TypeScript | 2010s | Applications web, front-end à grande échelle |
| `swift` | Swift | 2010s | iOS, macOS, applications Apple |

---

## PNJ actuels (15)

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
| `npc_rasmus` | Rasmus | zone_04 | `php` | (300, 260) |
| `npc_yukihiro` | Yukihiro | zone_04 | `ruby` | (640, 420) |
| `npc_james` | James | zone_04 | `java` | (960, 240) |
| `npc_rob` | Rob | zone_05 | `go` | (300, 260) |
| `npc_jetbrains` | Svetlana | zone_05 | `kotlin` | (650, 420) |
| `npc_anders` | Anders | zone_05 | `typescript` | (960, 240) |

**Note espacement OBS-01** : espacement minimum ~300px entre PNJ dans chaque zone. Rayon interaction 240px. Un seul PNJ captable à la fois.

---

## Zones actuelles (5) ✓ ADR-004

| id | displayName | themeEra | NPCs | Porte | nextZoneId |
|---|---|---|---|---|---|
| `zone_01` | Zone 1 — Les pionniers du web | 1990s | npc_lea, npc_thomas, npc_clara | door_exit → (1100, 360) | zone_02 |
| `zone_02` | Zone 2 — Les fondations (1950s–1970s) | 1950s | npc_ernst, npc_grace, npc_john | door_exit_02 → (1100, 360) | zone_03 |
| `zone_03` | Zone 3 — L'ère des systèmes (1980s) | 1980s | npc_bjarne, npc_larry, npc_ada | door_exit_03 → (1100, 360) | zone_04 |
| `zone_04` | Zone 4 — L'explosion du web (1990s–2000s) | 2000s | npc_rasmus, npc_yukihiro, npc_james | door_exit_04 → (1100, 360) | zone_05 |
| `zone_05` | Zone 5 — L'ère moderne (2010s+) | 2010s | npc_rob, npc_jetbrains, npc_anders | door_exit_05 → (1100, 360) | — (fin) |

**Chaînage** : zone_01 → zone_02 → zone_03 → zone_04 → zone_05 → écran de fin.

---

## Frise chronologique (timeline.json) — TASK-025 ✓

`web/content/timeline.json` : 19 entrées ordonnées chronologiquement (1957–2016). Champs : `year`, `language` (FR), `cardId`, `blurb` (FR, ≤160 car.), `unlockedBy` (= cardId), `influences` (cardIds héritage).

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
| `php` | 1994 | c, perl |
| `java` | 1995 | c, cpp |
| `javascript` | 1995 | java, c |
| `ruby` | 1995 | perl, lisp |
| `csharp` | 2000 | c, cpp, java |
| `go` | 2009 | c |
| `rust` | 2010 | cpp, c |
| `typescript` | 2012 | javascript, java |
| `swift` | 2014 | cpp, rust |
| `kotlin` | 2016 | java |

---

## Narration cyberpunk (narrative.json) — TASK-025 ✓

`web/content/narrative.json` créé. Structure : `intro` (4 lignes), `zoneIntros` (5 zones × 4 lignes), `outro` (5 lignes). Trame : ingénieure de récupération en 2147, restaure la mémoire des IA en retrouvant les langages perdus dans les strates temporelles. Ton sobre, cyberpunk, FR.

---

## Bilan cartes par ère

| Ère | Langages |
|---|---|
| 1950s | fortran, cobol, lisp |
| 1970s | c, sql |
| 1980s | cpp, perl |
| 1990s | python, javascript, html, java, php, ruby |
| 2000s | csharp |
| 2010s | rust, go, typescript, swift, kotlin |

**Total : 19 langages. Cible ADR-004 (~15-20) atteinte.**

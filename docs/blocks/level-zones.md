# Level zones on floors 1 and 2 (for the C15 real-level candidate)

Prepared by Claude, 7 November 2026, in answer to `docs/blocks/first-floor-level-review.md`. Positions are in first-floor plan metres; both floor sheets are registered on the structural grid. Levels are the sheet's own N values: Block B's floor-1 datum is N 0.00. Each zone is marked:

- **confirmed:** level labels on the sheet.
- **derived:** continuous with a confirmed zone, with no step drawn between them.
- **drawn:** the sheet draws the element by convention (for example, a ramp arrow), with the levels at both ends confirmed.
- **pending:** not established. A pending zone keeps its current flat height and gets no guessed level.

**Block identity: confirmed by the user** (7 November 2026, 16:07). Block A is the north bar and Block B the south body. They join at the hall corridor, x 27.35–29.75.

Machine-readable zones and place assignments are in `docs/blocks/level-zones.json`. The Block A boundary is y = 49.23: the north bar's south facade line and the last hall nosing. The candidate built on these zones is `model/candidates/c15/`.

## Floor 1

| Zone | Plan extent | Level | Status | Evidence |
| --- | --- | --- | --- | --- |
| B west body | footprint with y < 49.23 and 13.6 ≤ x < 36.4, without the zones below | N 0.00 | confirmed | N 0.00 at (26.09, 34.08), (28.23, 47.71), (35.94, 34.66) |
| Access, Hall Acceso and access courtyard | south-west, y < 20 | N 0.00 | derived | Continuous with the B corridor; no label |
| A north bar | footprint with y ≥ 49.23 and x ≥ 13.6 | N −0.63 | confirmed | N −0.63 at (28.08, 50.16) elevator hall, (36.59, 55.72) north circulation, (14.77, 56.15) west tower; the sections give Block A's floor 1 at N −0.63 |
| Hall steps | x 27.3–29.8, y 47.86–49.23 | N 0.00 → −0.63 | confirmed | 4 risers of about 0.158 m; nosings at y 47.86, 48.32, 48.78, 49.23 |
| B stair, north flight | x 36.4–39.2, y 34.0–36.0 | N −0.90 (east) → 0.00 (west) | confirmed | Steps 1–6 and level labels |
| B stair, landing | x ≈ 35.9–36.4, y 32.1–36.0 | N 0.00 | confirmed | N 0.00 at (35.94, 34.66) |
| B stair, south flight | x 36.4–39.2, y 32.1–34.0 | N 0.00 (west) → +1.19 (east) | confirmed | Steps 7–15; N 1.19 at (39.48, 33.51) |
| Sloped hall | x 36.3–42.7, y 36–49 (`76.30m2`) | N −0.90 (south) → −0.63 (north) | derived | Ends match the stair foot and Block A; no level inside, profile unknown |
| East B: laboratory wing and circulation | footprint with y < 49.23 and x ≥ 39.2, without the sloped hall | — | **pending** | The `75.26 M2` circulation joins the stair top (+1.19), the area in front of the stair foot (−0.90) and the laboratory corridor, with no wall or step drawn between them. The sheet contradicts itself here |
| West glass block (cafeteria, library side) | x < 13.6, y > 41.5 | — | **pending** | No level label |
| West stair to piso cero | x 20.8–25.3, y 47.6–49.2 | — | **pending** (opening) | Risers 7–18 drawn on both the floor-1 and the piso cero sheets |

## Floor 2

| Zone | Plan extent | Level | Status | Evidence |
| --- | --- | --- | --- | --- |
| A north bar | footprint with y ≥ 49.23 and x ≥ 13.6 | N +2.68 | confirmed | N +2.68 at (38.07, 55.33) and (15.67, 54.02); the sections give Block A's floor 2 at N +2.68 |
| B body | footprint with y < 49.23 | N +2.94 | confirmed at (28.99, 34.04) | Extent beyond that label: derived |
| A/B junction: ramp | x 27.35–29.75, y 47.906–49.275 | N +2.68 (north) → +2.94 (south) | **drawn** (ramp notation) | The strip is drawn between two edges with no tread lines and no step numbers. One arrow runs along its centre (x ≈ 28.57) from the A side to the B side, with its head at y 47.906. The text "S" (*sube*, up) is at the A end, at (28.41, 49.87). On floors 3 and 4 the same strip has numbered treads, so the floor-2 strip reads as a ramp. Rise 0.26 m over 1.37 m: a slope of about 19 %, steeper than the usual accessibility limits |
| West block (library) | x < 13.6 | — | **pending** | No label |
| B stair half landing | (43.24, 35.35) | N +1.70 | confirmed | Not modelled |

Codex's three floor-2 destinations, Mixed Reality (D14), Molecular Biology (D15) and Medical Research (D13), and the east-stair arrival are all in Block A. Their routes do not cross the floor-2 junction ramp.

## Neighbouring models and transforms that change together

The world transforms stay as they are: the floor-1 B datum at world Y 3.5 and the floor-2 B datum at 6.44 (3.5 + 2.94). The half-levels are carried inside the candidate GLBs as vertical offsets from each floor's B datum:

| Model | Block A offset inside the GLB | Real level |
| --- | --- | --- |
| C15 floor 1 | −0.63 m (y ≥ 49.23, x ≥ 13.6) | N −0.63 |
| C15 floor 2 | −0.26 m (y ≥ 49.23, x ≥ 13.6) | N +2.68 |

- **Stairs from floor 1 to floor 2 (both towers):** the rise becomes 3.31 m (21 risers of about 0.158 m, tread layout unchanged). The foot is at −0.63 and the top at world 6.44 − 0.26 = 6.18.
- **Stairs from floor 2 to floor 3:** the real rise is 3.69 m (N +2.68 → +6.37). Floor 3 is still the flat C14 model (world 9.38), so the C15 floor-2 stairs rise 3.20 m to stay joined to it. That rise becomes 3.69 only when floor 3 gets its own Block A offset (+0.49).
- **Floors 0 and 3–5:** unchanged (C14). Do not pair the C15 floor 2 with a vertical route above floor 3 until those models change too.
- **Reference nodes:** the structural references keep their plan positions and the B datum height.

## Proposed graph points, checked against the C15 geometry

Codex's request lists them. The check results are in the candidate's reference sheet.

| Point | Plan | Level |
| --- | --- | --- |
| Hall before-point (moved `Hall corridor north`) | (28.0, 47.6) | N 0.00 |
| Hall after-point | (28.0, 49.5) | N −0.63 |
| B stair before-point | (36.0, 33.1) | N 0.00 |
| B stair after-point | (39.4, 33.1) | N +1.19, but the zone beyond is pending |

The B laboratory split is documented, but the candidate does not raise the laboratory side (pending above), so that split stays a data classification only.

## Floors 3, 4 and 5 (added for the C16 candidate)

Block A is the north bar on these floors too (footprint, y ≥ the facade line, x ≥ 13.6). The west block stays pending.

| Floor | Block A (confirmed) | Block B (confirmed) | Facade line | Hall junction |
| --- | --- | --- | --- | --- |
| 3 | N +6.37 at (38.6, 55.14), (17.9, 55.24) | N +5.88 at (35.46, 35.09) | y 49.28 | Treads 1–3 between four nosings (y 47.91, 48.37, 48.83, 49.28): 4 risers of 0.1225 m up northwards. **Confirmed** |
| 4 | N +9.87 at (39.32, 55.14), (17.89, 55.59) | N +8.82 at (35.46, 35.05) | y 49.19 | Four nosings drawn, but 1.05 m over 4 risers is 0.2625 m each. **Pending** (contradictory) |
| 5 | N +13.37 at (17.89, 55.68), (39.76, 56.03) | N +11.76 at (35.66, 35.06) | y 49.23 | Not drawn. **Pending** |

The Block B stair's half landings are N +4.64 (floor 3, at (39.77, 33.35)), N +7.58 (floor 4) and N +10.52 (floor 5); they are not modelled.

**Tower stairs (Block A to Block A):**

| Stairs | Real levels | Rise |
| --- | --- | --- |
| 1 → 2 | N −0.63 → +2.68 | 3.31 m |
| 2 → 3 | N +2.68 → +6.37 | 3.69 m |
| 3 → 4 | N +6.37 → +9.87 | 3.50 m |
| 4 → 5 | N +9.87 → +13.37 | 3.50 m |

The candidate set built on these zones is `model/candidates/c16/`.

## Piso cero (floor 0): source handoff requested in Codex's C16 review

Source: sheet `PLANTA PISO CERO`, registered at (0.022, −121.485) on the first floor. The floor-1 joins use the first-floor sheet. Map: `docs/blocks/piso-cero-levels.png` (`model/tools/piso_cero_levels.py`); it draws only the sheet's own labels and flights. This section documents sources and builds no model. The C14 floor-0 preview is unchanged: world translation 0.56 (B datum N −2.94), one flat slab.

### Every level label on the sheet

The sheet has only these seven labels.

| Plan (x, y) | Label | Where |
| --- | --- | --- |
| (37.04, 55.91) | N −4.13 | Block A, at the foot of the east tower stair ("S" at (36.45, 55.89)) |
| (39.21, 35.15) | N −4.13 | South of the A facade: the east foot of the Block B stair |
| (48.48, 39.70) | N −4.13 | South of the A facade: the clinic (`CLINICA 124.32 M2`, consulting cubicles of 3.7–4.7 m²) |
| (35.64, 34.01) | N −2.94 | The Block B stair landing (`13.81 M2`) |
| (20.00, 15.33) | N −2.94 | South-west service area (`COMPRESORES`, `SUCCIONADORES QUIRURGICOS`), at the foot of a ramp |
| (75.19, 52.03) | N −4.13 | Outside the footprint (x > 70.4), east service yard (`HIDROFLO`, `REJILLA DE DRENAJE`) |
| (75.18, 54.33) | N −2.93 | Same yard, 2.3 m north, at the top of four numbered risers |

**Reading of the two points south of the facade:** they belong to a Block B area at the Block A level. This area is the east part of piso cero: the clinic, its waiting room and halls, and the foot of the B stair.

### Regions

| Region | Extent (plan) | Level | Status | Evidence and limits |
| --- | --- | --- | --- | --- |
| Block A bar | footprint north of the facade band (y 49.02–49.16), x 15.7–69. On piso cero the bar reaches y 67.7 | N −4.13 | **confirmed** at the east tower; **derived** for the rest | No step is drawn inside the bar. There is only one A label because the west tower has no flight on this sheet. The marks listed under "Unclassified marks" are not read as steps |
| East B: clinic | south of the facade band, east of the two flights that leave −4.13 (B stair 1–6 at x 36.9–38.4; west stair 1–6 at x 36.0–37.9) | N −4.13 | **confirmed** at (39.21, 35.15) and (48.48, 39.70); extent **derived** | The facade band is open to the A bar at x 39.66–41.08 (sliding glass door) and has no walls at x 42.37–50.43, 53.08–59.57 and 62.26–70.4, so the clinic and the A bar share one level. The southern rooms (lockers, `ARCHIVO HISTORIAS CLINICAS`, `DENTALES 3D`, `PATIO`, y < 30) have no label. Their level is **pending** |
| West and south-west B | south of the facade band, west of those flights: sterilization rooms (`AREA ESTERIL`, `VESTIER`, `AREA LIMPIA`, `AREA CONTAMINADA`), `RX 1` / `RX 2`, `ALMACEN`, `HALL ACCESO BODEGA`, the compressors | N −2.94 | **confirmed** at the B stair landing and the compressors; extent **derived** | Between y 36 and y 47.6 the sheet draws no step and no label on the line between the west and east parts. That boundary is **pending** there |
| West stair landing (`PASILLO 22.51 M2`) | x ≈ 25.6–36.0, y ≈ 47.6–49.0, under the floor-1 hall | — | **pending** | No label. See the west stair below |

### Drawn level changes and joins to floor 1

| Element | Drawn | Levels | Status | Join to C16 floor 1 |
| --- | --- | --- | --- | --- |
| **B stair, north flight** | treads numbered 1–6 at x 38.40 → 36.87, y ≈ 34.2, rising west ("S" at (38.87, 34.87)), between 7 drawn riser lines at x 38.60, 38.30 … 36.80 | N −4.13 (east foot) → −2.94 (landing): 6 or 7 risers, 0.198 or 0.170 m (corrected at C18: the first note said 6) | levels **confirmed** (labels at both ends); riser count **ambiguous** | — (inside piso cero) |
| **B stair, south flight** | risers 7–9 at x 36.49 → 37.11, y ≈ 32.4, rising east from the landing ("S" at (35.99, 33.0)); cut above 9 | N −2.94 → the floor-1 foot of the B stair at N −0.90 (2.04 m) | **derived**: the riser count above 9 is not drawn on either sheet | Not compatible yet: in C16 the floor-1 −0.90 area is part of the pending laboratory zone and stays flat at 0.00 |
| **A east tower** | risers 1–10 at x ≈ 37.45, y 56.3–59.2, rising north ("S" at (36.45, 55.89)) | N −4.13 → −0.63 (floor 1, label at (36.59, 55.72) at the same tower): rise 3.50 m | **confirmed** (labels at both ends) | Compatible as a 3.50 m flight with the tower layout of floors 3–5: 21 risers of 0.1667 m, foot at world −0.63 (3.5 − 4.13), top at world 2.87, the C16 floor-1 Block A. The C14 floor-0 stair rises 2.94 m from world 0.56 and does not meet C16 |
| **A west tower** | no flight on piso cero | — | — | The west tower starts on floor 1 |
| **Elevators** | two cars at (24.12, 55.15) and (26.38, 55.14), in the A bar | A −4.13 → A −0.63 (floor-1 elevator hall at (28.08, 50.16)) | **confirmed** (A levels at both ends) | Stops at world −0.63 and 2.87 |
| **West stair** | one arrow from "S" at (38.11, 48.52) westwards. Risers 1–6 at x 37.85 → 36.05; the landing `PASILLO`; risers 7–18 at x 25.27 → 20.84. The floor-1 sheet draws 15–18 at x 21.98 → 20.74, with the arrowhead at x 20.74 | Foot on the clinic side (−4.13, derived). Landing and floor-1 arrival: **no label** | **pending** | Not compatible yet. If the landing is −2.94 (by analogy with the B stair, where 6 risers join −4.13 and −2.94), risers 1–6 are 0.198 m. Risers 7–18 would then be 0.245 m to reach N 0.00 (B west body), too high for a stair and above the runtime's 0.20 m, or 0.1925 m to reach N −0.63. The floor-1 arrival, next to the `9.70 M2` space at (20.8, 46.1), has no label. In C16 the floor-1 opening stays closed |
| **South-west ramp** | `RAMPA` at (19.14, 18.94), "S" at (19.73, 15.02) | from N −2.94 up; top **not labelled** | **pending** | — (service area) |
| **East yard stair** | risers 1–4 at x 74.77, y 52.36–53.29, rising north; outside the footprint | N −4.13 → −2.93: 1.20 m over 4 numbered risers, that is 0.30 m each | **pending** (contradictory or partly drawn) | — (outside) |

**Unclassified marks:**
- Four short arrows with "S" at x 20.0–21.2, y 50.10, 51.03, 53.26 and 54.19. They point east, inside the hatched compressor area at the west end of the A bar, each in front of a drawn door leaf.
- One arrow with "S" at (19.27, 33.09), next to `RX 1` / `RX 2`.

None of them has treads or level labels, so they are not read as level changes.

### What a C16-compatible floor 0 would need

This is not built; it waits for your review of these regions.
- **Transform:** the world translation stays 0.56 (B datum N −2.94).
- **Offsets:** the A bar and the east clinic go to −1.19 (N −4.13, world −0.63).
- **Boundary:** along the B stair north flight and the west stair flight 1–6, with the y 36–47.6 stretch pending.
- **East tower:** rebuilt with a 3.50 m rise.
- **Not built:** the B stair south flight, the west stair landing and opening, the ramp and the southern rooms. They stay pending until a label or section gives their levels.

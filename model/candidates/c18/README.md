# C18 candidate: piso cero at its real levels

Prepared by Claude on 7 November 2026 for Codex's request (`docs/blocks/floor0-candidate-request.md` / `.json`, `22e130e`). It is built on the reviewed sources in `docs/blocks/level-zones.md` ("Piso cero", `de3815e`).

It is a separate floor-0 GLB. These files are unchanged:
- the C14 preview `public/models/floor-0/campus.glb` (`a266b162`);
- the C16 and C17 candidates.

This candidate is a model handoff, not navigation data.

- Configuration: `model/tools/real_levels_c18.json`.
- Points and levels for the first routes: `floor-0-points.json` in this folder.

## Files, transform and levels

| Item | Value |
| --- | --- |
| GLB | `model/candidates/c18/floor-0.glb`, SHA-256 `a9eba61e…` |
| Floor-1 companion | `model/candidates/c18/floor-1.glb`, SHA-256 `b1df2d79…`. This is C16 floor 1 (`15745b7e…`) with its `Site` ground slab opened under the floor-slab stair well (`site_holes: "wells"`). In C16, that 0.2 m ground slab passes under the whole building, including the east tower shaft (world 2.52–2.72), and caps the stair rising from piso cero. The other 140 meshes are vertex-identical to C16 |
| World translation | `(0, 0.56, 0)`, unchanged from C14 (the B datum, N −2.94) |
| Block A and the east clinic | N −4.13: local −1.19, world −0.63 |
| B west, south-west and every pending area | N −2.94: local 0.00, world 0.56 |
| East tower top | C16 floor-1 Block A, N −0.63, world 2.87 |
| Structural references | `P0_REF_1_Column_21_62` (21.23, 62.23), `P0_REF_2_Column_47_37` (47.01, 36.83), `P0_REF_3_Column_33_62` (33.32, 62.37). They stay at local 0, the B datum, and are independent of the walking levels |
| Support nodes | `P0_Floor_Slab`, `P0_Stair_A_East` |
| Node names | Same as the C14 preview (43 meshes) |

## Zones

| Zone | Extent | Local level |
| --- | --- | --- |
| Block A bar | footprint with y ≥ 49.085 (the middle of the facade band, y 49.015–49.155) | −1.19 |
| East clinic | Polygon in the configuration. West edge: the waiting-room wall at x 36.3 and the west-stair foot at x 37.85. B stair: its foot at x 38.6 and the bodega wall at x 39.25. South edge: the hall's diagonal walls (39.25, 31.8) → (42.0, 30.4) → (46.5, 32.0) → (52.2, 34.0), then the glass at y 34.3. It contains the labels at (39.21, 35.15) and (48.48, 39.70) | −1.19 |
| Everything else | west and south-west service areas, the B stair, the west stair and its landing, the southern rooms | 0.00 |

**Storey-height objects** (walls, columns, glass) keep their bottoms at their zone level. Their upper part follows the C16 floor-1 zone above (Block A −0.63, the hall treads, B 0.00). They therefore stay under the floor-1 slab:
- In Block A, walls run from N −4.13 up to under the floor-1 A slab.
- In the clinic, they rise to under the flat C16 floor-1 slab, a 3.5 m clear height in total.

Doors, furniture and fixtures move with their zone.

## East tower (first deliverable)

| Item | Value |
| --- | --- |
| Rise | 3.50 m, from world −0.63 to 2.87. Levels from the labels at the same tower on both sheets |
| Risers | 21 of 0.1667 m; treads 0.30 m |
| Flight 1 | x 35.3–37.4, centre line x 36.35. Rises northwards from y 56.2; tread 10 ends at y 59.2 |
| Landing | semicircle centred at (37.55, 59.2), radius 2.25, local +0.643 (world 1.203) |
| Flight 2 | x 37.6–39.8, centre line x 38.7. Rises while running southwards from y 59.2 to 56.2 |
| Foot | (36.35, 55.9), world −0.63 |
| Upper stand | (38.7, 55.9) on C16 floor 1, world 2.87 |

**This layout is the C10–C16 tower layout** (`model/tools/blender_stairs.py`). It was kept so the flight meets the C16 floor-1 slab opening (x 35.3–39.8, y 56.5–61.45) and stacks under the C16 towers.

**The drawing differs, so please review this.** The east tower is drawn the same way on both the piso cero and first-floor sheets:

| Item | Drawn | Model (C10–C18) |
| --- | --- | --- |
| Flight 1 | x 35.39–37.69. Nine treads between ten riser lines (y 56.193 → 58.893); number "10" sits on the landing | x 35.3–37.4, ten treads |
| Well | x 37.69–38.17, with a 0.6 m column at its north end | Balustrade wall x 37.4–37.6 |
| Flight 2 | x 38.17–40.52. Ten riser lines y 58.978 → 56.278 (projection on the first-floor sheet) | x 37.6–39.8 |
| Landing | glass semicircle to y 61.9 | radius 2.25, to y 61.45 |
| Risers per storey | 20 (0.175 m for 3.50 m) | 21 (0.1667 m) |

- **Walking lines:** the walking lines used in every check (x 36.35 and 38.7, with the ±0.22 m body) lie inside both the drawn and the modelled flights. Both riser heights are under the 0.20 m limit.
- **Under flight 2:** on piso cero the space under the drawn flight 2 is the 5.8 m² `CAFETIN`.
- **A drawing-faithful tower set** (20 risers, flight 2 at x 38.17–40.52) would change the slab openings and stairs of floors 1–4 as well. It can be prepared as a separate candidate if you want it.

**Decision (7 November 2026, taken by Claude for the integration while Codex was out of quota).** The C10–C18 tower layout stays as a documented approximation for navigation. The reasons:
- Every walking line (x 36.35 and 38.7, with the ±0.22 m body) lies inside the drawn flights.
- The riser height differs by 8 mm (0.1667 vs 0.175 m), both under the 0.20 m limit.
- The landing and the arrival stands sit on drawn floor area.
- All towers 0 → 5 are verified with this layout in the browser.
- A drawing-faithful set would change every accepted floor GLB and slab opening without changing any route.

It remains listed as an approximation in this sheet and in `docs/blocks/floor0-navigation.md`.

## Not built (explicitly approximate)

Each of these keeps local 0.00 and gets no geometry. No route should cross the edges listed.

- **B stair north flight:** the sheet numbers 6 treads but draws 7 riser lines (x 38.60 → 36.80), so it has 6 or 7 risers (0.198 or 0.170 m). The C18 source note said 6; it is corrected in `level-zones.md`. Because the count is ambiguous it is not built. A 1.19 m edge stands at the foot (x 38.6, y 33.9–35.66).
- **B stair south flight** to the floor-1 N −0.90 zone, which is still pending.
- **West stair:** flights 1–6 and 7–18 and the `PASILLO` landing, whose levels have no labels. A 1.19 m edge faces the waiting room at x 37.85, y 47.6–49.085.
- **South-west ramp top, east-yard steps and southern rooms.** The southern rooms are south of the clinic polygon; their doors onto the clinic hall have 1.19 m edges.
- **The y 36–47.6 boundary:** it follows the closed waiting-room wall at x 36.3. The level of the sterilization rooms west of it is derived (−2.94), not labelled.
- **Elevators:** the cars stand at the A level. No shafts, doors or operating stops are modelled.

## Checks

`model/tools/real_levels_check.ts` with `model/tools/real_levels_c18.json`, in `docs/model-review/after-c18/checks.json`. The C18 floors 0 and 1 are loaded with C16 floors 3, 4 and 5 and C17 floor 2; body and head rays run against every mesh of all six floors.

The C16 `Site` slab inside the shaft was found by the integration audit (`tools/prepare-floor0.ts`), which casts the body rays along the sloped stair direction. The horizontal rays of this checker pass under it, so the floor-1 companion was added.

| Walk | Result |
| --- | --- |
| East tower 0 → 1, from the foot through flight 1, the landing and flight 2 to the upper stand on C16 floor 1 | clear |
| Floor 0, Block A: tower foot → circulation → elevator hall, and back | clear |
| Floor 0: tower foot → facade opening (x 39.66–40.55) → waiting room, and back | clear |
| Floor 0: tower foot → A corridor → gap x 42.5–43.8 → clinic corridor, and back | clear |
| Every C16/C17 walk: floor 1 with floor 0 now underneath, the two-floor graph, the halls, the floor-2 ramp, every tower 1 → 5 | clear |
| **Total** | **143 walks, 12,885 samples, 0 problems** |
| Negative control: the flat C14 floor-0 preview in place of C18 | **9 walks fail**: all 7 floor-0 walks, plus 2 floor-1 hall walks where C14 walls rise through the C16 hall treads at (28.0, 49.3) |

**Height map, C14 vs C18 floor 0** (first hit from above, 0.2 m grid; `.claude-e2e/c18-diff.ts`):

| Zone | Points | Unchanged | Lowered 1.19 m | Other |
| --- | --- | --- | --- | --- |
| B west and pending | 21,260 | 21,243 | 0 | 17: one shelf unit on the zone edge |
| Block A | 22,964 | 18 | 20,952 | 1,994: wall, column and glass-frame tops now under the floor-1 A slab |
| East clinic | 9,961 | 234 | 9,726 | 1 |

In the clinic, the 234 unchanged points are wall tops, which stay under the flat floor-1 slab.

**Captures** in `docs/model-review/after-c18/`:
- `floor-0-top.png`: the C14 top camera `Cam_P0_Top`, comparable with `public/models/floor-0/campus-top.png`;
- `floor-0-oblique.png`: an oblique overview.

## Rebuild

1. `python model/tools/real_levels_slabs.py model/tools/real_levels_c18.json`
2. In Blender, run `CONFIG = "real_levels_c18.json"`, then `exec(open("model/tools/blender_real_levels.py").read())`. This builds the "C18" scene, with floor 0 only.
3. `node --experimental-strip-types model/tools/real_levels_check.ts docs/model-review/after-c18/checks.json model/tools/real_levels_c18.json`

The script changes are inactive without the new configuration keys:
- `real_levels_slabs.py` regenerates the C16 and C17 slab files byte for byte.
- The updated checker still gives C16 130 walks (10,532 samples) and C17 136 walks (10,870 samples), with 0 problems.

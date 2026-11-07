# C16 candidate: Block A at its real level on floors 1–5, with tower stairs at their real rises

Prepared by Claude after Codex's review of C15 (`docs/blocks/first-floor-level-review.md`, "Codex review of C15"). It is a separate candidate set: C13/C14 in `public/models/` and C15 in `model/candidates/c15/` are unchanged.

- Configuration and evidence per floor: `model/tools/real_levels.json`.
- Zones and statuses: `docs/blocks/level-zones.md`.

## Files and levels

Each GLB uses its C13/C14 world transform (the floor's Block B datum). Block A is offset inside the geometry: footprint, y ≥ the facade line, x ≥ 13.6.

| File | SHA-256 (first 8) | World Y (B datum) | Block A offset | Block A world | Real levels A / B |
| --- | --- | --- | --- | --- | --- |
| `floor-1.glb` | `15745b7e` | 3.5 | −0.63 (y ≥ 49.23) | 2.87 | N −0.63 / 0.00 |
| `floor-2.glb` | `b099eb79` | 6.44 | −0.26 (y ≥ 49.23) | 6.18 | N +2.68 / +2.94 |
| `floor-3.glb` | `9f2cd05b` | 9.38 | +0.49 (y ≥ 49.28) | 9.87 | N +6.37 / +5.88 |
| `floor-4.glb` | `a187213f` | 12.32 | +1.05 (y ≥ 49.19) | 13.37 | N +9.87 / +8.82 |
| `floor-5.glb` | `8ba3edac` | 15.26 | +1.61 (y ≥ 49.23) | 16.87 | N +13.37 / +11.76 |

Every level comes from labels on its own sheet: two Block A labels at the stair towers and one Block B label at the B stair landing on each floor (`real_levels.json`, "evidence").

### Hall steps between Block B and Block A

| Floor | Hall junction |
| --- | --- |
| 1 | Four risers down (0.1575 m), as in C15 |
| 3 | Modelled: four nosings at y 47.91, 48.37, 48.83, 49.28; four risers of 0.1225 m up northwards (treads at +0.1225, +0.245, +0.3675) |
| 2 | **Pending.** The strip is drawn between two edges, with no nosings |
| 4 | **Pending.** Four nosings would give 0.2625 m risers for the 1.05 m, which is contradictory and above the runtime's 0.20 m |
| 5 | **Pending.** The 1.61 m junction is not drawn |

On the pending floors, the raised (or lowered) Block A meets Block B with an unmodelled edge along the facade line. No route should cross it.

### Stairs

The A tower stairs, both towers, rise from this floor's Block A to the next floor's Block A, with 21 risers and the measured tread layout:

| Stairs | Rise | Model approximation it replaces |
| --- | --- | --- |
| 1 → 2 | 3.31 m | 2.94 m |
| 2 → 3 | 3.69 m | 3.20 m in C15 |
| 3 → 4 | 3.50 m | 2.94 m |
| 4 → 5 | 3.50 m | 2.94 m |

These are the physical rises from the sections and labels. They are no longer joined to flat neighbours.

### Other zones and markers

- **Pending zones** keep 0.00 (flat): the laboratory wing on floor 1, the sloped hall, the west blocks (cafeteria, library, hemeroteca, the west rooms of floors 4–5), the stair to piso cero and the junctions marked pending above.
- **Markers:** the structural `REF_*` / `P<N>_REF_*` nodes keep their plan position at the B datum (3 per floor). On floor 1, `DEST_*` follow their zone.

## Checks (`model/tools/real_levels_check.ts`, results in `docs/model-review/after-c16/checks.json`)

- **Models loaded:** all five floors at their world datums.
- **Sampling:** every 0.05 m. The support under the feet must be at the expected height (±0.03 m on floors, ±0.20 m along stair waypoints). The body and head rays at 0.45, 1.2 and 1.8 m (centre and ±0.22 m, 0.25 m ahead) run against every mesh of every floor.

| Walk | Result |
| --- | --- |
| Floor 1: hall descent and ascent, the 16 API edges with the proposed hall split, Codex's 43 two-floor edges with heights mapped to the real levels (floor-2 Block A at 6.18) | clear |
| Floor 3: hall ascent and descent | clear |
| A stairs 1→2, 2→3, 3→4 and 4→5, both towers; each top lands on the next floor's Block A | clear |
| **Total** | **130 walks, 10,532 samples, 0 problems** |

**Inspection, not a route.** A straight line along the Block A north corridor between the two stair arrivals has support everywhere on floors 2–5, but it meets walls:
- On floors 2, 3 and 5, the elevator-hall walls at x ≈ 28.3.
- On floor 4, a drawn partition at x 38.28–38.50, y 54.8–55.68, just west of the east-stair arrival. A route from that arrival should keep x ≥ 38.75 there or turn after y 55.7.

## Neighbouring models

- **Floor 0:** not in this set. Piso cero's Block A (N −4.13) also appears south of the facade line, at (39.21, 35.15) and (48.48, 39.70), so its zones need their own review. The C14 floor-0 stair does not meet the C16 floor 1.
- **Rooftop:** the towers continue to the rooftop courts (N +16.87 / +20.38). There is no rooftop model.
- **Floors 1 and 2:**
  - Floor 1 has the same geometry as C15; its bytes differ only by export.
  - Floor 2 differs from C15 only in its stairs (3.69 m instead of 3.20 m).

## Rebuild

1. `python model/tools/real_levels_slabs.py` writes `model/tools/data/c16/slabs.json`.
2. In Blender: `exec(open("model/tools/blender_real_levels.py").read())`. This builds the "C16" scene and exports the GLBs here.
3. `node --experimental-strip-types model/tools/real_levels_check.ts docs/model-review/after-c16/checks.json`

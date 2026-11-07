# C15 candidate: floors 1 and 2 with the real Block A levels and the hall steps

Prepared by Claude in answer to `docs/blocks/first-floor-level-review.md`. It is a **separate candidate**: the C13/C14 exports in `public/models/` and their profiles are unchanged. Zones and evidence are in `docs/blocks/level-zones.md` / `.json`.

## Files

| File | SHA-256 (first 8) | World transform |
| --- | --- | --- |
| `floor-1.glb` | `75abed56` | Y 3.5, the floor-1 Block B datum (N 0.00), as in C13 |
| `floor-2.glb` | `8e7ea9aa` | Y 6.44, the floor-2 Block B datum (N +2.94), as in C13 |

- Node and mesh names are the same as in C13/C14: `Floor_Slab`, `Walls`, `Stair_A_West`, `Stair_A_East`, `P2_Floor_Slab`, `P2_Stair_A_*`, and so on.
- The half-levels are inside the geometry, as vertical offsets from each floor's B datum.

## Levels inside the GLBs

| Zone | Floor 1 | Floor 2 |
| --- | --- | --- |
| Block A: inside the outline, y ≥ 49.23, x ≥ 13.6 | −0.63 (N −0.63) | −0.26 (N +2.68) |
| Hall steps: x 27.33–29.79, nosings at y 47.86, 48.32, 48.78, 49.23 | treads at −0.1575, −0.315, −0.4725; then Block A at −0.63 | — |
| Everything else: Block B and the pending zones | 0.00 | 0.00 |

- **Pending zones stay flat at 0.00, with no guessed level.** They are the laboratory wing and its circulation, the sloped hall, the cafeteria block, the stair down to piso cero and the floor-2 A/B junction.
- **Support surfaces:** `Floor_Slab` and `P2_Floor_Slab` carry one piece per level, including the three treads. The stairs are `Stair_A_*` (floor 1 → 2, rise 3.31 m: 21 risers of 0.158 m, foot at −0.63, top at world 6.18) and `P2_Stair_A_*` (floor 2 → 3, rise 3.20 m, joined to the flat C14 floor 3 at world 9.38). The tread layout is the measured one (`docs/blocks/vertical-connections.md`).
- **Walls:** each wall vertex moves with the zone of its own position. The lower part of a wall also reaches down to the lowest neighbouring zone, within 0.35 m, so boundary walls close down to the lower floor. Flat overlays (floor zones, swing arcs, frames, hatches, site ground) are cut along the zone boundaries and each face moves with its own zone, so nothing is tilted across a boundary.
- **Markers:** `DEST_Hall_Ascensores` and `DEST_Preclinica` are at −0.63. `DEST_Icetex` and `DEST_Lab_Morfologia` (pending) are at 0.00. The structural `REF_*` / `P2_REF_*` nodes keep their plan positions at the B datum.

## Proposed graph points

| Point | Plan | Level in the candidate | Check |
| --- | --- | --- | --- |
| Hall before-point (moved `Hall corridor north`) | (28.0, 47.6) | 0.00 (world 3.5) | Support on the B slab |
| Hall after-point | (28.0, 49.5) | −0.63 (world 2.87) | Support on the Block A slab |
| B stair before-point | (36.0, 33.1) | 0.00 | The geometry stays flat (laboratory zone pending), so the split is a data classification only |
| B stair after-point | (39.4, 33.1) | pending | — |

The hall descent and ascent are walked: the feet find each tread at its height, and the body/head rays are clear.

## Checks (`model/tools/c15_check.ts`, results in `docs/model-review/after-c15/checks.json`)

- **Models loaded:** both candidates and the C14 floor 3.
- **Sampling:** every 0.05 m. At each sample, the support under the feet must be at the expected height (±0.03 m on floors, ±0.20 m along stair waypoints). The body and head rays at 0.45, 1.2 and 1.8 m (centre and ±0.22 m, 0.25 m ahead) run against every mesh.

| Walk | Result |
| --- | --- |
| Hall descent and ascent | clear |
| 16 first-floor API edges, both ways, with `Hall corridor north` at (28.0, 47.6) and the crossing split at (28.0, 49.5) | clear |
| Codex's two-floor graph: 43 edges both ways, from `dataset-candidate.json` | clear |
| A stairs 1 → 2 and 2 → 3, both towers | clear |
| **Total** | **124 walks, 9,436 samples, 0 problems** |

- **Height mapping for the two-floor graph:**
  - Floor-1 Block A points go to world 2.87 and floor-2 Block A points to 6.18.
  - East-stair waypoints go to 2.87 + (C13 height − 3.5) × 3.31 / 2.94.
  - Block B points keep their heights.
- **Negative control:** the same checks against the flat C13 floor 1 report 68 walks with problems (support at the wrong height), so the checker does detect a missing level change.

## Neighbouring models

- **Floor 0 → 1 stair:** the C14 floor-0 stair rises 2.94 m to world 3.5, so it does not meet the C15 Block A floor at 2.87. Floor 0 needs its own Block A level (piso cero A at N −4.13, a rise of 3.50 m to N −0.63) before it pairs with C15.
- **Floors 3–5:** C14, flat. The C15 floor-2 stairs rise 3.20 m to meet the C14 floor 3. The real rise is 3.69 m (N +2.68 → +6.37); it applies once floor 3 gets its Block A offset (+0.49).
- **Exterior and overview:** unchanged.

## Rebuild

1. `python model/tools/c15_slabs.py` writes the split slabs and the outlines to `model/tools/data/c15/slabs.json`.
2. In Blender: `exec(open("model/tools/blender_c15_levels.py").read())`. This builds the "C15" scene from copies of the floor objects and exports both GLBs here. Running it again rebuilds the scene from scratch.
3. `node --experimental-strip-types model/tools/c15_check.ts docs/model-review/after-c15/checks.json`

## Known limits

- **The wall tops follow their own zone.** The facade wall between the blocks stays at Block B height, so seen from Block A it is 0.63 m taller.
- **Pending floor-2 junction.** Along y = 49.23 there is an unmodelled 0.26 m edge wherever Block A meets Block B without a wall. None of Codex's floor-2 routes crosses it.
- **Laboratory zone.** It is flat until another source settles it: the drawing contradicts itself there.

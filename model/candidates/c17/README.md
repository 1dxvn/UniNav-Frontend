# C17 candidate: the floor-2 junction ramp between Block A and Block B

Prepared by Claude on 7 November 2026, after the user confirmed the two blocks:
- **Block A:** the north bar.
- **Block B:** the south body.
- They join at the hall corridor; the user marked that point on the floor-2 sheet.

C17 is the C16 set with **one change**: the floor-2 A/B junction is modelled as the ramp the sheet draws. C16 stayed pending there.

- Configuration: `model/tools/real_levels_c17.json`.
- Evidence and zones: `docs/blocks/level-zones.md` (floor 2, "A/B junction: ramp").

## Files

| Floor | File | SHA-256 (first 8) | Notes |
| --- | --- | --- | --- |
| 2 | `model/candidates/c17/floor-2.glb` | `7a81de62` | Rebuilt with the ramp |
| 1, 3, 4, 5 | `model/candidates/c16/floor-N.glb` | as in C16 | Reused unchanged and not re-exported (`"from": "c16"`) |

The world transform is unchanged (floor-2 B datum at world Y 6.44), as are the node names and the three structural references.

## The ramp

| Item | Value |
| --- | --- |
| Plan extent | x 27.353–29.753, y 47.906–49.275 (the strip between the drawn edges) |
| Levels | N +2.94 (Block B) at the south edge y 47.906, down to N +2.68 (Block A) at the north edge y 49.275 |
| In the GLB | 0.00 to −0.26 from the B datum, so world 6.44 to 6.18 |
| Rise and length | 0.26 m over 1.369 m: a slope of about 19 % |

**Why it is a ramp:**
- The strip is drawn between two edges, with no tread lines and no step numbers.
- One arrow runs along its centre (x ≈ 28.57) from the A side to the B side, with its head at y 47.906.
- The text "S" (*sube*, up) is at the A end, at (28.41, 49.87).
- On floors 3 and 4 the same strip has numbered treads ("1", "2", "3"), so the floor-2 drawing is a deliberate difference.

**Slope.** About 19 % is much steeper than the usual accessibility limits for ramps. It is step-free, but it should not be presented as a wheelchair-accessible route without checking it on site.

**What moves:**
- **Slab:** a sloped 0.2 m piece.
- **Floor zones and other flat meshes:** every vertex inside the strip follows the slope.
- **Walls on the strip edges:** they follow the same per-vertex rule as C16. The lower part takes the lowest level within 0.35 m.

Along the facade line outside the strip, Block A still meets Block B with the C16 edge. That edge is mostly walls and columns.

## Checks

`model/tools/real_levels_check.ts` with `model/tools/real_levels_c17.json`. Results are in `docs/model-review/after-c17/checks.json`.

| Check | Result |
| --- | --- |
| All C16 walks, with floor 2 replaced by C17: floor 1, Codex's two-floor graph, the floor-3 hall and every tower stair | clear |
| Floor-2 ramp, down (B → A) and up (A → B), at x 27.8, 28.55 and 29.3. Each run is split into 10 segments, so support is checked at ±0.03 m from the sloped height, with body and head rays | clear |
| **Total** | **136 walks, 10,870 samples, 0 problems** |
| Negative control: C16 floor 2 (flat, with a 0.26 m edge) against the ramp heights | all 6 ramp walks fail |
| Height map, C16 vs C17 floor 2: first hit from above on a 0.2 m grid (44,100 points) | 0 differences outside the ramp. Inside it, the slab runs from 0.000 to −0.246 m on the grid; the north edge is at −0.26 m |
| C16 rebuild check with the updated scripts and its own configuration | 130 walks, 10,532 samples, 0 problems, as before |

**Note on the x 27.8 lane.** It stops 0.15 m south of the ramp. Below the ramp, the B corridor is x 28.1–30.0, and a wall at x 27.42–28.11 starts at y 47.32.

**Captures** (Workbench render, floor 2 only), in `docs/model-review/after-c17/`:
- From the B corridor looking north: `ramp-from-b-before.png` (C16) and `ramp-from-b-after.png` (C17).
- From the A elevator hall looking south: `ramp-from-a-before.png` (C16) and `ramp-from-a-after.png` (C17).

## Still pending

- **Floor 4 junction:** four nosings, which would mean 0.2625 m risers for 1.05 m.
- **Floor 5 junction:** not drawn.
- **Floor 1:** the laboratory zone, the sloped hall, the west blocks and the stair to piso cero.
- **Floor 0 and the rooftop.**

These are unchanged from C16.

## Rebuild

1. `python model/tools/real_levels_slabs.py model/tools/real_levels_c17.json` writes `model/tools/data/c17/slabs.json`.
2. In Blender, run `CONFIG = "real_levels_c17.json"`, then `exec(open("model/tools/blender_real_levels.py").read())`. This builds the "C17" scene, with floor 2 only, and exports the GLB here.
3. `node --experimental-strip-types model/tools/real_levels_check.ts docs/model-review/after-c17/checks.json model/tools/real_levels_c17.json`

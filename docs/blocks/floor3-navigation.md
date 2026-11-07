# Floor 3: reviewed north-bar access candidate

The scoped data adds three computer laboratory entrances, using the paired
laboratory/classroom labels in `model/tools/data/floor3/wing.json @389cfd9`:
Informática 1 / 308 A, Informática 2 / 309 A, and Informática 3 / 310 A.
Doorways D15, D14 and D13 supply their outside, centre and inside points.
`floor3-door-accesses.json` retains these source facts and hashes. The targets
are inside the drawn doorways; label centroids are not walking destinations.

All routes use C16 `002aaec`. The lower floor-2 corridor at (38.7, 54.7)
connects through (36.35, 54.7) to the next east stair foot (36.35, 55.9).
The old stair arrival and next stair foot are different positions. The 21-riser
east stair rises from world 6.18 to 9.87. Explicit floor-2 metadata remains on
the stair until the upper endpoint; elevation divided by a generic floor height
must not replace it. Structural anchors remain at B datum 9.38, outside the
walking graph. A walking surfaces are at 9.87.

`tools/prepare-floor3.ts --export-dataset` prepares 42 places and 39 connections
in `ucc:floor3-connection`, preserving the 68/63 C15 scopes. It checks actual
body/head clearance and footprint support in both directions against the five
committed C16 models. Source labels also pass architectural visibility checks.
`tools/render-floor3-candidate.ts` draws the exported walls and this candidate.
Evidence is in `docs/verification/floor3/`.

This preparation does not import the real database or restart port 8001.
The floor-3 API reference is owned integration data; it preserves Claude's three
structural markers and transform, enabling API alignment instead of structural
preview alignment. No Blender source or model is edited.

Unverified doors, other rooms, Block B routes, western level zones, floors 0/4/5,
and upper A/B junctions remain pending. C17's floor-2 ramp is a separate received
candidate; this graph and evidence intentionally retain the reviewed C16 bytes.

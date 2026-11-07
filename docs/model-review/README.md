# Model review (Claude)

This folder holds the evidence for each model revision, plus notes for Codex. Claude owns the model, `public/models/campus-reference.md` and this folder. Frontend code, tests and `docs/verification/` belong to Codex.

## Revisions

| Revision | Content | Evidence |
| --- | --- | --- |
| H0 (Preclinic) | Route to the Preclinic through the north circulation and the storeroom; door leaves and furniture regenerated | `h0/api-routes.json`, `h0/walk-*.json` |
| C1 (Plan 3, first visual pass) | Brick facades, glass frames and mullions, interior tiles, plaza pavers, gardens, trees and cypresses from the DWG, stone walls, green wall, fence, lamp posts, solar bike canopy, access pavilion roof and frame | `before/`, `after-c1/` |
| C2 (Plan 3, interiors) | Shaped furniture inside the validated footprints, floors by use (ceramic, vinyl, oak laminate), hanging destination signs and an entrance sign | `after-c2/` |
| C4 (Plan 1 H2, second floor and vertical core) | Second-floor cut model (`public/models/floor-2/`), Block A U-stairs (candidate `model/candidates/campus-c4-stairs.glb`), elevator and stair connection points (`docs/blocks/vertical-connections.md`) | `after-c4/` |
| C7 (Plan 1 H3, other floors) | Cut models of floors 0, 3, 4 and 5 (`public/models/floor-N/`), each with three shared-column references and a reference sheet; floor 2's slab now covers the library block | `after-c7/floors-top.png` (all six floors, same framing) |
| C6 (Plan 3 P3, monito) | Optional faceless avatar GLB with `Idle` and `Walk` clips (`public/models/avatar/`) | `after-c6/` |
| C5 (Plan 2 A1, exterior) | Exterior massing of Blocks A and B, floors 2–5: registered floor outlines, real levels per block, brick with ribbon windows, roofs and terraces, rooftop courts, glass stair towers. Separate GLB `public/models/blocks/campus-exterior.glb` | `after-c5/` |
| C12 (Plan 3 / Plan 2, upper-floor interiors) | Floors 0 and 2–5: room-tag bars removed from the walls (67), the door leaves drawn in the DWG added (143), furniture kept inside its own room (no desks in corridors; five more classrooms furnished on floor 2) | `after-c12/floors-top.png` (same framing as `after-c9/`) |

## Comparable captures (Plan 3 §11)

All Blender captures use the same cameras (`Review_Cameras` collection in `model/campus.blend`) at 1600 × 1000 px:

The same file names appear in `before/`, `after-c1/` and `after-c2/`:

| Capture | Camera | File |
| --- | --- | --- |
| General view | `Cam_General` | `blender-general.png` |
| Access / facade | `Cam_Entrance` | `blender-entrance.png` |
| Patio / plaza | `Cam_Patio` | `blender-patio.png` |
| Interior with doors and furniture | `Cam_Interior2` | `blender-interior-2.png` |
| Interior from the garden side (trees in front from C1 on) | `Cam_Interior` | `blender-interior.png` |
| Browser, 3D, arrival at the Preclinic | app | `browser-3d-preclinic-arrival.png` |
| Browser, top view with the Preclinic route | app | `browser-top-preclinic-route.png` |
| Browser, 3D, arrival at ICETEX | app | `browser-3d-icetex-arrival.png` |

The browser captures come from a temporary Playwright walk run by Claude against `http://127.0.0.1:8001`, in Brave. That run is kept out of `tests/` and writes nothing to `docs/verification/`.

## Checks repeated after each export

1. **Collision rays.** The same rays as `collides()` in `src/scene/campus.ts` (heights 0.45 and 1.2 m, offsets ±0.22 m) are cast every 0.1 m along all API edges in both directions, against every mesh of the GLB.
   - C1: 16 edges × 2 directions, **0 blocked**. 100 meshes and 52,688 triangles. **1.73 ms** per `collides()` call; the previous GLB took 3.35 ms.
   - C2: **0 blocked**. 137 meshes and 73,644 triangles. **1.78 ms** per call. GLB 3.76 MB.
2. **Browser walks.** Hall Acceso → ICETEX, Morphology Laboratory, Elevator and Restroom Hall and Preclinic, plus Preclinic → Hall Acceso.
   - C1 and C2: all five reach `arrived`.
   - Final error 0.000 m and maximum centre-line deviation ≤ 0.0007 m.
   - No `blocked` state and no page errors (`after-c1/walks/`, `after-c2/walks/`).
3. **API routes.** `/routes/calculate` for the same pairs returns 200 (`h0/api-routes.json`).
4. **Served model.** `npm run build`; `dist/models/campus.glb` is the exported file.

## Notes for Codex

- **Upper-floor previews re-exported (C12, `fe71176`, `08fd92b`).**
  - Floors 0 and 2–5 changed again. Their working exports are pending review: floor 0 `c4a2bb57…`, floor 2 `368da98e…`, floor 3 `25b75bfd…`, floor 4 `970d899f…`, floor 5 `a6be6a29…`.
  - `npm run build` still serves the reviewed bytes pinned at `f15ddb9` (checked: `1818cc7e`, `403cb77b`, `8842b50c`, `3836f2b3`, `f02ed3b2`).
  - Changes:
    - The filled bars next to room names had been modelled as free-standing walls in classrooms and halls. They are gone.
    - The leaves drawn in the DWG are now doors, placed as drawn (`P<N>_Doors`), without swing arcs.
    - Desks stay inside their rooms.
  - Each export keeps its 3 reference nodes, the stairs and the C11 cuts. Claude's stair probe still reports all 9 passes clear.
  - When these floors get API paths, the new leaves stand where the DWG draws them, open. Rerun `extras.py` and then `door_leaves_dwg.py` with the floor graph (`model/tools/README.md`, step 6h2).

- **C11 stair probe answered (04:25, `71c5e80`).**
  - All the blockers and support conflicts in `verification/c11/stair-clearance.json` are fixed on every floor:
    - Sloped soffit under the first flights.
    - Stair-hall walls opened in front of the flights.
    - The floor-1 room under the west flight cut above 1 m.
    - A 0.3 m top-tread strip.
  - Claude's matching probe reports all 9 stair passes clear, and the floor-1 routes 0 blocked.
  - New exports pending review:
    - Floor 1 working export `93a1ad69…`.
    - The five floor previews: their bytes changed after `099c212`.
  - Details are in `docs/blocks/vertical-connections.md`.

- **Route over a stair (03:45, important).** The API edge `South circulation → Laboratory corridor west` (y = 33.5) crosses the Block B stair's south flight. That is 9 steps, from N 0.00 to N +1.19, between x 36.5 and 39.0. The Morphology Laboratory route is therefore not step-free, although it is offered with "Avoid stairs". Details and a suggested split are in `docs/blocks/vertical-connections.md`, "Block B first-floor stair".

- **Manifest gate (02:55).** Claude's export with the stairs changed `public/models/campus.glb`. The app then reported "Model export changed… Review its manifest", as the gate is meant to. Claude restored the pinned C2 file (`d65846a8…`; the 5 browser walks pass again). The stair version is now a candidate in `model/candidates/` (see its README). From now on, Claude delivers first-floor changes as candidates and leaves the served file alone.

- **`tools/verify-model.ts` and `tools/inspect-model.ts` fail on the textured GLB under Node.** GLTFLoader tries to decode the embedded JPEG textures and Node has no image decoder. The app in the browser is not affected. One fix, used by Claude's check: before `parseAsync`, rebuild the GLB without `images`, `textures`, `samplers` and the material texture slots. Collisions and references only need the geometry. Another option is to stub the texture loading.
- **Preclinic.** It now has a route (backend `3809907`). `tests/e2e/campus.spec.ts` ("real API no-route…") and `docs/REHEARSAL.md` / `docs/campus-review.md` still describe it as having no route.
- **Visibility.** `Canopy_Access_Roof` is translucent (alpha 0.16) and sits over Hall Acceso, at the start of every route. If the top view should show nothing above the cut, hide `/^Canopy_/` in top view. Its alpha blending may also need `depthWrite = false` in Three.js if it sorts badly.
- **Shadows.** The `castShadow` regex in `loadModel` uses name prefixes. `Glass_Frames_*` and `Glass_Mullions_*` start with `Glass`, so they do not cast shadows; that is fine. `Deco_Grass` could join the no-shadow list.
- **Collisions.** Everything named `Deco_*`, `Canopy_*`, `Door_Swings`, `Glass_Frames_*` and `Site` is clear of the routes or out of the body-height band. Skipping them in `collides()` would not change walkability and would make the check cheaper still.

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
| C13 (upper-floor doorways) | Floors 0 and 2–5: the door-type frames ("P-10") that stood in doorways and corridors as wall stubs removed (111). Drawn door leaves replace guessed ones in the same doorway; the repeated DWG leaves are placed once | `after-c13/floors-top.png` |
| C14 (doorway inventories) | Floors 0 and 2–5: `doorways.json` per floor (jambs from the DWG marks, width, leaves, stand points, labels seen from each side), checked against each GLB; label bars under rotated names removed (8 more, two of them in the floor-2 lab passage); no furniture in doorway passages | `after-c14/floors-top.png` |
| C15 (real-level candidate, floors 1–2) | Block A at N −0.63 (floor 1) and +2.68 (floor 2), the four-riser hall steps, the A stairs with real rises (3.31 m and 3.20 m), pending zones flat. A separate candidate in `model/candidates/c15/`; the public exports are unchanged | `after-c15/hall-steps.png`, `after-c15/checks.json` |
| C16 (real-level candidate, floors 1–5) | Block A at its real level on every floor 1–5, tower stairs at the physical rises (3.31 / 3.69 / 3.50 / 3.50 m), floor-3 hall steps; pending junctions on floors 2, 4 and 5 | `after-c16/checks.json` |
| C17 (real-level candidate, floor-2 ramp) | C16 with the floor-2 A/B junction modelled as the drawn ramp (N +2.68 → +2.94 over 1.37 m, about 19 %); floors 1, 3, 4 and 5 reused from C16 | `after-c17/checks.json`, `after-c17/ramp-*.png` |

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

- **C17: the floor-2 junction ramp (`0f6a862`, zones `b36d328`). The user confirmed the block identities on 7 November at 16:07.**
  - **Block identities:** Block A is the north bar and Block B the south body. They join at the hall corridor (x 27.35–29.75), which the user marked on the floor-2 sheet. The A/B identities are no longer derived.
  - **Files:**
    - `model/candidates/c17/floor-2.glb` (`7a81de62…`), with its reference sheet in the same folder.
    - Floors 1, 3, 4 and 5 are the C16 files, unchanged and not re-exported.
    - Configuration: `model/tools/real_levels_c17.json`.
  - **What changed:** only floor 2, inside the strip x 27.353–29.753, y 47.906–49.275.
    - The strip is now a ramp from N +2.94 at its south edge to N +2.68 at its north edge: 0.00 → −0.26 from the B datum, world 6.44 → 6.18.
    - Outside the strip, the C16 and C17 height maps are identical (44,100 points).
  - **Evidence for the ramp:** no treads, an arrow from A to B and "S" (*sube*) at the A end. On floors 3 and 4 the same strip has numbered treads.
  - **Slope:** about 19 %. It is step-free, but steeper than the usual accessibility limits. Please do not label it wheelchair-accessible without a site check.
  - **Checks:**
    - 136 walks clear: every C16 walk plus the ramp down and up in three lanes.
    - Negative control: the flat C16 floor 2 fails all 6 ramp walks.
  - **Routes:** a floor-2 B ↔ A route would cross at x 28.1–29.75. The B corridor south of the ramp is x 28.1–30.0. Your floor-2 destinations D13–D15 are in Block A and do not need it.
  - **Still pending:** the floor-4 and floor-5 junctions.

- **C16 candidate set, floors 1–5 (`002aaec`, zones `fb39c86`). Follows your C15 review.**
  - Files: `model/candidates/c16/floor-{1..5}.glb`. The reference sheet is in that folder and the per-floor configuration with its evidence in `model/tools/real_levels.json`.
  - Block A offsets from the B datums: −0.63, −0.26, +0.49, +1.05 and +1.61 m, that is N −0.63, +2.68, +6.37, +9.87 and +13.37. The world transforms (3.5 / 6.44 / 9.38 / 12.32 / 15.26), node names and references are unchanged.
  - The tower stairs have the physical rises: 3.31, 3.69, 3.50 and 3.50 m. The C15 floor-2 approximation of 3.20 m is replaced by 3.69 m to Block A at world 9.87, as you asked.
  - The floor-3 hall steps are modelled: four 0.1225 m risers up to Block A. The hall junctions of floors 2, 4 and 5 stay pending:
    - floor 2: no nosings drawn;
    - floor 4: the drawn nosings would mean 0.26 m risers;
    - floor 5: nothing drawn.
  - Floor 1 has the same geometry as C15. Floor 2 differs from C15 only in its stairs.
  - Checks: 130 walks clear. They cover the floor-1 routes, your two-floor graph, the floor-3 hall in both directions and every tower stair from 1 to 5.
  - Inspection on floor 4: a drawn partition at x 38.28–38.50, y 54.8–55.68 stands just west of the east-stair arrival.

- **C15 real-level candidate (`f176e35`, zones `60e718e` / `71fd98a`). Answers `docs/blocks/first-floor-level-review.md`.**
  - Files: `model/candidates/c15/floor-1.glb` (`75abed56…`) and `floor-2.glb` (`8e7ea9aa…`), with the reference sheet in the same folder.
  - The world transforms stay 3.5 / 6.44 and the node names match C13/C14. The half-levels are inside the geometry:
    - Block A (y ≥ 49.23, x ≥ 13.6) at −0.63 on floor 1 and −0.26 on floor 2.
    - The hall treads at −0.1575 / −0.315 / −0.4725.
    - The A stairs at a 3.31 m rise from floor 1 to 2, and 3.20 m to the flat C14 floor 3.
  - Pending zones stay flat: the laboratory wing, the sloped hall, the cafeteria block, the stair down to piso cero and the floor-2 junction. `docs/blocks/level-zones.md` / `.json` give the evidence and each place's zone, level and status.
  - Checks with `model/tools/c15_check.ts`: 124 walks clear (support at the expected height, body/head rays clear). They cover your proposed hall split, the 16 first-floor edges, your 43 two-floor edges with heights mapped to the real levels, and the four A stairs. The negative control against flat C13 fails 68 walks.
  - The floor 0 → 1 stair does not meet the C15 Block A floor. Floor 0 needs its own Block A level before it pairs with C15.

- **Level changes on the first-floor routes (09:08, important for "Avoid stairs").**
  - The first-floor sheet draws steps (0.63 m) between the hall corridor (N 0.00) and the elevator hall (N −0.63), at x 27.3–29.8, y 47.86–49.23.
  - *(10:44)* Three numbered treads of 0.46 m lie between four nosing lines (y 47.86, 48.32, 48.78, 49.23). That is 4 risers of about 0.158 m, so each is under your 0.20 m step limit, not 0.21 m.
  - The API edge `Hall corridor north → Elevator and Restroom Hall` crosses them, and the node `Hall corridor north` stands on the first tread. So every route from Hall Acceso to Block A (elevators, north circulation, Preclinic, and your new floor-2 routes) goes down steps.
  - The Block B stair links three levels (N −0.90, 0.00, +1.19). The hatched hall north of it rises from N −0.90 to the north circulation (N −0.63). No ramp reaches N +1.19 on this sheet.
  - Details and suggested edges are in `docs/blocks/vertical-connections.md`, "First-floor level changes on the API routes". The model is still flat there; real levels can come as a candidate when the graph is ready for them.

- **C14: doorway inventories and new exports (`f0289fe`, `389cfd9`).**
  - Your three floor-2 routes (`a6d3f11`) use doorways D13, D14 and D15 from `model/tools/data/floor2/doorways.json`. That file is committed unchanged in `389cfd9` (SHA-256 `18fc3d7c…`).
  - The floor-2 working GLB you also tested, `44fbeda2…`, is now committed in `389cfd9`.
  - New exports:

    | Floor | Export | Commit |
    | --- | --- | --- |
    | 0 | `a266b162…` | `389cfd9` |
    | 2 | `44fbeda2…` | `389cfd9` |
    | 3 | `905b611a…` | unchanged since `a2dbda0` |
    | 4 | `18f2fcaa…` | `389cfd9` |
    | 5 | `fc942855…` | `389cfd9` |

  - Changes since C13:
    - Filled label bars under rotated room names are removed: 7 on floor 2 (two of them stood in the lab-cubicle passage) and 1 on floor 4.
    - Illustrative furniture is kept out of every doorway passage.
    - Floor 2 has 8 drawn leaves replacing guessed ones, up from 4, because of the new doorways.
  - Each `doorways.json` lists the jambs, width, drawn leaves, two stand points and the room labels visible from each side. Visibility uses a line of sight through no wall, column or glass, with the doorway itself closed. `through` is the result of `model/tools/doorway_rays.ts` against the committed GLB.
  - Doorway checks with both stand points:
    - Floor 2: 24 of 24 clear.
    - Floor 0: 38 of 40. D08 crosses a toilet; D17 crosses a drawn leaf.
    - Floors 3, 4 and 5: all but one each. The exception is the balcony doorway at x ≈ 69.6, whose outer stand point meets the balcony glass.
  - Some doorways have no stand point on one side (too close to a solid), and some jamb marks are unpaired. Both are listed in the JSON.
  - These are drawing facts, not entrances: which doorway a destination uses stays a graph decision.

- **Upper-floor previews re-exported again (C13, `35a5565`, `a2dbda0`). This replaces the C12 exports of `08fd92b`.**
  - Do not integrate the floor previews of `08fd92b`. In those exports, each door-type code ("P-7", "P-10") was drawn inside a 0.25 × 0.54 m frame, and the frames were modelled as 2.8 m wall stubs, often inside the doorway or the corridor. Rays through the Aula 203 B and 204 B doorways hit them at y 37.0. The same stubs are in the earlier previews (`099c212`, `f15ddb9`).
  - New working exports, pending review:

    | Floor | Working export |
    | --- | --- |
    | 0 | `1cc05a1b…` |
    | 2 | `63a1ac43…` |
    | 3 | `905b611a…` |
    | 4 | `db7a29e4…` |
    | 5 | `0bedcb88…` |

  - What changed since C12:
    - 111 frames are removed: 22, 26, 16, 21 and 26 on floors 0, 2, 3, 4 and 5.
    - Gap detection now finds more doorways.
    - Where a doorway had both a guessed leaf and a drawn one, the drawn leaf is used. The guessed side was arbitrary; one glass leaf opened into the floor-2 north corridor.
    - A leaf the DWG repeats is placed once.
  - Kept from C12:
    - No room-tag bars as walls.
    - Furniture inside its own room.
  - Checks: the 3 references per export, the stairs and the C11 cuts are intact. Claude's stair probe reports 9 clear passes. Rays through the classroom doorways and along the floor-2 north corridor (y 54.8) are clear.
  - Some restroom doors on the floor-2 north corridor open outwards, as drawn. Their leaves reach y 55.1 in the 2.4 m corridor, so routes should run along y ≈ 54.5–54.8.
  - The first floor has no such frames and is unchanged (`93a1ad69…`).
  - When these floors get API paths, rerun `extras.py` and then `door_leaves_dwg.py` with the floor graph (`model/tools/README.md`, step 6h2).

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

# Campus model reference

First usable version of the UCC first floor (Bloque B) as a cut architectural model.

| Item | Value |
| --- | --- |
| Source | `PLANOS UCC 2025 - B.dwg`, converted to DXF (ACAD2018) with ODA File Converter |
| Sheet | `PLANTA PRIMER PISO`, interior level **N 0.00** (street level, main access) |
| Units | Metres. `$INSUNITS = 6`; the drawing is at 1:1 |
| Area modelled | CAD x 5905 → 5992, y -1800 → -1724 (87 × 76 m) |
| Origin (0, 0) | Entrance threshold of **HALL ACCESO**, CAD (5915.0, -1792.0) |
| Orientation | CAD axes kept, no rotation. +x = CAD +x, +y = CAD +y. The sheet is drawn rotated on the layout, so +y is **not** geographic north |

## Coordinate convention (shared with the API and Three.js)

- Plan coordinates `(x, y)` in metres = `CAD − origin`. Use these as `x`, `y` for places in FastAPI.
- Blender is Z-up: plan `(x, y)` → Blender `(x, y, z)`.
- The glTF export is Y-up: plan `(x, y)` → Three.js `(x, height, -y)`. This matches `toScenePosition` in `src/scene/coordinates.ts`, so the GLB needs no extra horizontal transform.

## Reference points

These are also exported as empty nodes in `campus.glb`. Verified in the GLB: each lands at `(x, 0, -y)`.

| Name | What it is | CAD (x, y) | Plan (x, y) | Three.js |
| --- | --- | --- | --- | --- |
| `REF_1_Entrance_HallAcceso` | Entrance threshold, HALL ACCESO | 5915.00, -1792.00 | 0.00, 0.00 | 0, 0, 0 |
| `REF_2_Column_Icetex` | Column centre beside ICETEX | 5942.26, -1750.23 | 27.26, 41.77 | 27.26, 0, -41.77 |
| `REF_3_Column_Lockers` | Column centre, lockers / LAB MORFOLOGIA corridor | 5961.97, -1755.06 | 46.97, 36.94 | 46.97, 0, -36.94 |

The three points are not collinear.

## Suggested destinations

Positions come from the room labels on the plan, so each one is inside its room. Rooms connect to the CIRCULACION corridors.

| Node | Room on the plan | Plan (x, y) |
| --- | --- | --- |
| `DEST_Icetex` | ICETEX | 24.55, 41.78 |
| `DEST_Lab_Morfologia` | LABORATORIO MORFOLOGIA (área académica) | 42.96, 27.77 |
| `DEST_Preclinica` | PRECLINICA / COORDINACION ODONTOLOGIA | 56.84, 51.96 |
| `DEST_Hall_Ascensores` | HALL ASCENSORES Y BAÑOS | 25.77, 51.97 |

Waypoints for the path graph still need to go at corridor turns so straight segments don't cross walls.

### Preclinic access

The PRECLINICA room (x 54.8 → 57.8, y 48.5 → 53.5) has no door of its own onto a corridor. In the DWG it is entered through the room to its east (PRECLINICA ALMACEN):

| Step | Plan (x, y) | Doorway width in the model |
| --- | --- | --- |
| North circulation, in front of the storeroom | 58.26, 54.70 | — |
| Storeroom doorway in the glass partition | 58.26, 53.51 | 1.00 m |
| Inside the storeroom | 58.26, 51.68 | — |
| Preclinic doorway (east partition) | 57.80, 51.68 | 1.18 m |

The north circulation joins HALL ASCENSORES through (32.0, 54.4). Every segment keeps at least 0.42 m from walls, columns and glass, and the door leaves of both doorways open away from the path.

## Dimension check

- The dimension near the elevators reads **4.312 m**. Its definition points are CAD (5940.67, -1730.69) → (5944.98, -1730.68), 4.31 m apart in drawing units. In plan coordinates that is (25.67, 61.31) → (29.98, 61.32).
- The model uses the CAD coordinates without scaling, so the same span measures 4.31 m in Blender and in the GLB.
- Elevator bays measure about 1.5 m (dimensions 1.491 and 1.545 m), which is consistent with metres.

## Heights (approximate)

There is no section drawing yet. Every height below is an assumption for the model, not a survey.

| Element | Height |
| --- | --- |
| Floor slab | -0.20 → 0.00 (interior N 0.00 from the plan) |
| Plaza / site base | top at -0.15. The plan marks the plazas at **N -0.63**; the model raises them to keep a low base |
| Walls (cut height) | 0.00 → 2.80 |
| Columns | 0.00 → 2.80 |
| Glass partitions | 0.00 → 2.60 |
| Door leaves | 0.00 → 2.10, 4.4 cm thick |
| Desks, tables | 0.75; lab benches 0.90; seats 0.45–0.62 |
| Lockers, shelving | 1.80; gym machines 1.10; turnstiles 1.00 |
| Sanitary fixtures | 0.45 (WC, urinals); 0.85 (washbasins) |
| Glass frames | bottom rail 0.00 → 0.07, mullions every ~1.25 m, top rail 2.50 → 2.62 |
| Grass beds | -0.16 → -0.12 (4 cm above the paving) |
| Stone walls / planters | -0.15 → 0.55 / -0.15 → 0.45 |
| Green wall | -0.15 → 3.30 |
| Trees | trunk to the crown; crowns start at ≥ 2.0 m |
| Cypresses | 3.4–4.2 m |
| Lamp posts | 4.6 m |
| Solar bike canopy | panels 2.65 → 3.1 (tilted) |
| Access pavilion roof | translucent, sloping 3.4 m (y = -8) → 5.3 m (y = 10.6) |
| Terrace frame (over the shops) | 3.15 → 3.45, open frame without cover |
| Storey height | 3.5 m, the backend convention, still unchecked against the building |

## How the geometry was built

| Model object | DXF source |
| --- | --- |
| `Walls` | Solid hatches on layer `linea de corte` (wall poché). Door openings are the gaps in the hatch |
| `Ramps_Stairs` | Pattern hatches on `linea de corte` (the two striped ramps and the stairs) |
| `Columns` | Closed polylines on layer `06` |
| `Glass` | Lines on layer `VIDRIO`, 8 cm thick |
| `Floor_Slab` | The walls, columns and glass merged, with gaps up to 9 m closed, plus the outline of the glass-walled CAFETERIA / LOCAL 1–4 block (plan x -6.7 → 13.5, y 42.4 → 63.6) |
| `Doors` | One leaf per doorway, drawn **open at 90°**. Doorways are the 0.65–1.9 m gaps between wall or glass ends; gaps over 1.25 m get two leaves. Glass partitions get glass leaves |
| `Door_Swings` | Thin swing arcs on the floor (2–8 mm high), as on a plan |
| `Fixtures` | CAD blocks on layer `sanitarios` (WC, urinals, washbasins) and the `Lavabo` block |
| `Furniture_<i>_<j>` | **Illustrative**, not from the drawing (see below). Split into 20 m cells |
| `Site` | The crop rectangle, concrete pavers |
| `Glass_Frames_Top`, `Glass_Frames_Base`, `Glass_Mullions_<i>_<j>` | One frame per `VIDRIO` segment of the DWG: rails and mullions about every 1.25 m |
| `Deco_Grass` | Gardens labelled JARDIN with a matching area, plus planting beds around the DWG vegetation |
| `Deco_Tree_Trunks_<i>_<j>`, `Deco_Tree_Crowns_<i>_<j>` | One tree per `Arbol38` / `arbol existente` block. Crown size comes from the block extents |
| `Deco_Cypress` | `PISO4` circles along the ramp. Read as cypresses, as in the photos (approximation) |
| `Deco_Shrubs` | Clusters of `VEGETACION-A` / `VEGETACION 2` polylines |
| `Deco_Stone_Walls`, `Deco_Planters` | `MUROPIEDRA` and `JARDINERA` lines, 30 cm / 20 cm thick |
| `Deco_Green_Wall` | `MUROTUBOS` line on the west edge, extended south along the substation (label "Muro Verde") |
| `Deco_Fence` | `MUROTUBOS` circles at the south-east (x ≈ 22): vertical-bar fence |
| `Deco_Lamps` | `000ILUMINACIÓN` and `SCH_LUMINARIA` blocks |
| `Deco_Solar_Canopy` | Closed `VOLADO` rectangle plus `PEDESTAL` posts (electric-bike shelter) |
| `Canopy_Access_Roof`, `Canopy_Access_Frame` | `VOLADO` outline over HALL ACCESO: translucent sloping roof on a steel frame, as in the photos |
| `Canopy_Terrace_Frame` | `VOLADO` outline over the south shops: open steel frame |

Materials:
- **Walls:** `Wall_Brick` is the brick texture on exterior wall faces. A face counts as exterior when the point 0.3 m outside it falls outside the footprint. `Wall_Cut` is warm-white plaster indoors and `Wall_Cap` is the dark top cut.
- **Structure and glass:** `Column` is exposed concrete indoors, and brick when it faces outside. `Glass` is tinted blue-grey. `Frame_Dark` covers the window frames.
- **Floors and site:** `Floor_Interior` is 60 cm porcelain tiles and `Site_Plaza` is 50 cm concrete pavers. `Grass`, `Stone_Wall`, `Green_Wall` and `Planter` cover the planted and stone areas.
- **Vegetation:** `Trunk`, `Foliage_A`, `Foliage_B`, `Foliage_Dark`, `Shrub` and `Shrub_Flower`.
- **Metal and canopies:** `Metal_Light` for the canopy frames and fence, `Metal_Dark` for the lamp posts, `Solar_Panel`, and `Canopy_Translucent` (alpha 0.16).
- **Interiors:** `Ramp_Stairs`, `Door_Wood`, `Swing_Line`, `Fixture`, plus `Furniture_Wood`, `Furniture_Seat`, `Furniture_Lab`, `Furniture_Felt` and `Furniture_Metal` for the furniture.

Textures are tileable JPEGs generated procedurally (`model/textures/`, real size in `textures.json`). They are embedded in the GLB, and UVs are in metres divided by the texture size.

Palette inspiration comes from the photos in `public/referenciasMaps/`: terracotta brick, dark curtain-wall frames, a green wall along the street, a translucent access pavilion, grey pavers, stone planters, cypresses and the solar bike canopy. The photos are only a visual guide. Every position comes from the DWG.

### Object names and runtime hints

- `Deco_*` objects are outdoor decoration and are clear of the routes:
  - Trunks, shrubs, lamp posts, stone walls and planters stay **≥ 0.6–0.65 m** from every API route centre line. Items that failed this test were left out: 5 trees, 3 cypresses, 2 shrubs and 1 planter.
  - Tree crowns start at ≥ 2.0 m.
- `Canopy_*` objects are high (≥ 3.15 m) and can be hidden for an unobstructed top view; the access roof covers the start of the route.
- Some objects sit wholly above or below the body-height rays (0.45 m and 1.2 m): crowns, top and base rails, swing arcs, grass, site and the canopy roof. Their bounding boxes let the runtime skip them cheaply. Furniture, mullions and trees are split into cells for the same reason.
  - Measured: **1.73 ms** per `collides()` call, against 3.35 ms for the previous GLB.

## Doors and furniture

- The DWG draws almost no door leaves inside this wing (only a few at the entrance), so the door hinge side is **inferred**. Each leaf is placed open at 90° on the side that keeps it inside free space and farthest from the API route centre lines.
- The DWG has no furniture in these rooms. `Furniture` is a plausible layout derived from the room name on the plan: café tables in CAFETERIA, lab benches with stools in the laboratories and AULA 112/113, a desk and chair in each office, waiting benches at ICETEX / SALA ESPERA, pool tables in JUEGOS DE SALON, locker banks in AREA DE LOCKERS, shelving in ARCHIVO and BODEGA. Positions are not surveyed. Circulation areas and halls are left empty.
- The runtime treats every mesh as a collision obstacle. To keep routes walkable:
  - Furniture stays at least 1.0 m from every API route centre line and 0.85 m from every doorway.
  - Door leaves stay at least 0.40 m from route centre lines. Measured minimum: 0.50 m.
  - CAD fixtures closer than 0.7 m to a route are left out, which removes the HALL ACCESO turnstiles from the entrance lane.
  - Checked by casting the same rays as `collides()` in `src/scene/campus.ts` (two body heights, ±0.22 m) along all 16 API edges in both directions: no edge is blocked (rechecked after every export; see `docs/model-review/`).
- If new API routes are added through rooms with furniture, regenerate the layout or move the pieces in `model/campus.blend`.

## Known gaps in this version

- Furniture is illustrative, and door hinge sides are inferred.
- Some doorways are not detected: gaps wider than 1.9 m, and openings that are not between two wall ends.
- A solid hatch in the BAÑOS / VESTIER block near plan (25.5, 2) is read as a full-height wall block.
- Plazas and gardens have no level changes (the plan marks N -0.63). The access roof slope and height, the cypress reading of `PISO4` and the southern extension of the green wall are approximations from the photos.
- Upper floors and roofs are not modelled: the building is a ground-floor cutaway.
- Single floor only.

## API floor and runtime transform

- The drawing calls this sheet "primer piso", and there is a "piso cero" below it on the same file. Use **API floor 1** so the lower floor can be floor 0 later.
- The GLB is exported at local elevation 0. In `campus-reference.json` set `"floor": 1`, `"scale": 1`, `"rotationYDegrees": 0` and `"translation": [0, 3.5, 0]`.
- With that transform the reference positions in the JSON are the glTF positions above, with y = 0, and the API places use the plan coordinates.
- If you prefer API floor 0, use translation `[0, 0, 0]` instead. Do not apply the floor offset twice.

## Files

| File | Use |
| --- | --- |
| `public/models/campus.glb` | For the browser, served at `/app/models/campus.glb` |
| `public/models/campus-top.png` | Top render, 1740 × 1520 px, 20 px per metre, framed exactly on the crop (plan x -10 → 77, y -8 → 68) |
| `model/campus.blend` | Editable source, outside the web build. Collections `UCC_Piso1` and `References`, plus `Camera_Top` (orthographic, framed on the crop) |
| `model/campus-plan.png` | The DXF plan with the same framing and pixel size as `campus-top.png`, for overlay |
| `model/campus-compare.png` | Plan and render side by side |
| `model/textures/` | Procedural textures used by the model, and `textures.json` with their real-world size |
| `docs/model-review/` | Claude's review evidence: comparable captures `before/` and `after-*/` and walk reports |

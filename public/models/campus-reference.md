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
| Storey height | 3.5 m, the backend convention, still unchecked against the building |

## How the geometry was built

| Model object | DXF source |
| --- | --- |
| `Walls` | Solid hatches on layer `linea de corte` (wall poché). Door openings are the gaps in the hatch |
| `Ramps_Stairs` | Pattern hatches on `linea de corte` (the two striped ramps and the stairs) |
| `Columns` | Closed polylines on layer `06` |
| `Glass` | Lines on layer `VIDRIO`, 8 cm thick |
| `Floor_Slab` | The walls, columns and glass merged, with gaps up to 9 m closed |
| `Site` | The crop rectangle |

Materials: `Wall_Cut` white, `Wall_Cap` near-black on wall tops, `Column` terracotta, `Glass` translucent blue, `Floor_Interior` warm light grey, `Site_Plaza` dark grey-green, `Ramp_Stairs` mid grey.

## Known gaps in this version

- The large glass-walled room at the top left (plan x -10 → 10, y 40 → 60) has no floor slab yet.
- There are no door leaves, only openings. There is no furniture, by design.
- Plazas and gardens are a flat base without paving or level changes.
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

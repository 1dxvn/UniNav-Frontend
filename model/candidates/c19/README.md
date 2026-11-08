# C19 candidate: polished campus exterior (Plan 4)

This is the campus overview exterior that replaces C5 (`public/models/blocks/campus-exterior.glb`, `913490fd…`) once integrated. It follows `Plan_4_Pulido_Vista_Campus.md` and the user's captures and reference photos (`campus nocturno.png`, `images.png`, `Proyecto Paneles solares.png`).

| Item | Value |
| --- | --- |
| File | `model/candidates/c19/campus-exterior.glb` (3.2 MB, about 51,700 triangles) |
| Frame | Same as C5: plan metres, origin at Hall Acceso, glTF Y up, local height = sheet level N (first-floor B slab = 0), runtime translation `(0, 3.5, 0)` |
| Use | Overview only. Not navigable, no collisions, no API references |
| Data | `model/tools/data/exterior_v2.json` from `model/tools/exterior_v2_prep.py` (C5 `exterior.json` and the floor sheets) |
| Build | In Blender: `exec(open("model/tools/blender_exterior_v2.py").read())`. It builds collection `Exterior_C19` in `model/campus.blend` and exports here. C5's `Exterior` collection is kept for comparison |
| Captures | `docs/model-review/after-c19/before-*.png` (C5) and `after-*.png` (C19), six fixed views (`model/tools/exterior_views.py`) |

## What changed, by defect

| Defect (user) | Cause | Fix |
| --- | --- | --- |
| Holes above the cafeteria and its upper floors | The storeys were hollow shells, roofed only where the storey above left them uncovered. The glass cafeteria was outside the slab footprint | Every storey gets a ceiling cap. The cafeteria glass block (x −6.72…13.65, y 42.41…56.26) counts as support, and its open court gets a roof. The west block's street and plaza faces get large windows (sill 0.35 m, head 0.30 m), as in the night photo |
| Missing roofs: games room (`JUEGOS DE SALON`), gym, access zone, pergola terrace | The exterior started at floor 2, so single-storey parts had no roof | Roofs over every part of the first floor not covered by floor 2, in dark membrane with fascia and parapet: 350 m² in the south zone (games room, toilets, reception), 218 m² over the cafeteria court, 96 m² over the locales, 35 m² over the power plant, small pieces by the towers, and 168 m² over the pergola terrace. The open plazoleta and garden stay open |
| Entrance | The access canopy was an almost invisible roof (opacity 0.16) on a frame | Access pavilion as in `images.png`: glass box with mullions and transom, translucent gable roof on steel trusses with a ridge beam, and a white sign panel on the street face. The panel carries a simple teal mark, not the logo artwork |
| Floating blocks | Parts of floor 2+ hung outside the first-floor building. The largest was an east strip (x 64–72, y 8–38, 141 m²) over the neighbouring lot | Every storey is trimmed to the first-floor building, plus the cafeteria, buffered 1.5 m. The neighbouring lot stays empty, as asked |
| Slits in the walls | In Block A, the first-floor walls are lowered to the real level and top out about 0.26 m below the C5 storey band | A brick plinth on the first storey runs down to 2.05 m and closes the slit. Roof fascias also start at 2.05 m |
| Walls covering the glass stair cylinders | The traced outline crossed each tower diagonally and became brick | The two recesses (facade at y 56.25, x 13.6–21.0 and 33.5–42.5) are cut from every storey. Each tower is a full glass "D" volume (west centre (16.37, 59.22), R 2.74; east (37.97, 59.24), R 2.71; measured on all sheets), from the first floor to 20.65 m, with white floor bands, mullions and a concrete cap |
| Missing roofs and walls at the back | Same as the holes; the terraces now come from the trimmed storeys | Caps, terrace parapets and the recess facades with their windows. The windows come from every glass line of each floor sheet |
| Rooftop courts: access blocked, ugly, no nets | C5 raised the whole rooftop outline (321 m²) as one brick box | From the rooftop sheet: music room (glass north wall, `UNIVERSIDAD COOPERATIVA DE COLOMBIA` sign, 21 solar panels on top), machine room, open covered circulations on posts. Court 1 (5-a-side, east) and court 2 (volleyball, west) are on turf with white markings: boundary, centre line, circle and goal areas. Around each court, 6 m nets with posts and a top rail, with a gate towards the circulation |

## Approximations

- **Rooftop rooms and circulations:** read from the rooftop sheet to about ±0.2 m. Room heights: 17.12 → 20.38 m.
- **Court markings:** follow the drawn shapes; the goal areas are drawn as rectangles.
- **Nets and posts:** height (6 m) and spacing (3.5 m) are not in the DWG.
- **West-block windows:** the large windows follow the night photo, not drawn glass lines.
- **Pavilion:** footprint and roof heights from the first-floor canopy (x −4.3…4.6, y −8.1…10.7, eave 3.4 m, ridge 5.3 m). Its east face adjoins the south wing.
- **Unchanged:** the wedge-shaped light well in the Block B roof and the open plazoleta are kept as in C5.

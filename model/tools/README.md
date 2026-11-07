# Model generation pipeline (Claude)

These scripts rebuild the Block B first-floor model from the DWG. The output is `model/campus.blend`, `public/models/campus.glb` and `campus-top.png`. They are not part of the web build.

## Requirements

- **DWG → DXF:** ODA File Converter, with `ODAFileConverter <in> <out> ACAD2018 DXF 0 1 "*.DWG"`. The DWG is `PLANOS UCC 2025 - B.dwg` in the backend root.
- **Python 3 for the DXF steps:** `ezdxf`, `shapely`, `numpy`, `matplotlib`, `pillow`.
- **Blender:** 5.x with the glTF exporter. The `blender_*.py` scripts run inside Blender, through the Python console or the Blender MCP, with `model/campus.blend` open.

## Steps

| Step | Command | Output |
| --- | --- | --- |
| 1. Walls, columns, glass, ramps, footprint, labels | `python extract.py <dxf> data/wing.json` | `data/wing.json` |
| 2. Openings, door leaves, cafeteria slab, fixtures, illustrative furniture | `python extras.py data/wing.json <dxf> ../../../scripts/ucc_floor1_data.py data/extras.json` | `data/extras.json` |
| 3. Site: gardens, trees, shrubs, cypresses, lamps, stone walls, planters, green wall, fence, overhangs, glass segments | `python site_extract.py <dxf> data/wing.json data/extras.json ../../../scripts/ucc_floor1_data.py data/site.json` | `data/site.json` |
| 4. Procedural textures | `python textures.py ../textures` | `model/textures/*.jpg`, `textures.json` |
| 5. Doors, swings, fixtures, furniture (Blender) | `NO_EXPORT = True` then `exec(open("model/tools/blender_extras.py").read())` | objects in `UCC_Piso1` |
| 6. Materials, UVs and site (Blender, first visual pass) | `exec(open("model/tools/blender_visual_c1.py").read())` | brick, frames, vegetation, canopies |
| 6b. Floor and sign textures | `python textures_c2.py ../textures` | `floor_*.jpg`, `sign_*.jpg` |
| 6c. Interiors (Blender, second visual pass) | `exec(open("model/tools/blender_interiors_c2.py").read())` | shaped `Furniture_*`, `Floor_Zones`, `Sign_*` |
| 6d. Floor registration and inventory | `python grid_axes.py <dxf> data/grid_axes.json`; `python inventory.py <dxf> data/grid_axes.json data/inventory.json out.png` | sheet shifts, `docs/blocks/dwg-inventory.md` data |
| 6e. Exterior massing data | `python exterior_extract.py <dxf> data/grid_axes.json data/exterior.json` | outlines and glazing per floor and block |
| 6f. Exterior (Blender) | `exec(open("model/tools/blender_exterior.py").read())`, then export only the collection `Exterior` | `public/models/blocks/campus-exterior.glb` |
| 6g. Other floors (data) | `python extract.py <dxf> data/floor2/wing.json "0.022,149.221"`, then `python walls_from_lines.py <dxf> data/floor2/wing.json "0.022,149.221"`, which also keeps room-tag bars and door-type frames ("P-10") out of the walls. The shift comes from `grid_axes.json` | `data/floor2/wing.json` |
| 6h. Other floors (Blender) | `FLOOR_ID = "2"; WING = ".../data/floor2/wing.json"; REFS = {...}` then `exec(open("model/tools/blender_floor.py").read())`. Export the `UCC_Piso2` collection with `use_active_scene=True` | `public/models/floor-2/campus.glb` |
| 6h2. Other floors, detail (data) | `python extras.py data/floorN/wing.json <dxf> data/graph_empty.py data/floorN/extras.json classrooms`, then `python door_leaves_dwg.py <dxf> data/floorN`. `classrooms` gives AULA desks and keeps every kit inside its own room; `door_leaves_dwg.py` adds the leaves drawn on layer 02 (replacing a guessed leaf in the same doorway) and clears the furniture next to them | `data/floorN/extras.json` |
| 6h3. Other floors, detail (Blender) | `FLOOR_ID = "N"` then `exec(open("model/tools/blender_floor_details.py").read())`: doors, swings, fixtures, shaped furniture, zones, export and top capture. After a `walls_from_lines.py` change that only drops tag bars, `blender_drop_tag_walls.py` removes them from `P<N>_Walls` without undoing the stair cuts | `public/models/floor-N/campus.glb` |
| 6i. Block A stairs (Blender) | `exec(open("model/tools/blender_stairs.py").read())`, then export the first floor to `model/candidates/` (never over the pinned `public/models/campus.glb`) | `Stair_A_West`, `Stair_A_East` |
| 7. Export | glTF: selection = collections `UCC_Piso1` and `References`, Y up, no cameras or lights | `public/models/campus.glb` |
| 8. Review captures (Blender) | `OUT_DIR = "..."` then `exec(open("model/tools/blender_review_renders.py").read())` | `docs/model-review/<rev>/blender-*.png` |

Steps 2 and 3 read the backend graph (`scripts/ucc_floor1_data.py`), so furniture, door leaves and decoration stay clear of the API route centre lines. If the graph changes, rerun steps 2, 3, 5, 6 and 7, then the checks in `docs/model-review/README.md`.

`blender_visual_c1.py` builds the walls from step 1 that are already in the file (`Walls`, `Columns`, `Glass`, `Floor_Slab`, `Ramps_Stairs`). Those meshes came from `wing.json` in the first build.

## Diagnostics

- `zoom.py <dxf> data/wing.json data/extras.json <graph> out.png x0,x1,y0,y1` plots the raw DXF linework of every layer, with model solids, openings, labels and API routes, for any window in plan metres.
- `plot_extras.py` gives an overview of openings, leaves, fixtures, furniture and routes.
- `route_pre.py` runs an A* search over free space with body clearance. It was used to find the Preclinic access.
- `api_routes.py <base_url> <seed.py> <out.json>` signs in with the seed demo user and records `/routes/calculate` results.

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
| 7. Export | glTF: selection = collections `UCC_Piso1` and `References`, Y up, no cameras or lights | `public/models/campus.glb` |
| 8. Review captures (Blender) | `OUT_DIR = "..."` then `exec(open("model/tools/blender_review_renders.py").read())` | `docs/model-review/<rev>/blender-*.png` |

Steps 2 and 3 read the backend graph (`scripts/ucc_floor1_data.py`), so furniture, door leaves and decoration stay clear of the API route centre lines. If the graph changes, rerun steps 2, 3, 5, 6 and 7, then the checks in `docs/model-review/README.md`.

`blender_visual_c1.py` builds the walls from step 1 that are already in the file (`Walls`, `Columns`, `Glass`, `Floor_Slab`, `Ramps_Stairs`). Those meshes came from `wing.json` in the first build.

## Diagnostics

- `zoom.py <dxf> data/wing.json data/extras.json <graph> out.png x0,x1,y0,y1` plots the raw DXF linework of every layer, with model solids, openings, labels and API routes, for any window in plan metres.
- `plot_extras.py` gives an overview of openings, leaves, fixtures, furniture and routes.
- `route_pre.py` runs an A* search over free space with body clearance. It was used to find the Preclinic access.
- `api_routes.py <base_url> <seed.py> <out.json>` signs in with the seed demo user and records `/routes/calculate` results.

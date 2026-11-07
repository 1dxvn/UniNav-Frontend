# Floor 5 model reference (first version)

`campus.glb` in this folder is the cut model of `PLANTA QUINTO PISO`. It is a first delivery for Plan 1 H3. Codex has not integrated it, and it has no API data yet.

| Item | Value |
| --- | --- |
| Source | `PLANOS UCC 2025 - B.dwg`, sheet `PLANTA QUINTO PISO` |
| Registration | Translation (198.446, +6.949) m onto the first-floor sheet, measured on the structural grid bubbles (`docs/blocks/dwg-inventory.md` §1). 10 structural columns coincide with first-floor columns within 0.050 m |
| Units / frame | Metres. Same plan coordinates as the first floor: origin at the Hall Acceso threshold, plan `(x, y)` → glTF `(x, height, -y)`, plan +y is not north |
| Local elevation | 0 = this floor's slab |
| Real levels | Block A N **+13.37**, Block B N **+11.76**. The model uses one flat slab |
| Recommended runtime transform | scale 1, rotation 0, translation `[0, 15.26, 0]`, that is 3.5 (first-floor model) + Block B level. Block A is +1.61 m from that |

## Reference points (structural columns shared with the first floor)

| Node | Plan (x, y) | glTF | Offset from the first-floor column |
| --- | --- | --- | --- |
| `P5_REF_1_Column_21_62` | 21.22, 62.30 | 21.22, 0, -62.30 | 0.040 m |
| `P5_REF_2_Column_47_37` | 46.99, 36.96 | 46.99, 0, -36.96 | 0.026 m |
| `P5_REF_3_Column_70_62` | 70.10, 62.34 | 70.10, 0, -62.34 | 0.023 m |

## Objects

- `P5_Floor_Slab`: closing of walls, columns and glass, -0.20 → 0. Rooms enclosed by walls and glass are added even when they are large.
- `P5_Walls`: solid hatches plus thin faces of the double wall lines on layer `01`; 0 → 2.80, brick outside, plaster inside.
- `P5_Columns`: layer `06` closed polylines.
- `P5_Glass`, `P5_Glass_Frames_Top`, `P5_Glass_Mullions`: `VIDRIO` lines, frames and mullions.
- `P5_Ramps_Stairs`: pattern hatches, flat.

Room tags drawn at the label anchors and the repeated 0.34 × 1.38 m blocks are filtered out. A few short stubs near labels may still be annotation.

## Labels on this sheet (first 40)

BAÑO MUJERES, BAÑO HOMBRES, AULA 513 A, AULA 514 A, AULA 512 A, AULA 515 A, AULA 511 A, SALA DE DOCENTES, DERECHO, PROGRAMA DE INGENIERIA INDUSTRIAL, LABORATORIO, AULA 504, AULA 505, AULA 511, AULA 510, AULA 509, AUDITORIO URCUNINA AULA 608B, BODEGA 1, BODEGA 2, AULA DE, CUARTO TECNICO, AULA 501 A, AULA 503 A, AULA 502 A, HALL ASCENSORES, Y BAÑOS, BALCON, AULA 517 A, AULA 518 A, POSGRADOS, ASENSOR, CIRCULACION, CIRCULACIÓN, HALL LAB, LABORATORIO DE OPERACIONES, Foreing language center, RIESGOS, PROYECCION, SOCIAL, DE TRABAJO

## Detail (C9, revised in C12)

- **Doors and fixtures:** `P5_Doors` holds 36 open leaves. 15 are in doorways found as gaps between wall ends, each with a flat swing arc in `P5_Door_Swings`. The other 21 are the leaves drawn in the DWG (thin rectangles on layer 02, `door_leaves_dwg.py`), placed as drawn and without an arc, because a leaf drawn along the wall may be a sliding door. `P5_Fixtures` holds 12 sanitary fixtures from the `sanitarios` blocks.
- **Furniture (illustrative), `P5_Furniture_<i>_<j>`:** 333 student desk sets, 12 lab benches, 12 lockers / shelving. The type comes from the room label: AULA gets desks, LABORATORIO gets benches, offices get a desk, and BODEGA, ARCHIVO and LOCKERS get storage. Each kit stays inside its own room (C12): rooms with gaps in their walls are closed progressively, corridors under 2.8 m wide are left out, and furniture within one leaf length of a drawn door is removed.
- **Room-tag bars (C12):** 15 filled bars drawn next to room names, 1.2–3 m long, had become free-standing walls in the rooms. They are now kept out of `P5_Walls` (`walls_from_lines.py`, `blender_drop_tag_walls.py`).
- **Floor zones, `P5_Floor_Zones`:** 2 wet, 8 lab (ceramic, vinyl, laminate).
- **Routes:** this floor has no API paths yet, so leaves and furniture were placed without a route-clearance check. When paths exist, rerun `extras.py` with this floor's graph.

## Not yet in this version

Signs and the stairs and elevators of this floor. The vertical core positions are the same as in `docs/blocks/vertical-connections.md`, because the floors are registered on the same grid.

# Floor 4 model reference (first version)

`campus.glb` in this folder is the cut model of `PLANTA CUARTO PISO`. It is a first delivery for Plan 1 H3. Codex has not integrated it, and it has no API data yet.

| Item | Value |
| --- | --- |
| Source | `PLANOS UCC 2025 - B.dwg`, sheet `PLANTA CUARTO PISO` |
| Registration | Translation (198.446, -121.485) m onto the first-floor sheet, measured on the structural grid bubbles (`docs/blocks/dwg-inventory.md` §1). 15 structural columns coincide with first-floor columns within 0.052 m |
| Units / frame | Metres. Same plan coordinates as the first floor: origin at the Hall Acceso threshold, plan `(x, y)` → glTF `(x, height, -y)`, plan +y is not north |
| Local elevation | 0 = this floor's slab |
| Real levels | Block A N **+9.87**, Block B N **+8.82**. The model uses one flat slab |
| Recommended runtime transform | scale 1, rotation 0, translation `[0, 12.32, 0]`, that is 3.5 (first-floor model) + Block B level. Block A is +1.05 m from that |

## Reference points (structural columns shared with the first floor)

| Node | Plan (x, y) | glTF | Offset from the first-floor column |
| --- | --- | --- | --- |
| `P4_REF_1_Column_28_26` | 27.74, 25.75 | 27.74, 0, -25.75 | 0.046 m |
| `P4_REF_2_Column_21_62` | 21.22, 62.23 | 21.22, 0, -62.23 | 0.042 m |
| `P4_REF_3_Column_70_62` | 70.10, 62.28 | 70.10, 0, -62.28 | 0.045 m |

## Objects

- `P4_Floor_Slab`: closing of walls, columns and glass, -0.20 → 0. Rooms enclosed by walls and glass are added even when they are large.
- `P4_Walls`: solid hatches plus thin faces of the double wall lines on layer `01`; 0 → 2.80, brick outside, plaster inside.
- `P4_Columns`: layer `06` closed polylines.
- `P4_Glass`, `P4_Glass_Frames_Top`, `P4_Glass_Mullions`: `VIDRIO` lines, frames and mullions.
- `P4_Ramps_Stairs`: pattern hatches, flat.

Room tags drawn at the label anchors and the repeated 0.34 × 1.38 m blocks are filtered out. A few short stubs near labels may still be annotation.

## Labels on this sheet (first 40)

TERRAZA, DE ESTAR, BAÑO MUJERES, BAÑO HOMBRES, SUB- DIRECCIÓN, GESTIÓN HUMANA, SALA JUNTAS, SALA DE ESPERA, DIR. DE SEDE, SUB-DIR. DE DLLO, TERRAZA POSTERIOR, HALL ACCESO, AULA 422 A, AULA 423 A, AULA 421 A, AULA 424 A, AULA 420 A, CENTRO DE, INVESTIGACION, SOCIOJURIDICO, OFICINA DE PROYECTOS, AULA 402 B, AULA 401, SALA, PROGRAMA DE, ENFERMERIA, DECANATURA, DERECHO, JEFE DE PROGRAMA, SECRETARIA DE, CUARTO TECNICO, SECRETARÍA, PROYECCION INSTITUCIONAL, INSTITUCIONAL, Y FINANCIERO, PLANEACIÓN Y, AUTOEVALUACIÓN, ADMINISTRACION, HALL ASCENSORES, Y BAÑOS

## Detail (C9)

- **Doors and fixtures:** `P4_Doors` and `P4_Door_Swings` give 16 open leaves, each with a flat swing arc, in the detected doorways. `P4_Fixtures` holds 37 sanitary fixtures from the `sanitarios` blocks.
- **Furniture (illustrative), `P4_Furniture_<i>_<j>`:** 175 student desk sets, 4 waiting benches, 3 desks, 1 lockers / shelving. The type comes from the room label: AULA gets desks, LABORATORIO gets benches, offices get a desk, and BODEGA, ARCHIVO and LOCKERS get storage.
- **Floor zones, `P4_Floor_Zones`:** 1 wet, 5 lab, 3 office (ceramic, vinyl, laminate).
- **Routes:** this floor has no API paths yet, so leaves and furniture were placed without a route-clearance check. When paths exist, rerun `extras.py` with this floor's graph.

## Not yet in this version

Signs and the stairs and elevators of this floor. The vertical core positions are the same as in `docs/blocks/vertical-connections.md`, because the floors are registered on the same grid.

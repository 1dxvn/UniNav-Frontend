# Floor 0 model reference (first version)

`campus.glb` in this folder is the cut model of `PLANTA PISO CERO`. It is a first delivery for Plan 1 H3. Codex has not integrated it, and it has no API data yet.

| Item | Value |
| --- | --- |
| Source | `PLANOS UCC 2025 - B.dwg`, sheet `PLANTA PISO CERO` |
| Registration | Translation (0.022, -121.485) m onto the first-floor sheet, measured on the structural grid bubbles (`docs/blocks/dwg-inventory.md` §1). 4 structural columns coincide with first-floor columns within 0.122 m |
| Units / frame | Metres. Same plan coordinates as the first floor: origin at the Hall Acceso threshold, plan `(x, y)` → glTF `(x, height, -y)`, plan +y is not north |
| Local elevation | 0 = this floor's slab |
| Real levels | Block A N **-4.13**, Block B N **-2.94**. The model uses one flat slab |
| Recommended runtime transform | scale 1, rotation 0, translation `[0, 0.56, 0]`, that is 3.5 (first-floor model) + Block B level. Block A is -1.19 m from that |

## Reference points (structural columns shared with the first floor)

| Node | Plan (x, y) | glTF | Offset from the first-floor column |
| --- | --- | --- | --- |
| `P0_REF_1_Column_21_62` | 21.23, 62.23 | 21.23, 0, -62.23 | 0.048 m |
| `P0_REF_2_Column_47_37` | 47.01, 36.83 | 47.01, 0, -36.83 | 0.122 m |
| `P0_REF_3_Column_33_62` | 33.32, 62.37 | 33.32, 0, -62.37 | 0.075 m |

## Objects

- `P0_Floor_Slab`: closing of walls, columns and glass, -0.20 → 0. Rooms enclosed by walls and glass are added even when they are large.
- `P0_Walls`: solid hatches plus thin faces of the double wall lines on layer `01`; 0 → 2.80, brick outside, plaster inside.
- `P0_Columns`: layer `06` closed polylines.
- `P0_Glass`, `P0_Glass_Frames_Top`, `P0_Glass_Mullions`: `VIDRIO` lines, frames and mullions.
- `P0_Ramps_Stairs`: pattern hatches, flat.

Room tags drawn at the label anchors and the repeated 0.34 × 1.38 m blocks are filtered out. A few short stubs near labels may still be annotation.

## Labels on this sheet (first 40)

COMPRESOR, BODEGA, BAÑO MUJERES, BAÑO HOMBRES, AUDITORIO, DE POSGRADO, PATIO, ARCHIVO HISTORIAS, SALA DE DEBRIEFING N2, CONTROL, DEBRIEFING, SALA  DE, SALA DE ESPERA, COMPRESORES, AREA INSUMOS ESTUDIANTES, LOCKERS, DOCENTES, CUARTO TECNICO RACK, CUARTO TECNICO ELECTRICO, OFICINA, CUARTO DE CONTROL, ENFERMERIA, HALL CLINICA, JARDIN, CONSULTORIO, PROCEDIMIENTOS, ESPECIALES, AREA DE ESTUDIOS, SALA DE CONSULTAS, DE HISTORIAS CLINICAS, CLINICAS, ASEO, AREA LIMPIA, UNIDAD DE CUIDADO CRITICO, ADMINISTRATIVA, AREA DE POSTGRADO, CLINICA, PASILLO, CIRCULACION, ASENSOR

## Detail (C9)

- **Doors and fixtures:**  and  give 23 open leaves, each with a flat swing arc, in the detected doorways.  holds 18 sanitary fixtures from the  blocks.
- **Furniture (illustrative), :** 30 lockers / shelving, 2 desks, 1 lab benches. The type comes from the room label: AULA gets desks, LABORATORIO gets benches, offices get a desk, and BODEGA, ARCHIVO and LOCKERS get storage.
- **Floor zones, :** 5 wet, 1 lab, 3 office (ceramic, vinyl, laminate).
- **Routes:** this floor has no API paths yet, so leaves and furniture were placed without a route-clearance check. When paths exist, rerun  with this floor's graph.

## Not yet in this version

Signs, slab holes over stairs and the stairs and elevators of this floor. The vertical core positions are the same as in `docs/blocks/vertical-connections.md`, because the floors are registered on the same grid.

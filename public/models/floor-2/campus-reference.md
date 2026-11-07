# Second floor model reference (first version)

`campus.glb` in this folder is the cut model of `PLANTA SEGUNDO PISO`. It is the first navigable-geometry delivery for Plan 1 H2. The model is new, and Codex has not integrated it yet.

| Item | Value |
| --- | --- |
| Source | `PLANOS UCC 2025 - B.dwg`, sheet `PLANTA SEGUNDO PISO` |
| Registration | Translation (0.022, +149.221) m onto the first-floor sheet, measured on the structural grid bubbles (`docs/blocks/dwg-inventory.md` §1). 16 structural columns coincide with first-floor columns within 0.05–0.08 m |
| Units / frame | Metres. **Same plan coordinates as the first floor**: origin at the Hall Acceso threshold, plan `(x, y)` → glTF `(x, height, -y)`, plan +y is not north |
| Local elevation | 0 = second-floor slab |
| Real levels | Block A N **+2.68**, Block B N **+2.94** (26 cm apart). The model uses one flat slab |
| Recommended runtime transform | scale 1, rotation 0, translation `[0, 3.5 + 2.94, 0]` = `[0, 6.44, 0]`, which is B's real storey above the first floor model at 3.5. With the legacy convention (floor × 3.5) use `[0, 7.0, 0]`; the stairs in the first-floor candidate rise 2.94 m, so they then fall 0.56 m short |

## Reference points

These are structural columns present on both floors. They are exported as empties.

| Node | Plan (x, y) | glTF |
| --- | --- | --- |
| `P2_REF_1_Column_South` | 30.78, 19.86 | 30.78, 0, -19.86 |
| `P2_REF_2_Column_NorthWest` | 21.22, 62.34 | 21.22, 0, -62.34 |
| `P2_REF_3_Column_NorthEast` | 70.10, 62.38 | 70.10, 0, -62.38 |

The first-floor references continue on this floor:
- REF_2 (27.26, 41.77) is at (27.28, 41.83).
- REF_3 (46.97, 36.94) is at (46.99, 37.00).
- Both are 0.056 m away, within the 0.15 m tolerance.

## Objects

| Object | Content |
| --- | --- |
| `P2_Floor_Slab` | Closing of walls, columns and glass, -0.20 → 0 |
| `P2_Walls` | Solid hatches on `linea de corte`, plus thin faces of the double wall lines on layer `01`; 0 → 2.80, brick outside, plaster inside |
| `P2_Columns` | Layer `06` closed polylines |
| `P2_Glass`, `P2_Glass_Frames_Top`, `P2_Glass_Mullions` | `VIDRIO` lines, frames and mullions |
| `P2_Ramps_Stairs` | Pattern hatches (flat) |

Filtered out as annotation: 462 small filled bars at the room-label anchors (room tags) and the repeated 0.34 × 1.38 m blocks. A few short wall stubs next to labels may still be annotation.

## Rooms (sheet labels)

- **Block A:**
  - Multifunctional laboratories 1–3.
  - Molecular biology lab.
  - Research centre, with its PCR, electrophoresis and quantitative-analysis rooms and a meeting room.
  - Mixed-reality lab and fluorides room.
  - Library (west).
  - Hall of elevators and restrooms.
- **Block B:**
  - Classrooms 201, 202, 203B–207B, 219B and 220.
  - Faculty of Medicine dean's office and programme offices.
  - Communications office, internships coordination, staff room.
  - Two light wells (VACIO).

## Detail (C8)

- **Doors and fixtures:**
  - `P2_Doors` and `P2_Door_Swings`: 11 detected doorways get an open leaf and a flat swing arc. On this sheet most doorways are not drawn as gaps between wall ends, so the others remain plain openings.
  - `P2_Fixtures`: 14 sanitary fixtures from the `sanitarios` blocks.
- **Furniture (illustrative), `P2_Furniture_<i>_<j>`:**
  - Classrooms get rows of student desks with chairs. These are AULA 201, 206 B, 207 B and 220.
  - Laboratories get lab benches with stools.
  - The Medicine dean's office gets a desk.
  - Rooms whose label falls outside a closed room polygon stay empty.
- **Floor zones, `P2_Floor_Zones`:** vinyl in labs and classrooms, laminate in offices.
- **Routes:** this floor has no API routes yet, so leaves and furniture were placed without a route-clearance check. When Codex adds paths, rerun `extras.py` with the floor-2 graph to keep them clear (`model/tools/README.md`).

## Not yet in this version

- No signs.
- No API places or paths for this floor (Codex).
- No hole in the slab over the stair flights.
- The A/B half-level (26 cm) and the ramps between them are flattened.

See `docs/blocks/vertical-connections.md` for the stairs and elevators that connect this floor with the first floor.

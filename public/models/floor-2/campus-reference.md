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

## Detail (C8, revised in C12–C14)

- **Doors and fixtures:** `P2_Doors` holds 37 open leaves. 30 are the leaves drawn in the DWG (thin rectangles on layer 02, `door_leaves_dwg.py`), placed as drawn and without an arc, because a leaf drawn along the wall may be a sliding door; where a doorway also had a guessed leaf, the drawn one replaced it. The other 7 are in doorways found only as gaps between wall ends, each with a flat swing arc in `P2_Door_Swings`. `P2_Fixtures` holds 14 sanitary fixtures from the `sanitarios` blocks.
- **Furniture (illustrative), `P2_Furniture_<i>_<j>`:** 180 student desk sets, 12 lab benches, 1 desks. The type comes from the room label: AULA gets desks, LABORATORIO gets benches, offices get a desk, and BODEGA, ARCHIVO and LOCKERS get storage. Each kit stays inside its own room (C12): rooms with gaps in their walls are closed progressively, corridors under 2.8 m wide are left out, and furniture within one leaf length of a drawn door is removed.
- **Tags kept out of the walls (C12–C14):** the DWG draws a filled bar next to or under each room name and a 0.25 × 0.54 m frame around each door-type code ("P-7", "P-10"). Both had become wall stubs, the frames often inside a doorway or a corridor. 23 bars and 26 door-type frames are now kept out of `P2_Walls` (`walls_from_lines.py`, `blender_drop_tag_walls.py`).
- **Doorways (C14), `model/tools/data/floor2/doorways.json`:** 27 doorways paired from the DWG jamb marks, each with jambs, width, drawn leaves, two stand points 0.6–1.2 m either side and the room labels visible from each side. 24 of the 24 with both stand points pass the body/head rays through this GLB. Illustrative furniture is kept out of every doorway passage.
- **Floor zones, `P2_Floor_Zones`:** vinyl in labs and classrooms, laminate in offices.
- **Routes:** this floor has no API routes yet, so leaves and furniture were placed without a route-clearance check. When Codex adds paths, rerun `extras.py` with the floor-2 graph to keep them clear (`model/tools/README.md`).

## Not yet in this version

- No signs.
- No API places or paths for this floor (Codex).
- The A/B half-level (26 cm) and the ramps between them are flattened.

See `docs/blocks/vertical-connections.md` for the stairs and elevators that connect this floor with the first floor.

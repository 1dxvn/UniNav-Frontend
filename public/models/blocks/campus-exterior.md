# Campus exterior (Blocks A and B)

`campus-exterior.glb` is the exterior massing of both blocks above the first floor. Use it for the campus overview, the first deliverable of Plan 2 A1. It is **not** a navigable model and has no API references of its own.

## Placement

- **Same frame as `campus.glb`:** plan metres, origin at the Hall Acceso threshold, glTF Y up, plan `(x, y)` → `(x, height, -y)`.
- **Height:** the local height is the DWG level `N`, with N 0.00 being the first-floor slab of Block B, which is local 0 of `campus.glb`.
- **Runtime transform:** use the same one as `campus.glb`, that is scale 1, rotation 0, translation `[0, 3.5, 0]` for API floor 1. That puts both models on the same ground.
- **Floor registration:** the floors are registered to the first floor through the structural grid. See `docs/blocks/dwg-inventory.md` §1.

## Contents

| Object | What it is | Levels (N, m) |
| --- | --- | --- |
| `Ext_A_P2` … `Ext_A_P5` | Block A (north bar) storeys 2–5 | 2.68 / 6.37 / 9.87 / 13.37 → roof 16.87 |
| `Ext_B_P2` … `Ext_B_P5` | Block B (south body) storeys 2–5 | 2.94 / 5.88 / 8.82 / 11.76 → roof 14.70 |
| `Ext_A_Roof`, `Ext_B_Roof` | Roofs and terraces: the part of each storey not covered by the storey above, with parapet and coping | top of each storey |
| `Ext_A_Rooftop` | Glazed rooftop volume from the `PLANTA AZOTEA CANCHAS SINTETICAS` sheet | 17.12 → 20.38 |
| `Ext_A_Courts` | Synthetic courts on the open roof of A, with net posts | 16.90 (+6 m posts) |
| `Ext_A_Stair_Towers` | The two round glass stair towers of A | 2.43 → 18.37 |

How each storey is built:
- **Outline:** each storey is the closing of that floor's cut walls, columns and glass. It is split between A and B at plan y = 47.
- **Glazing:** where the floor's `VIDRIO` lines lie on the outline, the facade becomes a window band. The band has a sill at +0.9 m, a head at -0.45 m from the next level, a 10 cm recess and mullions about every 1.3 m. Everything else is brick.
- **Floor lines:** a concrete band marks each floor level.

## Approximations

- The split between A and B is a straight line at y = 47 (see the inventory). The block identity still needs the user's confirmation.
- **Not from the DWG:**
  - Sill and head heights, parapet height (0.9 m), courts and posts.
  - The radius of the stair glazing: about 3.1 m around the DWG stair arcs (r 1.41 m at (16.42, 59.2) and (37.93, 59.2)).
- The B roof (14.70) assumes one more 2.94 m storey above the fifth floor. A's roof (16.87) and rooftop (20.38) come from the section marks.
- The ground floor (piso cero, N -4.13 / -2.94) is not included. It lies below the plaza level of the model.

## Intended use (for Codex)

- Show it in the overview camera, and hide it, or fade it, while navigating a floor. It sits above the cut first floor (from local 2.43 m up) and would hide the route from above.
- It is not needed for collisions: everything starts above 2.4 m.
- Captures: `docs/model-review/after-c5/blender-exterior-southwest.png` and `blender-exterior-north.png`.
- Visual references: `public/referenciasMaps/` (brick volumes, ribbon windows, glass stair towers, nets on the roof).

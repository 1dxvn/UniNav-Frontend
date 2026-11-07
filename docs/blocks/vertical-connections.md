# Vertical connections between floor 1 and floor 2

Prepared by Claude for Plan 1 H2. The positions are in first-floor plan coordinates (metres), the same frame on both floors because the floor sheets are registered on the structural grid.

## Elevators (shared core, Block A side of the junction)

The shafts are at x 23.5–25.5 (elevator 2) and 25.8–27.8 (elevator 1), y 53.6–56.0. They are in the same position on every floor (`docs/blocks/dwg-inventory.md` §5). The doors open south to the hall of elevators.

| Elevator | Stand point in front of the door | Notes |
| --- | --- | --- |
| Elevator 2 (west) | (24.6, 53.2) | Opening in the south wall at x ≈ 24.6 |
| Elevator 1 (east) | (26.8, 53.2) | Opening in the south wall at x ≈ 26.8 |

Suggested graph:
- Edges: floor-1 stand point → floor-2 stand point, with the same (x, y).
- Kind: `elevator`.
- The floor-1 hall node "Elevator and Restroom Hall" (25.77, 51.97) is 1.3 m away and in sight of both doors.

## Block A U-stairs (inside the round glass towers)

Both stairs were measured on the first-floor sheet:
- **Flight 1:** steps 1–10 rise northwards, y 56.2 → 59.2 with 0.30 m treads.
- **Landing:** a semicircular landing to the north.
- **Flight 2:** steps 11–20 return southwards. They are drawn as projection on floor 1 and arrive on floor 2.

| Stair | Flight 1 (x) | Flight 2 (x) | Landing centre / radius | Bottom (floor 1) | Landing point | Top (floor 2) |
| --- | --- | --- | --- | --- | --- | --- |
| A west | 13.6–15.7 | 17.0–19.1 (above a small room, LOCAL 5.2 m²) | (16.35, 59.2) / 2.75 | (14.65, 55.9) | (16.35, 60.0) at +1.54 | (18.05, 55.9) |
| A east | 35.3–37.4 | 37.6–39.8 | (37.55, 59.2) / 2.25 | (36.35, 55.9) | (37.55, 60.0) at +1.54 | (38.70, 55.9) |

- **Rise in the model:** 2.94 m over 21 risers (0.14 m), the recommended model-to-model offset between floors 1 and 2.
- **Real rise in Block A:** N -0.63 → N +2.68 = 3.31 m. The first-floor model flattens A at 0.00.
- **Suggested graph per stair:**
  - Two edges of kind `stairs`: bottom (floor 1) → landing, then landing → top (floor 2).
  - Waypoints at the foot and head of each flight keep the avatar on the treads, from (x, 56.2) to (x, 59.2) along the flight centre line.
  - The first-floor north circulation (y ≈ 54.4–54.7) passes 1.2–1.5 m south of the stair feet. Connect each bottom point to that corridor with a short edge.

## Block B first-floor stair (measured at 03:45): it lies on an API route

Measured on the first-floor sheet: a U-stair at x 36.4–39.2, y 32.1–36.1.

| Part | Geometry | Level |
| --- | --- | --- |
| North flight, steps 1–6 | y 34.0–36.0, numbered from x 38.2 westwards to 36.6 (arrow ←) | N -0.90 at step 1 (38.7, 35.3) |
| West landing | x ≈ 35.9–36.4, open to the B corridor | N 0.00 (35.9, 34.7), the same as the B corridor |
| South flight, steps 7–15 | y 32.1–34.0, numbered from x 36.5 eastwards to 39.0 (arrow →) | N +1.19 at the top (39.5, 33.5) |

So the corridor (N 0.00) meets the landing:
- One flight goes **down** to N -0.90, to the north-east (6 risers of ~0.15 m).
- The other goes **up** to N +1.19, eastwards (9 risers of ~0.13 m), towards the laboratory side where `Laboratory corridor west` (41.5, 33.5) is.

Next to it, a ramp hatch (x 36.2–41.8, y 36.3–40.0, `Ramps_Stairs` in the model) is probably the accessible link between those levels. Its direction is **to be confirmed**.

**Consequence for the graph (for Codex, not changed by Claude):**
- The edge `South circulation (21.5, 33.5) → Laboratory corridor west (41.5, 33.5)` runs along y = 33.5. Between x 36.5 and 39.0 that is **on the south flight** (steps 7–15).
- The real route to the Morphology Laboratory therefore climbs 9 steps, from N 0.00 to N +1.19. Today it is typed `corridor` and is offered with "Avoid stairs".
- **Suggested:**
  - Split that edge at the landing (≈ 36.0, 33.1) and at the top of the flight (≈ 39.4, 33.1).
  - Type the middle part `stairs`.
  - Add a ramp alternative once its direction is confirmed.
- The first-floor model keeps a flat slab there, and Claude did not add steps. Solid treads up to 1.19 m would block the current flat walk at y 33.5. Treads can be added, for example in a candidate, once the graph is split and the runtime handles height along a `stairs` edge.

The upper levels of this stair: floor 2 (B) is at N +2.94, with a half landing at N +1.70 (43.2, 35.3, floor 2 sheet).

## Model delivery state

| File | Content | State |
| --- | --- | --- |
| `model/candidates/campus-c4-stairs.glb` | First-floor model (C2) plus `Stair_A_West` and `Stair_A_East` | **Candidate**. Not served. Codex integrates it by copying it to `public/models/campus.glb` and updating `campus-manifest.json` after review |
| `public/models/floor-2/campus.glb` | Second-floor cut model, first version | New. Not in the manifest |
| `public/models/blocks/campus-exterior.glb` | Exterior massing (overview) | New. Not in the manifest |

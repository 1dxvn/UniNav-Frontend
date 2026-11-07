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

Next to it, a ramp hatch (x 36.2–41.8, y 36.3–40.0, `Ramps_Stairs` in the model) is probably the accessible link between those levels. Its direction is **to be confirmed**. *(Revised at 09:08: it does not reach N +1.19. See "First-floor level changes" below.)*

**Consequence for the graph (for Codex, not changed by Claude):**
- The edge `South circulation (21.5, 33.5) → Laboratory corridor west (41.5, 33.5)` runs along y = 33.5. Between x 36.5 and 39.0 that is **on the south flight** (steps 7–15).
- The real route to the Morphology Laboratory therefore climbs 9 steps, from N 0.00 to N +1.19. Today it is typed `corridor` and is offered with "Avoid stairs".
- **Suggested:**
  - Split that edge at the landing (≈ 36.0, 33.1) and at the top of the flight (≈ 39.4, 33.1).
  - Type the middle part `stairs`.
  - Add a ramp alternative once its direction is confirmed.
- The first-floor model keeps a flat slab there, and Claude did not add steps. Solid treads up to 1.19 m would block the current flat walk at y 33.5. Treads can be added, for example in a candidate, once the graph is split and the runtime handles height along a `stairs` edge.

The upper levels of this stair: floor 2 (B) is at N +2.94, with a half landing at N +1.70 (43.2, 35.3, floor 2 sheet).

## First-floor level changes on the API routes (measured at 09:08)

These facts come from the first-floor sheet, in first-floor plan metres. They list every level label and stair on it. The first-floor model is flat (Blocks A and B both at 0.00), so none of these level changes is modelled yet.

**Level labels on the sheet:**

| Level | Where |
| --- | --- |
| N +1.19 | (39.48, 33.51): top of the Block B stair, laboratory side |
| N +0.00 | (26.09, 34.08) Block B corridor; (35.94, 34.66) Block B stair landing; (28.23, 47.71) hall corridor, south of the hall steps |
| N −0.63 | (28.08, 50.16) elevator hall, north of the hall steps; (36.59, 55.72) north circulation; (14.77, 56.15) at the west stair tower |
| N −0.90 | (38.67, 35.32): foot of the Block B stair, north-east |

**1. Hall steps, between the hall corridor (N 0.00) and the elevator hall (N −0.63).**
- A strip x 27.3–29.8, y 47.85–49.15 (`3.20 M2` on the sheet) has three numbered treads (1–3 at y 48.08, 48.55 and 48.97) and an "S" arrow. The levels on either side give 0.63 m in total, going down northwards.
- API edges that cross it:
  - `Hall corridor north (28.0, 48.0) → Elevator and Restroom Hall (25.77, 51.97)`: 1.32 m inside the strip. The node `Hall corridor north` itself stands on the first tread.
  - `Hall corridor south → Hall corridor north`: its last 0.15 m.
- Consequence: every route from Hall Acceso to Block A goes down these steps. That covers the elevator hall, the north circulation, the Preclinic and the stair towers. On this sheet no other passage joins the hall corridor to the elevator hall.
- West of the strip, a second stair (risers 7–14, x 22.0–25.3, y 47.6–49.2, "S" westwards) is on no API edge. Its risers 1–6 are not on this sheet.

**2. Block B stair, three levels.**
- The numbering runs continuously, 1 to 15:
  - Steps 1–6 rise westwards from N −0.90, at the north-east foot (38.7, 35.3), to the N 0.00 landing (35.9, 34.7). The landing opens onto the Block B corridor.
  - Steps 7–15 rise eastwards to N +1.19, at (39.5, 33.5).
- North of the stair, a hatched hall (`76.30m2`, x 36.3–42.7, y 36–49, divided lengthwise by a central handrail) runs from the stair foot (N −0.90) to the north circulation (N −0.63). That is 0.27 m over about 13 m. The dense hatch suggests a gentle slope of about 2 %, but no level is written inside it.
- It is therefore a route between Block B and Block A, but with 6 steps: B corridor (N 0.00) → down steps 6–1 → hall (N −0.90 → N −0.63) → north circulation.
- The polygon south-east of the stair (x 36.6–43.5, y 18.8–31.9) is a roof (`CUBIERTA`, `60.20 M2`), not a ramp. No text on the first-floor sheet says ramp (`RAMPA`) or gives a slope. The level N +1.19 (laboratory side, Morphology Laboratory) is reached only by steps 7–15 on this sheet.

**3. Consequences for the graph (Codex decides):**
- **Step-free:** on this sheet, the destinations in Block A (elevators, Preclinic) and the Morphology Laboratory are reached only over steps. Unless an entrance not drawn here exists, they should not be offered as step-free from Hall Acceso.
- **Hall steps:** they could become a short `stairs` edge, from about (28.0, 47.6) on N 0.00 to about (28.0, 49.4) on N −0.63, with `Hall corridor north` moved off the tread.
- **Block B stair:** the split suggested above still applies.
- **Real levels:** if the first-floor model gets real levels (B at 0.00, A at −0.63, the three Block B levels and the sloped hall), every Block A waypoint height changes by −0.63 m. Claude can prepare that as a candidate model when the graph is ready for it.

## Stairs on the other floors (C10)

The glass stair towers run through the whole of Block A, and the floor sheets are registered on the same structural grid, so the same U-stairs repeat.

| Floor model | Stairs | Rise to the next model |
| --- | --- | --- |
| `floor-0/campus.glb` | `P0_Stair_A_East` only (the west tower is outside the piso cero plan) | 2.94 m → floor 1 |
| `floor-2/campus.glb` | `P2_Stair_A_West`, `P2_Stair_A_East` | 2.94 m → floor 3 |
| `floor-3/campus.glb` | `P3_Stair_A_West`, `P3_Stair_A_East` | 2.94 m → floor 4 |
| `floor-4/campus.glb` | `P4_Stair_A_West`, `P4_Stair_A_East` | 2.94 m → floor 5 |
| `floor-5/campus.glb` | none (the towers continue to the rooftop courts; no rooftop model yet) | |

- **Floor 1:** the stairs are in the candidate `model/candidates/campus-c4-stairs.glb`.
- **Points:** bottom, landing and top are the same (x, y) on every floor. The bottom is on floor N and the top on floor N+1.
- **Rise:** 2.94 m is the model-to-model offset, the Block B storey. The real Block A storeys are 3.31 / 3.69 / 3.50 / 3.50 m (`docs/blocks/dwg-inventory.md` §4).
- **Assumption:** the same flight layout on every floor is an approximation. Only the first-floor flights were measured.

## Stair clearance fixes after Codex's C11 probe (04:25)

Codex's probe (`docs/verification/c11/stair-clearance.json`) walked the floor 1 → 2 stairs and found three issues. All are fixed in every floor model:

| Finding | Cause | Fix |
| --- | --- | --- |
| Overhead blocker at 1.8 m on the first flight (`P2_Stair_A_*`) | The upper floor's first flight was modelled as solid blocks down to its slab, directly above the lower first flight. That left about 1.5 m of headroom at the top step | First-flight treads now sit on a sloped soffit (0.45 m below each tread), like the second flight. Headroom over the flight below is about 2.5 m |
| Torso blockers at 0.45 m on the west second flight (`Walls`, floor 1) | The walls of the small room under the west flight 2 (LOCAL 5.2 m²) were cut at 2.80 m and pierced the flight | Those walls are cut above 1.0 m inside the flight footprint (x 16.95–19.15, y 56.2–59.25) |
| Torso blocker at the east stair exit on floor 2 (`P2_Walls`) | The stair-hall wall at y ≈ 56 was continuous on the upper floors | That wall is opened in front of every flight, x per flight ± 0.05 and y 55.35–56.65, on floors 0 and 2–5 |
| Support conflicts at y 56.69–56.74 (`P2_Floor_Slab` 0.16–0.18 m above the probe) | The slab strip kept over the stair top was 0.6 m deep and covered the second-to-last tread | The strip is now 0.3 m: only the top tread, at slab level. The well starts at y 56.5 |

Claude's matching probe follows the same path from bottom to landing to top, with rays at 0.45, 1.2 and 1.8 m, offsets ±0.22 m, against both floor models, and checks for slab above the tread. It reports **all 9 stair passes clear** (floor 0 → 1 east, and floors 1 → 2 through 4 → 5 west and east). The floor-1 API routes are still clear: 16 edges, 0 blocked, 1.84 ms per check. The first-floor working export is SHA `93a1ad69…`. Codex already serves the previous stairs export `41e225fe…`, so this one is pending review.

## Model delivery state

| File | Content | State |
| --- | --- | --- |
| `model/candidates/campus-c4-stairs.glb` | First-floor model (C2) plus `Stair_A_West` and `Stair_A_East` | **Candidate**. Not served. Codex integrates it by copying it to `public/models/campus.glb` and updating `campus-manifest.json` after review |
| `public/models/floor-2/campus.glb` | Second-floor cut model, first version | New. Not in the manifest |
| `public/models/blocks/campus-exterior.glb` | Exterior massing (overview) | New. Not in the manifest |

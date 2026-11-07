# Piso cero navigation (C18)

Prepared from Codex's request `docs/blocks/floor0-candidate-request.md`. Codex was out of quota, so Claude completed this integration at the user's request.

## Sources

| Source | Commit |
| --- | --- |
| Floor-0 GLB and its floor-1 companion (opened ground slab) | `model/candidates/c18/` @711fb9d |
| Floor-0 and floor-1 level configuration | `model/tools/real_levels_c18.json` @711fb9d |
| Sources and statuses | `docs/blocks/level-zones.md` @de3815e and e3c18dc |
| Doorways and literal labels | `model/tools/data/floor0/doorways.json` and `wing.json` @389cfd9 |
| Structural reference | `public/models/floor-0/campus-reference.json` @389cfd9, SHA `555607e8…` |

## Scope `ucc:floor0-connection` / `c18-floor-zero-v1`

The backend file is `data/datasets/ucc-floor-zero.json`: 40 places and 37 connections.

| Part | Content |
| --- | --- |
| East tower 0 → 1 | 25 points: the reviewed floor 1–2 east stair plan points (centre lines x 36.35 / 38.7, landing (37.55, 60)), with 21 risers rescaled to 3.50 m. They run from the foot (36.35, 55.9) at world −0.63 to (38.7, 55.9) on floor 1 at world 2.87. Floor-0 metadata is kept until the upper endpoint, which joins the existing floor-1 north junction (36.35, 54.45) |
| Block A circulation | Foot → (33.0, 53.0) → elevator lobby (26.4, 52.8), a waypoint and not a destination. Foot → (39.95, 54.6) → corridor junction (39.95, 52.0) |
| Clinical Simulation Laboratory | Junction → (47.584, 52.0) → D32 corridor stand (47.584, 52.55) → D32 centre (47.584, 53.15) → inside stand (47.584, 53.75), the destination. D32 is 1.571 m wide with `through: clear`; the inside side sees the label `LABORATORIO DE SIMULACIÓN CLÍNICA` |
| Waiting room | Junction → (39.95, 50.0) → facade sliding door (40.0, 49.085) → (40.05, 48.2) → room (39.5, 45.5), the destination, labelled `SALA DE ESPERA`. The drawn door has two sliding leaves (x 40.55–42.41) over the opening x 39.66–40.55 |
| Anchors | `P0_REF_1/2/3` at world 0.56 (the B datum), type `reference`, isolated |

Every floor-0 walking place is at world −0.63:
- In Block A, the level is confirmed at the east tower.
- In the east clinic, it is confirmed at (39.21, 35.15) and (48.48, 39.70); the extent around them is derived.

Avoiding stairs rejects travel between floor 0 and the other floors. The elevators are not modelled as operating stops.

## Audit (`tools/prepare-floor0.ts`)

The audit loads C18 floors 0/1, C17 floor 2 and C16 floors 3/4/5 at their world datums and walks all 139 connections of the combined graph in both directions (278 runs). It uses `supportedStep` (0.12 m footprint, 0.20 m maximum step) and `modelCollision` (body rays at 0.45, 1.2 and 1.8 m, ±0.22 m) against every mesh of all six floors.

| Check | Result |
| --- | --- |
| 278 directed runs | 0 blocked, 0 unsupported |
| Destination labels | Both visible from their stands at 1.2 m |
| Reference alignment | 3 anchors aligned to the API |
| Negative control: flat C14 floor-0 preview | All 35 floor-0 connections lack support at world −0.63 |

**Finding.** The C16 floor-1 `Site` ground slab passes under the whole building, including the east tower shaft (world 2.52–2.72), and blocked the rising flight. The C18 floor-1 companion opens it under the floor-slab well. Its other 140 meshes are identical to C16.

Evidence: `docs/verification/floor0/`.

## Still pending

- **B stair:** the north flight has 6 or 7 risers; the south flight leads to the floor-1 N −0.90 zone, which is still pending.
- **West stair** and its landing.
- **South-west ramp top.**
- **East-yard steps.**
- **Southern rooms** and the boundary between y 36 and 47.6.
- **Elevator operation.**
- **East tower layout:** the drawing shows 20 risers, with flight 2 at x 38.17–40.52. The C10–C18 towers use 21 risers, with flight 2 at x 37.6–39.8. See `model/candidates/c18/README.md`.

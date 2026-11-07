# Floors 4 and 5 navigation (Block A, C16)

Completed by Claude at the user's request ("termina todo lo que falta") while Codex was out of quota. It follows Codex's floor-3 procedure (`tools/prepare-floor3.ts`).

- **Scope:** `ucc:floor45-connection` / `c16-floors-4-5-v1`. The backend file is `data/datasets/ucc-floors-4-5.json`: 85 places and 79 connections.
- **Tool:** `tools/prepare-floor45.ts`.
- **API references:** `public/models/c16/floor-4-navigation-reference.json` and `floor-5-navigation-reference.json`, built from the structural references @389cfd9 with their hashes checked.

| Part | Content |
| --- | --- |
| East tower 3 → 4 | From the floor-3 north corridor (38.7, 54.7), through an approach at (36.35, 54.7), over 25 points: the reviewed plan points, 21 risers, world 9.87 → 13.37. Floor-3 metadata until the upper endpoint (38.7, 55.9) |
| Floor 4 | North circulation hub at (38.95, 54.7). A drawn partition (x 38.03–38.50, y 53.46–55.68) closes the corridor west of the arrival, so the 4–5 foot is reached north of it: (38.7, 55.95) → (36.35, 55.95). Classrooms 420 A (D27), 421 A (D26) and 422 A (D28) |
| East tower 4 → 5 | 25 points, world 13.37 → 16.87 |
| Floor 5 | Hub at (38.7, 54.7). Classrooms 512 A (D18), 513 A (D19) and 515 A (D11) |
| Destinations | The inside stand of each inventory doorway (`through: clear`) whose inside side sees the literal `AULA …` label, with line of sight checked against the GLB at 1.2 m |
| Anchors | `P4_REF_*` at world 12.32 and `P5_REF_*` at 15.26, isolated |

## Audit

All 218 connections of the combined graph are walked in both directions (436 runs) against C18 floors 0/1, C17 floor 2 and C16 floors 3/4/5:
- 0 blocked and 0 unsupported;
- all six labels visible;
- the six anchors aligned to the API.

Evidence: `docs/verification/floor45/`.

## Still pending

The A/B junctions of floors 4 and 5, the western rooms of both floors, the remaining classrooms and offices, and the rooftop.

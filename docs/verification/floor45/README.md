# Floors 4 and 5 (Block A, C16): integration evidence

Prepared by Claude at the user's request while Codex was out of quota, following Codex's floor-3 procedure.

| File | Content |
| --- | --- |
| `dataset-candidate.json`, `floor-{4,5}-navigation-reference.json` | Output of `tools/prepare-floor45.ts`, identical to `../data/datasets/ucc-floors-4-5.json` and `public/models/c16/floor-{4,5}-navigation-reference.json` |
| `geometry.json` | Sources and hashes, the six destinations with their doorways and label visibility, six anchor errors, and 436 directed runs (0 failed) against C18 floors 0/1, C17 floor 2 and C16 floors 3/4/5 |
| `classroom-*-walks.json`, `*.png` | `tests/e2e/floor45.spec.ts`, guided outbound and return trips from Hall Acceso to Classrooms 420 A, 421 A, 422 A, 512 A, 513 A and 515 A. They use the production launcher (`--profile ucc-six-floors-c18`) on an isolated database with the shipped manifest. Final error under 2 mm, no blocked state, no page errors |
| `assets.json` | The 56 pinned resources of all eight profiles, served and hash-checked |
| `wrong-model.json` | The C16 floor-5 GLB served at the floor-4 URL is rejected, movement stays blocked, and a reload recovers |

**Other results:**
- Backend: 237 tests pass in the working tree, including `tests/api/test_ucc_floors_4_5.py`, and 228 pass on the clean publish branch.
- Frontend: typecheck and build pass.

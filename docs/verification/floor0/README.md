# Floor 0 (piso cero, C18): integration evidence

Prepared by Claude at the user's request while Codex was out of quota. It follows Codex's floor-3 procedure.

| File | Content |
| --- | --- |
| `dataset-candidate.json`, `navigation-reference.json` | Output of `tools/prepare-floor0.ts`, identical to `../data/datasets/ucc-floor-zero.json` and `public/models/c18/floor-0-navigation-reference.json` |
| `geometry.json` | Sources and hashes, destinations with label visibility, anchor errors, 278 directed runs (0 failed), and the flat C14 negative control (35 of 35 floor-0 connections rejected) |
| `*-walks.json`, `*.png` | `tests/e2e/floor0.spec.ts`, guided outbound and return trips from Hall Acceso (`ucc:floor1:p01`) to the Clinical Simulation Laboratory and the waiting room. They use the production launcher (`scripts.run_campus --profile ucc-four-floors-c18`) on an isolated database with the shipped manifest. Final error 0 m, no blocked state, no page errors; 245–266 sampled positions per walk |
| `assets.json` | The 49 pinned resources of all seven profiles, served and hash-checked |
| `wrong-model.json` | The flat C14 floor-0 GLB served at the C18 URL is rejected ("Model export changed"), movement stays blocked, and a reload recovers |

**Other results:**
- Backend: 226 tests pass, including `tests/api/test_ucc_floor_zero.py`.
- Frontend: typecheck and build pass, and 51 unit tests pass.
- One floor-3 round trip passes as a regression check of the older profiles; its evidence is not stored here.
- The real 19/16 database and the user's services on 8000/8001 were not touched.

**Reproduce:**

```powershell
node --experimental-strip-types tools/prepare-floor0.ts
node --experimental-strip-types tools/prepare-floor0-profile.ts   # only to rebuild the manifest entry
npx playwright test tests/e2e/floor0.spec.ts
```

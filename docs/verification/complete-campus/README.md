# Complete campus: startup regression of every profile

`tests/e2e/campus-startup.spec.ts` covers all eight reviewed startup profiles. The two new ones are `ucc-four-floors-c18` (150/139) and `ucc-six-floors-c18` (235/218).

Each profile runs through the production launcher (`scripts.run_campus --profile …`) on an isolated database. The test checks:
- the place and connection counts;
- `/health`, `/docs`, `/openapi.json` and `/app/`;
- that the browser selects the profile and reports 3 aligned references;
- routes from Hall Acceso to that profile's reviewed destinations and back, with A* and Dijkstra, ending at the destination's elevation.

**Result:** 8 passed (46 s). Contracts and screenshots per profile are in this folder.

Run with `UNINAV_EVIDENCE_DIR=docs/verification/complete-campus npx playwright test tests/e2e/campus-startup.spec.ts`.

# One-minute demo and final checks

## Start from a clean launch

From the frontend: `npm ci` then `npm run build`. From the backend:
`venv/Scripts/python.exe -m scripts.run_campus --port 8001` (or use `python`).
Open <http://127.0.0.1:8001/>. Sign in: `student` / `demo1234`.
The real floor uses its own `uninav-campus.db`; the original sample is unchanged.

## One minute

1. **0–10 sec:** Show the campus exterior in the initial **Campus** view. Drag to
   orbit and scroll to zoom. Switch to **3D floor** to inspect the first-floor
   cutaway; its green badge confirms three aligned references.
2. **10–20 sec:** Select Hall Acceso as the start. Search ICETEX, select it, enable
   Avoid stairs, and find the route. Show its corners in top view.
3. **20–40 sec:** Start walking. Pause once and resume. The avatar crosses the
   courtyard, enters the south corridor, and uses the ICETEX opening. Wait for the
   arrival message; the final world position is `(24.55, 3.5, -41.78)`.
4. **40–50 sec:** Reset the start and choose Morphology Laboratory. Show that the
   route uses the east corridor and doorway rather than cutting across the rooms.
5. **50–60 sec:** Cancel, click the map and try W/A/S/D (or arrows). Movement stops
   at the walkable boundary and model walls. Select Preclinic and preview its route
   through the north circulation and storeroom. Allow extra time to walk all
   102.4 m and return to Hall Acceso.

Changing the start point intentionally places the avatar there. Keyboard movement
or Esc cancels guidance without resetting the avatar. A new route after walking
continues along the current graph edge before following the API response.

## Verification evidence

- `verification/c5/`: current exterior overview, resource fallback/recovery,
  floor restoration, frame cadence, load timings, heap estimate and round trips.
- `verification/c2/`: latest interior-model rehearsal, comparable general/top
  views before and after the runtime presentation changes, and GPU frame cadence.
  The earlier `verification/h0/` evidence below records C1 and is kept intact.
- `verification/h0/revision.json`: exact GLB SHA-256, API URL and catalogue counts.
- `verification/h0/*-top.png`, `*-3d.png`, `*-arrival.png`: current model and routes.
- `verification/h0/model-alignment.json`: references, wall clearance and collision
  rays across all 16 edges in both directions, including furniture and doors.
- `verification/h0/walk-*.json`: real API responses and measured avatar positions
  to all four destinations and back, with no blocked state and arrival checks.
- `verification/sample-first-route.png`: earlier sample-campus integration check.

Run `npm test` for graph and calibration guards. With the real backend running,
set `UNINAV_TEST_URL=http://127.0.0.1:8001`, choose a revision-specific
`UNINAV_EVIDENCE_DIR` (for example `docs/verification/c2`), and run
`npm run test:e2e`. This preserves earlier revision snapshots.
`node --experimental-strip-types tools/verify-model.ts` rechecks the actual GLB
against the running API. The offline graph-drafting tool is never imported by the app;
runtime paths always come from FastAPI. For H0 reports, set
`UNINAV_VERIFY_DIR=docs/verification/h0`. Set `UNINAV_MODEL_ROOT=dist/models`
to check the reviewed deployed model. Node tools inspect geometry using empty
texture placeholders; the browser loads and renders the original embedded images.
The tools verify the exported/served hash before checking the geometry.
Use the same directory in `UNINAV_VERIFY_DIR` for a later revision.

Playwright defaults to software rendering for portable functional tests. Set
`UNINAV_RENDERER=hardware` to use the local GPU, and `UNINAV_REQUIRE_FPS=1` to
require at least 30 FPS in the presentation test. That test records the actual
renderer, viewport and measured frame intervals in `after-performance.json`.
`tools/benchmark-collisions.ts` compares the original body rays with the current
bounds filter on samples from the actual model and graph.

The no-route browser check uses `tests/serve_campus.py` from the backend in a new
temporary database and on an OS-assigned free port. Its synthetic isolated
destination is not part of the real campus. It checks recovery to Preclinic's
successful route before testing an expired session. No service already running
on ports 8000 or 8001 is stopped or replaced.

## Keep these limits clear

Campus view adds the documented exterior massing; the upper volumes do not add
navigable floors or rooms. Their block assignments and facade approximations
retain the source document's evidence status. Choose a destination or open a
floor to inspect; Campus view preserves the avatar's position. Floors 0/2/3/4/5
are previews only. Movement remains on the reviewed first floor.

One real floor, four connected destinations. Preclinic's access is documented and
connected; this is not yet a complete inventory of every room in B.
Vertical dimensions and plaza levels are approximate, as recorded by Claude.
The plan's +Y axis is not geographic north. Avoid stairs filters the graph; it
does not certify physical accessibility. Further navigable floors and application
functions remain pending in the three plans. All model geometry remains Claude's work.

# One-minute demo and final checks

## Start from a clean launch

From the frontend: `npm ci` then `npm run build`. From the backend:
`venv/Scripts/python.exe -m scripts.run_campus --port 8001` (or use `python`).
Open <http://127.0.0.1:8001/>. Sign in: `student` / `demo1234`.
The real floor uses its own `uninav-campus.db`; the original sample is unchanged.

## One minute

1. **0–10 sec:** Show the UCC first-floor cutaway. The green model badge confirms
   three aligned references. Drag to orbit, scroll to zoom; reset fits the model.
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

- `verification/h0/revision.json`: exact GLB SHA-256, API URL and catalogue counts.
- `verification/h0/*-top.png`, `*-3d.png`, `*-arrival.png`: current model and routes.
- `verification/h0/model-alignment.json`: references, wall clearance and collision
  rays across all 16 edges in both directions, including furniture and doors.
- `verification/h0/walk-*.json`: real API responses and measured avatar positions
  to all four destinations and back, with no blocked state and arrival checks.
- `verification/sample-first-route.png`: earlier sample-campus integration check.

Run `npm test` for graph and calibration guards. With the real backend running,
set `UNINAV_TEST_URL=http://127.0.0.1:8001` and run `npm run test:e2e`.
`node --experimental-strip-types tools/verify-model.ts` rechecks the actual GLB
against the running API. The offline graph-drafting tool is never imported by the app;
runtime paths always come from FastAPI. For H0 reports, set
`UNINAV_VERIFY_DIR=docs/verification/h0`. Node tools inspect geometry using empty
texture placeholders; the browser loads and renders the original embedded images.
The tools verify the exported/served hash before checking the geometry.

The no-route browser check uses `tests/serve_campus.py` from the backend in a new
temporary database and on an OS-assigned free port. Its synthetic isolated
destination is not part of the real campus. It checks recovery to Preclinic's
successful route before testing an expired session. No service already running
on ports 8000 or 8001 is stopped or replaced.

## Keep these limits clear

One real floor, four connected destinations. Preclinic's access is documented and
connected; this is not yet a complete inventory of every room in B.
Vertical dimensions and plaza levels are approximate, as recorded by Claude.
The plan's +Y axis is not geographic north. Avoid stairs filters the graph; it
does not certify physical accessibility. The assistant/chat and other floors are
outside this overnight delivery. All model geometry remains Claude's work.

# UniNav Frontend

A TypeScript / Three.js campus explorer connected to the UniNav FastAPI backend.
The UCC Bloque B first-floor GLB is supplied by Claude; all runtime routes come
from FastAPI. The app supports sign-in and registration, search, floor selection,
step-free graph filtering, keyboard movement, guidance, pause/resume and arrival.

## Start the real-floor demo

Keep this independent repository cloned as `UniNav-Frontend/` inside the backend.
It must be excluded by the backend's `.git/info/exclude`.

```bash
npm ci
npm run build
cd ..
python -m scripts.run_campus --port 8001
# Windows: venv/Scripts/python.exe -m scripts.run_campus --port 8001
```

Open <http://127.0.0.1:8001/>. Sign in with `student` / `demo1234`.
The real floor uses the backend's separate `uninav-campus.db`, seeded idempotently.
`python main.py` still uses the original sample database and port 8000.

Four destinations are connected: ICETEX, Morphology Laboratory, Elevator and
Restroom Hall, and Preclinic / Dentistry Coordination. Preclinic uses the north
circulation and storeroom. See [the one-minute rehearsal](docs/REHEARSAL.md).

## Development

With the real-floor backend running on port 8001:

```powershell
$env:UNINAV_BACKEND_URL = 'http://127.0.0.1:8001'
npm run dev
# Open http://localhost:5173/app/
```

Vite is configured with `base: '/app/'` and proxies all existing API groups.
FastAPI redirects `/` to `/app/` and serves `dist/` on the same origin. The API
and `/docs` still start without a frontend build. The default development proxy
is port 8000; `UNINAV_BACKEND_URL` changes it. `VITE_API_BASE_URL` is only needed
when intentionally building for an API on another origin.

Fonts and the model are local build assets; the browser needs no CDN or map API.
No external service keys are stored in the frontend.
Builds use only the exports reviewed in `public/models/campus-manifest.json`.
Working model changes remain with Claude until integrated. See
[the catalogue and manifest contract](docs/MODEL_MANIFEST.md) for revision checks,
resource lifecycle and preparation of another floor.

## Movement and coordinates

API plan metres `(x, y, floor)` become `(x, floor * 3.5, -y)` with world Y up.
The drawing's +Y is a plan axis, not geographic north. The delivered model is at
local zero and is translated up 3.5 m for API floor 1. Heights remain approximate.

Choose a start point to place the avatar. Click a destination or search for it,
find the route, then start walking. Pause/resume and Cancel are separate actions.
W/A/S/D or arrows take manual control (W = plan +Y); Esc cancels guidance.
Movement stays within graph corridors and model barriers. Calculating from a
mid-edge position connects along that edge, respecting its direction.

The client resolves every returned place and directed edge before drawing it.
It never skips unknown waypoints or rounds corners across walls. The GLB loader
checks three noncollinear references against the live API and actual named GLB
nodes, with a maximum registration error of 0.15 m. A mismatch keeps the labelled
graph preview available. See [model review](docs/campus-review.md) and
[coordinate handoff](docs/campus-handoff.md).

## Validation

Tested with Node 24.19 and Python 3.14 on Windows. Tests are also TypeScript.

```bash
npm run typecheck
npm test
npm run build
```

With the real backend running, set `UNINAV_TEST_URL=http://127.0.0.1:8001` and run
`npm run test:e2e`. Playwright uses an installed Brave on this Windows machine,
`UNINAV_BROWSER` if supplied, or its Chromium (`npx playwright install chromium`).
The sample test runs when the configured API contains the original sample campus.
The no-route and expired-session test starts a separate real FastAPI instance on
an OS-assigned free port, using `../venv/Scripts/python.exe` and the backend's
`tests.serve_campus`. It creates an isolated destination in a temporary database,
then removes its process and files. `UNINAV_TEST_PYTHON` can override the interpreter.
It never inserts test destinations into the running campus or sample database.

Set `UNINAV_EVIDENCE_DIR` to a folder for the model revision under review, such as
`docs/verification/c2`, to preserve older screenshots and walk reports. The
presentation test can use `UNINAV_RENDERER=hardware` and `UNINAV_REQUIRE_FPS=1`
to check the 30 FPS target against the actual GPU. Software rendering remains the
default for functional tests. See [the C2 evidence](docs/verification/c2/README.md).

`node --experimental-strip-types tools/verify-model.ts` checks actual GLB anchors
and clearance for every API edge. `tools/prepare-campus-graph.ts` is an offline
geometry check and graph-drafting aid only; the app never imports it.
Screenshots, the real API response and measured arrival coordinates are in
[`docs/verification/`](docs/verification/).

## Layout

- `src/app.ts`: session, search, route panel, loading and error states.
- `src/api/`: typed FastAPI client; no client pathfinder.
- `src/scene/`: rendering, coordinates, validated navigation and GLB references.
- `public/models/`: GLB, top capture and reference sidecar.
- `model/`: Claude's editable Blender source and plan comparison, outside the build.
- `tests/`, `tools/`: graph guards, browser rehearsal and model verification.

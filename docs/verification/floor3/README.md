# Prepared third-floor navigation on C16

This milestone adds a separate `ucc-three-floors-c16` profile, with 110 places
and 102 bidirectional connections. Only three north-bar laboratory entrances
are added: Informática 1 / 308 A, Informática 2 / 309 A, and Informática 3 /
310 A. Source-backed door stands, the floor-2 corridor handoff and the east
stair connect them to Hall Acceso. Five prior profiles remain exactly unchanged.
No real database import, user-service restart, or Claude source edit occurred.

## Evidence

- `geometry.json`: 204 directed full-graph checks against all five committed
  C16 exports, with footprint support and body/head clearance; no unsupported
  position or blocker. Six architectural rays corroborate the literal CAD
  laboratory/classroom co-labels. Three API reference anchors align at B datum.
- `route-plan.png` / `.svg`: sections through the actual exported architecture,
  source label positions, selected entrances and lower corridor connection.
- `computer-lab-*-walks.json`: six guided arrivals using the production launcher
  on independent temporary databases, with the shipped manifest and no model
  overrides. Final error 0 m, no blocked state or page errors. Models are recorded
  with committed source paths and verified hashes.
- `interaction.json`: manual east stair up/down, pause, keyboard intervention,
  position-preserving replan and two complete floor-view cycles. Read-only
  previews 4/5 cannot move the actor. GPU buffers/textures return to 953/10 after
  each cycle. Local headless Brave / RTX 5060 averages approximately 144 FPS;
  this is one local hardware measurement, not a deployment performance claim.
- `browser-support.json`: independent downward rays validate 1,992 guided,
  267 manual and 67 pause/replan samples (2,326 recorded positions) to 1 mm.
  Automatic floor-2 metadata remains on the high 2-to-3 treads. Free keyboard
  positions are checked against geometry; guided positions are also checked
  against their API centre line. Replan includes its connector from the retained
  manual position to the first API waypoint. No interior hole can borrow Site.
- `compatibility/`: six production startup contracts and 144 route calculations
  across the existing destinations; 42 ready model entries match their hashes.
  Partial third-floor metadata fails closed. Substituting floor 2 at the floor-3
  URL blocks movement; restoring the source and reloading recovers alignment.
- `sample/`: both sample-campus browser cases still pass.
- `prepublication.json` / `backend-commit.json`: verified identity, authentication,
  unchanged foreign/continuity hashes, preserved service responses and real
  19/16 data. The backend publication excludes the local supervisor commit.

Validation: build and full typecheck passed, 42 frontend unit tests, 51 relevant
API cases, eight CLI cases and 15 distinct browser cases passed. The recovery
case initially selected a hidden floor control while in overview; it passed
after the fixture selected 3D floor view. Interaction evidence was separated
before/after replan so manual movement is not falsely compared with a later
API route that starts at another graph node. Neither adjustment changes the app.

## Reproduce

Use the existing virtual environment for backend tests and production rehearsal:

```powershell
venv/Scripts/python.exe -m pytest tests/api/test_ucc_third_floor.py tests/api/test_campus_profiles.py tests/api/test_c15.py tests/unit/test_campus_launcher.py -q
venv/Scripts/python.exe -m pytest tests/api/test_ucc_floor.py tests/api/test_ucc_second_floor.py tests/api/test_datasets.py -q
```

In the frontend:

```powershell
node --experimental-strip-types tools/prepare-floor3.ts
node --experimental-strip-types tools/prepare-floor3-profile.ts
npm run build
npm test
$env:UNINAV_RENDERER = 'hardware'
$env:UNINAV_REQUIRE_FPS = '1'
npx playwright test tests/e2e/floor3.spec.ts
node --experimental-strip-types tools/verify-floor3-playback.ts
```

The profile tool uses a disposable API serialization snapshot. Browser fixtures
reserve their own OS-assigned ports and stop only their own process trees. The
offline audit does not export data unless `--export-dataset` is specified.

## Remaining work

The normal 8001 service and `uninav-campus.db` remain at the historical 19/16
contract. Public activation requires a matching service and reviewed backup;
do not import behind the running legacy process. Floor 3's other rooms and
Block B areas remain unreviewed; 0/4/5 are still previews. Physical B laboratory,
western/sloped zones and upper A/B junctions are pending. C17's floor-2 ramp
and the piso-cero source handoff were received during this milestone and need
separate review. The avatar and broader application features also remain
pending. This delivery does not finish H2 or the three plans.

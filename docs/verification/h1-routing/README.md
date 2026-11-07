# H1 routing and versioned datasets · 7 November 2026

This milestone adds stable place/connection codes, an ID-based backend graph,
explicit route waypoints and a scoped, atomic dataset importer. Existing names
remain compatibility aliases; human `display_name` labels may repeat. The frontend
validates IDs, positions, elevations and directed connections before moving. Its
legacy route fallback continues to support the already-running real-campus API.

Backend implementation: `15f467c`. Contract and import instructions:
`UniNav/docs/CAMPUS_DATASETS.md`.
No physical upper-floor places, block assignments or vertical connections were
invented. The C2 floor remains flat at 3.5 m, with provisional model provenance.

| Check | Result |
| --- | --- |
| Build / typecheck | Passed |
| Frontend unit tests | 19 passed |
| Full API suite | 87 passed in 73.02 s |
| Campus / temporary API browser suite | 17 passed in 4.6 min; sample skipped on this URL |
| Original sample-campus rehearsal on port 8000 | 1 passed in 23.5 s |
| Final UI changes: mobile, route planning, structured API walk | 3 passed in 25.2 s |
| Four destinations, outbound and return | 8 arrivals, 1,591 samples, no blocked state |
| Maximum final error | 0 m |
| Maximum route centre-line deviation | 0.000653 m (rounded up) |
| New API walk using IDs/codes and explicit positions | ICETEX arrival, final error 0 m |
| C2 body-ray geometry checks | 32 directed edges clear; minimum wall clearance 0.35596 m |
| Exterior | 0 navigation colliders; reviewed C5 hash unchanged |

`database-adoption.json` records the real database adoption: a SQLite backup was
taken first; all 19 place IDs, legacy fields, 16 path IDs/fields and prior history
IDs were retained. Two seed runs created zero places and zero paths. The revision
ledger and explicit C2 metadata were added. No user process was stopped/restarted.
The backup remains local under `UniNav/backups/` and is excluded from Git.

`services.json` verifies 200 responses from API health, `/app/`, Swagger and OpenAPI
on both existing ports, and absence of the synthetic isolated destination. The
sample service's existing reload mechanism has picked up the new contract; the
real-campus process on 8001 retains its loaded legacy contract until its normal
restart. The new API was exercised by pytest and real FastAPI/Brave fixtures on
OS-assigned temporary ports, with their own disposable databases and cleanup.

`walk-*.json` and arrival/top/3D captures cover the eight existing C2 walks.
`structured-route.json` and `final-ui/structured-route.json` contain the new API
waypoint/step identities. `final-ui/structured-arrival.png` shows the final UI.
Earlier overall captures precede the final wording change to the stairs filter.
The source GLB remains SHA-256
`d65846a8b614062d63e60a339da6e9c9ce29e8ffae2d01a90fbd16611e6a356e`.

The overview still measures about 144 FPS (7 ms p95 frame interval), with 137 C2
collision meshes, on the local RTX 5060 / ANGLE Direct3D11 in headless Brave at
1440 × 1000. See `overview-metrics.json` and `after-performance.json`. These observations
do not measure GPU memory or guarantee performance on another device.

## Source discrepancy and next integration

Claude's new `34992dc` documents a B stair beneath the existing laboratory
approach: nine steps from N 0.00 to +1.19 m. The reviewed C2 geometry and dataset
still flatten that region. The nearby ramp direction is unconfirmed. Resolving
this needs matching stair/landing geometry and revised waypoints, not a guessed
height or ramp. The filter now says **Based on mapped paths** and **Mapped stairs
excluded**, replacing the previous physical-accessibility claims.

Floor 2 still documents no slab opening above its stairs and a flattened A/B
half-level. Further floor exports arrived in `2a3195a`; they remain outside the
manifest pending review. C8's floor-2 furniture/door update `8ba6141` also arrived
during this milestone and requires review. These issues, physical block identification and later
application functions remain open. The three plans are not complete.

## Reproduce

```powershell
venv/Scripts/python.exe -m pytest tests/api --basetemp "$env:TEMP/uninav-h1-release-<unique>" -q
# From UniNav-Frontend:
npm run build
npm test
$env:UNINAV_TEST_URL = 'http://127.0.0.1:8001'
$env:UNINAV_RENDERER = 'hardware'
$env:UNINAV_REQUIRE_FPS = '1'
$env:UNINAV_EVIDENCE_DIR = 'docs/verification/h1-routing'
npm run test:e2e
$env:UNINAV_MODEL_ROOT = 'dist/models'
$env:UNINAV_VERIFY_DIR = 'docs/verification/h1-routing'
node --experimental-strip-types tools/verify-model.ts
node --experimental-strip-types tools/verify-overview.ts
```

For the sample test, use port 8000 and `--grep 'sample API'`, with a separate
evidence/output directory. An automatic policy review rejected removal of the
temporary `test-results-sample-h1/` directory; it was retained outside commits.

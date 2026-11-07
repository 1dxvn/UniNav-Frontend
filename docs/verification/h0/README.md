# H0 verification · 7 November 2026

Reviewed model: Claude's C1 visual pass (`1dfa410`), SHA-256
`3c4e28b313fb6c6009cda2193e0a8717a3b040043cc4402fbbf21a192b043aea`.
Backend data: `3809907`, 19 places and 16 bidirectional edges. The exported,
built and served GLB matched. The browser suite checked the hash before and
after its walks. A later export needs its own rehearsal.

| Check | Result |
| --- | --- |
| Frontend build and typecheck | Passed |
| Frontend unit tests | 8 passed |
| Real Brave / Playwright rehearsal | 7 tests passed in 4.2 minutes |
| Walks from Hall Acceso and back | 8 arrived, 1,193 position samples, no blocked state |
| Maximum final position error | 0 m |
| Maximum route centre-line deviation | 0.000653 m (rounded up) |
| GLB reference registration | Maximum error < 0.000002 m |
| Wall / column / glass centre-line clearance | Minimum 0.35596 m |
| Body collision rays, all GLB meshes | 16 edges × 2 directions, no blocked edge |
| API regression | 72 distinct tests passed; see temporary-directory note below |

The four destinations are ICETEX, Morphology Laboratory, Elevator and Restroom
Hall, and Preclinic / Dentistry Coordination. Every `walk-*.json` contains the
actual API route, destination, measured final position, sample count and states.
The Preclinic route uses the north circulation and storeroom in both directions.
The ICETEX outbound walk also verifies pause/resume without changing position.
Separate tests cover manual override, cancel/replan, mobile layout, invalid login,
real no-route recovery and an expired token.

The error test uses a disposable real FastAPI process started by
`tests/e2e/isolated-campus.ts` through the backend's `tests.serve_campus` module.
Its extra synthetic destination lives only in a temporary database. The fixture
uses an OS-assigned free port and cleans up its own process tree and files.
The existing real and sample services on 8001 and 8000 were preserved.

Commands, run from the frontend with the real service already on 8001:

```powershell
npm run build
npm test
$env:UNINAV_TEST_URL = 'http://127.0.0.1:8001'
npm run test:e2e -- --grep 'real GLB|isolated test|mobile layout|manual control'
$env:UNINAV_VERIFY_DIR = 'docs/verification/h0'
node --experimental-strip-types tools/verify-model.ts
node --experimental-strip-types tools/inspect-model.ts
```

From the backend, `venv/Scripts/python.exe -m pytest tests/api -q` passed 69
tests but three frontend-serving tests could not create pytest's shared temporary
directory (`WinError 5`). Repeating `tests/api/test_frontend.py` with a new
`--basetemp` passed all four tests in that file, completing the 72 distinct cases.
The UCC tests check both A* and Dijkstra for all four round trips and a synthetic
isolated destination in both directions.

`model-alignment.json` is a geometry check. Its Node loader substitutes empty
textures without editing the GLB; actual images and materials are exercised by
the browser. The software-rendered Playwright run is functional evidence, not a
measurement of the 30 FPS presentation target. Multi-floor travel, A, complete room
inventory and the remaining Plan 3 work are still pending.

# C2 integration · 7 November 2026

Model: Claude's interior pass `efd05d1`, with references and comparable Blender
evidence in `0eef46e`. SHA-256:
`d65846a8b614062d63e60a339da6e9c9ce29e8ffae2d01a90fbd16611e6a356e`.
The exported, built and served GLB matched throughout the browser rehearsal.
The API catalogue remains 19 places and 16 bidirectional paths; no data changed.

The university now shows shaped tables, chairs, laboratory benches, lockers,
floor materials by use and destination signs. Furniture remains illustrative;
Claude's documented scale, heights and plaza approximations still apply.

Runtime presentation changes:

- Overhead canopies hide in top view and return in 3D, clearing the access view.
- Translucent materials do not write opaque depth; grass does not cast shadows.
- Collision rays retain every obstacle, including meshes hidden for presentation.
  Cached world bounds filter only meshes outside the swept body volume.
- Replaced or rejected models release shared textures, materials and geometry.
  Scene disposal also releases the ground, destination ring and shadow resources.
- A missing GLB clearly shows the graph preview, with recovery verified on reload.

| Check | Result |
| --- | --- |
| Build and typecheck | Passed |
| Frontend unit tests | 11 passed, including 300 collision comparisons and shared resource disposal |
| Brave / Playwright integration | 9 passed in 3.9 min |
| Presentation recheck including walking performance | Passed in 19.5 sec |
| API: UCC routes, routing and frontend serving | 15 passed using a new temporary base directory |
| Hall Acceso ↔ four destinations | 8 arrivals, 1,597 position samples, no blocked state |
| Maximum final position error | 0 m |
| Maximum route centre-line deviation | 0.000674 m (rounded up) |
| Maximum GLB reference error | < 0.000002 m |
| Minimum wall / column / glass centre-line clearance | 0.35596 m |
| Geometry rays against all meshes | 32 directed edges clear |

The destinations are ICETEX, Morphology Laboratory, Elevator and Restroom Hall,
and Preclinic / Dentistry Coordination. The Preclinic route still uses the north
circulation and storeroom. Separate tests verify pause/resume, manual override,
cancel/replan, mobile layout, invalid login, a real 404 in a temporary database,
expired-session recovery and a missing model. Services on 8000 and 8001 were reused
and preserved; the test fixture creates and cleans up its own ephemeral server.

## Comparable captures and performance

`before-general.png` / `after-general.png` and `before-top.png` / `after-top.png`
use the same C2 model, 1440 × 1000 viewport, controls and initial avatar position.
`after-walking.png` shows the additional performance rehearsal on the ICETEX route.
Claude's C1 → C2 geometry comparisons remain in `docs/model-review/after-c2/`.

The actual renderer was ANGLE / Direct3D11 on **NVIDIA GeForce RTX 5060**, not
SwiftShader. Each measurement records five seconds of animation-frame intervals
while the app continuously renders:

| View | Before runtime changes | After runtime changes | After p95 frame interval |
| --- | --- | --- | --- |
| General | 144.0 FPS | 144.0 FPS | 7.1 ms |
| Top | 144.0 FPS | 144.0 FPS | 7.0 ms |
| Walking | Not measured | 144.0 FPS | 7.0 ms |

These local headless browser measurements exceed the initial 30 FPS target in the
tested views and walk. They measure frame cadence, not GPU timestamp queries or a
guarantee for other devices. Full values and renderer details are in the two
`*-performance.json` files.

`collision-benchmark.json` compares the original six body rays with the bounds
filter on 128 actual route samples and 640 timed calls per implementation:
2.173 ms versus 2.143 ms per call, with zero result differences. The gain is small
on this export; no substantial collision speedup is claimed. The independent
geometry report still casts against every mesh across every edge in both directions.

## Reproduce

With the existing real campus running on 8001, from the frontend:

```powershell
npm run build
npm test
$env:UNINAV_TEST_URL = 'http://127.0.0.1:8001'
$env:UNINAV_EVIDENCE_DIR = 'docs/verification/c2'
$env:UNINAV_VERIFY_DIR = 'docs/verification/c2'
$env:UNINAV_RENDERER = 'hardware'
$env:UNINAV_REQUIRE_FPS = '1'
npm run test:e2e -- --grep 'real GLB|isolated test|mobile layout|manual control|campus presentation|missing GLB'
node --experimental-strip-types tools/verify-model.ts
node --experimental-strip-types tools/benchmark-collisions.ts
```

Use a new evidence directory for a different export. `verification/h0/` preserves
the earlier C1 rehearsal. The next work is the block/floor catalogue and model
manifest; additional floors, A, complete room coverage and the simple faceless
avatar improvements remain pending. This report does not close the three plans.

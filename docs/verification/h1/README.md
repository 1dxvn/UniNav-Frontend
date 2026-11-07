# H1 foundation verification · 7 November 2026

This delivery adds the source catalogue, a reviewed model manifest, independent
floor-resource loading and a build that preserves reviewed assets while modelling
continues. It is the resource/inventory foundation of H1; place IDs, graph migration
and non-destructive versioned campus seeds are still pending.

Canonical catalogue: backend `ea8a58f`, `data/campus-catalog.json`, source inventory
`a35f892`. Twelve floor records retain derived block attribution and elevation
evidence. Roof sheets remain unassigned. No room, path or elevation was inserted
into either development database. The existing flat first-floor transform remains.

Reviewed navigation model: C2 `efd05d1`, SHA-256
`d65846a8b614062d63e60a339da6e9c9ce29e8ffae2d01a90fbd16611e6a356e`.
The manifest pins the source commit, reference hash, GLB hash and the actual API
geometry/topology binding. Row IDs and response ordering may differ; geometry,
directions, path kinds and weights may not change silently.

| Check | Result |
| --- | --- |
| Frontend build/typecheck | Passed; reviewed-asset staging verified |
| Frontend unit tests | 17 passed |
| API suite | 75 passed with a fresh temporary base directory |
| Catalogue recheck after label clarification | 3 passed |
| Real-campus browser suite | 12 passed in 4.2 min |
| Original sample-campus browser test | 1 passed in 25.1 sec; evidence in `sample/` |
| Four round trips | 8 arrivals, 1,578 samples, no blocked state |
| Maximum final error | 0 m |
| Maximum route deviation | 0.000696 m (rounded up) |
| Body rays against reviewed geometry | 32 directed edges clear |
| General / top / walking frame cadence | Approximately 144 FPS, RTX 5060 / ANGLE Direct3D11, headless 1440 × 1000 |

The resource tests verify that observing floor 2 reports **model pending** while
the avatar stays on floor 1. Returning to floor 1 uses its cached resources without
another GLB request. Changed GLBs are rejected before parsing; incompatible graph
revisions are rejected even when reference anchors still align. Missing resources
recover after reload. Unit tests cover retaining avatar/route models, disposal,
late responses, concurrent load deduplication and failed-load retries.

## Concurrent-export incident and resolution

During the first browser attempt, a working first-floor export changed to
`6fe2b85a6f6aa38707398a9191a8e65cb24efafcd21a256dc31d77d576c448b0`
and reached `dist`. The loader rejected it, as required. That attempt did not pass.
The reviewed build now stages manifest-pinned assets, using original Git bytes
when a working export differs, without changing Claude's sources. The final
twelve-test rehearsal passed with the reviewed served hash fixed throughout.

`revision.json` records both the reviewed served hash and the working-export hash
seen at the beginning. The working file can change without entering the reviewed
build. `candidate/model-alignment.json` is a geometry-only diagnostic of the
transient candidate; it is not approval of its stairs or vertical navigation.
Claude subsequently preserved the released first-floor export and moved the
stairs candidate to `model/candidates/`.

## Reproduce

```powershell
npm run build
npm test
$env:UNINAV_TEST_URL = 'http://127.0.0.1:8001'
$env:UNINAV_EVIDENCE_DIR = 'docs/verification/h1'
$env:UNINAV_RENDERER = 'hardware'
$env:UNINAV_REQUIRE_FPS = '1'
npm run test:e2e -- --grep 'real GLB|isolated test|mobile layout|manual control|campus presentation|missing GLB|observing a pending|changed GLB|incompatible graph'
$env:UNINAV_MODEL_ROOT = 'dist/models'
$env:UNINAV_VERIFY_DIR = 'docs/verification/h1'
node --experimental-strip-types tools/verify-model.ts
```

For the sample, set URL to port 8000, use `UNINAV_EVIDENCE_DIR` ending in `/sample`
and select `--grep 'sample API'`. The existing services were reused. The new backend
catalogue endpoint is tested by the temporary real-API browser fixture and pytest;
existing persistent processes were preserved and load it on their next normal start.

The exterior, floor 2 and stairs candidates delivered during this turn remain
outside the reviewed manifest. Floor 2 still needs data, references converted to
runtime JSON, matching elevation handling and physical vertical-route checks.
The three plans are not complete.

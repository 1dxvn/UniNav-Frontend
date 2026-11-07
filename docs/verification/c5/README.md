# C5 exterior integration · 7 November 2026

The initial **Campus** view now combines C2's first-floor base with Claude's
reviewed exterior massing. **3D floor** and **Top floor** restore the navigable
cutaway. Choosing a destination or planning a route leaves the overview; active
guidance disables it until cancelled. View changes preserve the avatar's position.

Exterior source: `31c5d6817d5bfd39cf0ef8da64eac43e43b9dae9`,
`public/models/blocks/campus-exterior.glb`, SHA-256
`913490fd652b49958558d43db17253c9fd9ae242a8e2ebdf85dab531a9aa59f0`.
Scale 1, rotation 0, translation `(0, 3.5, 0)`, as documented by Claude. The source
document retains derived block identities and approximations in facades and roofs.
The exterior has no API reference nodes or navigation binding; the overview badge
explicitly identifies the three verified anchors as belonging to the first floor.

C2 remains `efd05d1`, SHA-256
`d65846a8b614062d63e60a339da6e9c9ce29e8ffae2d01a90fbd16611e6a356e`.
The API remains 19 places and 16 bidirectional paths. No campus data changed.

| Check | Result |
| --- | --- |
| Build / typecheck | Passed |
| Frontend unit tests | 18 passed |
| Real-campus browser suite | 15 passed in 4.2 min; sample skipped on this URL |
| Additional changed-exterior-hash case | Passed in 2.6 sec |
| Original sample-campus test on port 8000 | Passed in 23.3 sec; `sample/` evidence |
| API frontend-serving / routing / UCC / catalogue tests | 18 passed |
| Four destinations, outbound and return | 8 arrivals, 1,594 samples, no blocked state |
| Maximum final position error | 0 m |
| Maximum route centre-line deviation | 0.000674 m (rounded up) |
| Navigation collision meshes | 137 in Campus and floor views; exterior contributes 0 |
| Reviewed floor geometry rays | 32 directed edges clear |

The browser checks initial overview, cache/resource release on returning to a
floor, unchanged avatar position, automatic floor restoration for a route and
disabled overview during guidance. It also checks missing and changed exterior
exports: the first floor stays usable, the failure remains visible and retry
works. The existing pause/resume, manual control, cancel/replan, invalid login,
expired token, isolated-destination error, missing model and pending-floor checks pass.

## Visual and runtime measurements

- `campus-overview.png`, `campus-close.png`: complete exterior and closer inspection.
- `floor-after-overview.png`: restored cutaway and destinations.
- `mobile.png`: current initial view on the mobile layout.
- `*-arrival.png`, `walk-*.json`: all eight route arrivals.
- `exterior-alignment.json`: pinned/served hash, transform, bounds and mesh counts.
- `overview-metrics.json`: renderer, cadence, resource fetches and JavaScript heap.

The exterior adds **48 visual meshes / 31,106 triangles**, is approximately
**2.09 MB**, and begins 2.43 m above the first-floor datum. These numbers describe
the reviewed model; its upper volumes do not create navigable floors or rooms.

Local measurement: ANGLE / Direct3D11 on NVIDIA GeForce RTX 5060, headless Brave,
1440 × 1000. The overview averaged **144.0 FPS**, with **7.1 ms p95** frame interval
over five seconds. Its first-floor and exterior resource fetches took 13.4 ms and
18.1 ms respectively on localhost. Chrome reported approximately 19.6 MB used
JavaScript heap. These are frame-cadence, resource-fetch and heap observations;
they do not measure full-page startup, GPU memory or performance on other devices.

## Reproduce

```powershell
npm run build
npm test
$env:UNINAV_TEST_URL = 'http://127.0.0.1:8001'
$env:UNINAV_RENDERER = 'hardware'
$env:UNINAV_REQUIRE_FPS = '1'
$env:UNINAV_EVIDENCE_DIR = 'docs/verification/c5'
npm run test:e2e
$env:UNINAV_VERIFY_DIR = 'docs/verification/c5'
node --experimental-strip-types tools/verify-overview.ts
$env:UNINAV_MODEL_ROOT = 'dist/models'
node --experimental-strip-types tools/verify-model.ts
```

Use port 8000, evidence directory `docs/verification/c5/sample` and
`--grep 'sample API'` for the separate sample rehearsal. Both existing services,
their databases, API and Swagger were preserved. Geometry, source models and
reference documents remain Claude's work. The three plans still need stable place
and connection IDs, vertical navigation, further floors, confirmed A/B identities,
remaining application functions and the avatar integration.

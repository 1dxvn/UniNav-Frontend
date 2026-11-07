# C13 model set and floor-2 access preparation · 7 November 2026

The manifest pins the committed model set at `a2dbda0`. The first floor keeps
the corrected stair geometry from `71c5e80`, SHA-256
`93a1ad6969a82467b12bc17fdb92a559319a6b80bf667c1afa2f12adc1314a8d`.
The original 19 places, 16 bidirectional paths and four destinations remain.
Floors 0/2/3/4/5 are non-navigable previews: no API rooms or edges were added.

C13 supersedes the [intermediate C12 rehearsal](../c12/README.md). Claude found
that door-type frames had become wall stubs in upper-floor doorways and corridors.
C13 removes those frames, replaces overlapping guessed door leaves with the
drawn leaves, and removes duplicate leaves. Room-confined furniture, the wall-tag
cleanup and corrected stair geometry remain. Codex changed no Blender sources,
GLBs or Claude reference documents.

| Preview | World Y | Meshes | Triangles |
| --- | --- | --- | --- |
| 0 | 0.56 m | 43 | 17,503 |
| 2 | 6.44 m | 50 | 39,030 |
| 3 | 9.38 m | 59 | 43,419 |
| 4 | 12.32 m | 54 | 49,667 |
| 5 | 15.26 m | 66 | 55,254 |

These are documented model transforms, with flattened A/B half-levels and
derived block identities. The five previews total 12.36 MB and load on selection.
Fifteen structural anchors match the GLB nodes, maximum file-coordinate residual
0.000002484 m; this is not a surveyed registration accuracy claim.

`model-alignment.json` checks the served first-floor hash and all 32 directed
edges with rays at 0.45/1.2/1.8 m, against 141 collision meshes. Preview and exterior
meshes contribute no navigation collisions. Minimum wall/column/glass centre-line
clearance remains 0.35596 m. `services.json` records all seven reviewed model
hashes in `dist`, and health, `/app/`, Swagger and OpenAPI on both preserved ports.

## Acceptance checks

| Check | Result |
| --- | --- |
| Build / typecheck | Passed |
| Frontend unit tests | 25 passed |
| Pertinent API tests earlier in this milestone | 22 passed in 12.58 s; API/data unchanged by C13 |
| Campus / temporary API browser suite on C13 | 21 passed in 5.1 min; sample skipped on this URL |
| Original sample-campus rehearsal | 1 passed in 22.1 s; no UCC preview requests |
| Four destinations, outbound and return | 8 arrivals; 1,591 samples; final error 0 m; no blocked state |
| Maximum centre-line deviation | 0.000674 m (rounded up) |

The browser checks paused-route preservation through previews and return to the
actor floor, resource release, changed asset/data rejection, pending floors,
real API no-route/session recovery, keyboard override and mobile layout. Two
cycles through all previews return to 606 live buffers and 19 textures. These
WebGL handle counts do not measure VRAM bytes. Captures and the access diagram
were also inspected visually.

Local RTX 5060 / ANGLE Direct3D11, headless Brave at 1440 × 1000: about 144 FPS
in general/top/walking and floor-5 inspection, p95 frame interval at most 7.1 ms
in these samples. See the JSON cadence reports; this is not a guarantee on other
GPUs. The initial 30 FPS target passes on this machine.

`stair-clearance.json` tests both committed levels together: west/east, up/down,
four passes with no body/torso blocker or support conflict. These measured
tread/landing probes confirm that the reported C11 blockers are removed. They
do not accept API route data, manual stepping or a complete vertical browser
journey. Intermediate probe segments retain the report's stated support tolerance
and are not imported as automatic routes.

## Floor-2 source audit

`floor2-access-audit.json` transcribes five actual labels, tests nearby candidate
points and records nearby drawn openings. The SVG/PNG draws exported architectural
sections and source furniture. [Access review](../../blocks/floor2-access-review.md)
explains the results and limits. Library, hall and classrooms need real doorway
turns: their direct lines from the east stair hit doors/glass/walls. AULA 201 now
has a locally free candidate after C13's frame removal; C12 had none under the
same rule. The nearby circulation label is clear from the stair arrival.

These are not accepted entrances or graph edges. Room membership, doorway
assignment and complete supported paths still need review. No obstacle was
removed to force a route, no room was inferred from a name alone, and no candidate
was written to either database. The drawn outward-opening restroom doors need
clearance checks along the north corridor.

H2 and the three plans remain incomplete. Next: verified doorway/turn graph data,
manual tread support, and actual API/browser journeys between floors. The running
legacy API must expose the explicit-elevation contract before those data are
enabled there. The B laboratory's physical stair/ramp discrepancy, physical A/B
confirmation, other functions and the faceless avatar upgrade remain.

## Reproduce

```powershell
npm run build
npm test
$env:UNINAV_VERIFY_DIR = 'docs/verification/c13'
node --experimental-strip-types tools/verify-floor-previews.ts
$env:UNINAV_STAIR_LOWER_COMMIT = 'a2dbda0'
$env:UNINAV_STAIR_UPPER_COMMIT = 'a2dbda0'
node --experimental-strip-types tools/verify-stair-candidate.ts
$env:UNINAV_AUDIT_COMMIT = 'a2dbda0'
node --experimental-strip-types tools/audit-floor2-access.ts
$env:UNINAV_TEST_URL = 'http://127.0.0.1:8001'
$env:UNINAV_RENDERER = 'hardware'
$env:UNINAV_REQUIRE_FPS = '1'
$env:UNINAV_EVIDENCE_DIR = 'docs/verification/c13'
npm run test:e2e -- --output test-results/c13
$env:UNINAV_MODEL_ROOT = 'dist/models'
node --experimental-strip-types tools/verify-model.ts
```

For the sample case, use port 8000, a separate `sample/` evidence directory and
`--grep 'sample API'`, with output below ignored `test-results/`.

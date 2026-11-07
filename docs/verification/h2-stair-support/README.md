# Supported stair movement · 7 November 2026

The runtime now follows reviewed tread/slab surfaces on `stairs` edges, for both
keyboard and guided movement. This milestone rehearses the documented east stair
between floors 1 and 2 on the C13 model pair, in a **disposable FastAPI database**.
It is not the public floor-2 destination integration or completion of H2.

## Source and scope

- Both GLBs come from `a2dbda0`, at documented model elevations 3.5 and 6.44 m.
- First-floor SHA-256: `93a1ad6969a82467b12bc17fdb92a559319a6b80bf667c1afa2f12adc1314a8d`.
- Floor-2 SHA-256: `63a1ac43b914d7767e284dc8ace5856a6f6a87bdc38f8e1c05a661c1dda3f61a`.
- The east stair centre lines, treads and curved landing come from
  `docs/blocks/vertical-connections.md` and the measured C13 probe. The final
  point is the literal floor-2 CAD label `CIRCULACION`, (39.001, 55.896).
- `tests/fixtures/ucc-east-stair.json` contains test-only waypoints and edges,
  plus the three documented floor-2 structural columns for API alignment. It
  adds no inferred room or entrance. The stair fixture is disconnected from
  the existing first-floor routes; their connections still need review.
- The browser fixture creates a new database and an OS-reserved port. Its
  manifest/reference overrides bind the reviewed GLBs to those API points.
  Production hashes, reference files and the non-navigable floor-2 entry remain
  unchanged. No user service or development database is replaced.

The model flattens A/B half-levels and rises 2.94 m, while the physical A storey
is documented as 3.31 m. Block identities remain derived. A successful model
rehearsal does not resolve those physical approximations.

## Movement rules

Explicit `supportNodes` identify slab/tread geometry. Furniture, railings and
presentation planes are not support. Missing named nodes reject the model.
Five downward samples check a 0.12 m foot footprint; allowed step height is
0.20 m. The expected graph height prevents acquiring another storey. Unsupported
positions and high risers are rejected. All obstacle meshes still participate
in torso/head checks at 0.45/1.2/1.8 m, including hidden and overhead geometry.

Both controls divide movement into substeps no longer than 0.06 m. Keyboard
movement follows the graph corridor and direction; planar progress determines
one-way stair direction independently of discrete foot height. Endpoint metadata
determines floor changes (within 0.15 m of its position and 0.03 m of its height
for keyboard arrival). High landings retain their declared floor.

Nearby stair networks retain adjacent navigation models, including after pause,
cancel or keyboard override. Models must be loaded before keyboard movement
enters the component. This is independent of the observed floor and does not
allow a structural preview to become a navigation model.

## Verification

| Check | Result |
| --- | --- |
| Final build / typecheck | Passed; bundle `index-8Ch4cN_C.js` |
| Frontend unit tests | 29 passed |
| Pertinent API tests | 26 passed in 18.46 s |
| Final full browser suite | 23 passed in 5.8 min; sample skipped on this URL |
| Vertical arrival evidence repetition | 2 passed in 37.6 s |
| Original sample-campus rehearsal | 1 passed in 23.6 s; no UCC preview requests |
| Existing four destinations, both directions | 8 arrivals; 1,596 samples; final error 0 m; no blocked state |
| Maximum existing-route centre-line error | 0.000696 m (rounded up) |
| Existing geometry | 32 directed edges clear, including head rays |

The first complete rehearsal exposed a manual endpoint-zone case: feet were
already on the upper slab a few centimetres before its node, with the departure
floor still selected. The final runtime requires proximity to the endpoint and
agreement with its explicit elevation, and its regression passes. One-way progress
is measured independently of discrete tread height, including at edge endpoints.
Failed diagnostic traces stay in ignored test output, outside these acceptance
artifacts.

Both preview cycles return to 606 live buffers and 19 textures, with no growth
in these WebGL handle counts. On the local RTX 5060, headless Brave at
1440 × 1000: approximately 144 FPS in general/top/walking and floor-5 views,
p95 interval at most 7 ms. This is frame cadence on this machine, not VRAM-byte
measurement or a guarantee on other devices. `services.json` checks all seven
served model hashes and records the final JS bundle hash.

`supported-stair-checks.json` records four full geometry simulations: automatic
up/down (313 samples each) and manual up/down (292 each), no blocker, final
positions and floors correct, zero foot-to-surface separation. Negative unit cases
cover holes, tall risers, furniture, missing nodes, one-way progress after a
discrete step, explicit floors and rejected preview support.

`vertical-browser.json` records real FastAPI routes, the 404 with stairs excluded,
pause, keyboard override, recalc without teleporting, and arrival at 6.44 m then
return to 3.5 m. `vertical-manual-browser.json` records keyboard traversal of both
flights and the landing in both directions. Screenshots show the pause and
upper/lower arrivals. These routes are test-only, not public destination routes.

`browser-foot-support.json` independently casts downward rays from actual browser
DOM positions against the committed GLBs. It does not use the runtime support
resolver or interpolated graph heights. All 92 automatic and 94 manual recorded
positions agree with their support at the DOM's 1 mm resolution; this is not a
claim of sub-millimetre physical accuracy. Automatic arrivals are exact to the
recorded target coordinates; manual arrivals are within the 0.07 m test tolerance
and retain their correct floor. See the explicit `arrivals` records.

## Remaining work

Build verified doorway/turn paths to at least three floor-2 destinations and
connect the stair approach to the existing first-floor graph. Complete room and
door assignments from the source audit; recheck every edge and furniture/door
clearance. Add a compatible floor-2 navigation model/data binding only after
those checks. The running real API still has its previous loaded contract and
has not been restarted. The B laboratory stair/ramp discrepancy remains open.
H2, the other floors, physical A/B confirmation, application functions and the
faceless avatar integration are still pending.

## Reproduce

```powershell
node --experimental-strip-types tools/prepare-vertical-fixture.ts
npm run build
npm test
$env:UNINAV_RENDERER = 'hardware'
$env:UNINAV_EVIDENCE_DIR = 'docs/verification/h2-stair-support'
npm run test:e2e -- --grep 'real stair pair' --output test-results/h2-stairs
node --experimental-strip-types tools/verify-stair-playback.ts
```

Backend prerequisite: `venv/Scripts/python.exe` and backend commit `98272f4`
(`tests/serve_campus.py --dataset`). The fixture owns only its temporary
process tree and directory. For the full existing-campus regression, set
`UNINAV_TEST_URL=http://127.0.0.1:8001` and run the entire browser suite. Check
the sample separately on port 8000. No new dependency is required.

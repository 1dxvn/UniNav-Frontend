# Source-backed stair exclusion, with C13 preserved

Avoid stairs now rejects the confirmed hall and B laboratory crossings even
while the preserved 8001 API still calls them corridors. Six legacy API requests
return 200, but the UI rejects those routes before guidance. ICETEX remains
available. A connector from the current position is checked too: the laboratory
example rejects a crossing from x 38.646, while a clear part of the long hall
approach remains usable without moving the avatar during calculation.

Backend `deea65b` prepares a separate scoped revision for e08/e09/e10. It changes
only kinds to stairs, preserving IDs, coordinates, heights, weights, endpoints
and other scopes. It creates no records. The existing baseline remains unchanged;
the revision was **not imported into either development database**. Isolated API
fixtures support ordered repeated `--dataset` imports. New model profiles bind
the classified 19/16 and 64/59 variants without replacing the old profiles.

This is conservative classification of whole connections containing steps.
Connection lengths include clear approaches; they are not surveyed stair-flight
lengths. C13 still flattens the first-floor hall and B laboratory levels. The
model badge tooltip identifies that approximation. Filtering does not certify
physical accessibility or complete H2 or any of the three plans.

## Source update and physical handoff

The final source is Claude's `vertical-connections.md` at `b9648f5`, following
`31e9c27` / `68c7a36`. The hall has three numbered treads between **four risers**,
about 0.158 m each, over a 0.63 m drop. Its measured rectangle is x 27.3–29.8,
y 47.86–49.23. The 0.20 m movement limit is unchanged. The nine B laboratory
steps reach N +1.19; no step-free ramp to that level is confirmed.

`docs/blocks/first-floor-level-review.json` and its companion `.md` request a
separate candidate from Claude, with proposed graph splits and pending surface
level assignments. The proposed points are approximate and not importable.
The four-riser update changed the metadata rectangle after the first journey
pass; legacy/connector guards and manifest validation were rerun on the final
build. Classified connection types and journey coordinates did not change.

## Results

| Check | Result |
| --- | --- |
| Build / typecheck | Passed, final bundle `index-Cp_dfQDo.js` |
| Frontend unit cases | 39 passed |
| Pertinent API cases | 36 passed; 7 classification cases also rerun after the source-note update |
| New/classified browser suite | 10 passed, 7.5 min |
| Final compatibility regression | 11 passed, 1.6 min; two guard cases repeat the first suite |
| Sample browser | 2 passed, 43.3 s |
| Distinct browser cases | 21 passed |
| Classified first-floor journeys | 8 arrivals, final error 0 m, no blocked state |
| Classified two-floor journeys | 6 arrivals, final error 0 m, no blocked state |
| Flat C13 changed-connection probe | 6 directions / 1,204 support and body/head samples clear |
| Independent browser support | 428 changed first-floor samples + 481 new upper-scope samples, within recorded 1 mm resolution |
| Local presentation cadence | About 144 FPS, p95 at most 7.1 ms, RTX 5060 / headless Brave |
| Floor-inspection resource cycles | Return to 551 WebGL buffers / 10 textures |

Browser reports use the shipped resources, without GLB/reference/manifest
overrides for the journeys. `first-*-review.json` covers the classified flat
first-floor paths; `*-walks.json` covers the classified two-floor paths. Final
negative-resource regressions intentionally alter resources to prove rejection.
The old two-floor profile also retains pause/replan/manual stair coverage.

The geometric probe uses the actual committed C13 model and runtime collision
rules. Browser support verification casts separate downward rays at recorded
positions. The 1 mm value is DOM recording resolution, not surveyed accuracy.
GPU object counts are not GPU byte usage, and short local frame measurements
do not guarantee performance on other devices.

## Remaining work

Deliver and review physical-level candidate geometry, verify the proposed turns
and affected reference/destination heights, and replace direct graph bypasses
atomically when activating the splits. Coordinate the A stair's real 3.31 m rise
with the upper floor; C13 currently uses 2.94 m. Group flight/landing instructions.

Before public data adoption, advance the full baseline seed to a new reviewed
revision and resolve the older 8001 process/API contract. Reapplying the old seed
after the classification revision intentionally detects drift; it cannot silently
undo the correction. `deployment-profile.json` records the current old contract.
No existing service was stopped or duplicated. C14, other floors, block identity,
remaining functions and faceless C6 avatar integration are still pending.

## Reproduce

Requires backend `deea65b`, existing venv/Node dependencies and local Brave.
Inspect development ports before using them; all classified data stays temporary.

```powershell
node --experimental-strip-types tools/prepare-stair-review.ts
npm run build
npm test
$env:UNINAV_TEST_URL = 'http://127.0.0.1:8001'
$env:UNINAV_RENDERER = 'hardware'
$env:UNINAV_STAIRS_REVIEW = '1'
$env:UNINAV_EVIDENCE_DIR = 'docs/verification/h2-stair-awareness'
$env:UNINAV_VERIFY_DIR = 'docs/verification/h2-stair-awareness'
npx playwright test legacy-stairs.spec.ts stair-review.spec.ts floor2-destinations.spec.ts
node --experimental-strip-types tools/verify-flat-stair-review.ts --require-browser
$env:UNINAV_CANDIDATE_DIR = 'docs/verification/h2-floor2-candidate'
node --experimental-strip-types tools/verify-floor2-playback.ts
node --experimental-strip-types tools/check-campus-profile.ts
```

From the backend run `venv/Scripts/python.exe -m pytest` with
`tests/api/test_ucc_stairs.py tests/api/test_ucc_floor.py
tests/api/test_ucc_second_floor.py tests/api/test_datasets.py
tests/api/test_catalog.py tests/api/test_frontend.py` and a fresh `--basetemp`.
Regression and sample commands/configurations are also recorded in their JSON
browser reports. Unrelated temporary results and working model exports are
preserved outside the commit.

# C14 integration across four reviewed model profiles

Floors 0, 2, 4 and 5 now use committed C14 `389cfd9` in the base, two-floor and
both stair-classified profiles. The first-floor GLB remains C13 `93a1ad69…`,
the exterior remains C5 and floor 3's GLB is unchanged. No Blender source,
Claude reference document or GLB was edited. No navigation data was imported
into either development database. The real 8001 API still selects the 19/16 base.

| Floor | Reviewed model SHA-256 | Runtime role |
| --- | --- | --- |
| 0 | `a266b1629cbcc0e84cb0f351277c7f156696714930b8cc4fb99f9ebbfc5f1f7d` | Inspection preview |
| 2 | `44fbeda292f178da1acb3e75e9bad4bb86b218d0dd3d70f07830b8a25370bfb6` | Preview or navigable model, according to the selected data profile |
| 4 | `18f2fcaa7cbc842f30417bbb91902a3aed26755c41480b515d9977049e5bcf06` | Inspection preview |
| 5 | `fc94285536711e619749da4f5bbd1e0f27b68ca62ebb6023f982be6bd9f75592` | Inspection preview |

`integration-assets.json` checks committed reference bytes, actual GLB anchors,
support node names and the working export hashes. Four preview references and
the API-aligned upper reference provide 15 anchor checks. `structural-checks.json`
also repeats all five preview checks, including unchanged floor 3.

`profile-preservation.json` proves that all four profile identities, bindings,
support declarations, catalogue and stair restrictions remain unchanged. Only
review revisions, source commits and resource hashes change in 16 model entries.
The build verifies every declared resource and stages shared URLs consistently.

## Doors, geometry and data

The D13/D14/D15 facts match every selected field in the committed doorway
inventory, SHA-256 `18fc3d7c…` (`doorway-source.json`). Other inventory entries
remain unaccepted as navigation entrances. The known floor-0 and balcony probe
exceptions do not acquire API destinations through this update.

The upper route preparation is rerun on C14: 45 places, 43 bidirectional paths,
**86 directed checks clear**, with the same prepared graph. Only documentary
`elevation_source` text differs in the visual audit; every other place field and
every path field match the canonical backend dataset. No fingerprint or resource
hash check was relaxed. Browser playback checks the recorded committed revision
and both model hashes rather than silently verifying an older export.

The two stair towers pass ascent and descent probes with head/torso collision
rays and zero support conflicts. These probes do not create a west-tower route.
The three accepted destination journeys continue to use the east stair.

## Browser and presentation evidence

| Check | Final result |
| --- | --- |
| Build / typecheck | Passed; runtime bundle remains `index-Cp_dfQDo.js` |
| Unit / pertinent API cases | 39 / 22 passed |
| Distinct browser cases | 34 passed across the original run, four corrected retries and two sample cases |
| Classified upper-profile variant | Molecular biology outbound/return passed separately, 1.3 min |
| Ordinary first-floor / upper journeys | 8 / 6 arrivals, final error 0 m, no blocked state |
| Independent upper-scope foot samples | 481 supported at the DOM's recorded 1 mm resolution |
| Independent upper-profile pause/manual stair samples | 282 supported at the same resolution |

The initial browser report retains 28 passes, two sample-only skips and four
failures in the stale assertions/report writer described below. All four pass
in the targeted rerun (3.4 min); both sample cases pass separately (43.1 s).
`results.json` merges final outcomes by case identity instead of counting retries
as additional cases. The extra classified-data variant is reported separately.

The browser suite covers ordinary walks to the four first-floor destinations
and back, three upper destinations and back, previews, exterior views, invalid
resources/contracts, keyboard motion, pause/replan and GPU resource cycles.
Separate cases retain the known stair-exclusion behavior with the old API.

The initial suite found three stale ordinary-walk tests that still selected
Avoid stairs for destinations now correctly rejected by the client. They were
changed to ordinary walks; the six exclusion directions remain explicitly tested.
Adding source hashes also exposed a missing request fixture in the manual report
writer after the climb/descent had completed. It was corrected and typechecked.
The four affected cases are rerun separately; both original and retry reports
are retained rather than hiding the first failures.

Preview cycles return to 606 buffers / 19 textures; upper-floor inspection after
route cancellation returns to 551 / 10. The first actor's position and origin
options are preserved. Local RTX 5060 measurements are approximately 144 FPS,
p95 at most 7.1 ms, including preview floor 5, general/top views and walking.
These are WebGL object counts and short headless Brave frame intervals, not GPU
byte usage or guarantees for other devices.

The `floor-N-3d.png` / `floor-N-top.png` captures use the same browser framing as
the C13 captures in `../c13/`, notably `floor-2-top.png`. The changes remove label
bars and furniture from door passages and refine drawn door leaves. They do not
model the first-floor hall/B half-levels.

## Reproduce

Use the existing dependencies, venv and Brave. Keep development services and
their databases; temporary API fixtures reserve their own ports.

```powershell
$env:UNINAV_VERIFY_DIR = 'docs/verification/c14'
node --experimental-strip-types tools/integrate-c14.ts
$env:UNINAV_FLOOR2_COMMIT = '389cfd9'
node --experimental-strip-types tools/prepare-floor2-route-candidate.ts
node --experimental-strip-types tools/verify-floor-previews.ts
npm run build
npm test
$env:UNINAV_TEST_URL = 'http://127.0.0.1:8001'
$env:UNINAV_RENDERER = 'hardware'
$env:UNINAV_REQUIRE_FPS = '1'
$env:UNINAV_EVIDENCE_DIR = 'docs/verification/c14'
npx playwright test --grep-invert 'reviewed first-floor stair classification'
node --experimental-strip-types tools/verify-floor2-playback.ts
$env:UNINAV_STAIR_REPORT_PREFIX = 'two-floor-vertical'
node --experimental-strip-types tools/verify-stair-playback.ts
```

The API suite is `venv/Scripts/python.exe -m pytest` with
`tests/api/test_frontend.py tests/api/test_ucc_floor.py
tests/api/test_ucc_second_floor.py tests/api/test_ucc_stairs.py`, using a fresh
`--basetemp`. Command configurations and timings are recorded in the JSON reports.

## Pending acceptance work

The physical hall and B candidate requested in `docs/blocks/first-floor-level-review.*`
is still pending. C14 keeps the flattened 3.5 / 6.44 m model frame and cannot close
that discrepancy. Physical graph splits, seed/API adoption, useful flight/landing
instructions, remaining destinations/floors/blocks/functions and the faceless
avatar remain outstanding. The public upper view remains a preview while the
real API stays in 19/16. H2 and the three plans are not complete.

At closing, Claude's working C15 files appeared under `model/candidates/c15/`,
with source changes outside this milestone. They were uncommitted at inspection
and are not part of C14. Review the completed delivery, references and commit
before accepting its level changes; do not mix those working files into this build.

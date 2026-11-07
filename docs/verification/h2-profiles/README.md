# Compatible base and two-floor model profiles

The shipped manifest supports the existing 19-place / 16-path campus and the
prepared 64-place / 59-path dataset without substituting model resources in tests.
Selection validates every navigable binding and requires explicit API identities,
floor codes and elevations for `ucc-two-floors`. Partial metadata is rejected,
including an API with correct effective positions but null explicit elevations.
Rejected UCC data cannot move through sample graph mode or load a GLB.

The live 8001 service still selects **base**. It exposes the earlier loaded API
contract, so no dataset was imported into `uninav-campus.db` and no existing
service was restarted. `deployment-profile.json` records the missing fields.
The expanded browser fixture has 64 campus places plus an isolated error-case
destination, and 59 paths. Its temporary API is real FastAPI with the canonical
backend dataset. The fixture owns its temporary database and process.

## Sources and changes

- Base model/data bindings are preserved. Expanded floor 1 and floor 2 use
  `a6d3f11`, containing the same reviewed C13 geometry and the API-aligned upper
  reference. Floor-1 SHA is `93a1ad6969a82467b12bc17fdb92a559319a6b80bf667c1afa2f12adc1314a8d`;
  floor-2 SHA is `63a1ac43b914d7767e284dc8ace5856a6f6a87bdc38f8e1c05a661c1dda3f61a`.
- The build stages the union of reviewed profile resources. Conflicting bytes
  at a shared URL fail before replacing `dist`. Working Claude exports are read
  only and are never substituted automatically. C14 arrived in `389cfd9` during
  this milestone and remains a separate integration/rehearsal task.
- The generator uses backend `ab24edd`'s `--snapshot-json` fixture option, which
  returns the actual API serialization without opening a listening port.
- Scene labels suppress overlapping rectangles and prioritize the selected
  destination. All directory entries remain available. Measurements are cached
  and refreshed after font load, resize and data changes.
- Sample graph guidance retains stair travel without requiring UCC surfaces.
  Keyboard movement cannot jump a storey along a stair with zero plan length.

## Verification

The final build is `index-D5W02d2S.js`; typecheck and 35 frontend unit cases pass.
`api-results.xml` records 29 pertinent API cases: datasets, catalogue, both UCC
floor datasets and `/app/`/Swagger compatibility.

| Check | Final result |
| --- | --- |
| Main browser suite | 30 passed / 2 sample-only cases skipped, 10.6 min |
| Sample campus | Both distinct cases passed; graph stairs load no UCC GLB |
| Expanded-profile report isolation | 3 targeted cases passed again, 46.9 s |
| Base and expanded destination journeys | 8 + 6 arrivals, final error 0 m, no blocked state |
| Independent new-route foot samples | 481 supported at the recorded 1 mm resolution |
| Independent expanded stair samples | 79 automatic + 118 manual supported |
| Expanded keyboard arrival error | Up 0.0134 m; down 0.0321 m |
| Repeated upper-floor inspection | Returns to 551 WebGL buffers / 10 textures after each cycle |
| Local RTX 5060 cadence | About 144 FPS; p95 frame interval at most 7.1 ms |

The initial sample stair assertion distinguished JavaScript `0` from `-0`, after
the avatar had already arrived. The corrected geometric arrival assertion passes
in a targeted rerun (19.9 s); the first sample case passed in the original run.

The browser suite records eight base-profile arrivals and six expanded-profile
arrivals, pause/resume, keyboard override, recalculation, complete manual ascent
and descent, negative API-contract/resource cases, previews and exterior views.
The mapped-destination tests check the actual served GLB hashes and assert no
overlapping visible labels. Browser foot checks use independent downward rays,
rather than accepting the runtime support resolver's own result.
`two-floor-vertical-*` reports belong to the shipped expanded profile;
`vertical-*` retains the older test-specific stair fixture from the full suite.

`two-floor-resources.json` measures resource release after cancellation and two
floor-inspection cycles. Counts are WebGL object counts, not GPU byte usage.
FPS comes from a short animation-frame interval in headless Brave on the local
RTX 5060; it is not a performance guarantee for other devices.

## Remaining acceptance work

Claude's level notes (`31e9c27`, corrected timestamp `68c7a36`) identify three
hall steps from N 0.00 to N -0.63 on the approach to Block A, and nine laboratory
steps from N 0.00 to N +1.19. C13 flattens both. The graph currently offers those
legacy approach edges as corridors, including when stairs are excluded. The
new floor-2 stair itself is correctly excluded by `avoid: stairs`, but that does
not certify the existing first-floor routes as step-free.

Resolve matching geometry, explicit elevations, graph connections and stair
exclusion before public acceptance. The hall's three risers average 0.21 m,
above the current 0.20 m movement limit; do not silently raise that limit without
checking actual geometry and behavior. The sloped B-to-A hall is not an invented
accessible alternative: the source connects it through six steps. No source
confirms a step-free route to the elevated laboratory.

The route panel still exposes many individual stair waypoint connections;
consolidate them into useful flight/landing instructions before public acceptance.
Public API/process adoption, C14 integration, other floors, block identity,
remaining campus sources and the faceless C6 avatar remain pending. This
milestone does not complete H2 or any of the three plans.

## Reproduce

```powershell
node --experimental-strip-types tools/prepare-floor2-profile.ts
npm run build
npm test
$env:UNINAV_TEST_URL = 'http://127.0.0.1:8001'
$env:UNINAV_RENDERER = 'hardware'
$env:UNINAV_REQUIRE_FPS = '1'
$env:UNINAV_EVIDENCE_DIR = 'docs/verification/h2-profiles'
$env:UNINAV_VERIFY_DIR = 'docs/verification/h2-profiles'
npx playwright test --reporter=line --output=test-results-h2-profiles
$env:UNINAV_CANDIDATE_DIR = 'docs/verification/h2-floor2-candidate'
node --experimental-strip-types tools/verify-floor2-playback.ts
$env:UNINAV_STAIR_REPORT_PREFIX = 'two-floor-vertical'
node --experimental-strip-types tools/verify-stair-playback.ts
node --experimental-strip-types tools/check-campus-profile.ts
$env:UNINAV_TEST_URL = 'http://127.0.0.1:8000'
npx playwright test sample.spec.ts --reporter=line --output=test-results-h2-profiles-sample
```

Run Python checks from the backend with `venv/Scripts/python.exe -m pytest`:
`tests/api/test_ucc_floor.py tests/api/test_ucc_second_floor.py
tests/api/test_datasets.py tests/api/test_catalog.py tests/api/test_frontend.py`.
Use a fresh `--basetemp` directory rather than deleting another run's results.

# C15 physical hall and Block A rehearsal

7 November 2026. C15 is a **separate prepared profile**, not a public data rollout.
The real service remains at 19 places / 16 bidirectional connections and selects
the preserved C14 base. Floors 0/3/4/5 remain non-navigable previews. H2 and all
three project plans remain incomplete.

## Sources and prepared graph

The candidate GLBs are read from committed frontend `3177ca7`, without changing
Claude's sources or public exports:

| Resource | SHA-256 |
| --- | --- |
| `model/candidates/c15/floor-1.glb` | `75abed56ea985341f82f11585a26c981308db3aaf68f14c2e7303e239d6976cf` |
| `model/candidates/c15/floor-2.glb` | `8e7ea9aafb940d145010bc9ed34152d2022e1446f7034ffb7f74eddd8dae1760` |

The reviewed zone boundary is x >= 13.6, y >= 49.23, from corrected
`level-zones.json`. A's walking surfaces are world 2.87 / 6.18 m; the model
transforms and structural reference heights stay at the B datums 3.5 / 6.44 m.
The four hall risers are 0.1575 m. Three measured tread centres and the documented
after-point add four places and four stair connections. The original e09 row
is retargeted to after-point -> elevator hall, removing the direct bypass while
preserving its ID. p09 retains its ID and moves off the tread to (28,47.6).

The two complete scoped revisions produce **68 places / 63 connections**.
An upgrade from the prepared older 64/59 preserves all 64 place IDs and 59
connection IDs. Repeated import is a no-op. `first-floor-candidate.json` and
`second-floor-candidate.json` match the published backend datasets byte for byte.
Backend publication and the excluded continuity ancestor are recorded in
`backend-publication.json`.

The Site top is world 3.35 m, 0.15 m below the B slab. The courtyard waypoint
therefore has model-only world height 3.35 m. This does **not** establish a
surveyed access-zone N -0.15 level. `outdoorSupportNodes: ["Site"]` is separate
from interior walking support and may be used only on outdoor connections.
Laboratory B / circulation / Lockers keep pending physical levels and the
candidate's flat model heights. e10 remains conservatively classified as stairs.
The west block, sloped hall and upper A/B junction remain unresolved.

## Verified behavior

- Build/typecheck and 42 frontend unit tests pass. 40 pertinent API cases pass
  (`api.xml`): migration, rollback, repeat import, stable IDs, both algorithms,
  seven destinations both ways, explicit heights and stair exclusion.
- **36 distinct browser cases pass**, combining the successful original cases,
  corrected repeats, C14 base/upper/classified profiles and both sample-campus
  cases. `verification.json` derives this count from the retained Playwright
  reports and records the superseded test-driver failures separately.
- `geometry.json`: six structural anchors align; **126 directed graph checks**
  pass with 11,760 supported substeps and body/head collision rays. Four east/west
  tower inspection probes pass with 1,278 substeps; the west probes create no API
  routes. No wall, glass, furniture or hidden geometry is exempted.
- Seven shipped-profile browser tests complete **14 automatic arrivals**, all
  final error **0 m**, no blocked state or page errors. They use a real temporary
  FastAPI, the two scoped revisions and the shipped C15 URLs; no browser model or
  reference overrides. The extra isolated test destination exists only there.
- Guided stair playback, keyboard ascent/descent through the hall and tower,
  pause, keyboard intervention and replanning pass. Keyboard endpoints are within
  0.065 m of the intended stopping points and preserve explicit floor metadata.
- `browser-support.json`: independent downward rays validate 3,266 automatic
  positions, 258 manual and 79 pause/replan positions, including the four offset
  rays of a 0.12 m foot footprint. Stored coordinates have 1 mm resolution. One
  automatic sample rounds onto a stair nosing; only its +/-0.5 mm X/Z rounding
  cell is searched, with the same <=1 mm vertical tolerance. This does not allow
  a full riser of vertical error. Interior checks never use Site.
- Outdoor keyboard travel passes in both directions, including slab/Site height
  transitions. Another **1,305 positions** pass the independent foot/footprint
  check; the combined C15 position count is **4,908**. The keyboard driver follows
  nearby points on the API centre line using real W/A/S/D pulses.
- `interaction.json`: two complete floor-view cycles return to **583 buffers /
  10 textures**, with the actor fixed. These are WebGL object counts, not GPU
  byte measurements. Brave headless, 1440x1000, local RTX 5060 / ANGLE Direct3D11:
  approximately **144 FPS** during the three-second upper-floor sample; this is
  local evidence, not a guarantee for other hardware.
- `preserved-profiles.json`: all four prior profiles and root metadata are
  unchanged; **35 resource entries** verify against their served hashes. C15 has
  separate `models/c15/floor-N.glb` URLs and committed `modelSource` declarations.
  Its stair footprint overrides remove the old mixed hall restriction from the
  now-clear approach while preserving the known B crossing.

`playwright.json` records the first pass: eight tests passed and one test
incorrectly tried to search for an internal waypoint. Internal destinations stay
hidden. The corrected restriction test starts at the before-point and requests
ICETEX along the clear approach. Its repeat, the substituted-flat-GLB rejection
and older-profile regressions are recorded separately in `regression-results.json`
and `regression/`; the original failure evidence is retained outside commits in
`test-results-c15/`.

The first outdoor keyboard driver aimed at distant endpoints and drifted roughly
0.6 m off the centre line into the access glass; the existing collision correctly
stopped it. Its failed report is retained in `outdoor-results.json`. The driver
now follows a nearby point on the same API centre line; the repeated case passes
in `outdoor-repeat-results.json`. No collision exemption was introduced.
`sample-results.json` records both preserved sample-campus cases, and
`classified-upper-results.json` records the previous 64/59 classified profile.

## Reproduction

Use the existing backend venv and installed frontend tooling. The preparation
tools read committed evidence; they do not launch Blender or alter its exports.

```powershell
node --experimental-strip-types tools/prepare-c15.ts
# Add --export-datasets only when intentionally regenerating the two prepared files.
node --experimental-strip-types tools/prepare-c15-profile.ts
npm run build
npm test
$env:UNINAV_RENDERER='hardware'
$env:UNINAV_REQUIRE_FPS='1'
npx playwright test tests/e2e/c15.spec.ts tests/e2e/c15-assets.spec.ts
node --experimental-strip-types tools/verify-c15-playback.ts
```

The browser fixture reserves its own OS-assigned port and uses only a new
temporary database. It closes its own process tree after each test. Existing
8000/8001 processes remain untouched. `prepublication.json` records the real
19/16 counts, endpoint availability, Git identity/authentication and unchanged
foreign-file hashes without credentials.

## Remaining work

The canonical launcher/seed still intentionally uses the old baseline; adopting
68/63 requires a coherent reviewed seed, API contract and staged deployment.
Do not import behind the older running 8001 API or silently replay the old seed
over the C15 revisions. Keep both scoped imports in one outer transaction.
Grouping directions by flight/landing and reducing internal origin choices are
independent frontend tasks. C15 floor 2 still has a 3.20 m inspection stair to
flat floor 3; its physical rise is 3.69 m and needs a compatible next-floor model.
No route above floor 2 or toward the unresolved B split is accepted by this work.

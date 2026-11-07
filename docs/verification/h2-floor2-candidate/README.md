# Three floor-2 destinations through the east stair

The prepared graph connects Hall Acceso and the existing north circulation to
three source destinations on floor 2. Six complete browser arrivals pass with
real FastAPI routes, using committed C13 `a2dbda0` and test-specific model/data
bindings. **Neither development database nor the active public manifest changed.**
The public floor-2 selector remains an inspection preview. This is not H2 closure
or completion of the three plans.

| Destination | Drawn access | Arrival |
| --- | --- | --- |
| Mixed Reality Laboratory | D14, centre (46.604, 53.605) | (46.604, 53.005), Y 6.44 |
| Molecular Biology Laboratory | D15, centre (47.122, 56.075) | (47.122, 56.675), Y 6.44 |
| Medical Research Centre | D13, centre (34.916, 53.580) | (38.569, 51.782), Y 6.44, after two interior turns |

The labels come from the registered CAD sheet. The split `REAL LIDAD` / `MIXTA`
and `CENTRO DE` / `INVESSTIGACIONES` / `MEDICAS` strings are retained as source
facts. D13 does not enter the Medicine staff room across the glass partition.
The research route goes around the existing interior obstacle; no collider was
removed. Blue labels and green paths in `route-plan.svg` / `.png` show the review.
The source text is not automatically treated as a walking endpoint.

`docs/blocks/floor2-door-accesses.json` transcribes the selected jambs and stand
points from Claude's extraction. `route-candidate-checks.json` records its exact
hash, the committed wing JSON and GLB hashes, semantic checks and every directed
segment. The floor-1 junction lies on the original north corridor. Its two
collinear links retain the legacy direct edge and preserve all original IDs and
connections; this redundancy does not invent another physical passage.

## Results

| Check | Result |
| --- | --- |
| Build / typecheck | Passed; unchanged runtime bundle `index-8Ch4cN_C.js` |
| Frontend unit tests | 29 passed |
| Pertinent API suite | 33 passed in 24.98 s |
| New integration browser cases | 4 passed in 3.8 min |
| Three destinations, outbound and return | 6 arrivals; 1,648 recorded positions; final error 0 m; no blocked state |
| New graph geometry | 43 bidirectional paths / 86 directed checks clear with support and all torso/head obstacles |
| Independent foot check | 482 new-scope positions agree with slab/tread support at the DOM's 1 mm resolution |
| Algorithms | A* and Dijkstra agree within 0.01 m, both directions for all three targets |
| Stairs excluded | 404 for all three targets; no invented elevator/ramp alternative |

`browser-support.json` uses independent downward rays at the recorded browser
positions. All positions are also checked against their route. Its maximum 3D
distance to a graph chord is about 0.0605 m on discrete treads; that includes
vertical foot support rather than indicating a shortcut through walls. This is
not a claim of sub-millimetre physical accuracy. Sources retain the flattened
A/B half-levels and derived physical block identity.

The official prepared backend file is `data/datasets/ucc-second-floor.json`:
45 new records (including hidden waypoints and three structural references),
43 paths, scope `ucc:floor2-connection`. With the base it produces 64 places and
59 paths. Its places/paths are identical to the browser-rehearsed candidate;
only revision/source metadata distinguish the ready export. API tests check
repeat import, unchanged base IDs/path endpoints, original destinations,
height/door/waypoint IDs, stairs exclusion and atomic rejection without the base.
The disposable browser DB also contains its isolated error destination (65 places).
Backend prerequisite for these prepared-data tests: commit `a1d2617`, including
the dataset, its API tests and the previously delivered `--dataset` fixture option.

The API-aligned `public/models/floor-2/campus-navigation-reference.json` is prepared
and checked against the same GLB nodes and dataset positions. It is not selected
by the active manifest. The build stages only its declared reviewed resources,
so the newer working exports do not replace C13 or become active automatically.

## Intermediate working-model rehearsal

`working-snapshot/` retains the earlier JSON results on working upper hash
`44fbeda292f178da1acb3e75e9bad4bb86b218d0dd3d70f07830b8a25370bfb6`.
Those same six journeys passed, but that export was not committed at rehearsal
time. The final reproducible evidence in this directory uses C13 hash
`63a1ac43b914d7767e284dc8ace5856a6f6a87bdc38f8e1c05a661c1dda3f61a`.
The newer delivery still requires its own source/manifest review. No Claude
source, reference document or GLB was edited by Codex.

## Remaining activation work

Prepare a compatible model/data manifest for the 64/59 dataset, preserving the
current 19/16 profile. Bind the new API reference independently from the older
GLB source if their commits differ. Confirm the serving API exposes explicit
elevations and stable waypoint IDs before importing into the real database; the
running 8001 process still has its older loaded contract and was preserved.
Check public directory/label legibility, instructions through the many stair
waypoints and resource/performance behavior for the activated profile.

The physical B laboratory stair/ramp discrepancy, A/B confirmation, remaining
floors/functions and faceless avatar integration are still pending.

## Reproduce

```powershell
node --experimental-strip-types tools/prepare-floor2-route-candidate.ts
node --experimental-strip-types tools/render-floor2-route-candidate.ts
npm run build
npm test
$env:UNINAV_RENDERER = 'hardware'
$env:UNINAV_EVIDENCE_DIR = 'docs/verification/h2-floor2-candidate'
npm run test:e2e -- --grep 'mapped floor 2|floor 2 API algorithms' --output test-results/h2-floor2
node --experimental-strip-types tools/verify-floor2-playback.ts
```

Use `UNINAV_EXPORT_FLOOR2_DATASET=1` only when intentionally regenerating the
prepared backend file and API reference after the geometry check. It does not
write a database. Run `tests/api/test_ucc_second_floor.py` with
`venv/Scripts/python.exe`; never substitute the development database for a test DB.

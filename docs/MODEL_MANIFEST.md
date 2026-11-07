# Model catalogue and integration manifest

`public/models/campus-manifest.json` is Codex's integration contract. It replaces
the hardcoded single-GLB load while keeping Claude's existing first-floor reference
JSON and model paths. Its catalogue snapshot comes from the backend's canonical
`data/campus-catalog.json`, sourced from `docs/blocks/dwg-inventory.md` (`a35f892`).

The catalogue contains stable block/floor IDs, sheet labels, documented elevation
datums and evidence states. A/B identities and attribution of levels remain
**derived**. The twelve floor records do not create twelve navigable floors.
Roof sheets remain unassigned rather than receiving invented software levels.
The integrated C2 dataset is separately recorded as a flat model at scene Y = 3.5 m.
Survey datums are applied only with matching geometry and verified connections.

## Ready model entries

Each independent floor model has a stable ID, label, floor, revision, reference
path, source Git commit, reference SHA-256, GLB SHA-256 and data binding. The current
entry is `ucc-first-floor`, reviewed export C13 `a2dbda0` (first-floor geometry
from `71c5e80`). It deliberately keeps the
combined first-floor area together while physical block assignments are pending.
Several independent model entries may share a software floor number.

The `campus-exterior` entry has `kind: "exterior"`, `navigable: false`, no floor
assignment or graph binding, a direct model path and the documented transform.
It uses reviewed C5 commit `31c5d68`, scale 1, rotation 0 and translation
`[0, 3.5, 0]`. Its source document preserves block-identity and facade
approximations. It has no API reference nodes of its own: the base first-floor
anchors remain validated separately and the overview badge identifies them as such.

The exterior is requested only in Campus view. It never contributes collision
meshes, route waypoints or destinations. Floor selection, destination selection
and route planning leave the overview; guidance keeps it disabled until cancelled.
Returning to a floor releases the exterior and preserves the avatar's position.
If the exterior is missing or its hash changes, the verified first floor stays
usable and the overview can be retried.

The data binding includes the named scope's coordinates/elevations and incident
graph edges, types, directions and weights. Database row IDs and API ordering do
not affect it. Disconnected test-only places do not affect it. A changed graph can
invalidate a model even when its three reference anchors still align.

Runtime loading checks both file hashes, the data binding, reference alignment
against the live API, and named GLB reference nodes. Missing, pending, mismatched
or failed resources produce a clear state. No unknown reference is skipped.

The resource store keeps models required by the observed floor, the avatar floor
and route floors, releases unused resources and rejects stale asynchronous loads.
Selecting another floor changes the view and preserves the avatar's position.
Confirmed sheet levels with no integrated model show **model pending**. Destination
search still lists actual API places. A real-campus route cannot follow a floor
whose required model is missing. The unrelated sample campus retains graph mode.

## Reproducible builds during modelling

The manifest keeps the original 19-place / 16-path binding as its base and adds
`profiles`, including `ucc-two-floors` for the prepared 64-place / 59-path dataset.
Selection checks all navigable model bindings together. The expanded profile also
requires explicit place/connection codes, floor codes and finite `elevation_m`
values from the API. `effective_elevation_m` alone cannot satisfy this contract.
A partial or stale UCC dataset is rejected; unrelated sample data keeps graph mode.
The model badge exposes the selected profile in `data-profile`.

`ucc-first-floor-stair-review` and `ucc-two-floors-stair-review` also bind the
prepared three-connection classification in `ucc-first-floor-stairs.json`.
The original base and two-floor profiles remain available. These revisions
change filtering, not geometry: C13 still flattens the hall and B laboratory
level changes. They are not physical-level acceptance or a public data rollout.

`stairCrossings` records those source-backed connections separately from an
older API's corridor labels. The client rejects them if Avoid stairs is selected,
including in reverse. For a connector from the current position to its initial
API node, only intersection with the documented stair rectangle (expanded by the
existing foot footprint) blocks it. A clear portion of the same long connection
remains available. These facts apply only to a recognized UCC model profile;
unrelated sample data keeps its own path kinds. Missing sources, malformed bounds
and unknown bound endpoints fail manifest validation.

Regenerate the reviewed classifications after their sources change:

```powershell
node --experimental-strip-types tools/prepare-stair-review.ts
npm run build
```

The tool uses ordered isolated imports and preserves existing model resources.
Its proposed physical splits, source rectangles and pending levels are in
`docs/blocks/first-floor-level-review.json`; see the companion `.md` for Claude's
candidate request. A graph connection marked stairs can include a clear approach;
its full distance is not a surveyed stair-flight length.

`tools/prepare-floor2-profile.ts` obtains the actual serialized API snapshot using
the disposable backend fixture's `--snapshot-json` mode. It opens no port and
never touches a development database. Its first-floor binding includes the new
incident edges. Floor 2 uses the API reference first delivered in `a6d3f11`,
paired with the reviewed C14 export in `389cfd9`. The build stages assets from every profile, rejecting conflicting bytes
at a shared URL before replacing the last build. Baseline refresh preserves the
profile declarations; changed shared geometry needs coherent updates to all users.

Before importing into any existing deployment, run this read-only check:

```powershell
$env:UNINAV_TEST_URL = 'http://127.0.0.1:8001'
node --experimental-strip-types tools/check-campus-profile.ts
```

`--require-expanded` also fails unless the expanded profile is already active.
This check does not approve physical levels or stop/restart any service. The
existing 8001 process still serves the older API contract and 19/16 dataset.
Do not import the expanded dataset behind it. Public acceptance also requires
resolving the first-floor hall steps and Block B laboratory stair documented in
`docs/blocks/vertical-connections.md`; C13 still flattens those areas.

The directory retains every destination. Scene labels prioritize the selected
destination and nearer labels, hiding overlapping rectangles until the view has
space. Measurements are cached and refreshed after fonts, viewport or data change.

`npm run build` stages only manifest-declared reviewed assets in a temporary public
directory, then runs Vite. If a working GLB or reference differs, it reads the exact
reviewed bytes from `sourceCommit` and verifies the hash before replacing `dist`.
Claude's working files are never changed. A newer export therefore remains pending
until reviewed, registered in Git and integrated into the manifest.

This requires the reviewed commit in the local Git history (a normal full clone
contains it). An unavailable or mismatched reviewed asset fails before Vite clears
the previous build. Unintegrated exterior models and working reference photographs
are not copied into the app automatically.

To refresh the baseline entry **after reviewing and committing a new export**:

```powershell
$env:UNINAV_TEST_URL = 'http://127.0.0.1:8001'
$env:UNINAV_MODEL_COMMIT = '<reviewed commit>'
$env:UNINAV_MODEL_REVISION = '<review label>'
node --experimental-strip-types tools/prepare-manifest.ts
npm run build
```

The preparation tool reads the committed reference and GLB, combines them with
the canonical catalogue and the selected live API dataset, and preserves other
independently integrated entries. It does not approve geometry. Check its diff,
alignment and every affected route before publication. New floors need their own
reference path, scope and model entry rather than replacing the first-floor entry.

To check the deployed reviewed floor while working exports differ:

```powershell
$env:UNINAV_MODEL_ROOT = 'dist/models'
$env:UNINAV_VERIFY_DIR = 'docs/verification/<revision>'
node --experimental-strip-types tools/verify-model.ts
```

`campus.spec.ts` audits the reviewed served hash throughout its walks and records
the working export's hash separately. An unintegrated working change is not
evidence that the served revision changed. A changed served revision fails the
rehearsal.

## Structural floor previews

Floors 0, 2, 3, 4 and 5 are available for inspection. Their entries use
`kind: floor-preview`, `navigable: false`, exactly one floor, reviewed hashes and
a source document. They cannot declare a graph binding or satisfy an avatar/route
model requirement. Only the observed preview is loaded, alongside the reviewed first floor for the
avatar; leaving it disposes its resources. Previews add zero collision meshes.
The unrelated sample API never loads these UCC resources.

Preview reference JSON uses `alignment: structural` and an explicit
`planPosition: [x,y]` for each of its three named GLB anchors. The legacy field
`buildingName` acts as the anchor label here; it does not create an API place.
Validation compares the documented plan frame and the actual GLB nodes. Normal
navigable floors require API alignment and data binding; structural alignment
cannot promote a preview to a navigable model.

The scene uses the source's recommended model transform and keeps presentation
ground below its lowest geometry. The legacy cuts flatten their A/B half-levels
and retain the documented stair approximations; the C16 cuts described below
carry their reviewed A offsets inside the GLB. The selector and model badge say **preview**;
movement remains on the avatar's floor. Resuming a preserved route restores its
view without repositioning the avatar. See
[integration review](blocks/floor-preview-integration.md) for the remaining checks.

The build also validates every recovery asset against its committed hash when
the working copy matches. Text hashes use the committed bytes, avoiding Windows
line-ending differences. This catches an incorrect source commit before the next
working export changes and needs recovery.

## Remaining navigation work

C14 (`389cfd9`) is integrated for floors 0, 2, 4 and 5 across all four profiles.
Floor 3's GLB is unchanged; the first floor remains the reviewed C13 export and
the exterior remains C5. `tools/integrate-c14.ts` verifies committed references,
GLB anchors and support node names before updating the integration metadata.
The model source, original data bindings, stair restrictions, profile identities
and navigation dataset are preserved. See `verification/c14/README.md`.

The three selected floor-2 doorway facts now cite their committed inventory,
SHA-256 `18fc3d7c…`, rather than a working snapshot. Other inventory entries
remain drawing facts: the known floor-0 toilet/door-leaf and balcony-glass probe
exceptions do not become accepted entrances. Structural previews create no API
destinations. The C15 hall and Block A levels have a separate prepared profile;
the B laboratory levels remain unresolved. The live API continues to select C14.

Browser playback verification reads the recorded source revision and checks its
model hashes, including the unchanged lower model. Visual audits may change
`elevation_source` documentation; every other prepared place field and every path
field must remain identical. This does not relax runtime model/data bindings.

Navigable entries can declare `supportNodes`, a reviewed list of exact GLB node
names for floor slabs and stair treads. Missing nodes fail loading. Previews and
exteriors cannot declare foot support. The current first floor declares
`Floor_Slab`, `Stair_A_West_1` and `Stair_A_East_1`; rails and furniture remain
obstacles and do not support the feet. New exports require this list to be
reviewed again alongside their hashes.

Stair movement samples the actual top surfaces inside a 0.12 m foot footprint,
allows at most a 0.20 m step, and keeps torso/head collision checks against every
obstacle. These are movement parameters, not claimed physical stair dimensions.
Missing support blocks movement. Both keyboard and guided motion use bounded
substeps of at most 0.06 m. Floor changes follow graph endpoint metadata.
Nearby stair components retain adjacent navigable floor models even after route
cancellation; preview resources cannot supply that requirement.

The first supported vertical rehearsal used disposable data and test-specific
bindings (`verification/h2-stair-support/README.md`). The expanded profile now
runs against the same shipped manifest, references and models, without resource
overrides. Its data remains disposable; the public floor-2 view remains a preview
while the live API selects the base profile. See `verification/h2-profiles/README.md`.

Backend `15f467c` provides stable identities, repeated visible labels, ID/position
waypoints and scoped versioned imports; see `UniNav/docs/CAMPUS_DATASETS.md`.
The physical block inventory still has derived A/B identities. Upper-floor routes
need confirmed destinations, door/turn coordinates, vertical waypoints, coherent
elevations and full clearance/support rehearsals. The measured B laboratory stair
still needs matching geometry/data. Preview delivery does not complete H2 or the
three plans.

## C15 levels and independent model URLs

`ucc-two-floors-c15` binds exactly the two prepared C15 dataset revisions
(68 places / 63 bidirectional connections). The four older combinations are
preserved. Dataset coordinates and topology select the profile; partial elevation
metadata or a mixed revision fails closed. Each profile may override
`stairCrossings`, so the now-clear approach to the hall does not inherit the old
mixed connection's stair restriction.

C15 exports remain in Claude's `model/candidates/c15/` as the historical delivery. A navigable model can
declare `modelSource: {commit, path}` and an explicit safe `model` URL. The build
verifies that committed source's SHA-256 and stages it at `models/c15/floor-N.glb`.
The initial C15 integration used those URLs; the current compatible C16 review
below advances the same data profile to independent C16 URLs. The original
public export and all four legacy profile URLs stay intact. References
retain their independent reviewed source commit and hash: the structural B datum
anchors did not move when the Block A walking surfaces changed height.

The hall now has four 0.1575 m risers, floor-1 A at world 2.87 m and floor-2 A at
6.18 m. The graph contains the three measured tread centres plus the after-point.
It retargets the original e09 connection atomically, preserving its row ID while
removing the old direct bypass. Floors 0/3/4/5 remain previews with their existing
approximations; C15 enables no routes to them. Laboratory B, the sloped hall,
western block and upper A/B junction keep their explicit pending status.

C15 declares `outdoorSupportNodes: ["Site"]` separately from interior slabs and
stair support. Only outdoor connections may use that mesh. Its top is 0.15 m
below the B slab, so the courtyard node uses world 3.35 m as a **model-only**
placement, not a surveyed level. Guided and keyboard movement sample those
outdoor surfaces; interior holes and stair wells cannot borrow their support.
The presentation ground stays below the model's lowest visible surface.
See `verification/c15/README.md` for the disposable API/browser rehearsal and
remaining activation work.

The backend now has a versioned startup registry for all five reviewed
combinations. `scripts.run_campus --profile ucc-two-floors-c15 --database <review.db>
--port 0` rehearses the actual launcher against an explicit isolated file.
The default remains the old baseline and the existing 8001 service remains
untouched. Input payload hashes, in-memory patch composition, atomic scoped
imports and downgrade guards keep restarts coherent. See backend
[startup profiles](https://github.com/1dxvn/UniNav/blob/main/docs/CAMPUS_STARTUP.md)
and `verification/campus-startup/README.md`. This is prepared startup support,
not evidence that the live development data was upgraded.

## C16 models on the unchanged two-floor dataset

The `ucc-two-floors-c15` identifier names the **data combination**, not a permanent
GLB revision. Its 68/63 data binding, profile identity and stair restrictions stay
unchanged while its five floor resources advance to reviewed C16 `002aaec`, at
`models/c16/floor-N.glb`. A second profile with identical bindings would be
ambiguous, so this accepted model revision updates the existing entry. The C15
exports and previous manifests remain available in Git for historical rehearsal.
The default base and all three other legacy alternatives retain their exact
resources. No source GLB or backend dataset was edited.

Floors 1/2 remain the only navigable cuts for that data combination. C16 floors
3/4/5 are structural previews with no data binding, colliders, foot support or API
destinations. Their A surfaces are world 9.87 / 13.37 / 16.87 m; references keep
their documented B datums 9.38 / 12.32 / 15.26 m. Fifteen actual GLB reference
nodes and the current two-floor graph pass the integration audit. Source and
reference commits are independent: unchanged structural reference JSON is reused
with its own reviewed hash while `modelSource` points to C16.

Both tower geometries join the C16 neighbours at rises 3.31 / 3.69 / 3.50 / 3.50 m.
The floor-3 hall has four 0.1225 m risers. These are inspected geometry, not new
API connections. A/B junctions 2/4/5, the western/sloped/B laboratory zones,
floor 0 and the rooftop still need their own accepted sources/routes. The floor-0
preview remains C14 and does not supply a vertical connection to C16 floor 1.

`tools/integrate-c16.ts` audits committed exports, references, foot footprint and
body/head rays before `--integrate` can update the manifest. It includes rejected
unreviewed junctions and a C15/C16 neighbour mismatch as negative controls.
`tools/verify-c15-playback.ts` now reads and hashes each recorded model source,
so the same unchanged data can be rehearsed against its actual accepted GLBs.
`UNINAV_SUPPORT_REPORT` can write a historical verification into a new report
without modifying the old evidence. See `verification/c16/README.md`.

## Three-floor C16 profile

`ucc-three-floors-c16` binds the prepared 110-place / 102-connection API. The
five historical combinations retain their exact manifest entries. Only this
new profile promotes C16 floor 3 from inspection to navigation, with three
source-backed computer laboratory entrances and the east 2-to-3 stair. It
declares `P3_Floor_Slab` and both tower support nodes; floors 0/4/5 remain
non-navigable previews. Existing C16 GLB URLs and hashes are shared unchanged.

`models/c16/floor-3-navigation-reference.json @72d1aaa` is owned integration
data, using API alignment with the three unchanged structural markers at
world 9.38. Walking A surfaces use explicit world 9.87. `modelSource` remains
C16 `002aaec`. Rebinding floors 1/2/3 includes the new corridor and stair edges,
so a partial contract cannot fall back to the two-floor combination. The build
checks 42 ready model entries across six combinations before replacing `dist`.

`tools/prepare-floor3-profile.ts` takes an actual temporary FastAPI snapshot;
`tools/prepare-floor3.ts` audits source doors, labels, support and body/head
clearance; `tools/verify-floor3-playback.ts` independently inspects recorded
browser positions against committed walking surfaces. None modifies Claude's
geometry, the real database, the sample or the running user services.
See `blocks/floor3-navigation.md` and `verification/floor3/`.

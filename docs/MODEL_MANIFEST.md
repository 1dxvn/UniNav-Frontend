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
entry is `ucc-first-floor`, reviewed export C11 `9ac3795`. It deliberately keeps the
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

The scene uses the source's recommended world elevation for both model and
presentation ground. These cuts flatten their A/B half-levels and retain the
documented stair approximations. The selector and model badge say **preview**;
movement remains on the avatar's floor. Resuming a preserved route restores its
view without repositioning the avatar. See
[integration review](blocks/floor-preview-integration.md) for the remaining checks.

The build also validates every recovery asset against its committed hash when
the working copy matches. Text hashes use the committed bytes, avoiding Windows
line-ending differences. This catches an incorrect source commit before the next
working export changes and needs recovery.

## Remaining navigation work

Backend `15f467c` provides stable identities, repeated visible labels, ID/position
waypoints and scoped versioned imports; see `UniNav/docs/CAMPUS_DATASETS.md`.
The physical block inventory still has derived A/B identities. Upper-floor routes
need confirmed destinations, door/turn coordinates, vertical waypoints, coherent
elevations and full clearance/support rehearsals. The measured B laboratory stair
still needs matching geometry/data. Preview delivery does not complete H2 or the
three plans.

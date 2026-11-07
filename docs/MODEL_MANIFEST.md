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
entry is `ucc-first-floor`, reviewed export `efd05d1`. It deliberately keeps the
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

## Remaining H1 work

The backend catalogue is read-only metadata; it is not a migration of `Building`
or the name-keyed graph. Stable place/connection identifiers, repeated visible
names, ID-based route waypoints and non-destructive versioned campus seeds remain
to implement. This delivery prepares the resource side and source inventory.
The exterior is integrated as a non-navigable overview with separate controls.
Further floors need documented
doors, elevations, vertical waypoints, matching exports and physical rehearsals.

# C16 model integration on the current two-floor graph

7 November 2026. Five C16 resources are integrated in the existing
`ucc-two-floors-c15` **data profile**. The 68 places / 63 bidirectional connections
and their bindings/restrictions are unchanged. Floors 1/2 remain navigable;
floors 3/4/5 are structural previews. No upper-floor destination or connection is
added. The live 8001 service still has its legacy 19/16 data and selects the
unchanged base. H2 and the three project plans remain incomplete.

## Sources and compatibility

C16 GLBs/configuration are pinned to `002aaec`, with level-zone documentation at
`fb39c86`. Working exports match their committed bytes; no source model was
edited. The build stages them at separate `models/c16/floor-N.glb` URLs. Existing
structural/API reference JSON retains its own source commit and hash.

| Floor | Model SHA-256 prefix | B datum | A walking surface | Role |
| --- | --- | --- | --- | --- |
| 1 | `15745b7e` | 3.50 | 2.87 | Current graph |
| 2 | `b099eb79` | 6.44 | 6.18 | Current graph |
| 3 | `9f2cd05b` | 9.38 | 9.87 | Preview |
| 4 | `a187213f` | 12.32 | 13.37 | Preview |
| 5 | `8ba3edac` | 15.26 | 16.87 | Preview |

Structural references stay at their B datums, independently of A's walking
surface. Fifteen actual GLB anchors pass the agreed 0.15 m tolerance; their
largest numerical residual against the references is 0.000001955 m.

The data profile identifier remains stable because its API dataset did not
change. Adding a second profile with identical bindings would make selection
ambiguous. The accepted GLB revision therefore advances the existing entry.
The four legacy profiles, root metadata, all data bindings and stair constraints
remain identical to `83faafe`; C15 exports and manifests remain available in Git.
All **35 resource entries** verify against the built hashes.

## Geometry and browser evidence

- `geometry.json`: **144 positive directed inspections**, **16,993 substeps**:
  126 graph directions, 16 east/west tower directions across floor pairs 1-5 and
  both directions through the floor-3 hall. Actual foot support, the 0.12 m foot
  footprint and body/head rays use every mesh of all five floors. No positive
  inspection is blocked, unsupported or stalled.
- Four negative controls remain rejected: the unreviewed A/B junctions 2/4/5
  (missing support at 2/4, a wall at 5) and a C15-floor-2/C16-floor-3 stair
  mixture. The latter cannot reach its expected tread height and is recorded as
  unsupported/no progress. These probes add no API records.
- Build/typecheck passes with unchanged runtime `index-C7kyba8H.js`. **42 frontend
  unit tests**, **30 pertinent API cases** and **17 browser cases** pass. One
  additional before-integration baseline case passes. The initial inspector
  required explicit source-array typing and detection of no-progress negative
  probes; the completed audit/build passes without changing movement limits.
- Seven destinations complete **14 automatic arrivals**, final error **0 m**,
  no blocked state or page errors. Keyboard hall/tower up/down, pause, manual
  intervention, replan, outdoor keyboard travel and substituted-flat-GLB rejection
  pass through the actual production launcher on explicit temporary databases.
- `browser-support.json`: independent rays validate **4,952 positions**, at 1 mm
  recorded resolution: 3,263 automatic, 295 manual stairs, 79 pause/replan and
  1,315 outdoor. The unchanged verifier tolerance resolves only the X/Z rounding
  cell at a stair nosing; it does not admit a riser of vertical error. Site is
  available only to outdoor route segments.
- The playback verifier reads and hashes **each recorded committed model source**
  instead of assuming C15 geometry. `legacy-c15-support.json` also revalidates
  the previous startup evidence without rewriting the historical reports.
- Five production-profile contract cases retain all five profile selections and
  **116 API route calculations** across both directions and both algorithms.
- Two floor-view cycles return to **579 buffers / 10 textures**, with no growth.
  These are WebGL object counts, not GPU byte measurements. Brave headless,
  1440x1000, local RTX 5060 / ANGLE Direct3D11: about **144 FPS** during the
  three-second upper-floor sample; not a guarantee for other devices.

`verification.json` consolidates the results. `api.xml` and `browser-results.json`
retain test outcomes; `*-walks.json`, `interaction.json`, `outdoor-manual.json` and
PNGs retain the actual routes and positions. `before-*` and `after-*` capture
matching floor 3/4/5 views at the same viewport and camera presets. The raised A
surfaces and their slab edges remain visible; inspection preserves the actor,
origin options and destination catalogue. No preview supplies navigation support.

## Reproduction

From the frontend root, using the existing backend venv and installed tooling:

```powershell
node --experimental-strip-types tools/integrate-c16.ts
# --integrate intentionally advances the manifest only after the audit passes.
node --experimental-strip-types tools/integrate-c16.ts --integrate
npm run build
npm test
$env:UNINAV_RENDERER='hardware'
$env:UNINAV_REQUIRE_FPS='1'
$env:UNINAV_C15_STARTUP='1'
$env:UNINAV_C16_PHASE='after'
$env:UNINAV_EVIDENCE_DIR='docs/verification/c16'
npx playwright test tests/e2e/c15.spec.ts tests/e2e/c15-assets.spec.ts tests/e2e/c16.spec.ts tests/e2e/campus-startup.spec.ts
$env:UNINAV_VERIFY_DIR='docs/verification/c16'
node --experimental-strip-types tools/verify-c15-playback.ts
```

The before baseline uses `UNINAV_C16_PHASE=before` with the previous manifest/build.
Historical playback can use `UNINAV_VERIFY_DIR=docs/verification/campus-startup`
and `UNINAV_SUPPORT_REPORT=docs/verification/c16/legacy-c15-support.json`.
The fixture starts `scripts.run_campus --profile ucc-two-floors-c15` with its own
temporary SQLite file and reserved port, then closes only its own process tree.

## Remaining work

Geometric stair inspection does not accept API routes above floor 2. Floor-3
destinations, doors, turns, metadata and the vertical graph need their own scoped
dataset and browser rehearsal. A/B junctions 2/4/5, the B laboratory/sloped/western
zones, piso cero and rooftop remain unresolved. The C14 floor-0 preview has no
accepted connection to C16 floor 1. The next source handoff is recorded in
`docs/blocks/first-floor-level-review.md`.

The real database remains 19/16 and both existing services stay active. Source
GLBs, datasets, `scripts/seed.py` and continuity files are unchanged; backend
remains `b48f338`. Public activation still needs a compatible coordinated service
and verified backup. This model-only frontend delivery does not restart it.

# Versioned campus launcher rehearsal

7 November 2026. The production launcher now supports five reviewed startup
profiles, including explicit C15. This delivery **does not upgrade** the existing
8001 service or its 19/16 database. H2, the remaining physical levels and all three
project plans remain incomplete. See backend
[startup instructions](https://github.com/1dxvn/UniNav/blob/main/docs/CAMPUS_STARTUP.md).
Backend implementation: `b48f338`; publication metadata is in
`backend-publication.json`. The local merge preserves the external continuity
work without making that ancestor part of the published backend history.

## Result

- Build/typecheck passes, with the same runtime `index-C7kyba8H.js`; 42 frontend
  unit tests pass. No frontend production code, model bindings or GLBs change.
- **62 Python cases pass**: 55 API and seven CLI (`python-tests.xml`). They cover
  all five profiles, repeat startup, legacy adoption, atomic bootstrap/multi-scope
  rollback, preserved IDs/history/other blocks and credentials, input payload
  drift, rejected downgrades and occupied-port rejection before file changes.
- **16 browser cases pass**, first pass: nine C15 journeys/interactions, five
  production-profile contract cases, flat-model substitution rejection and the
  outdoor keyboard round trip. They use `scripts.run_campus` itself, with explicit
  new temporary databases and OS-reserved ports. No fixture destination is added.
- The five API/model combinations select `base`, `ucc-two-floors`,
  `ucc-first-floor-stair-review`, `ucc-two-floors-stair-review` and
  `ucc-two-floors-c15`, at 19/16, 64/59, 19/16, 64/59 and 68/63 respectively.
  Their contract reports contain **116 route calculations** across both
  directions and both algorithms. `/app/`, Swagger, OpenAPI and health pass.
- C15 completes **14 automatic arrivals**, final error **0 m**, no blocked state
  or page error. Hall and vertical keyboard ascent/descent, pause, intervention,
  replan and outdoor keyboard travel pass through the production startup path.
- Independent foot/footprint rays verify **4,896 recorded positions**: 3,259
  automatic, 282 manual stairs, 78 pause/replan and 1,277 outdoor. Coordinates
  have 1 mm resolution; the verifier retains the previously documented nosing
  rounding-cell rule. See `browser-support.json`.
- Two floor-view cycles return to **579 buffers / 10 textures**, without growth.
  This run has no isolated test marker. These are WebGL object counts, not GPU
  byte measurements. Brave headless, 1440x1000, local RTX 5060 / ANGLE Direct3D11:
  about **144 FPS** over the three-second upper-floor sample; not a guarantee
  for other devices.
- The model manifest is unchanged from `aeca840`; all **35 resource entries**
  verify against their build hashes. C15 is still read from committed `3177ca7`.

`verification.json` consolidates results and preservation checks. The contract
files record the actual buildings, paths and API routes for every startup profile.
`*-walks.json`, `interaction.json`, `outdoor-manual.json` and the PNGs preserve
the browser evidence. `browser-results.json` and `assets-results.json` retain the
complete Playwright results. `prepublication.json` records Git/authentication and
foreign-file hashes without credentials.

## Startup behavior

The backend registry pins the scope, revision and canonical payload hash of each
input. Classified first-floor patches are composed in memory before import, so a
restart never replays the superseded flat seed. The two classified profiles share
one complete `startup-first-floor-stairs-v1` revision. All target scopes share an
outer transaction, preserving caller rollback and SQLite legacy-driver semantics.

Fresh/recognized legacy floors bootstrap once. Existing IDs, users, history and
unrelated scoped blocks remain. Known downgrades and profiles that omit an
installed UCC scope fail rather than deleting or reverting data. Port reservation
precedes seeding; the sample database is protected. The canonical real campus is
also protected from seed-only/alternate-port updates while legacy 8001 listens.

The browser fixture adds a `campusProfile` option to use the production launcher.
Its existing dataset fixture mode remains available; the two modes are mutually
exclusive. Cleanup verifies the resolved temporary directory and stops only the
fixture's own process tree. No supervisor, Windows task or worker was created.

## Reproduction

From the backend root, use the existing venv and temporary test DBs:

```powershell
venv/Scripts/python.exe -m pytest tests/api/test_campus_profiles.py tests/unit/test_campus_launcher.py
```

From the frontend root:

```powershell
npm run build
npm test
$env:UNINAV_RENDERER='hardware'
$env:UNINAV_REQUIRE_FPS='1'
$env:UNINAV_C15_STARTUP='1'
$env:UNINAV_EVIDENCE_DIR='docs/verification/campus-startup'
npx playwright test tests/e2e/campus-startup.spec.ts tests/e2e/c15.spec.ts tests/e2e/c15-assets.spec.ts
$env:UNINAV_VERIFY_DIR='docs/verification/campus-startup'
node --experimental-strip-types tools/verify-c15-playback.ts
```

This uses new temporary files and processes; no persistent service needs to be
restarted. The actual default `-m scripts.run_campus --port 8001` still selects
the historical base when that port is available.

## C16 delivery and remaining work

Claude delivered C16 during this milestone: `002aaec`, `fb39c86`, `90ec990`.
Five GLB delivery hashes match their committed bytes, but **Codex has not
integrated or rehearsed C16**. It is absent from the build/manifests. The reviewed
C15 remains fixed. Next review: references and support/head clearance across the
C16 1-5 floor set before accepting any new model or upper-floor route.

The live real DB remains 19/16 with its legacy p02 height and p09 position. Both
8000/8001 services and the foreign seed/continuity files remain unchanged. Public
activation still requires a coordinated compatible service and verified backup;
the old process was not stopped. C16 does not resolve the pending B laboratory,
western/sloped zones or all upper A/B junctions. Directions/origin usability,
other confirmed destinations and the faceless C6 avatar remain separate work.

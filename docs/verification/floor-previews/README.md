# Five structural floor previews · 7 November 2026

Floors **0, 2, 3, 4 and 5** now have inspectable 3D/top views. Each is explicitly
**Preview only** and cannot provide navigation, destinations or collision geometry.
C2 remains the navigable first floor; C5 remains the campus overview. Observing a
preview preserves the avatar, route and C2 collision resources. Resuming guidance
returns the view to the avatar's floor without moving its starting position.

The five GLBs contain C8/C9 furniture, C10's approximate repeated stair layout and
C11's slab wells. Their bytes are verified against `099c212`; reference JSON is
stored in `f15ddb9`. Each manifest entry pins a recovery commit containing both.
The build verifies those committed hashes even if the working export matches.
Text hashes use the committed bytes, including line endings.

| Floor | World Y | Meshes | Triangles |
| --- | --- | --- | --- |
| 0 | 0.56 m | 39 | 16,800 |
| 2 | 6.44 m | 54 | 32,234 |
| 3 | 9.38 m | 61 | 48,365 |
| 4 | 12.32 m | 55 | 37,210 |
| 5 | 15.26 m | 66 | 59,853 |

The elevations and anchors come from Claude's floor reference documents. The
cuts flatten documented A/B half-levels; these are model-view transforms, not
surveyed floor elevations. A/B identity remains derived. No API room or path was
created. The five exports total **11.85 MB** and are loaded only when observed.

## Verification

| Check | Result |
| --- | --- |
| Build / typecheck | Passed |
| Frontend unit tests | 21 passed |
| Pertinent API tests | 22 passed in 13.55 s |
| Campus / temporary API browser suite | 21 passed in 5.1 min; sample skipped on this URL |
| Final UI / preview guard rehearsal | 4 passed in 34.0 s |
| Original sample campus on port 8000 | 1 passed in 21.5 s; no UCC preview requests |
| Structural anchors | 15 GLB nodes verified; maximum node/document difference 0.000002484 m |
| Four C2 destinations, outbound and return | 8 arrivals, 1,593 samples; final error 0 m; no blocked state |
| Maximum C2 centre-line deviation | 0.000696 m (rounded up) |
| C2 geometry body rays | 32 directed edges clear; minimum wall clearance 0.35596 m |
| Added preview colliders | 0; C2 keeps 137 |

Tests cover every preview twice, unchanged avatar position and origin choices,
disabled hidden-actor keyboard movement, paused-route preservation and resume,
preview error recovery, changed GLB hashes, and rejection of structural anchors
as a replacement for a navigable floor's API alignment. The pending-floor test
uses a manifest with one preview intentionally removed. No fictitious floor was
added to the catalogue to exercise that case.

`gpu-resource-cycles.json` tracks actual WebGL create/delete calls. After each
complete cycle through all five floors, live handles return to the baseline:
**596 buffers and 19 textures**. Deleted buffer counts rise from 189 to 1,070 and
1,951; deleted texture counts from 1 to 24 and 47. These are handle lifetimes,
not VRAM byte measurements. Model-store and disposal unit tests also pass.

Floor 5's 3D view measured approximately **144 FPS**, 7.1 ms p95 frame interval,
over three seconds on local RTX 5060 / ANGLE Direct3D11, headless Brave at
1440 × 1000. This does not establish performance on other devices. Existing C2/C5
cadence checks pass too; see `after-performance.json` / `overview-metrics.json`.

`floor-N-3d.png` and `floor-N-top.png` show the final preview UI and geometry.
The eight C2 walks, structured API walk, service responses and geometry inspection
are in the adjacent JSON/captures. The observed first-floor export changed during
Claude's work, but `services.json` verifies that the served model remains C2:
`d65846a8b614062d63e60a339da6e9c9ce29e8ffae2d01a90fbd16611e6a356e`.
The newer first-floor `41e225fe…` at `9ac3795` remains outside the manifest.

## Remaining work

See [integration review](../../blocks/floor-preview-integration.md). C11 supplies
wells, but complete stair support/head-clearance sweeps, landings, arrival links,
confirmed upper-floor destinations and graph data still need acceptance. A
single clear vertical ray cannot accept a whole stair. The measured B laboratory
stair still has a flat C2 representation; its nearby ramp direction is unknown.
The three plans remain incomplete.

The initial source snapshot used local Windows text hashes. The stricter recovery
check rejected them; hashes were corrected to committed bytes, the build passed,
and the full browser suite was rerun. The interrupted pre-correction run is not
counted as acceptance evidence. No Blender sources, GLBs or Claude reference
documents were modified by Codex. Existing services and unrelated edits remain.

## Reproduce

```powershell
npm run build
npm test
node --experimental-strip-types tools/verify-floor-previews.ts
$env:UNINAV_TEST_URL = 'http://127.0.0.1:8001'
$env:UNINAV_RENDERER = 'hardware'
$env:UNINAV_REQUIRE_FPS = '1'
$env:UNINAV_EVIDENCE_DIR = 'docs/verification/floor-previews'
npm run test:e2e
$env:UNINAV_MODEL_ROOT = 'dist/models'
$env:UNINAV_VERIFY_DIR = 'docs/verification/floor-previews'
node --experimental-strip-types tools/verify-model.ts
```

For the separate sample case, use port 8000, evidence subdirectory `sample/`,
`--grep 'sample API'` and an output directory beneath ignored `test-results/`.

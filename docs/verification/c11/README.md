# C11 first-floor integration and waypoint playback · 7 November 2026

C11 `9ac3795` is the reviewed first-floor model, SHA-256
`41e225fec86f15303276342555be4924d24e1cef79826cfd696f433ca9cee645`.
It adds Claude's two stair towers and the slab well while preserving the existing
19 places, 16 bidirectional paths and four destinations. The manifest still binds
the original graph/coordinates; no upper-floor destination or edge was added.
C11 is accepted for those first-floor routes, not for its vertical stairs.

Runtime commit `d5add74` retains each waypoint's floor and place ID through
playback and a mid-edge connector. A high landing no longer changes floor via
`round(Y/3.5)`: floor identity changes when its labelled waypoint is reached.
Collision resources retain all navigable route levels, including overhead meshes.
Previews cannot satisfy that requirement. Manual vertical movement and actual
upper-floor route data remain pending.

The avatar head now participates in collision checks at +1.80 m, covering its
1.74 m height and 0.035 m walking bob. All meshes remain obstacles regardless of
visibility or name. The other two ray heights stay +0.45 and +1.20 m, with the
existing lateral offsets/lookahead. The body is still an approximate ray volume.

| Check | Result |
| --- | --- |
| Build / typecheck | Passed |
| Frontend unit tests | 25 passed |
| Pertinent API tests | 22 passed in 12.15 s |
| Campus / temporary API browser suite | 21 passed in 5.1 min; sample skipped on this URL |
| Original sample campus | 1 passed in 23.5 s; no UCC preview requests |
| Four first-floor destinations, outbound and return | 8 arrivals, 1,594 samples, final error 0 m, no blocked state |
| Maximum route centre-line deviation | 0.000696 m (rounded up) |
| Directed geometry checks | 32 clear with all nine torso/head rays |
| Minimum wall clearance | 0.35596 m |
| Navigation meshes | 141; preview and exterior resources add zero |

Unit tests specifically cover a floor-1 landing at Y=5.5, arrival into floor 2 at
Y=6.44, descent, paused inter-floor connectors without teleporting, coincident
positions with distinct place IDs, and an overhead beam missed by torso rays.
The public campus has no synthetic inter-floor connections from those tests.
Browser tests retain pause/resume, cancellation/manual override, preview viewing,
resource release, invalid hash recovery and API error/session recovery.

`model-alignment.json` checks the served C11 hash and GLB anchors; its
`servedModelChecked` is true. The earlier `candidate/` report checks the candidate
before deployment and explicitly marks that server comparison as false. Both use
the final +1.80 m head ray. `walk-*.json` stores all eight arrivals.

General, top and walking views measured about 144 FPS on local RTX 5060 / ANGLE
Direct3D11, headless Brave at 1440 × 1000, five seconds per view. See
`after-performance.json`; this is not a guarantee for other devices. Two complete
preview cycles return to 606 live WebGL buffers and 19 textures, without growth.

The CPU collision benchmark compares identical nine-ray checks on 128 model
samples: zero mismatches. In this local pass the bounds-filter version was slower
(3.398 ms/call versus 2.855 ms brute force); no speedup is claimed. Browser cadence
and walking checks still pass the 30 FPS target.

## Vertical findings and the correction received

The C11/piso-2 probe found head contact with the solid upper first flights, a
first-floor west wall, the east arrival wall and slab above the returning feet.
See `stair-clearance.json`, the diagnostic `head-clearance-section.svg` / `.png`,
and [review for Claude](../../blocks/c11-stair-review.md). The section illustrates
the delivered repeated-flight geometry, not a surveyed building section.

Claude responded through files with `71c5e80` and `183365c`. The same independent
probe against its corrected floor 1/2 now gives zero body/torso blockers and zero
support conflicts for both stairs, up and down. Its report is in
`../c12-candidate/stair-clearance.json` (four directed passes). This does not yet
accept route data, manual stair movement or a vertical browser journey.

The corrected `93a1ad69…` first-floor export and its five changed previews remain
outside the manifest until their own integration/browser rehearsal. A fresh build
after their arrival recovered the reviewed C11/preview bytes from Git; the JS
bundle and reviewed model hashes remained unchanged. `services.json` records both
the working and served first-floor hashes and 200 responses from API, `/app/`,
Swagger and OpenAPI on the existing ports. The real database stays 19/16 and has
no isolated test destination. No user service or model source was changed by Codex.

During closure Claude also delivered `fe71176` / `08fd92b` / `1d0f86f`: upper-floor
room-tag wall removal, DWG door leaves and furniture confined to rooms. These are
newer upper-floor bytes than the `71c5e80` stair comparison and require their own
checks before integration. The reviewed previews remain pinned to `099c212`.

The physical B laboratory stair still needs matching geometry/data. Its nearby
ramp direction is unconfirmed. A/B assignment, further destinations/functions and
the faceless avatar upgrade remain pending; the three plans are not complete.

## Reproduce

```powershell
npm run build
npm test
$env:UNINAV_TEST_URL = 'http://127.0.0.1:8001'
$env:UNINAV_RENDERER = 'hardware'
$env:UNINAV_REQUIRE_FPS = '1'
$env:UNINAV_EVIDENCE_DIR = 'docs/verification/c11'
npm run test:e2e
$env:UNINAV_MODEL_ROOT = 'dist/models'
$env:UNINAV_VERIFY_DIR = 'docs/verification/c11'
node --experimental-strip-types tools/verify-model.ts
node --experimental-strip-types tools/verify-stair-candidate.ts
node --experimental-strip-types tools/render-stair-section.ts
```

For C12 comparison, set `UNINAV_STAIR_LOWER_COMMIT` and
`UNINAV_STAIR_UPPER_COMMIT` to `71c5e80`, with a separate verification directory.
The sample browser test uses port 8000 and the `sample/` evidence subdirectory.

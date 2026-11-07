# C12 model set and floor-2 access preparation · 7 November 2026

This was an intermediate candidate rehearsal, superseded before publication by
[C13](../c13/README.md). The C12 upper floors still contained door-tag wall stubs
and a guessed door leaf in the north corridor. They are not the current served
previews and were not accepted as navigable floors.

The rehearsal used the committed model set at `08fd92b`: corrected
first-floor stairs from `71c5e80`, and upper-floor doors, wall-tag cleanup and
room-confined furniture. First-floor SHA-256:
`93a1ad6969a82467b12bc17fdb92a559319a6b80bf667c1afa2f12adc1314a8d`.
The original 19 places, 16 bidirectional paths and four destinations remain.
Floors 0/2/3/4/5 are still non-navigable previews, with no API rooms or edges added.

| Preview | World Y | Meshes | Triangles |
| --- | --- | --- | --- |
| 0 | 0.56 m | 43 | 18,961 |
| 2 | 6.44 m | 50 | 40,102 |
| 3 | 9.38 m | 59 | 42,939 |
| 4 | 12.32 m | 54 | 50,231 |
| 5 | 15.26 m | 66 | 56,668 |

These are the documented model transforms, with flattened A/B half-levels and
derived block identities. The five previews total 12.58 MB and load on selection.
Fifteen structural anchors match the GLB nodes, maximum file-coordinate residual
0.000002484 m; this is not a surveyed registration accuracy claim.

## Checks

| Check | Result |
| --- | --- |
| Build / typecheck | Passed |
| Frontend unit tests | 25 passed |
| Pertinent API tests | 22 passed in 12.58 s |
| Campus / temporary API browser suite | 21 passed in 5.1 min; sample skipped on this URL |
| Original sample-campus rehearsal | 1 passed in 23.6 s; no UCC preview requests |
| Four destinations, outbound and return | 8 arrivals; 1,589 samples; final error 0 m; no blocked state |
| Maximum centre-line deviation | 0.000696 m (rounded up) |
| First-floor geometry | 32 directed edges clear with torso/head rays |
| Collision meshes | 141 first-floor meshes; no preview/exterior contribution |
| Floor-1/2 stair probes on current 08fd92b | West/east, up/down: 4 passes, no body/torso blocker or support conflict |

`model-alignment.json` verifies the served first-floor hash and anchors. The
earlier `candidate/` report explicitly disables the server comparison for its
pre-deployment check. `source-revisions.json` and `structural-checks.json` record
the five preview hashes, bounds and reference residuals.

`stair-clearance.json` tests the two current committed levels together, with
measured tread/landing probes and all meshes. The clear result confirms the
reported C11 blockers have been removed in these probes. It does not accept API
route data, manual stepping or a complete vertical browser trip. Intermediate
probe segments use the report's stated support tolerance; they are not imported
as an automatic route.

The browser rehearses paused-route preservation through previews and return to
the actor floor, resource release, changed asset/data rejection, pending floors,
real API no-route/session recovery, keyboard override and mobile layout. Two
cycles through all previews return to 606 live buffers and 19 textures. These
WebGL handle counts do not measure VRAM bytes. Local RTX 5060 / ANGLE Direct3D11,
headless Brave at 1440 × 1000: about 144 FPS in general/top/walking and floor-5
inspection; see the JSON cadence reports. This is not a guarantee on other GPUs.

## Floor-2 source audit

`floor2-access-audit.json` transcribes five actual labels, tests nearby candidate
points and records nearby drawn gaps. The SVG/PNG draws exported architectural
sections and source furniture. [Access review](../../blocks/floor2-access-review.md)
explains the results and limits. Library, hall and AULA 220 need real doorway
turns: their direct lines from the east stair hit doors/glass/walls. AULA 201's
text anchor has no locally free candidate under the tested conservative rule.
The nearby circulation label is clear from the documented stair arrival.

These are not accepted entrances or graph edges. Room membership, doorway
assignment and complete supported paths still need review. No obstacle was
removed to force a path, no room was inferred from a name alone, and no candidate
was written to either database.

`services.json` confirms health, `/app/`, Swagger and OpenAPI on both preserved
ports. The real campus remains 19 places / 16 paths; the sample remains 21/25.
The synthetic isolated destination exists only in the disposable test database.
Blender sources, GLBs and Claude's reference documents were not edited by Codex.

H2 and the three plans remain incomplete. Next: verified doorway/turn graph data,
manual tread support, and actual API/browser journeys between floors. The running
legacy API must expose the explicit-elevation contract before those data are
enabled on that service. The B laboratory's physical stair/ramp discrepancy,
physical A/B confirmation, other functions and the faceless avatar upgrade remain.

## Historical artifacts

This directory records the intermediate rehearsal before Claude delivered C13.
The current build and tool defaults use C13; use its README for current commands.
To compare the old source audit separately, set `UNINAV_AUDIT_COMMIT=08fd92b`
and `UNINAV_VERIFY_DIR` to a new output directory before running
`tools/audit-floor2-access.ts`. Do not overwrite either acceptance archive or
restore the superseded upper floors to the current manifest.

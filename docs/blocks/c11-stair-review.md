# C11 stair clearance review for Claude

Codex inspection of committed exports, 7 November 2026. No model source or GLB
was edited. Reproduce with `node --experimental-strip-types tools/verify-stair-candidate.ts`.
Detailed measured tread/landing points, probe paths and first obstruction examples
are in `docs/verification/c11/stair-clearance.json`.

Sources: first floor `9ac3795` at world Y 3.5, SHA `41e225fe…`; floor 2
`099c212` at Y 6.44, SHA `403cb77b…`. Centre lines and dimensions come from
`vertical-connections.md` and the delivered `blender_stairs.py`. Probe heights are
measured downward onto the actual first-floor stair mesh. These are inspection
probes, not imported graph paths or approval of a new connection.

## Observed obstructions

| Stair / direction | First obstruction | Probe evidence (world coordinates) |
| --- | --- | --- |
| West, up | `P2_Stair_A_West_1`, head ray | Foot near `(14.65,4.52,-58.2357)`; ray at +1.80 m with existing 0.25 m lookahead hits `(14.4506,6.44,-58.4929)` |
| East, up | `P2_Stair_A_East_1`, head ray | Foot near `(36.35,4.52,-58.2357)`; same ray hits `(36.1506,6.44,-58.4929)` |
| West return flight / descent | First-floor `Walls_1`, torso ray | Example foot `(18.05,5.40,-58.5786)`, +0.45 m ray hits near `(17.8506,5.7336,-58.8280)` |
| East arrival / descent | `P2_Walls_1`, torso ray | Foot `(38.70,6.44,-55.90)`, +0.45 m ray hits near `(38.48,6.89,-55.9930)` |

The upper flight-1 boxes are solid down to their floor's local zero in
`blender_stairs.py`. The head hits at world Y 6.44 are consistent with that solid
underside. The torso-only rays miss this earlier obstruction. Check a thinner
structural underside/support solution that leaves the lower flight headroom,
while retaining the measured tread positions and rise. This is an interpretation
of the source and intersections, not a request to remove a collider in code.

Please also review the west return flight against the existing first-floor wall,
and the east arrival opening against floor-2 walls. The export's documented
top points are not yet usable routes in this probe. The support conflicts are
slab intrusions, not missing support: near plan y 56.69–56.74, the upper slab
surface at Y 6.44 lies 0.16–0.18 m above the interpolated foot point. Review the
south strip left by the slab well against the last return-flight treads.

Both stairs were swept up/down with all meshes of both levels, sampled at no more
than 0.05 m per segment, three lateral offsets and torso/head rays. Blocker/gap
arrays retain capped examples, not totals. Full stair navigation remains disabled.
The runtime head check now includes +1.80 m for the current 1.74 m avatar and its
0.035 m walking bob; geometry
must fit that volume. No mesh should be excluded by name to force a pass.

The existing four first-floor destinations are a separate acceptance scope.
Integrating C11 for those routes does not accept the new vertical connection.

## Correction received during review

Claude delivered `71c5e80` / `183365c`: sloped undersides, wall openings and a
shorter top strip. The same independent probe against floor 1 and floor 2 from
`71c5e80` now reports zero body/torso blockers and zero support conflicts for
both stairs, up and down (four directed passes). See
`docs/verification/c12-candidate/stair-clearance.json`. These corrected exports
are not yet in the manifest and still need browser/model integration and real
upper-floor graph data. C11's failure report above remains historical evidence.

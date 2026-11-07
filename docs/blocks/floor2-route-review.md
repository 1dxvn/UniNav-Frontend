# Floor-2 route preparation

Codex, 7 November 2026. The reproducible review uses committed C13 `a2dbda0`
and selected doorway facts transcribed in `floor2-door-accesses.json`. The same
paths also passed the newer working GLB; that intermediate evidence is archived
separately. This review does not activate the public floor-2 preview or import
anything into a development database.

| Destination | Doorway | Corridor stand | Inside stand |
| --- | --- | --- | --- |
| Mixed Reality Laboratory | D14 | (46.604, 54.205) | (46.604, 53.005) |
| Molecular Biology Laboratory | D15 | (47.122, 55.475) | (47.122, 56.675) |
| Medical Research Centre | D13 | (34.916, 54.180) | (34.916, 52.980) |

The research destination continues around the interior obstacle, through turns
at (34.916, 50.000) and (38.569, 50.000), to (38.569, 51.782), near the literal
`MEDICAS` label. This is derived navigation geometry inside the exported model,
not a new physical measurement. D13 does not enter the Medicine staff room:
that name is across a glass partition. The source strings `CENTRO DE`,
`INVESSTIGACIONES`, `MEDICAS` identify the correct bay. Mixed reality uses the
source's split `LABORATORIO` / `REAL LIDAD` / `MIXTA` labels. One text anchor is
obscured by architecture; the other two and the plan corroborate the room.

The first-floor approach adds a junction at x=36.35 on the existing north
circulation edge (its y is interpolated from the two existing API nodes), then
reaches the documented east-stair foot at (36.35, 55.90). The legacy direct north
corridor edge is retained; its two collinear junction links are a migration
redundancy, not an alternate physical passage. No ramp or elevator is inferred.

The source stair treads and landing are preserved from the C13 measurement.
Floor changes use explicit metadata; the upper model remains at 6.44 m with
the documented flattened A/B levels. Physical block identities remain derived.

The candidate has 45 new API records (including hidden waypoints/references)
and 43 bidirectional paths. All 86 directed checks pass with support and every
body/head obstacle included. No mesh was removed to make a path pass. Full
browser rehearsals and source-freezing are recorded separately in
`docs/verification/h2-floor2-candidate/`.

The reviewed C13 upper GLB SHA-256 is
`63a1ac43b914d7767e284dc8ace5856a6f6a87bdc38f8e1c05a661c1dda3f61a`.
`data/datasets/ucc-second-floor.json` in the backend prepares the scoped import;
`public/models/floor-2/campus-navigation-reference.json` prepares API alignment.
Both require a compatible active model/data manifest and API contract before
public activation. The current first-floor binding remains unchanged.

Model-delivery coordination: the newer working GLB `44fbeda2` is not integrated.
Record its final source commit and any changed export before accepting a new
binding. The working files remain owned by Claude; Codex has only read them.
No request to delete the interior obstacle or label-adjacent architecture is implied.

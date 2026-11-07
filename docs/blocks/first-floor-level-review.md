# First-floor levels: candidate request for Claude

The immediate correction classifies e08/e09/e10 as connections containing stairs
and rejects them with Avoid stairs. It preserves the current flat C13 positions,
IDs and all other connections. The actual level geometry and physical split are
still pending. `first-floor-level-review.json` is a handoff, **not an importable
dataset**. It invents no rooms, alternative access or ramp.

Please deliver a separate candidate model and reference sheet for the hall and B
level changes, keeping the existing C13 exports available. Sources are your
`vertical-connections.md`, including the four-riser measurement in `b9648f5`.
The following graph edits are proposed for that candidate. Their XY positions
come from your suggested edits and require your clearance/support review.

| Connection | Proposed physical split | Source levels |
| --- | --- | --- |
| e08, hall approach | Keep p08 → p09 as corridor after moving p09 off the tread to (28, 47.6); preserve its stable ID | N 0.00 |
| e09, hall crossing | p09 → new after-point (28, 49.5), stairs; after-point → elevator hall p10, corridor | N 0.00 → -0.63 |
| e10, B laboratory approach | p03 → before-point (36.0, 33.1), corridor; before → after (39.4, 33.1), stairs; after → p11, corridor | N 0.00 → +1.19 |

The measured B landing level is near (35.94, 34.66); the suggested southern
before-point is not a second measured landing. Adjust it if the candidate's
surface or clearance requires another turn. Each replaced direct connection
must be retired atomically when the split is activated; retaining it would
bypass stair exclusion. No retirement occurs in the current prepared revision.

The hall has three numbered treads between **four risers**, with nosing lines
at plan y 47.86, 48.32, 48.78 and 49.23. Its 0.63 m drop gives approximately
0.1575 m per riser, within the unchanged 0.20 m step limit. Keep these lines and
the foot/head support positions in the candidate reference. The client checks a
0.12 m foot footprint, torso/head heights 0.45/1.2/1.8 m and a 0.22 m body radius.
It does not exempt walls, glass, furniture or hidden meshes from collision.

Please identify all regions that change elevation, including the laboratory,
its corridor, the north circulation, destinations and the Lockers reference.
Unknown zone assignments must remain pending rather than receiving a guessed
height. Keep software floor 1 and explicit per-place elevations for half-levels.

The east stair and the upper floor must stay coherent: Block A's physical rise
from N -0.63 to +2.68 is 3.31 m, while C13 uses 2.94 m. State which neighboring
models/reference transforms must change together. Do not combine a physically
lowered first floor with the unchanged C13 upper transform and call it accepted.

The B north flight to N -0.90 and sloped hall toward N -0.63 can be documented
for a later graph connection. They include six steps from B. The source confirms
no step-free link to the laboratory at +1.19. The south-east polygon is a roof.

Codex will validate the committed candidate's reference nodes, slab/tread support,
clearance, graph weights, both algorithms, round trips and manual/pause/replan
behavior before changing the active resources or development database. The
separate C14 doorway export is already integrated in the preserved four profiles.

## Codex review of C15, 7 November

Committed `3177ca7` is reviewed as an independent two-floor profile. The hall
before-point, three tread centres and after-point pass support/body/head checks
in both directions. The original e09 row is retargeted after the stairs, removing
the bypass without deleting its identity. A uses world 2.87 / 6.18 m and the
structural references retain the B datum. All 126 directed graph checks and four
east/west tower inspection probes pass; the west probes create no API route.
Seven destinations completed fourteen temporary-API browser arrivals at 0 m
final error. Evidence: `docs/verification/c15/`. Public data stays at 19/16.

The Site top is world 3.35 m, 0.15 m below the B slab. The prepared courtyard
node uses that **model-only** placement, documented separately from the derived
physical access-zone datum. Site supports outdoor connections only and cannot
cover interior holes or stair wells. No export was changed by Codex.

Unresolved laboratory B / circulation / Lockers levels remain pending and flat
in the prepared data. The known e10 stair classification remains conservative;
no physical +1.19 split is activated against the flat laboratory model. The
west block, sloped hall and floor-2 A/B junction remain pending as documented.

Before upper vertical routes, the next model handoff needs source-backed zones,
unchanged structural references and compatible adjacent exports. In particular,
the current C15 floor-2 stair ends at the flat floor-3 world 9.38 m; its 3.20 m
rise is an inspection approximation. The documented physical rise is 3.69 m to
A at world 9.87 m. Please keep that distinction explicit when preparing a new
floor-3 candidate; floors 0/3/4/5 stay non-navigable previews meanwhile. Confirm
remaining levels from the drawing before moving them. No dimensions or joins
should be inferred to resolve the contradictory B laboratory circulation.

## Codex geometry review of C16

`002aaec` passes the independent audit in `docs/verification/c16/geometry.json`:
15 structural/API anchors, 126 directed segments of the unchanged 68/63 graph,
16 directed east/west tower probes across floors 1-5 and both directions of the
floor-3 hall. Foot support uses the runtime's 0.12 m footprint and 0.20 m maximum
step; body/head rays include every mesh of all five floors. The three pending
A/B junction probes are rejected. A negative C15-floor-2/C16-floor-3 mixture
cannot complete the physical stair. These inspection probes add no API nodes.

The accepted model revision advances only the existing two-floor data profile;
the four legacy profiles retain their resources. C16 floors 3-5 remain structural
previews, with no destinations or routes. Floors 1/2 retain their current graph
and heights. Model sources and the C15 datasets are unchanged on disk; the web
build stages the reviewed C16 commits at separate URLs.

Next source handoff for piso cero: please document the regions carrying N -4.13,
including the labelled points south of the usual A facade boundary, their source
status, the western stair opening and compatible stair/landing joins to floor 1.
The current C14 floor-0 stair does not meet C16 floor 1; it remains a preview.
Keep the contradictory B laboratory/sloped/western zones and A/B junctions
2/4/5 pending until the drawing or another source resolves them. No new risers,
ramps, rooms or inter-block joins should be inferred to fill those gaps.

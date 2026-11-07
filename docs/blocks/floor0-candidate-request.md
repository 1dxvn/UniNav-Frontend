# Request for Claude: C18-compatible piso cero candidate

C18 sources `de3815e` / `30cb648` have been reviewed. Please deliver a separate
floor-0 GLB and its reference sheet, preserving the existing C14 preview and all
accepted C16/C17 exports. This file and `floor0-candidate-request.json` are a
model handoff, **not an importable dataset or accepted route graph**.

The seven source labels establish two levels. A and the east clinic have
N −4.13 (world −0.63); the B stair landing and west/south-west service areas
have N −2.94 (world 0.56). Extents are derived, with the C18 ambiguities retained.
Keep translation `(0,0.56,0)`: A/clinic's local offset is −1.19. Preserve the
three structural reference nodes at the B datum independently of walking levels.

The first deliverable should make the east tower meet accepted C16 floor 1:
world −0.63 → 2.87, rise 3.50 m. C18 proposes a compatible 21-riser tower;
please confirm its plan centre line, return flight, landing, feet and upper
stand in the exported model. Reusing C14's old XY layout is not an accepted
walking source until that review. The existing C14 rise to world 3.50 cannot
be enabled merely by changing metadata. Codex's `review-floor0-handoff.ts`
records the old surfaces and rejects the requested physical foot as a control.

Retain the C18 region boundaries and explicitly mark unbuilt/approximate areas.
Do not infer the B south flight into floor 1's still-pending N −0.90 zone,
west landing/opening, south-west ramp top, eastern yard steps, southern rooms
or the unresolved west/east boundary between y 36 and 47.6. The known six-riser
B north flight may be included with documented endpoint levels and clearance,
but does not resolve that other flight or create a 0-to-1 route. Elevator levels
alone do not establish navigable shafts, doors, operating stops or accessibility.

Please include source Blender, GLB, comparable top view, transforms, local/world
levels, structural reference nodes, walkable-node names and clear points at
every flight, landing and doorway used for the first routes. Foot radius is
0.12 m; body radius 0.22 m; head height 1.8 m; maximum step 0.20 m. Codex will
check both directions, support, body/head clearance and the existing graph before
adding places, paths or a navigable model binding.

Sources: `docs/blocks/level-zones.* @de3815e`, `piso-cero-levels.png` and the
unchanged C14 structural preview. Evidence: `docs/verification/floor0-handoff/`.
No room names, dimensions, pending levels or connections are invented by this
request. While the candidate is prepared, Codex continues independent UI work.

# C17 floor-2 ramp integration

C17 replaces only floor 2 in the prepared 68/63 and 110/102 data profiles.
The four historical model combinations, all dataset payloads, bindings,
references and movement limits are unchanged. Floors 1/3/4/5 reuse C16.
No public ramp edge, destination, real import or service restart is added.
The shared catalogue now records the user's Block A/B identity confirmation;
the floor datums keep their existing derived/provisional evidence.

## Reviewed sources and geometry

- Floor 2: `model/candidates/c17/floor-2.glb @0f6a862`, SHA-256 beginning
  `7a81de62`, staged at `models/c17/floor-2.glb` by the reviewed build.
- Configuration: `model/tools/real_levels_c17.json @0f6a862`.
- Block identity confirmation: `level-zones.md @b36d328`.
- Original C17 delivery commits through `995119f` are merged separately, with
  their source bytes and identity intact. The newer piso-cero handoff remains
  local and outside this publication. No Blender source was edited or run.
- The ramp is the drawn strip x 27.353–29.753, y 47.906–49.275, descending
  from B world 6.44 to A world 6.18. Its step-free geometry does not establish
  certified accessibility. Other level zones remain pending.

`geometry.json` contains 204 directed checks for the complete current graph,
six ramp crossings at three source-reviewed lanes, fifteen reference anchors,
and six C16 negative controls. All positive checks have body/head clearance and
footprint support; every old flat C16 ramp control is rejected. A 0.4 m height
grid covers the full union of slab bounds: 25,536 samples, 24 changed inside the
ramp strip and zero changed outside it. This is a sampled height comparison,
not an exhaustive comparison of every point or material.

## Movement correction and browser evidence

The new regression test against the committed C17 slab exposed that keyboard
ramps were handled as flat corridors. Ramp paths now interpolate their graph
heights and use reviewed foot support in both keyboard and guided movement.
Missing support rejects a move; existing collision and maximum-step limits stay
unchanged. Both new tests fail before this correction and pass afterwards.

- `two-floors/`: seven destinations, fourteen guided arrivals, manual hall and
  stairs, pause/replan, outdoor keyboard approach in both directions, resource
  rejection and repeated view cycles.
- `three-floors/`: three computer labs, six guided arrivals, manual 2-to-3 stair,
  high-landing floor metadata, pause/replan, preview movement guards and cycles.
- `ramp/`: actual temporary FastAPI in both data combinations, four additional
  guided ramp arrivals, manual round trips, pause on the incline and replan.
  Only test data bindings are overridden for six disconnected fixture points;
  GLBs and reference resources are the shipped bytes. Avoid stairs permits these
  ramp-only fixture paths. No production destination is inferred from them.
- `compatibility/`: six unmodified production startup profiles and 144 API route
  calculations; all 42 ready model entries match their hashes. Partial metadata
  fails closed; substituting the wrong third-floor GLB blocks movement and
  restoring the reviewed resource recovers alignment.
- `sample/`: both unrelated sample-campus browser cases pass.

Independent downward rays inspect the committed model sources, feet and four
footprint offsets, with 1 mm coordinate resolution. Recorded sources and counts
are in each `browser-support.json` and `validation.json`. Existing twenty guided
arrivals have final error 0 m and no blocked states or page errors. Ramp fixture
arrivals also have error below 2 mm. Interior gaps cannot borrow outdoor Site.

Build, full typecheck, 44 frontend unit tests, 32 relevant API cases and 28
distinct browser cases pass. The two view cycles return to 579 buffers / 10
textures for floor 2 and 953 / 10 for floor 3. Local headless Brave / RTX 5060
averages approximately 144 FPS in the three-second samples; this is not a GPU
byte count or a guarantee for other machines.

Two test harness issues were corrected without relaxing checks: resource
recovery waits for the initial campus view before choosing a floor, and obtains
the substitute GLB URL from the selected profile. Outdoor keyboard completion
checks 3D distance; Hall Acceso is approached 3.5 cm inside its boundary to avoid
ending on the lower Site surface. Arrival tolerance and independent support
checks remain unchanged. Initial failing traces stay outside commits.

## Reproduce and pending work

From the frontend:

```powershell
node --experimental-strip-types tools/integrate-c17.ts
npm run build
npm test
$env:UNINAV_RENDERER = 'hardware'
npx playwright test tests/e2e/c17-ramp.spec.ts
node --experimental-strip-types tools/verify-c17-ramp-playback.ts
```

`--integrate` is explicit for manifest changes. The audit refuses working GLBs
that differ from their pinned commits. Browser fixtures use OS-reserved ports
and new temporary databases; they stop only their own processes. Existing 8000
and 8001 services remain healthy, the real campus remains 19/16, and continuity,
foreign seed changes and Claude's working sources keep their recorded hashes.

Piso cero has a source handoff but still lacks an accepted physical candidate
joining C16 floor 1. Floors 0/4/5 remain previews; other rooms, Block B level
contradictions and upper A/B junctions are pending. Public activation, the
broader application features and the simple faceless avatar update remain
outstanding. H2 and all three plans remain incomplete.

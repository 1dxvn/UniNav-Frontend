# Readable directions and the C18 model handoff

The production three-floor route now presents 24 directions for 71 API
segments, in both tested directions. Stair flights, landings and arrivals are
readable without listing every tread's internal waypoint name. Corridor turns,
named halls and path-kind changes remain separate. The instruction retains an
inclusive API edge range; all movement points, graph edges and physical distances
remain unchanged. Instructions show measured route length, not weighted cost.

The highlighted row follows the current movement target and stays selected on
pause. The current direction also appears in the walking status, so it remains
visible when its list row is below the fold. A replan from a manual position
shows its connector separately, with the correct highlight offset. Zero-length
floor metadata changes retain that offset. Legacy flat stair classifications
remain mapped steps; they do not imply a measured landing or floor elevation.

## Evidence

- `guided.json`: actual production launcher / shipped profile, Hall Acceso to
  Computer Lab 1 / 308A and back, with pause/resume. Every recorded moving/paused
  position is checked against the highlighted instruction's API edges, within
  0.251 m. The route has all 71 segments, 24 directions and zero final error.
- `connector.json`: keyboard movement on the 2-to-3 stair, position-preserving
  calculation, connector highlight and guided arrival. No route/model overrides.
- `flight-paused.png`, `outbound.png`, `return.png`: actual browser UI and campus.
- `base/`: ICETEX, Morphology, elevator/restroom hall and Preclinic, eight guided
  arrivals with error 0 m using the preserved 68/63 profile and C17 models.
- `sample/`: both unrelated sample-campus navigation cases still pass.
- Unit cases check the actual versioned three-floor path, lossless edge coverage,
  physical distance, turns, named halls, ramps/elevators, legacy stair tags,
  connector offsets, single-point routes and mixed stair direction metadata.
- `prepublication.json` records identity/authentication, unchanged resource
  manifest, foreign/continuity hashes, source files and the real 19/16 database.

Build/typecheck, 51 frontend unit tests, 15 relevant API cases and ten distinct
browser cases pass. Local headless Brave / RTX 5060 measures approximately
144 FPS over three seconds. This is one local presentation measurement.
The final build uses `index-DCY9idfS.js`; model bindings/resources are unchanged.

## C18 remains a model request

The original C18 source delivery is reviewed and preserved separately, followed
by the request/audit commit recorded in `handoff-commit.json`. It does not create
floor-0 places, connections, rooms or physical geometry. The browser verifies
that the floor-0 preview still rejects keyboard movement and has no API
destination. Claude's sources and existing exports were not edited.

See `../floor0-handoff/README.md`, `docs/blocks/floor0-candidate-request.md` and
its JSON contract for seven level labels, three structural anchors, the rejected
old-preview foot control, the accepted floor-1 stand and explicitly pending
levels/joins. A 0-to-1 traversal is not accepted before the requested GLB, plan
centre line, landing, endpoints and clearances are delivered and verified.

## Reproduce

```powershell
npm run build
npm test
$env:UNINAV_RENDERER = 'hardware'
$env:UNINAV_REQUIRE_FPS = '1'
npx playwright test tests/e2e/route-instructions.spec.ts
node --experimental-strip-types tools/review-floor0-handoff.ts
```

Browser fixtures use disposable SQLite databases and OS-reserved ports, closing
only their own process trees. The existing sample and real services remain
running; no real import or restart occurred. Floors 0/4/5, other destinations,
public activation, remaining application functions and the simple faceless
avatar work remain pending. This milestone does not finish the three plans.

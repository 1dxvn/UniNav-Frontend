# Floor 2 access preparation

Source C13 `a2dbda0`, `model/tools/data/floor2/wing.json` / `extras.json` and the
committed floor-2 GLB. This is a source audit, not a dataset import. The frame is
registered to the first floor; the delivered model view is flat at world Y 6.44.
The 26 cm A/B offset and physical block identity keep their documented evidence
states. No API room, floor connection or measured physical dimension was invented.

| Source label | Plan label position | Local candidate | Direct east-arrival segment |
| --- | --- | --- | --- |
| BIBLIOTECA 1 | (2.947,53.819) | (2.697,53.319) | Blocked by `P2_Doors_1` |
| AULA 201 | (33.088,45.198) | (32.338,44.948) | Blocked by `P2_Glass` |
| AULA 220 | (24.211,42.832) | (24.461,42.832) | Blocked by `P2_Glass` |
| HALL ASCENSORES | (25.830,53.088) | Label point locally clear | Blocked by `P2_Walls_1` |
| CIRCULACION | (39.001,55.896) | Label point locally clear | Clear from (38.70,55.90) |

The label coordinates are literal CAD facts. The orange candidates are generated
within 1.5 m of a label, on the model slab, at least 0.35 m from source furniture
footprints, with local torso/head ray checks. This does not establish their room
membership, entry or a complete route. The C13 candidate near AULA 201 is now
locally free after the door-tag frames were removed; the earlier C12 search
found none. This does not establish a route
into the room. A verified doorway is a better arrival target than forcing the
character to the text anchor.

`docs/verification/c13/floor2-access-audit.json` stores exact intersections,
source gaps and their widths. Nearby gaps are not assigned to a room automatically.
The SVG/PNG draws actual exported wall/glass/door sections at torso height and
source furniture footprints, with source labels and candidates. These blockers
are not requests to remove geometry: the graph needs the real doorway and turns.

C13 also replaces guessed door leaves with the drawn leaves where they overlap.
Some restroom leaves open into the north corridor, as documented by Claude.
The source suggests y approximately 54.5 to 54.8 as a corridor line; check it segment
by segment with both approaches before becoming graph data.

Before committing navigable floor-2 data:

1. Relate each selected destination to its drawn doorway and room boundary. Keep
   source label coordinates separately from the eventual walking endpoint.
2. Build doorway/turn points from the registered plan and GLB; test every directed
   segment with support and all obstacles. Never join a room to the stair with
   the failed direct lines above.
3. Preserve the measured stair tread/landing points and floor/elevation metadata.
   Test automatic and manual movement through the two-level model pair.
4. Import a scoped dataset only after the paths and model binding agree, then
   exercise real FastAPI routes and browser arrivals. The currently running
   legacy API must expose explicit elevations before this can be enabled there.

Reproduce the source audit with
`node --experimental-strip-types tools/audit-floor2-access.ts`. It reads committed
sources and writes review artifacts only. It neither runs Blender scripts nor
modifies Claude's JSON/model files or either development database.

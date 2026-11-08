# Application functions, avatar and minimap: browser evidence

`tests/e2e/campus-tools.spec.ts` runs on the production launcher (`scripts.run_campus --profile ucc-six-floors-c18`) with an isolated database and the shipped build. It uses the project's seeded demo accounts on that temporary database only.

| Test | Checks |
| --- | --- |
| Assistant, history, back/forward, queues, rankings, minimap and avatar | The reviewed avatar loads (`glb:Idle`). Signed in as `student`. The assistant answers "sala de espera piso cero" with the floor-0 waiting room; "Go ↗" calculates the route, the minimap shows the route on its floor, and the walk switches the avatar to `glb:Walk` and back to `glb:Idle` on arrival while the minimap's avatar moves. "aula 512" → Classroom 512A on floor 5, walked the same way. Back returns to the waiting room and forward to 512A. History shows 2 routes and the statistics. The queue at 512A goes 0 → "you are number 1" → 0. Rankings list the visited places. No page errors |
| Admin edits a place, builds a guided tour and a student follows it | `admin` sees the Admin tab, saves a display name, adds two destinations and creates the tour "Piso cero". In a second page, `student` starts it (stop 1 of 2), walks to the first stop and moves to stop 2 of 2. No page errors |

Both pass, last run after the pluralisation and minimap-position fixes (2 passed, about 3 minutes).

Files:
- `functions.json`: recorded history and ranking text;
- `assistant-arrival.png`, `queues-rankings.png`, `tour.png`: screenshots.

# Application functions (Plan 1 §11)

These are the frontend surfaces of the existing FastAPI functions, completed by Claude at the user's request while Codex was out of quota. They live in the "Your campus" panel of the sidebar (`src/campusTools.ts`), plus the minimap (`src/minimap.ts`) and the assistant (`src/assistant.ts`).

| Area | Interface | Endpoints |
| --- | --- | --- |
| Assistant | Free-text need in Spanish or English, for example "sala de espera piso cero", "aula 512" or "computer lab floor 3". It matches against the confirmed place catalogue from the API (names, display names, types, faculty, block) with a small synonym table and an optional floor filter. Every answer is an existing place with "Go ↗", which calculates the route. No generative provider and no key | `GET /buildings` (already loaded) |
| History and statistics | Routes, total and average distance, most visited place, the last 8 routes and a clear action | `GET /users/me/stats`, `GET /routes/history`, `DELETE /routes/history` |
| Back and forward | ← / → buttons next to "Your campus". A visit is recorded each time the avatar arrives at its destination | `POST /navigation/visit`, `POST /navigation/back`, `POST /navigation/forward`, `GET /navigation` |
| Guided tours | Tour list, start, current stop (n of N), previous/next, walk to the stop and end tour | `GET /tours`, `POST /tours/{id}/start`, `GET /tours/session`, `POST /tours/session/next`, `POST /tours/session/previous`, `DELETE /tours/session` |
| Queues and rankings | Queue length at the destination, join/leave and your position; most visited places; popular routes | `GET /queues/{id}`, `POST /queues/{id}/join`, `DELETE /queues/{id}/leave`, `GET /queues/{id}/position`, `GET /rankings/places`, `GET /routes/popular` |
| Administration (admin role only) | Edit the destination's display name and type; serve the next person in its queue; build a guided tour from destinations; delete tours; reload the route graph | `PUT /buildings/{id}`, `POST /queues/{id}/serve`, `POST /tours`, `DELETE /tours/{id}`, `POST /graph/reload` |
| Minimap | A top view of the observed floor showing the walkable graph, places, the route on that floor, the destination and the avatar with its heading. Clicking a place selects it. Floor changes follow the 3D view | data already loaded |

## Notes

**State in server memory.** The navigation trail, tour sessions and queues keep the backend's in-memory behaviour. They do not survive a server restart.

**Model binding.** Editing a display name or type does not change the model binding. The data fingerprint covers names, floors, positions and connections only.

**Accounts.** Signed-out users see a prompt to sign in for the functions that need an account.

**Browser evidence.** `tests/e2e/campus-tools.spec.ts`, on the six-floor production launcher with an isolated database, covers:
- the assistant → route → arrival flow, with the avatar switching between Walk and Idle;
- the minimap following floor and avatar;
- back and forward;
- history;
- the queue join/leave cycle and the rankings;
- an admin editing a place and creating a two-stop tour, which a student then starts and walks.

Results are in `docs/verification/campus-tools/`.

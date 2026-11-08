# Resumed delivery review · 7 November 2026

The supervisor checkpoint preceded Claude's user-requested completion work. This review recovers that work, publishes C19, and fixes stale responses in the campus tools. It does **not** close the three original plans.

The user had already activated `ucc-six-floors-c18` at 19:13. The running campus has **235 places and 218 bidirectional paths**. The older 19/16 checkpoint is historical. No activation, reseed or restart was performed during this review.

## Delivered changes

- C19 exterior is published with its original model commits `668c83a`, `365d713` and `9d8ee41`, integration `c46536b`, and the associated SVG minimap and browser evidence. Indoor models and bindings are identical to the pre-C19 manifest at `d540b21` after excluding exterior entries.
- C19 GLB: **3,249,124 bytes**, SHA-256 `e903fdbc5687586648296dad57b43c1e5b853b735cc5068177e7f8c6a2b79dd8`. All eight exterior entries pin the reviewed resource. The exterior adds **zero colliders**.
- Fix `be69a40`: late history successes/errors cannot replace a newly selected tab. Sign-out immediately clears the private panel, tour draft and navigation controls. Responses and actions from an older tab/session cannot reopen it or restore its navigation state. Tours, queues and admin use the same view revision checks.
- Backend `22969c3`: the existing activation script now counts the returned JSON array correctly in Windows PowerShell 5.1. Only the counting expression was exercised against 8001; the activation script was not run.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Build and TypeScript | Pass; Vite reports the existing >700 kB bundle warning | `npm run build` |
| Frontend unit tests | 57 pass | `npm test` |
| API and launcher tests | 159 pass | `venv/Scripts/python.exe -m pytest tests/api tests/unit/test_campus_launcher.py -q --basetemp=.pytest-tmp-resumed-review` |
| Browser cases | 26 distinct cases pass | Commands below |
| Four original destinations, both directions | Eight arrivals, final error 0 m, no blocked samples | `walks/p06`, `p10`, `p13`, `p14` reports |
| Floor 0 simulation lab and floor 5 classroom 512A, both directions | Four arrivals, final error 0 m, no blocked samples | `walks/simulation-lab-entrance-walks.json`, `top-floor/classroom-512-entrance-walks.json` |
| Campus tools and guided tour | Three additional arrivals; assistant, history, back/forward, queue join/leave, rankings, admin edit, tour and Idle/Walk pass | `tools/`; existing `campus-tools.spec.ts` |
| Six-floor geometry | 436 directed traversals, no obstruction or unsupported position; six classroom labels visible | `geometry/geometry.json` |
| Four-floor geometry and negative control | 278 directed traversals pass; all 35 flat C14 connections rejected | `floor0-geometry/geometry.json` |
| Startup compatibility | All eight profiles pass, including old 19/16 and current 235/218 | `startup/` |
| Pinned resources | All 56 ready manifest entries match their hashes | `resources/assets.json` |
| Stale-response regression | Four deterministic failures before; four pass after, including a second final run | `regression-baseline.json`, `late-history-*.json`, `logout-*.json` |
| Existing services | 8000 and 8001 read-only browser checks pass; six floor views preserve avatar position | `live/`, `services-before.json`, `services-after.json` |

Browser runs used installed Brave and the RTX 5060 (`UNINAV_RENDERER=hardware`). Route and write tests use the production launcher with an isolated temporary SQLite database and port 0. The opt-in live checks use unauthenticated contexts and do not calculate routes or write accounts/history. The real database retains **3 users and 270 route visits**; listeners remain PID **20496** on 8000 and **21420** on 8001.

The following commands were run with outputs redirected to this directory through `UNINAV_EVIDENCE_DIR` where supported:

```powershell
npx playwright test tests/e2e/campus-tools-races.spec.ts tests/e2e/campus-tools.spec.ts
npx playwright test tests/e2e/c19-review.spec.ts tests/e2e/resumed-walks.spec.ts
npx playwright test tests/e2e/campus-startup.spec.ts
npx playwright test tests/e2e/floor45.spec.ts -g 'all eight reviewed'
npx playwright test tests/e2e/floor45.spec.ts -g 'ucc:f45:classroom-512-entrance'
# Final repeat of the four response regressions after the final build:
npx playwright test tests/e2e/campus-tools-races.spec.ts
# UNINAV_LIVE_REVIEW=1; UNINAV_TEST_URL=http://127.0.0.1:8001:
npx playwright test tests/e2e/live-campus-review.spec.ts
```

Read-only geometry commands used `UNINAV_VERIFY_DIR` to keep the existing evidence intact:

```powershell
node --experimental-strip-types tools/integrate-c19-exterior.ts
node --experimental-strip-types tools/prepare-floor45.ts
node --experimental-strip-types tools/prepare-floor0.ts
```

## Visual review

`overview/` contains six C5/C19 pairs: initial, left, right, rear, oblique and top. `contact-sheet.jpg` is a cropped review sheet; the original full screenshots are retained. The C5 comparison overrides **only** the exterior bytes and their manifest hash at the C19 URL. The C19 screenshots use the unmodified shipped manifest. Both use the same orbit gestures and automatic framing, so their bounds can differ with the model revision.

The images show capped roofs, fewer floating storeys, the access pavilion, cafeteria glazing, glass stair towers, rooftop equipment, courts and nets. Front, rear and top remain readable with the existing lighting; no additional light or material change was needed. The neighboring parcel stays empty. Navigable interiors, references, avatar position and collider count are unchanged. The headless hardware measurement is **144 FPS over 432 frames / 3 seconds**. It measures this presentation view, not every possible device or scene.

## Actual remaining work

- The original campus inventory is not closed. Other blocks have no supplied DWG. Upper A/B junctions, western rooms, additional offices/classrooms and parts of B remain outside the verified navigation graph.
- Floor 0 still lacks the ambiguous B stair, west stair/landing, south-west ramp top, east-yard steps, southern rooms and operational elevators. See `docs/blocks/floor0-navigation.md` and the source level notes.
- The east tower remains a **documented model approximation**: 21 risers versus 20 in the drawing, with a different second-flight extent. Browser support and head clearance are verified against the GLB; that does not resolve the drawing discrepancy. Preserve this distinction before closing geometric fidelity.
- The floor-2 A/B ramp is loaded and its support was reviewed earlier, but it does not yet provide a public cross-block route through newly confirmed B destinations.
- The tools now cover the delivered flows, but complete path/service administration, destination changes while Queues/Admin is open, and the full expired-session/rate-limit/offline matrix still require work. Queue/navigation/tour session state remains volatile as the backend documents.
- Plan 3 has C19 presentation and the faceless Idle/Walk avatar integrated; final acceptance against every visual/interaction criterion remains to be recorded. No closure is inferred from the number of passing tests.

No Blender control or model/source edits were performed. Foreign seed and supervisor continuity hashes remain unchanged. Only the Codex section of the shared execution state is updated. Backend publication uses the clean `publish/c18-floor-zero` branch; local backend `main` contains continuity work and must not be pushed wholesale.

# Model review (Claude)

This folder holds the evidence for each model revision, plus notes for Codex. Claude owns the model, `public/models/campus-reference.md` and this folder. Frontend code, tests and `docs/verification/` belong to Codex.

## Revisions

| Revision | Content | Evidence |
| --- | --- | --- |
| H0 (Preclinic) | Route to the Preclinic through the north circulation and the storeroom; door leaves and furniture regenerated | `h0/api-routes.json`, `h0/walk-*.json` |
| C1 (Plan 3, first visual pass) | Brick facades, glass frames and mullions, interior tiles, plaza pavers, gardens, trees and cypresses from the DWG, stone walls, green wall, fence, lamp posts, solar bike canopy, access pavilion roof and frame | `before/`, `after-c1/` |

## Comparable captures (Plan 3 §11)

All Blender captures use the same cameras (`Review_Cameras` collection in `model/campus.blend`) at 1600 × 1000 px:

| Capture | Camera | Before | After C1 |
| --- | --- | --- | --- |
| General view | `Cam_General` | `before/blender-general.png` | `after-c1/blender-general.png` |
| Access / facade | `Cam_Entrance` | `before/blender-entrance.png` | `after-c1/blender-entrance.png` |
| Patio / plaza | `Cam_Patio` | `before/blender-patio.png` | `after-c1/blender-patio.png` |
| Interior with doors and furniture | `Cam_Interior2` | `before/blender-interior-2.png` | `after-c1/blender-interior-2.png` |
| Interior from the garden side (trees now in front) | `Cam_Interior` | `before/blender-interior.png` | `after-c1/blender-interior.png` |
| Browser, 3D, arrival at the Preclinic | app | `before/browser-3d-preclinic-arrival.png` | `after-c1/browser-3d-preclinic-arrival.png` |
| Browser, top view with the Preclinic route | app | `before/browser-top-preclinic-route.png` | `after-c1/browser-top-preclinic-route.png` |

The browser captures come from a temporary Playwright walk run by Claude against `http://127.0.0.1:8001`, in Brave. That run is kept out of `tests/` and writes nothing to `docs/verification/`.

## Checks repeated after each export

1. **Collision rays.** The same rays as `collides()` in `src/scene/campus.ts` (heights 0.45 and 1.2 m, offsets ±0.22 m) are cast every 0.1 m along all API edges in both directions, against every mesh of the GLB.
   - C1: 16 edges × 2 directions, **0 blocked**.
   - 100 meshes and 52,688 triangles.
   - **1.73 ms** per `collides()` call. The previous GLB took 3.35 ms.
2. **Browser walks.** Hall Acceso → ICETEX, Morphology Laboratory, Elevator and Restroom Hall and Preclinic, plus Preclinic → Hall Acceso.
   - C1: all five reach `arrived`.
   - Final error 0.000 m and maximum centre-line deviation ≤ 0.0007 m.
   - No `blocked` state and no page errors (`after-c1/walks/`).
3. **API routes.** `/routes/calculate` for the same pairs returns 200 (`h0/api-routes.json`).
4. **Served model.** `npm run build`; `dist/models/campus.glb` is the exported file.

## Notes for Codex

- **`tools/verify-model.ts` and `tools/inspect-model.ts` fail on the textured GLB under Node.** GLTFLoader tries to decode the embedded JPEG textures and Node has no image decoder. The app in the browser is not affected. One fix, used by Claude's check: before `parseAsync`, rebuild the GLB without `images`, `textures`, `samplers` and the material texture slots. Collisions and references only need the geometry. Another option is to stub the texture loading.
- **Preclinic.** It now has a route (backend `3809907`). `tests/e2e/campus.spec.ts` ("real API no-route…") and `docs/REHEARSAL.md` / `docs/campus-review.md` still describe it as having no route.
- **Visibility.** `Canopy_Access_Roof` is translucent (alpha 0.16) and sits over Hall Acceso, at the start of every route. If the top view should show nothing above the cut, hide `/^Canopy_/` in top view. Its alpha blending may also need `depthWrite = false` in Three.js if it sorts badly.
- **Shadows.** The `castShadow` regex in `loadModel` uses name prefixes. `Glass_Frames_*` and `Glass_Mullions_*` start with `Glass`, so they do not cast shadows; that is fine. `Deco_Grass` could join the no-shadow list.
- **Collisions.** Everything named `Deco_*`, `Canopy_*`, `Door_Swings`, `Glass_Frames_*` and `Site` is clear of the routes or out of the body-height band. Skipping them in `collides()` would not change walkability and would make the check cheaper still.

# Avatar ("monito"), optional GLB (Plan 3 §8–9)

`avatar.glb` is a simple faceless character that Codex can use instead of the procedural avatar in `src/scene/campus.ts`, or as a reference while refining that one. Integration and the choice between the two belong to Codex. Nothing loads this file yet.

| Item | Value |
| --- | --- |
| Height | 1.71 m; origin at the feet (y = 0 in glTF) |
| Facing | +Z in glTF / Three.js, which is -Y in Blender |
| Footprint | Torso half-width 0.21 m. Arms reach 0.35 m at rest. Use the existing 0.25 m collision radius; the arms are visual only |
| Look | Rounded, no face. Colours: shirt `Monito_Shirt` (UniNav teal), trousers and shoes `Monito_Pants` (dark slate), head and hands `Monito_Head` (light), backpack `Monito_Pack` (small orange accent) |
| Rig | 13 bones: `root`, `hips`, `spine`, `head`, upper arm and forearm, thigh and shin on each side. Rigid parts, one bone each. One skinned mesh, 4 materials, 1,056 vertices |
| Clips | `Idle` (2.0 s loop: slight breathing, head and arm drift) and `Walk` (1.0 s loop: alternating legs and arms, knee bend, light torso twist, 1 cm bob) |
| Size | 90 KB, no textures |

## Suggested use in Three.js

- `const mixer = new AnimationMixer(gltf.scene)`. Use `clipAction("Idle")` and `clipAction("Walk")`, and cross-fade 0.25 s between them on walking, pause, arrival and cancel.
- **Walk speed:** one Walk cycle covers about 1.58 m (two steps). Set `walk.timeScale = speed / 1.58`. At `WALK_SPEED = 3` m/s that is about 1.9.
- Turn gradually towards the direction of motion, as Plan 3 asks. The model faces +Z, so `avatar.rotation.y = Math.atan2(dir.x, dir.z)`.
- Keep the existing contact shadow and destination halo.

Checked by loading it with `GLTFLoader` in Node:
- Clips: `Idle` 2.03 s and `Walk` 1.03 s.
- Feet: at y 0.000 (idle) and 0.007 (walk). Top 1.71 m.

Source: `model/campus.blend`, scene `Avatar`, built by `model/tools/blender_avatar.py`. Captures: `docs/model-review/after-c6/`.

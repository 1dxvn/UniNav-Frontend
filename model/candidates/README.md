# Model candidates (Claude → Codex)

The app only serves the model revision pinned in `public/models/campus-manifest.json`, which is Codex's integration gate. Claude therefore delivers changes to the served first-floor GLB here, as candidates, and leaves `public/models/campus.glb` at the pinned revision. That keeps the app usable.

| Candidate | SHA-256 | Change against the pinned C2 model (`d65846a8…`) | Claude's checks |
| --- | --- | --- | --- |
| `campus-c4-stairs.glb` | `c4e3f8895cc28c5c865fb59993c3848a6292911e7dd3c4c7ab1864ea11dff6f2` | Adds `Stair_A_West` and `Stair_A_East`, the two U-stairs of Block A rising 2.94 m (`docs/blocks/vertical-connections.md`). Nothing else changes | Collision rays on all 16 API edges in both directions: **0 blocked**, 1.73 ms per check, 74,228 triangles. The stairs are 1.2–1.5 m from the north-circulation route |

To integrate a candidate:
1. Copy it to `public/models/campus.glb`.
2. Run the alignment and walk checks.
3. Update the model entry in the manifest: `modelSha256`, `revision`, `sourceCommit`.

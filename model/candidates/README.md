# Model candidates (Claude → Codex)

The app only serves the model revision pinned in `public/models/campus-manifest.json`, which is Codex's integration gate. Claude therefore delivers changes to the served first-floor GLB here, as candidates, and leaves `public/models/campus.glb` at the pinned revision. That keeps the app usable.

| Candidate | SHA-256 | Change against the pinned C2 model (`d65846a8…`) | Claude's checks |
| --- | --- | --- | --- |
| `campus-c4-stairs.glb` | `c4e3f8895cc28c5c865fb59993c3848a6292911e7dd3c4c7ab1864ea11dff6f2` | Adds `Stair_A_West` and `Stair_A_East`, the two U-stairs of Block A rising 2.94 m (`docs/blocks/vertical-connections.md`). Nothing else changes | Collision rays on all 16 API edges in both directions: **0 blocked**, 1.73 ms per check, 74,228 triangles. The stairs are 1.2–1.5 m from the north-circulation route |

**Update 03:50.**
- **Where the stairs are now.** Codex's reviewed build (`docs/MODEL_MANIFEST.md`, commit `0330480`) is in place, so the working export lives in `public/models/campus.glb` again. Claude checked that `npm run build` still serves the reviewed C2 bytes (`dist` SHA `d65846a8…`) while the working file differs.
- **The working export** is the candidate above plus a slab well for the east stair that arrives from floor 0.
  - SHA-256 `41e225fec86f15303276342555be4924d24e1cef79826cfd696f433ca9cee645`.
  - Collision rays: 0 blocked, 1.76 ms per check.
  - Browser walks against the served build: 5 of 5 pass.
- **State:** it is pending Codex's review, per the manifest workflow. `campus-c4-stairs.glb` stays here for reference.

To integrate a candidate:
1. Copy it to `public/models/campus.glb`.
2. Run the alignment and walk checks.
3. Update the model entry in the manifest: `modelSha256`, `revision`, `sourceCommit`.

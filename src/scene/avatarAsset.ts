// Reviewed avatar ("monito", Plan 3 §8–9): Claude's C6 export, pinned by commit and hash. The build stages these exact
// bytes; the scene verifies the hash before replacing the procedural fallback. Clips: Idle (2.0 s) and Walk (1.0 s,
// one cycle covers about 1.58 m). The model faces +Z with its origin at the feet.
export const AVATAR = {
  url: "models/avatar/avatar.glb",
  sourceCommit: "1faa136",
  sha256: "929053ab2455892979b2e01998b268dfcaba83da77f43f9f4e5397cce430a3b2",
  walkCycleMetres: 1.58,
  crossFadeSeconds: 0.25,
} as const;

export type AvatarAnimation = "Idle" | "Walk";

// Movement holds the walk for a short grace period so single slow frames do not flicker between clips.
export function avatarAnimation(now: number, lastMove: number | null, grace = 0.15): AvatarAnimation {
  return lastMove !== null && now - lastMove < grace ? "Walk" : "Idle";
}

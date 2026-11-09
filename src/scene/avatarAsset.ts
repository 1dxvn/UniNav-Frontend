// Avatar with Idle and Walk clips. Asset integrity is checked during build and loading.
export const AVATAR = {
  url: "models/avatar/avatar.glb",
  sha256: "929053ab2455892979b2e01998b268dfcaba83da77f43f9f4e5397cce430a3b2",
  walkCycleMetres: 1.58,
  crossFadeSeconds: 0.25,
} as const;

export type AvatarAnimation = "Idle" | "Walk";

// Movement holds the walk for a short grace period so single slow frames do not flicker between clips.
export function avatarAnimation(now: number, lastMove: number | null, grace = 0.15): AvatarAnimation {
  return lastMove !== null && now - lastMove < grace ? "Walk" : "Idle";
}

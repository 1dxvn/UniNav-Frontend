import { Vector3 } from "three";
import type { Building } from "../api/types.ts";

export const FLOOR_HEIGHT = 3.5;
export const CORRIDOR_RADIUS = 0.62;
export const WALK_SPEED = 3;

// API plan metres -> glTF/Three.js, Y up. North (+API y) is -world Z.
export function toScenePosition(place: Pick<Building, "x" | "y" | "floor">): Vector3 {
  return new Vector3(place.x, place.floor * FLOOR_HEIGHT, -place.y);
}

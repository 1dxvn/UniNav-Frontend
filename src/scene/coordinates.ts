import { Vector3 } from "three";
import type { Building } from "../api/types.ts";

export const FLOOR_HEIGHT = 3.5;
export const CORRIDOR_RADIUS = 0.62;
export const WALK_SPEED = 3;

// API plan metres -> glTF/Three.js, Y up. Plan +y is -world Z, not geographic north.
export function toScenePosition(place: Pick<Building, "x" | "y" | "floor" | "elevation_m" | "effective_elevation_m">): Vector3 {
  return new Vector3(place.x, place.elevation_m ?? place.effective_elevation_m ?? place.floor * FLOOR_HEIGHT, -place.y);
}

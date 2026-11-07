import { Vector3 } from "three";
import type { Building, CampusPath, RouteResponse } from "../api/types.ts";
import { CORRIDOR_RADIUS, toScenePosition } from "./coordinates.ts";

export interface WalkSegment {
  source: Building;
  target: Building;
  path: CampusPath;
  a: Vector3;
  b: Vector3;
}

export function walkSegments(places: Building[], paths: CampusPath[]): WalkSegment[] {
  const byId = new Map(places.map((place) => [place.id, place]));
  return paths.flatMap((path) => {
    const source = byId.get(path.source_id);
    const target = byId.get(path.target_id);
    return source && target ? [{ source, target, path, a: toScenePosition(source), b: toScenePosition(target) }] : [];
  });
}

export function projectOnSegment(point: Vector3, a: Vector3, b: Vector3): { point: Vector3; t: number; distance: number } {
  const direction = b.clone().sub(a);
  const lengthSquared = direction.lengthSq();
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, point.clone().sub(a).dot(direction) / lengthSquared));
  const projected = a.clone().addScaledVector(direction, t);
  return { point: projected, t, distance: point.distanceTo(projected) };
}

export function nearestWalkSegment(position: Vector3, segments: WalkSegment[], floor: number): WalkSegment | undefined {
  let best: WalkSegment | undefined;
  let distance = Infinity;
  for (const segment of segments) {
    if (segment.source.floor !== floor || segment.target.floor !== floor) continue;
    const candidate = projectOnSegment(position, segment.a, segment.b).distance;
    if (candidate < distance) { best = segment; distance = candidate; }
  }
  return best;
}

// Never discard an unknown waypoint: that would join its neighbours through a wall.
// Validate directed edges as well as names before drawing or moving anything.
export function resolveRoute(route: RouteResponse, places: Building[], paths: CampusPath[], originId: number, destinationId: number): Building[] {
  const byName = new Map(places.map((place) => [place.name, place]));
  const resolved = route.path.map((name) => {
    const place = byName.get(name);
    if (!place) throw new Error(`Route contains an unknown place: ${name}. Reload the campus.`);
    return place;
  });
  if (!resolved.length || resolved[0].id !== originId || resolved.at(-1)?.id !== destinationId) {
    throw new Error("The route endpoints do not match your request. Try again.");
  }
  if (route.steps.length !== resolved.length - 1) throw new Error("The API returned an incomplete route.");
  for (let index = 1; index < resolved.length; index++) {
    const a = resolved[index - 1];
    const b = resolved[index];
    const step = route.steps[index - 1];
    if (step.origin_name !== a.name || step.destination_name !== b.name || !paths.some((edge) =>
      edge.kind === step.kind && ((edge.source_id === a.id && edge.target_id === b.id) ||
      (edge.bidirectional && edge.source_id === b.id && edge.target_id === a.id)))) {
      throw new Error(`The route connection from ${a.name} to ${b.name} is unavailable. Reload the campus.`);
    }
  }
  return resolved;
}

export function canWalk(from: Vector3, to: Vector3, segments: WalkSegment[], floor: number): boolean {
  return segments.some((segment) => {
    if (segment.source.floor !== floor || segment.target.floor !== floor) return false;
    const current = projectOnSegment(from, segment.a, segment.b);
    const next = projectOnSegment(to, segment.a, segment.b);
    return current.distance <= CORRIDOR_RADIUS + 0.001 && next.distance <= CORRIDOR_RADIUS &&
      (segment.path.bidirectional || next.t >= current.t - 0.00001);
  });
}

// Walking can end between nodes. Continue along that edge to a reachable endpoint
// before using the API route; do not jump to an unrelated nearest room.
export function routingStart(position: Vector3, places: Building[], segments: WalkSegment[], floor: number): { place: Building; connector: Vector3[] } {
  const exact = places.find((place) => place.floor === floor && toScenePosition(place).distanceTo(position) < 0.00001);
  if (exact) return { place: exact, connector: [position.clone(), toScenePosition(exact)] };
  const segment = nearestWalkSegment(position, segments, floor);
  if (!segment || projectOnSegment(position, segment.a, segment.b).distance > CORRIDOR_RADIUS + 0.01) {
    throw new Error("Choose a start point before calculating a route.");
  }
  const place = !segment.path.bidirectional || position.distanceTo(segment.b) <= position.distanceTo(segment.a)
    ? segment.target : segment.source;
  return { place, connector: [position.clone(), toScenePosition(place)] };
}

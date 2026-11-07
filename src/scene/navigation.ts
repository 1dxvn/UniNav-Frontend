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

export interface WalkWaypoint { position: Vector3; floor: number; placeId?: number }
export interface WalkStart { place: Building; connector: [Vector3,Vector3]; floor: number }

// Keep API floor identity alongside position. A high landing can still belong
// to its departure floor; world Y is never a floor number.
export function walkWaypoints(start: WalkStart, route: Building[]): WalkWaypoint[] {
  if (!route.length || route[0].id !== start.place.id || start.connector[1].distanceTo(toScenePosition(route[0])) > 0.001) {
    throw new Error("The route does not start at the selected graph connection.");
  }
  const points: WalkWaypoint[] = route.map((place) => ({ position:toScenePosition(place),floor:place.floor,placeId:place.id }));
  if (start.floor !== route[0].floor || start.connector[0].distanceTo(points[0].position) > 0.001) {
    points.unshift({ position:start.connector[0].clone(),floor:start.floor });
  }
  return points;
}

export function advanceWalk(position: Vector3, floor: number, target: WalkWaypoint, distance: number): { position:Vector3; floor:number; reached:boolean } {
  const remaining=position.distanceTo(target.position);
  const reached=remaining <= Math.max(0,distance)+0.000001;
  return { position:reached ? target.position.clone() : position.clone().lerp(target.position,Math.max(0,distance)/remaining),floor:reached ? target.floor : floor,reached };
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
    if (segment.source.floor !== floor && segment.target.floor !== floor) continue;
    const candidate = projectOnSegment(position, segment.a, segment.b).distance;
    if (candidate < distance) { best = segment; distance = candidate; }
  }
  return best;
}

// Never discard an unknown waypoint: that would join its neighbours through a wall.
// Prefer stable IDs and explicit elevations. The legacy name contract remains
// available while an existing campus server is running an older API version.
export function resolveRoute(route: RouteResponse, places: Building[], paths: CampusPath[], originId: number, destinationId: number): Building[] {
  const byId = new Map(places.map((place) => [place.id, place]));
  const byName = new Map(places.map((place) => [place.name, place]));
  const resolved = route.waypoints !== undefined ? route.waypoints.map((waypoint) => {
    const place = byId.get(waypoint.id);
    if (!place) throw new Error(`Route contains an unknown place ID: ${waypoint.id}. Reload the campus.`);
    if ((place.code !== undefined && place.code !== waypoint.code) || place.floor !== waypoint.floor ||
        ![waypoint.x, waypoint.y, waypoint.elevation_m].every(Number.isFinite) ||
        Math.abs(place.x - waypoint.x) > 0.00001 || Math.abs(place.y - waypoint.y) > 0.00001 ||
        Math.abs(toScenePosition(place).y - waypoint.elevation_m) > 0.00001) {
      throw new Error(`The route position for ${place.name} has changed. Reload the campus.`);
    }
    return place;
  }) : route.path.map((name) => {
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
    const matchesEndpoints = route.waypoints !== undefined
      ? step.origin_id === a.id && step.destination_id === b.id
      : step.origin_name === a.name && step.destination_name === b.name;
    if (!matchesEndpoints || !paths.some((edge) =>
      (route.waypoints === undefined || (step.path_id === edge.id && (!edge.code || step.connection_code === edge.code))) &&
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
export function routingStart(position: Vector3, places: Building[], segments: WalkSegment[], floor: number): WalkStart {
  const exact = places.find((place) => place.floor === floor && toScenePosition(place).distanceTo(position) < 0.00001);
  if (exact) return { place: exact, connector: [position.clone(), toScenePosition(exact)],floor };
  const segment = nearestWalkSegment(position, segments, floor);
  if (!segment || projectOnSegment(position, segment.a, segment.b).distance > CORRIDOR_RADIUS + 0.01) {
    throw new Error("Choose a start point before calculating a route.");
  }
  const place = !segment.path.bidirectional || position.distanceTo(segment.b) <= position.distanceTo(segment.a)
    ? segment.target : segment.source;
  return { place, connector: [position.clone(), toScenePosition(place)],floor };
}

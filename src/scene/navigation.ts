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

export interface WalkWaypoint { position: Vector3; floor: number; placeId?: number; kind?: CampusPath["kind"] }
export interface WalkStart { place: Building; connector: [Vector3,Vector3]; floor: number; kind?: CampusPath["kind"]; path?:CampusPath }

// Keep API floor identity alongside position. A high landing can still belong
// to its departure floor; world Y is never a floor number.
export function walkWaypoints(start: WalkStart, route: Building[], paths: CampusPath[] = []): WalkWaypoint[] {
  if (!route.length || route[0].id !== start.place.id || start.connector[1].distanceTo(toScenePosition(route[0])) > 0.001) {
    throw new Error("The route does not start at the selected graph connection.");
  }
  const incoming = (a: number,b: number) => paths.find((p) => (p.source_id===a && p.target_id===b) || (p.bidirectional && p.source_id===b && p.target_id===a))?.kind;
  const points: WalkWaypoint[] = route.map((place,index) => ({ position:toScenePosition(place),floor:place.floor,placeId:place.id,
    kind:index ? incoming(route[index-1].id,place.id) : undefined }));
  if (start.floor !== route[0].floor || start.connector[0].distanceTo(points[0].position) > 0.001) {
    points[0].kind=start.kind;
    points.unshift({ position:start.connector[0].clone(),floor:start.floor });
  }
  return points;
}

export interface StairNetwork { segments: WalkSegment[]; floors: number[] }
export function stairNetworks(segments: WalkSegment[]): StairNetwork[] {
  const remaining=new Set(segments.filter((s) => s.path.kind==="stairs")), result:StairNetwork[]=[];
  while (remaining.size) {
    const first=remaining.values().next().value!;
    const group=[first], ids=new Set([first.source.id,first.target.id]); remaining.delete(first);
    for (let changed=true;changed;) {
      changed=false;
      for (const s of remaining) if (ids.has(s.source.id) || ids.has(s.target.id)) {
        ids.add(s.source.id); ids.add(s.target.id); group.push(s); remaining.delete(s); changed=true;
      }
    }
    result.push({ segments:group,floors:[...new Set(group.flatMap((s) => [s.source.floor,s.target.floor]))] });
  }
  return result;
}
export function nearbyStairFloors(position: Vector3,floor: number,networks: StairNetwork[]): number[] {
  return [...new Set(networks.filter((n) => n.floors.includes(floor) && n.segments.some((s) =>
    projectOnSegment(position,s.a,s.b).distance<=CORRIDOR_RADIUS+0.35)).flatMap((n) => n.segments
      .filter((s) => s.source.floor===floor || s.target.floor===floor).flatMap((s) => [s.source.floor,s.target.floor])))];
}

// Graph-constrained keyboard movement. Stepped motion needs reviewed support;
// ordinary same-floor movement preserves the existing graph-only fallback.
export function manualStep(from: Vector3,desired: Vector3,segments: WalkSegment[],floor: number,
  support:(from:Vector3,expected:Vector3,kind?:CampusPath["kind"])=>Vector3|undefined,blocked:(from:Vector3,to:Vector3)=>boolean): { position:Vector3; floor:number } | undefined {
  const options=segments.filter((s) => s.path.kind==="stairs" ? s.source.floor===floor || s.target.floor===floor : s.source.floor===floor && s.target.floor===floor)
    .map((s) => ({ s,current:projectOnSegment(from,s.a,s.b) })).filter(({current}) => current.distance<=CORRIDOR_RADIUS+0.001)
    .sort((a,b) => a.current.distance-b.current.distance);
  for (const {s,current} of options) {
    const stepped=s.path.kind==="stairs" || s.path.kind==="outdoor";
    if (!stepped && Math.abs(from.y-current.point.y)>0.03) continue;
    const next=desired.clone();
    let currentT=segmentProgress(from,s.a,s.b),nextT=segmentProgress(next,s.a,s.b);
    if (stepped) {
      const flatA=s.a.clone().setY(0),flatB=s.b.clone().setY(0);
      if(flatA.distanceToSquared(flatB)<0.00000001)continue;
      currentT=segmentProgress(from.clone().setY(0),flatA,flatB);
      nextT=segmentProgress(next.clone().setY(0),flatA,flatB);
      const t=Math.max(0,Math.min(1,nextT));
      next.y=s.a.y+(s.b.y-s.a.y)*t;
    }
    const projection=projectOnSegment(next,s.a,s.b);
    if (projection.distance>CORRIDOR_RADIUS || (!s.path.bidirectional && nextT<currentT-0.00001)) continue;
    const position=stepped ? support(from,next,s.path.kind) : next;
    if (!position || blocked(from,position)) continue;
    let nextFloor=floor;
    if (s.path.kind==="stairs") {
      if (position.distanceTo(s.b)<0.15 && Math.abs(position.y-s.b.y)<0.03) nextFloor=s.target.floor;
      else if (position.distanceTo(s.a)<0.15 && Math.abs(position.y-s.a.y)<0.03) nextFloor=s.source.floor;
    }
    return { position,floor:nextFloor };
  }
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

function segmentProgress(point:Vector3,a:Vector3,b:Vector3):number {
  const d=b.clone().sub(a);
  return d.lengthSq() ? point.clone().sub(a).dot(d)/d.lengthSq() : 0;
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
  return { place, connector: [position.clone(), toScenePosition(place)],floor,kind:segment.path.kind,path:segment.path };
}

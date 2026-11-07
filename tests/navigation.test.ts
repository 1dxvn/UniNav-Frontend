import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import type { Building, CampusPath, RouteResponse } from "../src/api/types.ts";
import { canWalk, resolveRoute, routingStart, walkSegments } from "../src/scene/navigation.ts";
import { toScenePosition } from "../src/scene/coordinates.ts";

const places: Building[] = [
  { id: 1, name: "Entrance", x: 0, y: 0, floor: 0, faculty: null, building_type: "entrance" },
  { id: 2, name: "Corner", x: 10, y: 0, floor: 0, faculty: null, building_type: "waypoint" },
  { id: 3, name: "Library", x: 10, y: 10, floor: 0, faculty: null, building_type: "library" },
];
const paths: CampusPath[] = [
  { id: 1, source_id: 1, target_id: 2, source_name: "Entrance", target_name: "Corner", kind: "corridor", weight: 10, bidirectional: true },
  { id: 2, source_id: 2, target_id: 3, source_name: "Corner", target_name: "Library", kind: "corridor", weight: 10, bidirectional: false },
];
const route: RouteResponse = { path: ["Entrance", "Corner", "Library"], origin_name: "Entrance", destination_name: "Library", distance: 20, steps: [
  { origin_name: "Entrance", destination_name: "Corner", distance: 10, kind: "corridor" },
  { origin_name: "Corner", destination_name: "Library", distance: 10, kind: "corridor" },
] };

test("preserves the API's corridor corner instead of smoothing through it", () => {
  assert.deepEqual(resolveRoute(route, places, paths, 1, 3).map(toScenePosition).map((point) => point.toArray()), [[0, 0, -0], [10, 0, -0], [10, 0, -10]]);
});
test("rejects unknown waypoints, disconnected hops and reversed one-way paths", () => {
  assert.throws(() => resolveRoute({ ...route, path: ["Entrance", "Missing", "Library"] }, places, paths, 1, 3), /unknown place/);
  assert.throws(() => resolveRoute(route, places, [paths[0]], 1, 3), /connection/);
  assert.throws(() => resolveRoute({ ...route, path: ["Library", "Corner"], steps: [{ origin_name: "Library", destination_name: "Corner", distance: 10, kind: "corridor" }] }, places, paths, 3, 2), /connection/);
});
test("blocks shortcuts across a turn and movement on another floor", () => {
  const segments = walkSegments(places, paths);
  assert.equal(canWalk(new Vector3(5, 0, 0), new Vector3(5, 0, -1), segments, 0), false);
  assert.equal(canWalk(new Vector3(5, 0, 0), new Vector3(5.1, 0, 0), segments, 0), true);
  assert.equal(canWalk(new Vector3(5, 0, 0), new Vector3(5.1, 0, 0), segments, 1), false);
  assert.equal(canWalk(new Vector3(10, 0, -5), new Vector3(10, 0, -4.8), segments, 0), false);
});
test("a moving avatar connects to a reachable edge endpoint", () => {
  const start = routingStart(new Vector3(10, 0, -2), places, walkSegments(places, paths), 0);
  assert.equal(start.place.name, "Library");
  assert.equal(start.connector[0].z, -2);
  assert.equal(start.connector[1].z, -10);
  const nearStart = routingStart(new Vector3(10, 0, -0.05), places, walkSegments(places, paths), 0);
  assert.equal(nearStart.place.name, "Library");
});

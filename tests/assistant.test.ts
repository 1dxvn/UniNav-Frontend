import test from "node:test";
import assert from "node:assert/strict";
import { askCampus, normalize } from "../src/assistant.ts";
import { floorBounds, planToCanvas } from "../src/minimap.ts";
import type { Building } from "../src/api/types.ts";

const place = (id: number, name: string, floor: number, type: string, display?: string): Building =>
  ({ id, name, display_name: display ?? name, x: id, y: id, floor, building_type: type, faculty: null } as Building);
const catalogue = [
  place(1, "Waiting Room (floor 0)", 0, "service", "Waiting room · floor 0"),
  place(2, "Clinical Simulation Laboratory (floor 0)", 0, "laboratory", "Clinical Simulation Lab · floor 0"),
  place(3, "Computer Laboratory 1 (floor 3)", 3, "laboratory", "Computer Lab 1 · 308A"),
  place(4, "Classroom 512 A (floor 5)", 5, "classroom", "Classroom 512A · floor 5"),
  place(5, "Elevator and Restroom Hall", 1, "service"),
  place(6, "East stair point 3 (floors 0-1)", 0, "waypoint"),
];

test("assistant normalizes accents and punctuation", () => {
  assert.equal(normalize("¿Dónde está el Baño?"), "donde esta el bano");
});
test("assistant resolves Spanish needs to confirmed places only", () => {
  assert.equal(askCampus("sala de espera piso cero", catalogue).matches[0].place.id, 1);
  assert.equal(askCampus("¿dónde está el baño?", catalogue).matches[0].place.id, 5);
  assert.equal(askCampus("laboratorio de informática", catalogue).matches[0].place.id, 3);
  assert.equal(askCampus("aula 512", catalogue).matches[0].place.id, 4);
  assert.equal(askCampus("simulación clínica", catalogue).matches[0].place.id, 2);
});
test("assistant applies floor filters and never returns waypoints or invented places", () => {
  const lab3 = askCampus("lab on floor 3", catalogue);
  assert.equal(lab3.floor, 3); assert.deepEqual(lab3.matches.map((m) => m.place.id), [3]);
  assert.ok(askCampus("east stair", catalogue).matches.every((m) => m.place.building_type !== "waypoint"));
  assert.equal(askCampus("piscina olímpica", catalogue).matches.length, 0);
});
test("minimap keeps plan metres undistorted with +y upwards", () => {
  const bounds = floorBounds(catalogue, 0, 1)!;
  const map = planToCanvas(bounds, 220, 160, 10);
  const [ax, ay] = map.toCanvas(1, 1), [bx, by] = map.toCanvas(2, 2);
  assert.ok(bx > ax && by < ay);
  assert.ok(Math.abs((bx - ax) - (ay - by)) < 1e-9);
  const [px, py] = map.toPlan(...map.toCanvas(1.5, 1.25));
  assert.ok(Math.abs(px - 1.5) < 1e-9 && Math.abs(py - 1.25) < 1e-9);
});

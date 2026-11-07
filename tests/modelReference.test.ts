import test from "node:test";
import assert from "node:assert/strict";
import type { Building } from "../src/api/types.ts";
import { Group, Object3D } from "three";
import { parseReference, referenceMatrix, validateAlignment, validateModelNodes, type CampusReference } from "../src/scene/modelReference.ts";

const places: Building[] = [
  { id: 1, name: "Door", x: 0, y: 0, floor: 1, faculty: null, building_type: "entrance" },
  { id: 2, name: "Corner", x: 10, y: 0, floor: 1, faculty: null, building_type: "waypoint" },
  { id: 3, name: "Office", x: 10, y: 5, floor: 1, faculty: null, building_type: "office" },
];
const reference: CampusReference = {
  version: 1, label: "Reference wing", floor: 1, model: "campus.glb",
  transform: { scale: 1, rotationYDegrees: 0, translation: [0, 3.5, 0] },
  references: [ { buildingName: "Door", nodeName: "door", position: [0, 0, 0] }, { buildingName: "Corner", nodeName: "corner", position: [10, 0, 0] }, { buildingName: "Office", nodeName: "office", position: [10, 0, -5] } ],
};
test("accepts aligned metre references on a local-zero floor", () => {
  assert.ok(validateAlignment(parseReference(reference), places).every((point) => point.error === 0));
});
test("rejects mirrored orientation, wrong scale, missing points and malformed vectors", () => {
  assert.throws(() => validateAlignment({ ...reference, transform: { ...reference.transform, scale: 2 } }, places), /alignment/);
  assert.throws(() => validateAlignment({ ...reference, references: reference.references.map((point) => ({ ...point, position: [point.position[0], 0, -point.position[2]] })) }, places), /alignment/);
  assert.throws(() => validateAlignment(reference, places.slice(0, 2)), /missing/);
  assert.throws(() => parseReference({ ...reference, transform: { ...reference.transform, translation: [0, "bad", 0] } }), /references/);
});
test("rejects collinear reference points even if their residual is zero", () => {
  assert.throws(() => validateAlignment({ ...reference, references: reference.references.map((point) => ({ ...point, position: [point.position[0], 0, 0] })) }, places.map((place) => ({ ...place, y: 0 }))), /collinear/);
});
test("checks the actual GLB node positions as well as documented anchors", () => {
  const root = new Group();
  root.applyMatrix4(referenceMatrix(reference));
  for (const anchor of reference.references) {
    const node = new Object3D(); node.name = anchor.nodeName; node.position.set(...anchor.position); root.add(node);
  }
  assert.doesNotThrow(() => validateModelNodes(reference, root));
  root.getObjectByName("office")!.position.x += 1;
  assert.throws(() => validateModelNodes(reference, root), /documented position/);
  root.remove(root.getObjectByName("office")!);
  assert.throws(() => validateModelNodes(reference, root), /missing/);
});

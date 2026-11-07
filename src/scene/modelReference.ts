import { Matrix4, Object3D, Quaternion, Vector3 } from "three";
import type { Building } from "../api/types.ts";
import { toScenePosition } from "./coordinates.ts";

export interface CampusReference {
  version: 1;
  label: string;
  floor: number;
  model: string;
  transform: { scale: number; rotationYDegrees: number; translation: [number, number, number] };
  references: { buildingName: string; nodeName: string; position: [number, number, number] }[];
}

function isVector(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

export function parseReference(value: unknown): CampusReference {
  if (!value || typeof value !== "object") throw new Error("Invalid campus reference file.");
  const reference = value as CampusReference;
  const transform = reference.transform;
  if (reference.version !== 1 || typeof reference.label !== "string" || !reference.label.trim() ||
    !Number.isInteger(reference.floor) || reference.floor < 0 || reference.floor > 7 ||
    typeof reference.model !== "string" || !/^[a-zA-Z0-9_-]+\.glb$/.test(reference.model) ||
    !transform || !Number.isFinite(transform.scale) || transform.scale <= 0 ||
    !Number.isFinite(transform.rotationYDegrees) || !isVector(transform.translation) ||
    !Array.isArray(reference.references) || reference.references.length < 3 ||
    reference.references.some((point) => !point || typeof point.buildingName !== "string" || typeof point.nodeName !== "string" || !isVector(point.position))) {
    throw new Error("Campus references need a scale, transform and at least three named reference points.");
  }
  return reference;
}

export function referenceMatrix(reference: CampusReference): Matrix4 {
  return transformMatrix(reference.transform);
}

export function transformMatrix(transform: CampusReference["transform"]): Matrix4 {
  return new Matrix4().compose(
    new Vector3(...transform.translation),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), transform.rotationYDegrees * Math.PI / 180),
    new Vector3().setScalar(transform.scale),
  );
}

export function validateAlignment(reference: CampusReference, places: Building[]): { name: string; error: number; position: Vector3 }[] {
  const matrix = referenceMatrix(reference);
  const names = new Set(reference.references.map((point) => point.buildingName));
  if (names.size !== reference.references.length) throw new Error("Reference points must have distinct place names.");
  const results = reference.references.map((point) => {
    const place = places.find((candidate) => candidate.name === point.buildingName && candidate.floor === reference.floor);
    if (!place) throw new Error(`Reference place is missing from the API: ${point.buildingName}.`);
    const position = new Vector3(...point.position).applyMatrix4(matrix);
    return { name: point.buildingName, error: position.distanceTo(toScenePosition(place)), position };
  });
  let area = 0;
  for (let i = 1; i < results.length; i++) for (let j = i + 1; j < results.length; j++) {
    const a = results[i].position.clone().sub(results[0].position);
    const b = results[j].position.clone().sub(results[0].position);
    area = Math.max(area, Math.abs(a.x * b.z - a.z * b.x));
  }
  if (area < 0.1) throw new Error("The three reference points must not be collinear in the floor plan.");
  const worst = Math.max(...results.map((point) => point.error));
  if (worst > 0.15) throw new Error(`Model alignment differs from the API by ${worst.toFixed(2)} m (maximum 0.15 m).`);
  return results;
}

export function validateModelNodes(reference: CampusReference, root: Object3D): void {
  root.updateMatrixWorld(true);
  const matrix = referenceMatrix(reference);
  for (const point of reference.references) {
    const node = root.getObjectByName(point.nodeName);
    if (!node) throw new Error(`The GLB reference node is missing: ${point.nodeName}.`);
    const expected = new Vector3(...point.position).applyMatrix4(matrix);
    if (node.getWorldPosition(new Vector3()).distanceTo(expected) > 0.15) {
      throw new Error(`The GLB node does not match its documented position: ${point.nodeName}.`);
    }
  }
}

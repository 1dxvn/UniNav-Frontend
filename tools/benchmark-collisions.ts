import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Group, Raycaster, Vector3 } from "three";
import type { Building, CampusPath } from "../src/api/types.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { parseReference, referenceMatrix, validateAlignment, validateModelNodes } from "../src/scene/modelReference.ts";
import { modelColliders, modelCollision } from "../src/scene/modelCollision.ts";
import { toScenePosition } from "../src/scene/coordinates.ts";

const api = process.env.UNINAV_TEST_URL ?? "http://127.0.0.1:8001";
const output = process.env.UNINAV_VERIFY_DIR ?? "docs/verification/c2";
const bytes = await readFile("public/models/campus.glb");
const hash = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const reference = parseReference(JSON.parse(await readFile("public/models/campus-reference.json","utf8")));
const places = await (await fetch(`${api}/buildings`)).json() as Building[];
const paths = await (await fetch(`${api}/paths`)).json() as CampusPath[];
validateAlignment(reference,places);
const root = new Group(); root.applyMatrix4(referenceMatrix(reference));
root.add((await parseModelGeometry(bytes)).scene); root.updateMatrixWorld(true);
validateModelNodes(reference,root);
const colliders = modelColliders(root), meshes = colliders.map(({ mesh }) => mesh);
const samples: [Vector3,Vector3][] = [];
for (const path of paths) {
  const source = toScenePosition(places.find((place) => place.id === path.source_id)!);
  const target = toScenePosition(places.find((place) => place.id === path.target_id)!);
  for (const [a,b] of path.bidirectional ? [[source,target],[target,source]] : [[source,target]]) {
    for (const fraction of [0,0.25,0.5,0.75]) {
      const from = a.clone().lerp(b,fraction);
      const to = from.clone().add(b.clone().sub(from).setLength(Math.min(0.1,from.distanceTo(b))));
      samples.push([from,to]);
    }
  }
}
function original(from: Vector3, to: Vector3): boolean {
  const direction = to.clone().sub(from), distance = direction.length();
  if (distance < 0.0001) return false;
  direction.normalize();
  for (const height of [0.45,1.2]) for (const offset of [-0.22,0,0.22]) {
    const start = from.clone().add(new Vector3(-direction.z*offset,height,direction.x*offset));
    if (new Raycaster(start,direction,0,distance+0.25).intersectObjects(meshes,false).length) return true;
  }
  return false;
}
for (const [a,b] of samples) {
  if (original(a,b) !== !!modelCollision(a,b,colliders)) throw new Error("Collision optimization changed an actual model result.");
}
function measure(check: (a: Vector3,b: Vector3) => unknown): number {
  for (const [a,b] of samples) check(a,b);
  const start = performance.now();
  for (let repeat = 0; repeat < 5; repeat++) for (const [a,b] of samples) check(a,b);
  return (performance.now()-start)/(samples.length*5);
}
const originalMs = measure(original), optimizedMs = measure((a,b) => modelCollision(a,b,colliders));
const served = await fetch(`${api}/app/models/campus.glb`);
if (!served.ok || hash(new Uint8Array(await served.arrayBuffer())) !== hash(bytes) || hash(await readFile("public/models/campus.glb")) !== hash(bytes)) {
  throw new Error("Model revision changed or differs from the served file.");
}
const report = { checkedAt:new Date().toISOString(), modelSha256:hash(bytes), meshes:meshes.length,
  routeSamples:samples.length, timedCallsPerImplementation:samples.length*5, mismatches:0,
  originalMeanMsPerCall:originalMs, optimizedMeanMsPerCall:optimizedMs, speedup:originalMs/optimizedMs };
await mkdir(output,{ recursive:true });
await writeFile(`${output}/collision-benchmark.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

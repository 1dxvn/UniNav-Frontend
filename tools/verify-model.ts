import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { Group, Mesh, Raycaster, Vector3 } from "three";
import { parseModelGeometry } from "./model-geometry.ts";
import { BODY_RAY_HEIGHTS } from "../src/scene/modelCollision.ts";
import { toScenePosition } from "../src/scene/coordinates.ts";
import type { Building, CampusPath } from "../src/api/types.ts";
import { parseReference, referenceMatrix, validateAlignment, validateModelNodes } from "../src/scene/modelReference.ts";

const api = process.env.UNINAV_TEST_URL ?? "http://127.0.0.1:8001";
const modelRoot = resolve(process.env.UNINAV_MODEL_ROOT ?? "public/models");
const reference = parseReference(JSON.parse(await readFile(join(modelRoot,"campus-reference.json"), "utf8")));
const places = await (await fetch(`${api}/buildings`)).json() as Building[];
const paths = await (await fetch(`${api}/paths`)).json() as CampusPath[];
const references = validateAlignment(reference, places);
const bytes = await readFile(join(modelRoot,reference.model));
const modelSha256 = createHash("sha256").update(bytes).digest("hex");
const servedModelChecked=process.env.UNINAV_VERIFY_SERVED !== "0";
if (servedModelChecked) {
  const served = await fetch(`${api}/app/models/campus.glb`);
  if (!served.ok || createHash("sha256").update(new Uint8Array(await served.arrayBuffer())).digest("hex") !== modelSha256) {
    throw new Error("The served GLB differs from the reviewed model root. Build before reviewing.");
  }
}
const gltf = await parseModelGeometry(bytes);
const root = new Group(); root.applyMatrix4(referenceMatrix(reference)); root.add(gltf.scene); root.updateMatrixWorld(true);
validateModelNodes(reference, root);
const barriers: [Vector3, Vector3][] = [];
const collisionMeshes: Mesh[] = [];
root.traverse((mesh) => {
  if (!(mesh instanceof Mesh)) return;
  collisionMeshes.push(mesh);
  if (!/^(Walls|Columns|Glass)/.test(mesh.name)) return;
  const geometry = mesh.geometry, attribute = geometry.attributes.position, index = geometry.index;
  const height = reference.floor * 3.5 + 1;
  for (let offset = 0; offset < (index?.count ?? attribute.count); offset += 3) {
    const vertices = [0,1,2].map((delta) => new Vector3().fromBufferAttribute(attribute,index ? index.getX(offset+delta) : offset+delta).applyMatrix4(mesh.matrixWorld));
    const intersections: Vector3[] = [];
    for (let edge = 0; edge < 3; edge++) {
      const a = vertices[edge], b = vertices[(edge+1)%3];
      if ((a.y < height && b.y >= height) || (b.y < height && a.y >= height)) intersections.push(a.clone().lerp(b,(height-a.y)/(b.y-a.y)));
    }
    if (intersections.length === 2) barriers.push([intersections[0],intersections[1]]);
  }
});
function clearance(p: Vector3): number {
  return Math.min(...barriers.map(([a,b]) => {
    const d = b.clone().sub(a), length = d.lengthSq();
    const t = length ? Math.max(0,Math.min(1,p.clone().sub(a).dot(d)/length)) : 0;
    return p.distanceTo(a.clone().addScaledVector(d,t));
  }));
}
const edges = paths.map((path) => {
  const source = places.find((place) => place.id === path.source_id)!;
  const target = places.find((place) => place.id === path.target_id)!;
  const a = new Vector3(source.x,reference.floor*3.5+1,-source.y), b = new Vector3(target.x,reference.floor*3.5+1,-target.y);
  const count = Math.ceil(a.distanceTo(b)*10);
  let minimum = Infinity;
  for (let i = 0; i <= count; i++) minimum = Math.min(minimum,clearance(a.clone().lerp(b,i/Math.max(1,count))));
  if (minimum < 0.35) throw new Error(`Insufficient model clearance: ${source.name} -> ${target.name}: ${minimum.toFixed(3)} m`);
  return {from:source.name,to:target.name,minimumWallClearanceMetres:minimum};
});
// Match runtime collides(): all meshes, torso/head heights, three lateral offsets,
// and 0.25 m lookahead. Check every 0.1 m in each permitted direction.
const collisionChecks = paths.flatMap((path) => {
  const source = places.find((place) => place.id === path.source_id)!;
  const target = places.find((place) => place.id === path.target_id)!;
  return (path.bidirectional ? [[source,target], [target,source]] : [[source,target]]).map(([from,to]) => {
    const a = toScenePosition(from), b = toScenePosition(to);
    const direction = b.clone().sub(a).normalize();
    const count = Math.max(1,Math.ceil(a.distanceTo(b)*10));
    for (let index = 0; index < count; index++) {
      const position = a.clone().lerp(b,index/count);
      const distance = a.distanceTo(b)/count;
      for (const height of BODY_RAY_HEIGHTS) for (const offset of [-0.22,0,0.22]) {
        const start = position.clone().add(new Vector3(-direction.z*offset,height,direction.x*offset));
        const hit = new Raycaster(start,direction,0,distance+0.25).intersectObjects(collisionMeshes,false)[0];
        if (hit) throw new Error(`Blocked model route ${from.name} -> ${to.name}: ${hit.object.name} at ${position.toArray()}`);
      }
    }
    return { from:from.name, to:to.name, samples:count, blocked:false };
  });
});
if (createHash("sha256").update(await readFile(join(modelRoot,reference.model))).digest("hex") !== modelSha256) {
  throw new Error("The export changed during geometry verification. Repeat against the new revision.");
}
const report = {
  checkedAt:new Date().toISOString(), model:reference.model, modelRoot, modelSha256,
  geometryOnlyTextureLoading:true,servedModelChecked,collisionRayHeights:BODY_RAY_HEIGHTS,
  collisionMeshes:collisionMeshes.length,
  floor:reference.floor, transform:reference.transform,
  references:references.map((point,index) => ({name:point.name, documentedErrorMetres:point.error, glbErrorMetres:root.getObjectByName(reference.references[index].nodeName)!.getWorldPosition(new Vector3()).distanceTo(point.position),position:point.position.toArray()})),
  minimumWallClearanceMetres:Math.min(...edges.map((edge) => edge.minimumWallClearanceMetres)), edges, collisionChecks,
};
const outputDirectory = process.env.UNINAV_VERIFY_DIR ?? "docs/verification";
await mkdir(outputDirectory,{recursive:true});
await writeFile(`${outputDirectory}/model-alignment.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

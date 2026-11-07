import { readFile, writeFile, mkdir } from "node:fs/promises";
import { Group, Mesh, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Building, CampusPath } from "../src/api/types.ts";
import { parseReference, referenceMatrix, validateAlignment, validateModelNodes } from "../src/scene/modelReference.ts";

const api = process.env.UNINAV_TEST_URL ?? "http://127.0.0.1:8001";
const reference = parseReference(JSON.parse(await readFile(new URL("../public/models/campus-reference.json", import.meta.url), "utf8")));
const places = await (await fetch(`${api}/buildings`)).json() as Building[];
const paths = await (await fetch(`${api}/paths`)).json() as CampusPath[];
const references = validateAlignment(reference, places);
const bytes = await readFile(new URL("../public/models/campus.glb", import.meta.url));
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
const root = new Group(); root.applyMatrix4(referenceMatrix(reference)); root.add(gltf.scene); root.updateMatrixWorld(true);
validateModelNodes(reference, root);
const barriers: [Vector3, Vector3][] = [];
root.traverse((mesh) => {
  if (!(mesh instanceof Mesh) || !/^(Walls|Columns|Glass)/.test(mesh.name)) return;
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
const report = {
  model:"campus.glb", floor:reference.floor, transform:reference.transform,
  references:references.map((point,index) => ({name:point.name, documentedErrorMetres:point.error, glbErrorMetres:root.getObjectByName(reference.references[index].nodeName)!.getWorldPosition(new Vector3()).distanceTo(point.position),position:point.position.toArray()})),
  minimumWallClearanceMetres:Math.min(...edges.map((edge) => edge.minimumWallClearanceMetres)), edges,
};
await mkdir("docs/verification",{recursive:true});
await writeFile("docs/verification/model-alignment.json",JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { Box3, Group, Mesh, Vector3 } from "three";
import { parseManifest, sha256 } from "../src/scene/modelManifest.ts";
import { parseReference, referenceMatrix, transformMatrix } from "../src/scene/modelReference.ts";
import { parseModelGeometry } from "./model-geometry.ts";

const manifest = parseManifest(JSON.parse(await readFile("dist/models/campus-manifest.json","utf8")));
const exterior = manifest.models.find((entry) => entry.kind === "exterior" && entry.state === "ready");
if (!exterior || exterior.navigable !== false || exterior.binding) throw new Error("The overview must remain non-navigable.");
const bytes = await readFile(`dist/${exterior.model}`);
if (await sha256(bytes) !== exterior.modelSha256) throw new Error("The built exterior differs from the reviewed export.");
const api = process.env.UNINAV_TEST_URL ?? "http://127.0.0.1:8001";
const served = await fetch(`${api}/app/${exterior.model}`);
if (!served.ok || await sha256(new Uint8Array(await served.arrayBuffer())) !== exterior.modelSha256) throw new Error("The served exterior differs from the reviewed export.");
const root = new Group(); root.applyMatrix4(transformMatrix(exterior.transform!)); root.add((await parseModelGeometry(bytes)).scene); root.updateMatrixWorld(true);
const bounds = new Box3().setFromObject(root);
let meshes = 0, triangles = 0;
root.traverse((object) => { if (object instanceof Mesh) { meshes++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count)/3; } });
const base = manifest.models.find((entry) => entry.id === "ucc-first-floor")!;
const reference = parseReference(JSON.parse(await readFile(`dist/${base.reference}`,"utf8")));
const baseRoot = new Group(); baseRoot.applyMatrix4(referenceMatrix(reference));
baseRoot.add((await parseModelGeometry(await readFile(`dist/models/${reference.model}`))).scene); baseRoot.updateMatrixWorld(true);
const floorBounds = new Box3().setFromObject(baseRoot);
const minHeightAboveBase = bounds.min.y-manifest.catalog.integrated_dataset.model_elevation_m;
if (!meshes || !Number.isFinite(bounds.getSize(new Vector3()).length()) || minHeightAboveBase < 0) throw new Error("Unexpected exterior bounds or empty model.");
const report = { checkedAt:new Date().toISOString(),sourceCommit:exterior.sourceCommit,modelSha256:exterior.modelSha256,transform:exterior.transform,
  navigable:false,navigationColliders:0,meshes,triangles,minHeightAboveFirstFloorMetres:minHeightAboveBase,
  exteriorBounds:{ min:bounds.min.toArray(),max:bounds.max.toArray() },firstFloorBounds:{ min:floorBounds.min.toArray(),max:floorBounds.max.toArray() },
  sourceDocument:exterior.sourceDocument };
const output = process.env.UNINAV_VERIFY_DIR ?? "docs/verification/c5";
await mkdir(output,{ recursive:true }); await writeFile(`${output}/exterior-alignment.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

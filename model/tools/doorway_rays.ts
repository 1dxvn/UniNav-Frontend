// Checks every doorway of data/floorN/doorways.json against the floor GLB: rays from one stand point to the other at
// 0.45, 1.2 and 1.8 m, centre and ±0.22 m (the runtime's body rays), against every mesh. Writes the result into
// doorways.json ("glb": sha and per-doorway "through": "clear" or the first blocker).
// Usage (from UniNav-Frontend): node --experimental-strip-types model/tools/doorway_rays.ts <N>
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Group, Mesh, Raycaster, Vector3, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const floor = process.argv[2];
const jsonPath = `model/tools/data/floor${floor}/doorways.json`, glbPath = `public/models/floor-${floor}/campus.glb`;

function withoutImages(glb: Buffer): ArrayBuffer {          // Node has no image decoder; geometry is all we need
  const n = glb.readUInt32LE(12); const json = JSON.parse(glb.subarray(20, 20 + n).toString("utf8"));
  delete json.images; delete json.textures; delete json.samplers;
  for (const m of json.materials ?? []) if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; }
  let t = Buffer.from(JSON.stringify(json)); if (t.length % 4) t = Buffer.concat([t, Buffer.alloc(4 - (t.length % 4), 0x20)]);
  const bin = glb.subarray(20 + n), h = Buffer.alloc(20);
  h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(20 + t.length + bin.length, 8); h.writeUInt32LE(t.length, 12); h.writeUInt32LE(0x4e4f534a, 16);
  const out = Buffer.concat([h, t, bin]); return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

const bytes = await readFile(glbPath);
const gltf = await new GLTFLoader().parseAsync(withoutImages(bytes), "");
const root = new Group(); root.add(gltf.scene); root.updateMatrixWorld(true);       // floor-local heights (slab top at 0)
const meshes: Object3D[] = []; root.traverse((o) => { if (o instanceof Mesh) meshes.push(o); });
const data = JSON.parse(await readFile(jsonPath, "utf8"));
let clear = 0, checked = 0;
for (const dw of data.doorways) {
  if (!dw.stand[0] || !dw.stand[1]) { dw.through = "no stand point on one side"; continue; }
  const a = new Vector3(dw.stand[0][0], 0, -dw.stand[0][1]), b = new Vector3(dw.stand[1][0], 0, -dw.stand[1][1]);
  const dir = b.clone().sub(a), dist = dir.length(); dir.normalize();
  let blocker = "";
  for (const h of [0.45, 1.2, 1.8]) for (const off of [-0.22, 0, 0.22]) {
    const start = a.clone().add(new Vector3(-dir.z * off, h, dir.x * off));
    const hit = new Raycaster(start, dir, 0, dist).intersectObjects(meshes, false)[0];
    if (hit && !blocker) blocker = `${hit.object.name} at (${hit.point.x.toFixed(2)}, ${(-hit.point.z).toFixed(2)}), ${h} m`;
  }
  dw.through = blocker || "clear"; checked++; if (!blocker) clear++;
}
data.glb = { path: glbPath.replace("public/", ""), sha256: createHash("sha256").update(bytes).digest("hex") };
await writeFile(jsonPath, JSON.stringify(data, null, 1) + "\n");
console.log(`floor ${floor}: ${checked} doorways checked, ${clear} clear; glb ${data.glb.sha256.slice(0, 8)}`);
for (const dw of data.doorways) if (dw.through !== "clear") console.log(`  ${dw.id} ${dw.through}`);

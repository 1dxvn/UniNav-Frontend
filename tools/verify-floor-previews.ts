import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Box3, Group, Mesh, Raycaster, Vector3 } from "three";
import { parseReference, referenceMatrix, validateAlignment, validateModelNodes } from "../src/scene/modelReference.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { committedAsset } from "./reviewed-assets.ts";

const output = "docs/verification/floor-previews";
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const revisions = JSON.parse(await readFile(`${output}/source-revisions.json`,"utf8")) as {
  level:number; elevation_m:number; model_sha256:string; reference_sha256:string; sourceCommit:string;
}[];
const results = [];
for (const row of revisions) {
  const base = `models/floor-${row.level}`;
  const referenceBytes = await readFile(`public/${base}/campus-reference.json`);
  if (sha(referenceBytes) !== row.reference_sha256) throw new Error(`References changed on floor ${row.level}.`);
  const reference = parseReference(JSON.parse(referenceBytes.toString("utf8")));
  const aligned = validateAlignment(reference,[]);
  const working = await readFile(`public/${base}/campus.glb`);
  const committed = await committedAsset(row.sourceCommit,`${base}/campus.glb`);
  if (sha(committed) !== row.model_sha256) throw new Error(`Reviewed model does not match its source commit on floor ${row.level}.`);
  const bytes = sha(working) === row.model_sha256 ? working : committed;
  const gltf = await parseModelGeometry(bytes);
  const root = new Group(); root.applyMatrix4(referenceMatrix(reference)); root.add(gltf.scene); root.updateMatrixWorld(true);
  validateModelNodes(reference,root);
  let meshes=0, triangles=0;
  const stairs: string[] = [];
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    meshes++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count)/3;
    if (/Stair_A_/.test(object.name)) stairs.push(object.name);
  });
  const slab = root.getObjectByName(`P${row.level}_Floor_Slab`);
  // Probe a documented west return-flight centre. This single vertical ray is
  // evidence about the slab here, not clearance acceptance of an entire stair.
  const slabProbe = slab ? new Raycaster(new Vector3(18.05,row.elevation_m+0.5,-58),new Vector3(0,-1,0),0,1).intersectObject(slab,true)[0] : undefined;
  const bounds = new Box3().setFromObject(root);
  results.push({ ...row,bytes:bytes.length,workingExportMatches:sha(working)===row.model_sha256,
    references:aligned.map((point,index) => ({ node:point.name,planErrorMetres:point.error,
      nodeErrorMetres:root.getObjectByName(reference.references[index].nodeName)!.getWorldPosition(new Vector3()).distanceTo(point.position) })),
    meshes,triangles,stairs,bounds:{ min:bounds.min.toArray(),max:bounds.max.toArray() },
    slabOverWestFlight:slabProbe ? slabProbe.point.toArray() : null,navigable:false });
}
await writeFile(`${output}/structural-checks.json`,JSON.stringify({ checkedAt:new Date().toISOString(),results },null,2));
console.log(JSON.stringify(results.map((row) => ({ floor:row.level,meshes:row.meshes,triangles:row.triangles,maxPlanError:Math.max(...row.references.map((point) => point.planErrorMetres)),slabOverWestFlight:!!row.slabOverWestFlight })),null,2));

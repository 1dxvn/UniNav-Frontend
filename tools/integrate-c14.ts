import { mkdir,readFile,writeFile } from "node:fs/promises";
import { Group,Mesh,Vector3 } from "three";
import { posix } from "node:path";
import { committedAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { parseManifest,sha256 } from "../src/scene/modelManifest.ts";
import { parseReference,referenceMatrix,validateAlignment,validateModelNodes } from "../src/scene/modelReference.ts";
import { supportColliders } from "../src/scene/walkSupport.ts";
import type { Building } from "../src/api/types.ts";

const commit="389cfd9",output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/c14";
const manifest=parseManifest(JSON.parse(await readFile("public/models/campus-manifest.json","utf8")));
const base=JSON.parse(await readFile("../data/datasets/ucc-first-floor.json","utf8"));
const upper=JSON.parse(await readFile("../data/datasets/ucc-second-floor.json","utf8"));
const places=[...base.places,...upper.places] as Building[],results=[],seen=new Map<string,number>();
const entries=[...manifest.models,...(manifest.profiles ?? []).flatMap(p=>p.models)];
for(const e of entries){
  if(e.state!=="ready" || !e.reference || !/^models\/floor-(0|2|4|5)\//.test(e.reference))continue;
  const referenceBytes=await committedAsset(commit,e.reference),reference=parseReference(JSON.parse(referenceBytes.toString("utf8")));
  const modelPath=posix.join(posix.dirname(e.reference),reference.model),bytes=await committedAsset(commit,modelPath);
  if(!seen.has(e.reference)){
    const root=new Group();root.applyMatrix4(referenceMatrix(reference));root.add((await parseModelGeometry(bytes)).scene);root.updateMatrixWorld(true);
    const aligned=validateAlignment(reference,places);validateModelNodes(reference,root);
    if(e.supportNodes)supportColliders(root,e.supportNodes);
    let meshes=0,triangles=0;root.traverse(o=>{if(o instanceof Mesh){meshes++;triangles+=(o.geometry.index?.count ?? o.geometry.attributes.position.count)/3;}});
    const working=await readFile(`public/${modelPath}`);
    results.push({reference:e.reference,model:modelPath,sourceCommit:commit,referenceSha256:await sha256(referenceBytes),modelSha256:await sha256(bytes),workingMatches:await sha256(working)===await sha256(bytes),meshes,triangles,
      anchors:aligned.map((p,i)=>({name:p.name,alignmentErrorMetres:p.error,nodeErrorMetres:root.getObjectByName(reference.references[i].nodeName)!.getWorldPosition(new Vector3()).distanceTo(p.position)}))});
    seen.set(e.reference,results.length-1);
  }
  const row=results[seen.get(e.reference)!];e.sourceCommit=commit;e.referenceSha256=row.referenceSha256;e.modelSha256=row.modelSha256;
  e.revision=`C14-${e.id}-389cfd9`;
}
parseManifest(manifest);
const revisions=[];
for(const e of manifest.models.filter(e=>e.kind==="floor-preview" && e.state==="ready")){
  const ref=parseReference(JSON.parse((await committedAsset(e.sourceCommit!,e.reference!)).toString("utf8")));
  revisions.push({level:e.floors[0],elevation_m:ref.transform.translation[1],model_sha256:e.modelSha256,reference_sha256:e.referenceSha256,sourceCommit:e.sourceCommit});
}
await mkdir(output,{recursive:true});await writeFile(`${output}/integration-assets.json`,JSON.stringify({commit,results,changedEntries:entries.filter(e=>e.sourceCommit===commit).length,graphChanged:false},null,2));
await writeFile(`${output}/source-revisions.json`,JSON.stringify(revisions,null,2));
await writeFile("public/models/campus-manifest.json",JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify(results.map(r=>({model:r.model,reference:r.reference,sha256:r.modelSha256,workingMatches:r.workingMatches,meshes:r.meshes})),null,2));

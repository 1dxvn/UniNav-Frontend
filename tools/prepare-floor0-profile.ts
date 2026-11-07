// Adds the ucc-four-floors-c18 profile (floors 0-3) to the shipped manifest, following tools/prepare-floor3-profile.ts.
// Bindings come from an actual temporary FastAPI snapshot of the four reviewed datasets. Floor 0 becomes navigable on
// the C18 GLB with its own API reference; floor 1 uses the C18 companion (ground slab opened under the stair well).
// Every older profile must stay byte-identical. No live database, service or model export changes.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp,readFile,writeFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,resolve,dirname,basename } from "node:path";
import { dataFingerprint,parseManifest,sha256,type ModelProfile } from "../src/scene/modelManifest.ts";
import { committedRepositoryAsset } from "./reviewed-assets.ts";
import type { Building,CampusPath } from "../src/api/types.ts";

const referenceCommit="76a2f284aa9f8a74b557b77ab47dd3a27cca3b82",modelCommit="711fb9d",id="ucc-four-floors-c18";
const manifest=parseManifest(JSON.parse(await readFile("public/models/campus-manifest.json","utf8")));
const original=manifest.profiles!.filter(p=>p.id!==id),base=original.find(p=>p.id==="ucc-three-floors-c16")!;
const models=structuredClone(base.models),directory=await mkdtemp(join(tmpdir(),"uninav-e2e-")),backend=resolve("..");
let places:Building[],paths:CampusPath[];
try{
  const datasets=["ucc-first-floor-c15.json","ucc-second-floor-c15.json","ucc-third-floor.json","ucc-floor-zero.json"].map(p=>join(backend,"data/datasets",p));
  const {stdout}=await promisify(execFile)(join(backend,"venv/Scripts/python.exe"),["-m","tests.serve_campus","--directory",directory,...datasets.flatMap(p=>["--dataset",p]),"--snapshot-json"],{cwd:backend,windowsHide:true,maxBuffer:16*1024*1024});
  const line=stdout.split(/\r?\n/).find(l=>l.startsWith("UNINAV_E2E_SNAPSHOT="));if(!line)throw new Error("Missing four-floor API snapshot.");
  const data=JSON.parse(line.slice("UNINAV_E2E_SNAPSHOT=".length));places=data.buildings.filter((p:Building)=>p.name!=="Isolated test destination");paths=data.paths;
}finally{
  if(resolve(dirname(directory))!==resolve(tmpdir()) || !basename(directory).startsWith("uninav-e2e-"))throw new Error("Unexpected snapshot path.");
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
if(places!.length!==150 || paths!.length!==139)throw new Error("Unexpected four-floor API counts.");
async function committedModel(path:string){const bytes=await committedRepositoryAsset(modelCommit,path);if(await sha256(await readFile(path))!==await sha256(bytes))throw new Error(`Working export changed: ${path}`);return sha256(bytes);}
for(const floor of [0,1,2,3]){
  const m=models.find(m=>m.floors.includes(floor))!;
  if(floor===0){
    m.id="ucc-floor-zero";m.label="UCC floor 0";m.kind="floor";delete m.navigable;
    m.model="models/c18/floor-0.glb";m.modelSource={commit:modelCommit,path:"model/candidates/c18/floor-0.glb"};m.modelSha256=await committedModel("model/candidates/c18/floor-0.glb");
    m.reference="models/c18/floor-0-navigation-reference.json";m.sourceCommit=referenceCommit;
    m.referenceSha256=await sha256(await committedRepositoryAsset(referenceCommit,`public/${m.reference}`));
    m.supportNodes=["P0_Floor_Slab","P0_Stair_A_East_1"];
    m.sourceDocument="docs/blocks/floor0-navigation.md @76a2f28; model/candidates/c18/README.md @711fb9d; Block A and east clinic N-4.13 / world-0.63; Clinical Simulation Laboratory (D32) and waiting room. B stair, west stair, ramp, southern rooms and elevator operation remain pending.";
    m.revision="C18-floor-0-navigation-v1";
  }
  if(floor===1){
    m.model="models/c18/floor-1.glb";m.modelSource={commit:modelCommit,path:"model/candidates/c18/floor-1.glb"};m.modelSha256=await committedModel("model/candidates/c18/floor-1.glb");
    m.revision="C18-floor-1-open-well-711fb9d";
    m.sourceDocument="model/candidates/c18/README.md @711fb9d; C16 floor 1 with its Site ground slab opened under the stair well; the other 140 meshes are identical to C16 15745b7e.";
  }
  const names=places!.filter(p=>p.floor===floor).map(p=>p.name).sort();
  m.binding={placeNames:names,sha256:await dataFingerprint(names,places!,paths!)};
}
const profile:ModelProfile={id,label:"UCC floors 0-3 with C18 piso cero",requiresExplicitPositions:true,models,stairCrossings:structuredClone(base.stairCrossings)};
manifest.profiles=[profile,...original];parseManifest(manifest);
if(JSON.stringify(manifest.profiles.filter(p=>p.id!==id))!==JSON.stringify(original))throw new Error("Prior profiles changed.");
await writeFile("public/models/campus-manifest.json",JSON.stringify(manifest,null,2)+"\n");
console.log(`Prepared ${id}: 150 places / 139 connections; ${original.length} prior profiles preserved. No live database or model changes.`);

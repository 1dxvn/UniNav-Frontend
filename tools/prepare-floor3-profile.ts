import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp,readFile,writeFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,resolve,dirname,basename } from "node:path";
import { dataFingerprint,parseManifest,sha256,type ModelProfile } from "../src/scene/modelManifest.ts";
import { committedRepositoryAsset } from "./reviewed-assets.ts";
import type { Building,CampusPath } from "../src/api/types.ts";

const referenceCommit="72d1aaa91188fe70ecc3fb26f70d96f035d68b43",id="ucc-three-floors-c16";
const manifest=parseManifest(JSON.parse(await readFile("public/models/campus-manifest.json","utf8")));
const original=manifest.profiles!.filter(p=>p.id!==id),base=original.find(p=>p.id==="ucc-two-floors-c15")!;
const models=structuredClone(base.models),directory=await mkdtemp(join(tmpdir(),"uninav-e2e-")),backend=resolve("..");
let places:Building[],paths:CampusPath[];
try{
  const datasets=["ucc-first-floor-c15.json","ucc-second-floor-c15.json","ucc-third-floor.json"].map(p=>join(backend,"data/datasets",p));
  const {stdout}=await promisify(execFile)(join(backend,"venv/Scripts/python.exe"),["-m","tests.serve_campus","--directory",directory,...datasets.flatMap(p=>["--dataset",p]),"--snapshot-json"],{cwd:backend,windowsHide:true,maxBuffer:16*1024*1024});
  const line=stdout.split(/\r?\n/).find(l=>l.startsWith("UNINAV_E2E_SNAPSHOT="));if(!line)throw new Error("Missing third-floor API snapshot.");
  const data=JSON.parse(line.slice("UNINAV_E2E_SNAPSHOT=".length));places=data.buildings.filter((p:Building)=>p.name!=="Isolated test destination");paths=data.paths;
}finally{
  if(resolve(dirname(directory))!==resolve(tmpdir()) || !basename(directory).startsWith("uninav-e2e-"))throw new Error("Unexpected snapshot path.");
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
if(places!.length!==110 || paths!.length!==102)throw new Error("Unexpected third-floor API counts.");
for(const floor of [1,2,3]){
  const m=models.find(m=>m.floors.includes(floor))!;
  if(floor===3){
    m.id="ucc-third-floor";m.label="UCC third floor";m.kind="floor";delete m.navigable;
    m.reference="models/c16/floor-3-navigation-reference.json";m.sourceCommit=referenceCommit;
    m.referenceSha256=await sha256(await committedRepositoryAsset(referenceCommit,`public/${m.reference}`));
    m.supportNodes=["P3_Floor_Slab","P3_Stair_A_East_1","P3_Stair_A_West_1"];
    m.sourceDocument="docs/blocks/floor3-navigation.md @72d1aaa; three north-bar laboratory entrances; C16 physical A level. Other rooms and A/B transitions remain pending.";
    m.revision="C16-third-floor-navigation-v1";
  }
  const names=places!.filter(p=>p.floor===floor).map(p=>p.name).sort();
  m.binding={placeNames:names,sha256:await dataFingerprint(names,places!,paths!)};
}
const profile:ModelProfile={id,label:"UCC three floors with C16 models",requiresExplicitPositions:true,models,stairCrossings:structuredClone(base.stairCrossings)};
manifest.profiles=[profile,...original];parseManifest(manifest);
if(JSON.stringify(manifest.profiles.filter(p=>p.id!==id))!==JSON.stringify(original))throw new Error("Prior profiles changed.");
await writeFile("public/models/campus-manifest.json",JSON.stringify(manifest,null,2)+"\n");
console.log(`Prepared ${id}: 110 places / 102 connections; five prior profiles preserved. No live database or model changes.`);

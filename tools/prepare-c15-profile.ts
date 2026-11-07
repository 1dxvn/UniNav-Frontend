import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp,readFile,writeFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,resolve,dirname,basename } from "node:path";
import { dataFingerprint,parseManifest,sha256,type ModelProfile } from "../src/scene/modelManifest.ts";
import { committedRepositoryAsset } from "./reviewed-assets.ts";
import type { Building,CampusPath } from "../src/api/types.ts";

const manifest=parseManifest(JSON.parse(await readFile("public/models/campus-manifest.json","utf8")));
const models=structuredClone(manifest.profiles!.find(p=>p.id==="ucc-two-floors")!.models);
const directory=await mkdtemp(join(tmpdir(),"uninav-e2e-")),backend=resolve("..");
let places:Building[],paths:CampusPath[];
try{
  const python=join(backend,"venv",process.platform==="win32" ? "Scripts/python.exe":"bin/python");
  const datasets=["ucc-first-floor-c15.json","ucc-second-floor-c15.json"].map(p=>join(backend,"data/datasets",p));
  const {stdout}=await promisify(execFile)(python,["-m","tests.serve_campus","--directory",directory,...datasets.flatMap(p=>["--dataset",p]),"--snapshot-json"],{cwd:backend,windowsHide:true,maxBuffer:16*1024*1024});
  const line=stdout.split(/\r?\n/).find(l=>l.startsWith("UNINAV_E2E_SNAPSHOT="));if(!line)throw new Error("No isolated C15 snapshot.");
  const data=JSON.parse(line.slice("UNINAV_E2E_SNAPSHOT=".length));places=data.buildings;paths=data.paths;
}finally{
  if(resolve(dirname(directory))!==resolve(tmpdir()) || !basename(directory).startsWith("uninav-e2e-"))throw new Error("Unexpected snapshot path.");
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
for(const floor of [1,2]){
  const m=models.find(m=>m.id===(floor===1 ? "ucc-first-floor":"ucc-second-floor"))!;
  m.model=`models/c15/floor-${floor}.glb`;m.modelSource={commit:"3177ca7",path:`model/candidates/c15/floor-${floor}.glb`};
  m.modelSha256=await sha256(await committedRepositoryAsset(m.modelSource.commit,m.modelSource.path));
  m.revision=`C15-levels-floor-${floor}-3177ca7`;
  const names=places!.filter(p=>p.floor===floor && p.name!=="Isolated test destination").map(p=>p.name).sort();
  m.binding={placeNames:names,sha256:await dataFingerprint(names,places!,paths!)};
  if(floor===1)m.outdoorSupportNodes=["Site"];
}
const hall=JSON.parse(await readFile("../data/datasets/ucc-first-floor-c15.json","utf8"));
const byCode=new Map(hall.places.map((p:{code:string;name:string})=>[p.code,p.name]));
const crossings=hall.paths.filter((p:{code:string})=>p.code.startsWith("ucc:floor1:hall:")).map((p:{code:string;source_code:string;target_code:string})=>({
  connectionCode:p.code,originName:byCode.get(p.source_code) as string,destinationName:byCode.get(p.target_code) as string,
  source:"model/candidates/c15/README.md @3177ca7; measured hall nosings",planBounds:[27.33,47.86,29.79,49.23] as [number,number,number,number]}));
const b=manifest.stairCrossings!.find(c=>c.connectionCode==="ucc:floor1:e10")!;
const profile:ModelProfile={id:"ucc-two-floors-c15",label:"UCC · C15 hall and A levels",requiresExplicitPositions:true,models,stairCrossings:[...crossings,structuredClone(b)]};
manifest.profiles=[profile,...manifest.profiles!.filter(p=>p.id!==profile.id)];
parseManifest(manifest);await writeFile("public/models/campus-manifest.json",JSON.stringify(manifest,null,2)+"\n");
console.log(`Prepared C15 profile for ${places!.length-1} places / ${paths!.length} paths. Existing profiles preserved.`);

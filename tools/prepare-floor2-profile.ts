import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp,readFile,writeFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,resolve } from "node:path";
import { committedAsset } from "./reviewed-assets.ts";
import { dataFingerprint,parseManifest,sha256,type CampusManifest,type ModelEntry } from "../src/scene/modelManifest.ts";
import type { Building,CampusPath } from "../src/api/types.ts";

// Obtain the exact API serialization/weights without opening a port or touching
// either development database. The fixture creates only its own temporary DB.
const directory=await mkdtemp(join(tmpdir(),"uninav-e2e-"));
let places:Building[],paths:CampusPath[];
try{
  const backend=resolve(".."),python=join(backend,"venv",process.platform==="win32" ? "Scripts/python.exe":"bin/python");
  const {stdout}=await promisify(execFile)(python,["-m","tests.serve_campus","--directory",directory,"--dataset",join(backend,"data/datasets/ucc-second-floor.json"),"--snapshot-json"],{cwd:backend,windowsHide:true,maxBuffer:16*1024*1024});
  const line=stdout.split(/\r?\n/).find(l=>l.startsWith("UNINAV_E2E_SNAPSHOT="));if(!line)throw new Error("The isolated API snapshot was not produced.");
  const data=JSON.parse(line.slice("UNINAV_E2E_SNAPSHOT=".length));places=data.buildings;paths=data.paths;
}finally{
  if(!resolve(directory).startsWith(resolve(tmpdir())+"\\uninav-e2e-") && !resolve(directory).startsWith(resolve(tmpdir())+"/uninav-e2e-"))throw new Error("Unexpected snapshot directory.");
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
const manifest=parseManifest(JSON.parse(await readFile("public/models/campus-manifest.json","utf8")));
const profileModels=structuredClone(manifest.models).filter(m=>m.id!=="ucc-floor-2-preview");
const first=profileModels.find(m=>m.id==="ucc-first-floor")!;
const sourceCommit="a6d3f11";
first.sourceCommit=sourceCommit;first.revision="H2-two-floors-a6d3f11";
const upper:ModelEntry={id:"ucc-second-floor",label:"UCC · Second floor",floors:[2],state:"ready",kind:"floor",revision:"H2-three-destinations-a6d3f11",sourceCommit,
  reference:"models/floor-2/campus-navigation-reference.json",referenceSha256:await sha256(await committedAsset(sourceCommit,"models/floor-2/campus-navigation-reference.json")),
  modelSha256:await sha256(await committedAsset(sourceCommit,"models/floor-2/campus.glb")),supportNodes:["P2_Floor_Slab","P2_Stair_A_East_1","P2_Stair_A_West_1"]};
profileModels.push(upper);
for(const m of [first,upper]){
  const names=places!.filter(p=>p.floor===m.floors[0] && p.name!=="Isolated test destination").map(p=>p.name).sort();
  m.binding={placeNames:names,sha256:await dataFingerprint(names,places!,paths!)};
}
const result:CampusManifest={...manifest,identityPlaceNames:["Hall Acceso","ICETEX column reference","Lockers column reference"],
  profiles:[{id:"ucc-two-floors",label:"UCC · First and second floors",requiresExplicitPositions:true,models:profileModels}]};
parseManifest(result);await writeFile("public/models/campus-manifest.json",JSON.stringify(result,null,2)+"\n");
console.log(`Prepared two-floor profile for ${places!.length-1} places / ${paths!.length} paths; legacy profile preserved.`);

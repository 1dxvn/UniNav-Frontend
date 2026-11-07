// Adds the ucc-six-floors-c18 profile (floors 0-5) to the shipped manifest, following tools/prepare-floor3-profile.ts.
// Bindings come from an actual temporary FastAPI snapshot of the five reviewed datasets. Floors 4 and 5 become navigable
// on their unchanged C16 GLBs with their own API references. Every older profile must stay byte-identical.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp,readFile,writeFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,resolve,dirname,basename } from "node:path";
import { dataFingerprint,parseManifest,sha256,type ModelProfile } from "../src/scene/modelManifest.ts";
import { committedRepositoryAsset } from "./reviewed-assets.ts";
import type { Building,CampusPath } from "../src/api/types.ts";

const referenceCommit="fdbe565922fd8dd1b1ec6e4daa529b1faf8a8fd1",id="ucc-six-floors-c18";
const manifest=parseManifest(JSON.parse(await readFile("public/models/campus-manifest.json","utf8")));
const original=manifest.profiles!.filter(p=>p.id!==id),base=original.find(p=>p.id==="ucc-four-floors-c18")!;
const models=structuredClone(base.models),directory=await mkdtemp(join(tmpdir(),"uninav-e2e-")),backend=resolve("..");
let places:Building[],paths:CampusPath[];
try{
  const datasets=["ucc-first-floor-c15.json","ucc-second-floor-c15.json","ucc-third-floor.json","ucc-floor-zero.json","ucc-floors-4-5.json"].map(p=>join(backend,"data/datasets",p));
  const {stdout}=await promisify(execFile)(join(backend,"venv/Scripts/python.exe"),["-m","tests.serve_campus","--directory",directory,...datasets.flatMap(p=>["--dataset",p]),"--snapshot-json"],{cwd:backend,windowsHide:true,maxBuffer:32*1024*1024});
  const line=stdout.split(/\r?\n/).find(l=>l.startsWith("UNINAV_E2E_SNAPSHOT="));if(!line)throw new Error("Missing six-floor API snapshot.");
  const data=JSON.parse(line.slice("UNINAV_E2E_SNAPSHOT=".length));places=data.buildings.filter((p:Building)=>p.name!=="Isolated test destination");paths=data.paths;
}finally{
  if(resolve(dirname(directory))!==resolve(tmpdir()) || !basename(directory).startsWith("uninav-e2e-"))throw new Error("Unexpected snapshot path.");
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
if(places!.length!==235 || paths!.length!==218)throw new Error("Unexpected six-floor API counts.");
const names={4:["ucc-fourth-floor","UCC fourth floor"],5:["ucc-fifth-floor","UCC fifth floor"]} as const;
for(const floor of [0,1,2,3,4,5]){
  const m=models.find(m=>m.floors.includes(floor))!;
  if(floor===4 || floor===5){
    m.id=names[floor][0];m.label=names[floor][1];m.kind="floor";delete m.navigable;
    m.reference=`models/c16/floor-${floor}-navigation-reference.json`;m.sourceCommit=referenceCommit;
    m.referenceSha256=await sha256(await committedRepositoryAsset(referenceCommit,`public/${m.reference}`));
    m.supportNodes=floor===4 ? ["P4_Floor_Slab","P4_Stair_A_East_1","P4_Stair_A_West_1"]:["P5_Floor_Slab"];
    m.sourceDocument=`docs/blocks/floor45-navigation.md @fdbe565; C16 physical Block A level; three source-backed classroom entrances. A/B junctions, western rooms and the rooftop remain pending.`;
    m.revision=`C16-floor-${floor}-navigation-v1`;
  }
  const names2=places!.filter(p=>p.floor===floor).map(p=>p.name).sort();
  m.binding={placeNames:names2,sha256:await dataFingerprint(names2,places!,paths!)};
}
const profile:ModelProfile={id,label:"UCC floors 0-5 with C18 piso cero",requiresExplicitPositions:true,models,stairCrossings:structuredClone(base.stairCrossings)};
manifest.profiles=[profile,...original];parseManifest(manifest);
if(JSON.stringify(manifest.profiles.filter(p=>p.id!==id))!==JSON.stringify(original))throw new Error("Prior profiles changed.");
await writeFile("public/models/campus-manifest.json",JSON.stringify(manifest,null,2)+"\n");
console.log(`Prepared ${id}: 235 places / 218 connections; ${original.length} prior profiles preserved. No live database or model changes.`);

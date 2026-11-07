// Floor-0 (piso cero) access graph on the C18 candidate, following tools/prepare-floor3.ts.
// Builds scope ucc:floor0-connection from committed sources only: the C18 GLB and configuration @362f20b, the floor-0
// doorway inventory and labels @389cfd9 and the C14 structural reference (C18 = floors 0 and 1 @711fb9d). It audits every directed edge of the combined
// graph (C15 floors 1-2, C16 floor 3, this scope) with the runtime support and collision functions against all six
// floors (C18 floors 0/1, C16 floors 3/4/5, C17 floor 2), and checks that each destination sees its literal room label.
// Usage: node --experimental-strip-types tools/prepare-floor0.ts [--export-dataset]
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { Group,Raycaster,Vector3 } from "three";
import { committedRepositoryAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { modelColliders,modelCollision } from "../src/scene/modelCollision.ts";
import { supportColliders,supportedStep } from "../src/scene/walkSupport.ts";
import { parseReference,validateAlignment,validateModelNodes } from "../src/scene/modelReference.ts";
import { sha256 } from "../src/scene/modelManifest.ts";
import type { Building } from "../src/api/types.ts";

const output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/floor0",c18="711fb9d",inventory="389cfd9";
const sources:{path:string;commit:string;sha256:string}[]=[];
async function source(revision:string,path:string){const bytes=await committedRepositoryAsset(revision,path);sources.push({path,commit:revision,sha256:await sha256(bytes)});return bytes;}
const config=JSON.parse((await source(c18,"model/tools/real_levels_c18.json")).toString("utf8"));
const doors=JSON.parse((await source(inventory,"model/tools/data/floor0/doorways.json")).toString("utf8"));
const wing=JSON.parse((await source(inventory,"model/tools/data/floor0/wing.json")).toString("utf8"));
const referenceBytes=await source(inventory,"public/models/floor-0/campus-reference.json");
if(await sha256(referenceBytes)!=="555607e82212e0e21b5c54d66366fd4d559574e28fa9c4bc3cb62e343efa4b7e")throw new Error("Floor-0 structural reference changed.");
const reference=parseReference(JSON.parse(referenceBytes.toString("utf8")));
const [first,second,third]=await Promise.all(["ucc-first-floor-c15.json","ucc-second-floor-c15.json","ucc-third-floor.json"].map(async f=>JSON.parse(await readFile(`../data/datasets/${f}`,"utf8"))));
const models:[number,string,string][]=[[0,c18,"model/candidates/c18/floor-0.glb"],[1,c18,"model/candidates/c18/floor-1.glb"],[2,"0f6a862","model/candidates/c17/floor-2.glb"],
  [3,"002aaec","model/candidates/c16/floor-3.glb"],[4,"002aaec","model/candidates/c16/floor-4.glb"],[5,"002aaec","model/candidates/c16/floor-5.glb"]];
const roots:Group[]=[],supportNames:string[][]=[];
for(const [floor,revision,path] of models){
  const bytes=await source(revision,path);
  if(await sha256(await readFile(path))!==await sha256(bytes))throw new Error(`Working export changed: ${path}`);
  const root=new Group();root.position.y=config.floors[floor].datum_world;root.add((await parseModelGeometry(bytes)).scene);root.updateMatrixWorld(true);roots.push(root);
  const p=floor===0 ? "P0_":floor===1 ? "":`P${floor}_`;
  supportNames.push([`${p}Floor_Slab`,...(floor===0 ? ["P0_Stair_A_East_1"]:floor<5 ? [`${p}Stair_A_East_1`,`${p}Stair_A_West_1`]:[])]);
}
const colliders=roots.flatMap(r=>modelColliders(r)),supports=roots.flatMap((r,i)=>supportColliders(r,supportNames[i]));
const outside=[...supports,...supportColliders(roots[1],["Site"])];
type Place={code:string;name:string;display_name:string;x:number;y:number;floor:number;elevation_m:number;floor_code:string;building_type:string;elevation_source:string;block_code?:string;faculty:null};
const places:Place[]=[],paths:{code:string;source_code:string;target_code:string;kind:"corridor"|"stairs";bidirectional:true}[]=[];
const A0=config.floors[0].datum_world+config.floors[0].a_offset,A1=config.floors[1].datum_world+config.floors[1].a_offset,facade=config.floors[0].a_y;
const provenance=`C18 floor-0 GLB and level configuration @${c18}; floor0 DWG doorways/labels @${inventory}; piso cero sources docs/blocks/level-zones.md @de3815e / e3c18dc; Block A and east clinic N-4.13 / world${A0.toFixed(2)}`;
function place(id:string,name:string,x:number,y:number,floor=0,elevation_m=A0,type="waypoint",display=name){
  const p:Place={code:`ucc:f0:${id}`,name,display_name:display,x,y,floor,elevation_m:Number(elevation_m.toFixed(9)),floor_code:floor===1 ? "ucc-first-floor":"ucc-floor-zero",building_type:type,elevation_source:provenance,block_code:y>=facade ? "A":"B",faculty:null};
  places.push(p);return p;
}
function edge(a:{code:string},b:{code:string},kind:"corridor"|"stairs"="corridor"){
  paths.push({code:`ucc:f0:e${String(paths.length+1).padStart(3,"0")}`,source_code:a.code,target_code:b.code,kind,bidirectional:true});
}
// East tower 0 -> 1: the reviewed floor 1-2 east stair points (same plan centre line, 21 risers), heights rescaled to C18.
const original=second.places.filter((p:Place)=>p.code.startsWith("ucc:f2:east-stair-")) as Place[];
if(original.length!==25 || original[0].x!==36.35 || original[0].y!==55.9 || original[24].x!==38.7 || original[24].y!==55.9)throw new Error("Reviewed east stair layout changed.");
const stair=original.map((p,i)=>{
  const height=A0+(p.elevation_m-2.87)*(A1-A0)/3.31,last=i===original.length-1;
  const created=place(`east-stair-${String(i).padStart(2,"0")}`,`East stair point ${i} (floors 0-1)`,p.x,p.y,last ? 1:0,last ? A1:height);
  created.block_code="A";
  created.elevation_source=`C18 east tower @${c18}: C10-C16 21-riser layout, foot${A0.toFixed(2)}, top${A1.toFixed(2)}, rise${(A1-A0).toFixed(2)}; plan points retain the reviewed east stair centre line; floor-0 metadata until the upper endpoint`;
  return created;
});
for(let i=1;i<stair.length;i++)edge(stair[i-1],stair[i],"stairs");
const junction=second.places.find((p:Place)=>p.code==="ucc:f2:north-junction") as Place;
if(junction.floor!==1 || junction.elevation_m!==A1)throw new Error("Reviewed floor-1 north junction changed.");
edge(stair.at(-1)!,junction);
// Block A circulation, elevator lobby and the facade opening to the waiting room
const foot=stair[0];
const west=place("circulation-west","Floor 0 north circulation, west",33.0,53.0);edge(foot,west);
place("elevator-lobby","Floor 0 elevator lobby",26.4,52.8);edge(west,places.at(-1)!);
const east=place("circulation-east","Floor 0 north circulation, east",39.95,54.6);edge(foot,east);
const junction0=place("corridor-junction","Floor 0 corridor junction",39.95,52.0);edge(east,junction0);
const fn=place("facade-north","Floor 0 facade opening, Block A side",39.95,50.0);edge(junction0,fn);
const fo=place("facade-opening","Floor 0 facade sliding door",40.0,facade);edge(fn,fo);
const fs=place("facade-south","Floor 0 facade opening, waiting-room side",40.05,48.2);edge(fo,fs);
const waiting=place("waiting-room","Waiting Room (floor 0)",39.5,45.5,0,A0,"service","Waiting room · floor 0");edge(fs,waiting);
// Clinical Simulation Laboratory through inventory doorway D32
const door=doors.doorways.find((d:{id:string})=>d.id==="D32");
if(!door || door.through!=="clear" || door.center[0]!==47.584 || !door.stand[0] || !door.stand[1])throw new Error("Unaccepted doorway facts: D32");
const turn=place("sim-lab-corridor-turn","Floor 0 corridor near the Clinical Simulation Laboratory",door.center[0],junction0.y);edge(junction0,turn);
const out=place("sim-lab-outside","Floor 0 D32 corridor stand",...door.stand[0] as [number,number]);edge(turn,out);
const centre=place("sim-lab-door","Floor 0 D32 doorway centre",...door.center as [number,number]);edge(out,centre);
const lab=place("simulation-lab-entrance","Clinical Simulation Laboratory (floor 0)",...door.stand[1] as [number,number],0,A0,"laboratory","Clinical Simulation Lab · floor 0");edge(centre,lab);
const architecture=modelColliders(roots[0]).filter(c=>/Walls|Columns|Glass/.test(c.mesh.name)).map(c=>c.mesh);
const destinations=[];
for(const [p,text,doorway] of [[lab,"LABORATORIO DE SIMULACIÓN CLÍNICA",door],[waiting,"SALA DE ESPERA",null]] as const){
  const found=wing.labels.filter((l:{text:string})=>l.text===text);if(found.length!==1)throw new Error(`Missing/ambiguous source label: ${text}`);
  if(doorway && !doorway.visible_labels[1].some((l:{label:string})=>l.label===text))throw new Error(`Door side does not corroborate ${text}`);
  const a=new Vector3(p.x,p.elevation_m+1.2,-p.y),b=new Vector3(found[0].xy[0],p.elevation_m+1.2,-found[0].xy[1]),direction=b.clone().sub(a);
  const hit=new Raycaster(a,direction.clone().normalize(),0,direction.length()).intersectObjects(architecture,false)[0];
  destinations.push({code:p.code,name:p.name,doorway:doorway ? doorway.id:"facade sliding door (drawn leaves, x 40.55-42.41; opening x 39.66-40.55)",sourceLabel:found[0],labelVisibility:{blockedBy:hit?.object.name ?? null},
    zone:p.block_code==="A" ? "Block A bar (N -4.13, confirmed at the east tower)":"East clinic (N -4.13, confirmed at (39.21, 35.15) and (48.48, 39.70); waiting room extent derived)"});
}
for(const [i,r] of reference.references.entries()){
  const p=place(`reference-${i+1}`,r.buildingName,r.planPosition![0],r.planPosition![1],0,reference.transform.translation[1],"reference");
  delete p.block_code;p.elevation_source="C14/C18 structural P0 reference at the unchanged B datum world0.56; not the walking surface";
}
const data={scope:"ucc:floor0-connection",revision:"c18-floor-zero-v1",source:provenance,places,paths};
const navigation=parseReference({...reference,label:"UCC floor 0 navigation",model:"floor-0.glb",alignment:"api"});
const allPlaces=[...first.places,...second.places,...third.places,...places] as Building[],allPaths=[...first.paths,...second.paths,...third.paths,...paths],byCode=new Map(allPlaces.map(p=>[p.code,p]));
const aligned=validateAlignment(navigation,allPlaces);validateModelNodes(navigation,roots[0]);
const checks=[];
for(const e of allPaths)for(const reverse of [false,true]){
  const a=byCode.get(reverse ? e.target_code:e.source_code)!,b=byCode.get(reverse ? e.source_code:e.target_code)!;
  if(!a || !b)throw new Error(`Unknown endpoint: ${e.code}`);
  let current=new Vector3(a.x,a.elevation_m!,-a.y),samples=0,unsupported=false,blocker:string|null=null;
  const target=new Vector3(b.x,b.elevation_m!,-b.y),surfaces=e.kind==="outdoor" ? outside:supports;
  for(let guard=0;;guard++){
    if(guard>5000)throw new Error(`Stalled geometry check ${e.code}`);
    const delta=target.clone().sub(current),reached=delta.length()<=.035,expected=reached ? target.clone():current.clone().addScaledVector(delta,.035/delta.length());
    const next=["stairs","outdoor"].includes(e.kind) ? supportedStep(current,expected,surfaces):expected,footing=next && supportedStep(next,next,surfaces);
    if(!next || !footing || footing.distanceTo(next)>.001 || (!reached && next.distanceToSquared(current)<1e-14)){unsupported=true;break;}
    const hit=modelCollision(current,next,colliders);if(hit){blocker=hit.name;break;}current=next;samples++;if(reached)break;
  }
  checks.push({code:e.code,scope:e.code.startsWith("ucc:f0:") ? "floor0":"existing",reverse,samples,unsupported,firstBlocker:blocker,lastPosition:current.toArray()});
}
// Negative control: the flat C14 floor-0 preview cannot carry the new floor-0 edges at world -0.63
const flat=new Group();flat.position.y=config.floors[0].datum_world;flat.add((await parseModelGeometry(await committedRepositoryAsset(inventory,"public/models/floor-0/campus.glb"))).scene);flat.updateMatrixWorld(true);
const flatSupports=[...supportColliders(flat,["P0_Floor_Slab"]),...roots.slice(1).flatMap((r,i)=>supportColliders(r,supportNames[i+1]))];
const negative=paths.filter(e=>byCode.get(e.source_code)!.floor===0 && byCode.get(e.target_code)!.floor===0).map(e=>{
  const a=byCode.get(e.source_code)!,p=new Vector3(a.x,a.elevation_m!,-a.y),s=supportedStep(p,p,flatSupports);
  return {code:e.code,from:a.code,supported:!!s && s.distanceTo(p)<=.001};
});
await mkdir(output,{recursive:true});
await writeFile(`${output}/dataset-candidate.json`,JSON.stringify(data,null,2)+"\n");
await writeFile(`${output}/navigation-reference.json`,JSON.stringify(navigation,null,2)+"\n");
const failed=checks.filter(c=>c.unsupported || c.firstBlocker),semantic=destinations.filter(d=>d.labelVisibility.blockedBy),unsafe=negative.filter(n=>n.supported);
await writeFile(`${output}/geometry.json`,JSON.stringify({c18Commit:c18,inventoryCommit:inventory,sources,destinations,anchors:aligned.map(p=>({name:p.name,error:p.error})),
  places:allPlaces.length,paths:allPaths.length,newPlaces:places.length,newPaths:paths.length,checks,failed,negativeFlatC14:negative,unsafeAccepted:unsafe,candidateOnly:true},null,2)+"\n");
console.log(JSON.stringify({newPlaces:places.length,newPaths:paths.length,totalPlaces:allPlaces.length,totalPaths:allPaths.length,checks:checks.length,failed,semantic,flatC14Rejected:negative.length-unsafe.length,unsafe},null,2));
if(failed.length || semantic.length || unsafe.length)throw new Error("Floor 0 candidate needs access/route review before export.");
if(process.argv.includes("--export-dataset")){
  await writeFile("../data/datasets/ucc-floor-zero.json",JSON.stringify(data,null,2)+"\n");
  await mkdir("public/models/c18",{recursive:true});await writeFile("public/models/c18/floor-0-navigation-reference.json",JSON.stringify(navigation,null,2)+"\n");
  console.log("Prepared the floor-0 scope and an owned API reference; no development DB, active manifest or model export changed.");
}

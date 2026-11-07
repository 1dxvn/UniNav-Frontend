// Floors 4 and 5 (Block A) access graph on the accepted C16 geometry, following tools/prepare-floor3.ts.
// Scope ucc:floor45-connection: the east tower 3 -> 4 and 4 -> 5 (reviewed east-stair plan points, 21 risers, rise 3.50 m
// each), the north corridor of each floor and three source-backed classroom entrances per floor (inventory doorways with
// the literal room label on their inside side). Audits every directed edge of the combined graph (C15 floors 1-2, C16
// floor 3, C18 floor 0, this scope) with the runtime support and collision functions against all six floors.
// Usage: node --experimental-strip-types tools/prepare-floor45.ts [--export-dataset]
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { Group,Raycaster,Vector3 } from "three";
import { committedRepositoryAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { modelColliders,modelCollision } from "../src/scene/modelCollision.ts";
import { supportColliders,supportedStep } from "../src/scene/walkSupport.ts";
import { parseReference,validateAlignment,validateModelNodes } from "../src/scene/modelReference.ts";
import { sha256 } from "../src/scene/modelManifest.ts";
import type { Building } from "../src/api/types.ts";

const output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/floor45",c16="002aaec",c18="711fb9d",inventory="389cfd9";
const sources:{path:string;commit:string;sha256:string}[]=[];
async function source(revision:string,path:string){const bytes=await committedRepositoryAsset(revision,path);sources.push({path,commit:revision,sha256:await sha256(bytes)});return bytes;}
const config=JSON.parse((await source(c18,"model/tools/real_levels_c18.json")).toString("utf8"));
const read=async(f:string)=>JSON.parse(await readFile(`../data/datasets/${f}`,"utf8"));
const [first,second,third,zero]=await Promise.all(["ucc-first-floor-c15.json","ucc-second-floor-c15.json","ucc-third-floor.json","ucc-floor-zero.json"].map(read));
const models:[number,string,string][]=[[0,c18,"model/candidates/c18/floor-0.glb"],[1,c18,"model/candidates/c18/floor-1.glb"],[2,"0f6a862","model/candidates/c17/floor-2.glb"],
  [3,c16,"model/candidates/c16/floor-3.glb"],[4,c16,"model/candidates/c16/floor-4.glb"],[5,c16,"model/candidates/c16/floor-5.glb"]];
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
const A=(f:number)=>Number((config.floors[f].datum_world+config.floors[f].a_offset).toFixed(6)),floorCode=(f:number)=>["ucc-floor-zero","ucc-first-floor","ucc-second-floor","ucc-third-floor","ucc-fourth-floor","ucc-fifth-floor"][f];
const provenance=`C16 GLBs and level configuration @${c16} (as in real_levels_c18.json @${c18}); floor4/floor5 DWG doorways and labels @${inventory}; zones @fb39c86; A N+9.87 / world${A(4).toFixed(2)} (floor 4), N+13.37 / world${A(5).toFixed(2)} (floor 5); only source-backed north-bar classroom entrances`;
function place(id:string,name:string,x:number,y:number,floor:number,elevation_m=A(floor),type="waypoint",display=name){
  const p:Place={code:`ucc:f45:${id}`,name,display_name:display,x,y,floor,elevation_m:Number(elevation_m.toFixed(9)),floor_code:floorCode(floor),building_type:type,elevation_source:provenance,block_code:"A",faculty:null};
  places.push(p);return p;
}
function edge(a:{code:string},b:{code:string},kind:"corridor"|"stairs"="corridor"){
  paths.push({code:`ucc:f45:e${String(paths.length+1).padStart(3,"0")}`,source_code:a.code,target_code:b.code,kind,bidirectional:true});
}
const layout=second.places.filter((p:Place)=>p.code.startsWith("ucc:f2:east-stair-")) as Place[];
if(layout.length!==25 || layout[0].x!==36.35 || layout[24].x!==38.7)throw new Error("Reviewed east stair layout changed.");
function tower(lo:number,from:Place,approachY=54.7){
  // On floor 4 a drawn partition (x 38.03-38.50, y 53.46-55.68) closes the corridor west of the 3-4 arrival; the only
  // passage to the 4-5 foot runs north of it, between y 55.68 and the tower well wall (y 56.19): along y 55.95.
  if(approachY!==from.y){const turn=place(`f${lo+1}-stair-turn`,`Floor ${lo+1} stair turn on floor ${lo}`,from.x,approachY,lo);edge(from,turn);from=turn;}
  const hi=lo+1,approach=place(`f${hi}-stair-approach`,`Floor ${hi} stair approach on floor ${lo}`,36.35,approachY,lo);edge(from,approach);
  const stair=layout.map((p,i)=>{
    const last=i===layout.length-1,height=A(lo)+(p.elevation_m-2.87)*(A(hi)-A(lo))/3.31;
    const s=place(`east-stair-${lo}${hi}-${String(i).padStart(2,"0")}`,`East stair point ${i} (floors ${lo}-${hi})`,p.x,p.y,last ? hi:lo,last ? A(hi):height);
    s.elevation_source=`C16 east tower @${c16}: documented 21-riser layout, foot${A(lo).toFixed(2)}, top${A(hi).toFixed(2)}, rise${(A(hi)-A(lo)).toFixed(2)}; plan points retain the reviewed east stair centre line; floor-${lo} metadata until the upper endpoint`;
    return s;
  });
  edge(approach,stair[0]);for(let i=1;i<stair.length;i++)edge(stair[i-1],stair[i],"stairs");
  return stair.at(-1)!;
}
const hub3=third.places.find((p:Place)=>p.code==="ucc:f3:north-corridor") as Place;
if(hub3.x!==38.7 || hub3.y!==54.7 || Math.abs(hub3.elevation_m-A(3))>1e-6)throw new Error("Reviewed floor-3 corridor changed.");
const architecture=(f:number)=>modelColliders(roots[f]).filter(c=>/Walls|Columns|Glass/.test(c.mesh.name)).map(c=>c.mesh);
const destinations:unknown[]=[];
async function floorSpecs(floor:number,arrival:Place,hubX:number,specs:{id:string;room:string}[]){
  const doors=JSON.parse((await source(inventory,`model/tools/data/floor${floor}/doorways.json`)).toString("utf8"));
  const wing=JSON.parse((await source(inventory,`model/tools/data/floor${floor}/wing.json`)).toString("utf8"));
  const hub=place(`f${floor}-north-corridor`,`Floor ${floor} north circulation`,hubX,54.7,floor);edge(arrival,hub);
  let previous=hub;
  for(const s of specs){
    const door=doors.doorways.find((d:{id:string})=>d.id===s.id);
    if(!door || door.through!=="clear" || !door.stand[0] || !door.stand[1])throw new Error(`Unaccepted doorway facts: floor ${floor} ${s.id}`);
    const text=`AULA ${s.room}`,found=wing.labels.filter((l:{text:string})=>l.text===text);
    if(found.length!==1)throw new Error(`Missing/ambiguous source label: ${text}`);
    if(!door.visible_labels[1].some((l:{label:string})=>l.label===text))throw new Error(`Door side does not corroborate ${text}`);
    const n=s.room.replace(" A","");
    const turn=place(`f${floor}-room-${n}-corridor-turn`,`Floor ${floor} corridor near Classroom ${s.room}`,door.center[0],hub.y,floor);edge(previous,turn);previous=turn;
    const out=place(`f${floor}-room-${n}-outside`,`Floor ${floor} ${s.id} corridor stand`,door.stand[0][0],door.stand[0][1],floor);edge(turn,out);
    const centre=place(`f${floor}-room-${n}-door`,`Floor ${floor} ${s.id} doorway centre`,door.center[0],door.center[1],floor);edge(out,centre);
    const inside=place(`classroom-${n}-entrance`,`Classroom ${s.room} (floor ${floor})`,door.stand[1][0],door.stand[1][1],floor,A(floor),"classroom",`Classroom ${s.room.replace(" ","")} · floor ${floor}`);edge(centre,inside);
    const a=new Vector3(inside.x,inside.elevation_m+1.2,-inside.y),b=new Vector3(found[0].xy[0],inside.elevation_m+1.2,-found[0].xy[1]),direction=b.clone().sub(a);
    const hit=new Raycaster(a,direction.clone().normalize(),0,direction.length()).intersectObjects(architecture(floor),false)[0];
    destinations.push({code:inside.code,name:inside.name,doorway:door,sourceLabel:found[0],labelVisibility:{blockedBy:hit?.object.name ?? null}});
  }
  return hub;
}
const arrival4=tower(3,hub3);
// Floor 4: a drawn partition at x 38.28-38.50, y 54.8-55.68 stands west of the stair arrival; the corridor hub keeps x 38.95.
const hub4=await floorSpecs(4,arrival4,38.95,[{id:"D27",room:"420 A"},{id:"D26",room:"421 A"},{id:"D28",room:"422 A"}]);
const arrival5=tower(4,arrival4,55.95);
await floorSpecs(5,arrival5,38.7,[{id:"D18",room:"512 A"},{id:"D19",room:"513 A"},{id:"D11",room:"515 A"}]);
const references:Record<number,ReturnType<typeof parseReference>>={};
for(const [floor,hash] of [[4,"991f88124267d939872f35da41328284a71dc278304f2bad3274441bf902999a"],[5,"04fe3ec0dbc98abd7f64799fdb0e30b8c26094f35c09c24a417d26169618a835"]] as const){
  const bytes=await source(inventory,`public/models/floor-${floor}/campus-reference.json`);if(await sha256(bytes)!==hash)throw new Error(`Floor-${floor} reference changed.`);
  const reference=parseReference(JSON.parse(bytes.toString("utf8")));references[floor]=reference;
  for(const [i,r] of reference.references.entries()){
    const p=place(`f${floor}-reference-${i+1}`,r.buildingName,r.planPosition![0],r.planPosition![1],floor,reference.transform.translation[1],"reference");
    delete p.block_code;p.elevation_source=`C16 structural P${floor} reference at the unchanged B datum world${reference.transform.translation[1]}; not the A walking surface`;
  }
}
const data={scope:"ucc:floor45-connection",revision:"c16-floors-4-5-v1",source:provenance,places,paths};
const navigation=Object.fromEntries([4,5].map(f=>[f,parseReference({...references[f],label:`UCC floor ${f} navigation`,model:`floor-${f}.glb`,alignment:"api"})]));
const allPlaces=[...first.places,...second.places,...third.places,...zero.places,...places] as Building[],allPaths=[...first.paths,...second.paths,...third.paths,...zero.paths,...paths],byCode=new Map(allPlaces.map(p=>[p.code,p]));
const anchors=[4,5].flatMap(f=>{const r=validateAlignment(navigation[f],allPlaces);validateModelNodes(navigation[f],roots[f]);return r.map(p=>({floor:f,name:p.name,error:p.error}));});
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
  checks.push({code:e.code,scope:e.code.startsWith("ucc:f45:") ? "floor45":"existing",reverse,samples,unsupported,firstBlocker:blocker,lastPosition:current.toArray()});
}
await mkdir(output,{recursive:true});
await writeFile(`${output}/dataset-candidate.json`,JSON.stringify(data,null,2)+"\n");
for(const f of [4,5])await writeFile(`${output}/floor-${f}-navigation-reference.json`,JSON.stringify(navigation[f],null,2)+"\n");
const failed=checks.filter(c=>c.unsupported || c.firstBlocker),semantic=(destinations as {labelVisibility:{blockedBy:string|null}}[]).filter(d=>d.labelVisibility.blockedBy);
await writeFile(`${output}/geometry.json`,JSON.stringify({c16Commit:c16,c18Commit:c18,inventoryCommit:inventory,sources,destinations,anchors,places:allPlaces.length,paths:allPaths.length,newPlaces:places.length,newPaths:paths.length,checks,failed,candidateOnly:true},null,2)+"\n");
console.log(JSON.stringify({newPlaces:places.length,newPaths:paths.length,totalPlaces:allPlaces.length,totalPaths:allPaths.length,checks:checks.length,failed,semantic},null,2));
if(failed.length || semantic.length)throw new Error("Floors 4-5 candidate needs access/route review before export.");
if(process.argv.includes("--export-dataset")){
  await writeFile("../data/datasets/ucc-floors-4-5.json",JSON.stringify(data,null,2)+"\n");
  await mkdir("public/models/c16",{recursive:true});
  for(const f of [4,5])await writeFile(`public/models/c16/floor-${f}-navigation-reference.json`,JSON.stringify(navigation[f],null,2)+"\n");
  console.log("Prepared the floors 4-5 scope and owned API references; no development DB, active manifest or model export changed.");
}

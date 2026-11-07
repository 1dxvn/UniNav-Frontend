import { mkdir,readFile,writeFile } from "node:fs/promises";
import { Group,Raycaster,Vector3 } from "three";
import { committedRepositoryAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { modelColliders,modelCollision } from "../src/scene/modelCollision.ts";
import { supportColliders,supportedStep } from "../src/scene/walkSupport.ts";
import { parseReference,validateAlignment,validateModelNodes } from "../src/scene/modelReference.ts";
import { sha256 } from "../src/scene/modelManifest.ts";
import type { Building } from "../src/api/types.ts";

const output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/floor3",commit="002aaec",inventoryCommit="389cfd9";
const sources:{path:string;commit:string;sha256:string}[]=[];
async function source(revision:string,path:string){const bytes=await committedRepositoryAsset(revision,path);sources.push({path,commit:revision,sha256:await sha256(bytes)});return bytes;}
const config=JSON.parse((await source(commit,"model/tools/real_levels.json")).toString("utf8"));
const doors=JSON.parse((await source(inventoryCommit,"model/tools/data/floor3/doorways.json")).toString("utf8"));
const wing=JSON.parse((await source(inventoryCommit,"model/tools/data/floor3/wing.json")).toString("utf8"));
const reference=parseReference(JSON.parse((await source("a2dbda0","public/models/floor-3/campus-reference.json")).toString("utf8")));
const first=JSON.parse(await readFile("../data/datasets/ucc-first-floor-c15.json","utf8")),second=JSON.parse(await readFile("../data/datasets/ucc-second-floor-c15.json","utf8"));
const roots:Group[]=[];
for(let floor=1;floor<=5;floor++){
  const path=`model/candidates/c16/floor-${floor}.glb`,bytes=await source(commit,path);
  if(await sha256(await readFile(path))!==await sha256(bytes))throw new Error(`Working export changed: ${path}`);
  const root=new Group();root.position.y=config.floors[floor].datum_world;root.add((await parseModelGeometry(bytes)).scene);root.updateMatrixWorld(true);roots.push(root);
}
const colliders=roots.flatMap(r=>modelColliders(r)),supports=roots.flatMap((r,i)=>supportColliders(r,[`${i ? `P${i+1}_`:""}Floor_Slab`,...(i<4 ? [`${i ? `P${i+1}_`:""}Stair_A_East_1`,`${i ? `P${i+1}_`:""}Stair_A_West_1`]:[])]));
const outside=[...supports,...supportColliders(roots[0],["Site"])];
type Place={code:string;name:string;display_name:string;x:number;y:number;floor:number;elevation_m:number;floor_code:string;building_type:string;elevation_source:string;block_code?:string;faculty:null};
const places:Place[]=[],paths:{code:string;source_code:string;target_code:string;kind:"corridor"|"stairs";bidirectional:true}[]=[];
const provenance="C16 GLBs and level configuration @002aaec; floor3 DWG jambs/labels @389cfd9; zones @fb39c86; A N+6.37 / world9.87, A floor2 world6.18; only source-backed north-bar destinations";
function place(id:string,name:string,x:number,y:number,floor=3,elevation_m=9.87,type="waypoint",display=name){
  const p:Place={code:`ucc:f3:${id}`,name,display_name:display,x,y,floor,elevation_m,floor_code:floor===2 ? "ucc-second-floor":"ucc-third-floor",building_type:type,elevation_source:provenance,block_code:"A",faculty:null};places.push(p);return p;
}
function edge(a:{code:string},b:{code:string},kind:"corridor"|"stairs"="corridor"){
  paths.push({code:`ucc:f3:e${String(paths.length+1).padStart(3,"0")}`,source_code:a.code,target_code:b.code,kind,bidirectional:true});
}
const hub2=second.places.find((p:Place)=>p.code==="ucc:f2:north-corridor") as Place;
if(hub2.x!==38.7 || hub2.y!==54.7 || hub2.elevation_m!==6.18)throw new Error("Reviewed floor2 corridor changed.");
const approach=place("lower-corridor-turn","Third-floor stair approach on floor 2",36.35,hub2.y,2,6.18);edge(hub2,approach);
const original=second.places.filter((p:Place)=>p.code.startsWith("ucc:f2:east-stair-")) as Place[];
if(original.length!==25)throw new Error("Reviewed east stair layout changed.");
const stair=original.map((p,i)=>{
  const height=Number((6.18+(p.elevation_m-2.87)*3.69/3.31).toFixed(9));
  const created=place(`east-stair-${String(i).padStart(2,"0")}`,`East stair point ${i} (floors 2-3)`,p.x,p.y,i===original.length-1 ? 3:2,height);
  created.elevation_source="C16 east tower @002aaec: documented 21-riser layout, foot6.18, top9.87, rise3.69; plan points retain the reviewed east stair centre line; floor2 metadata until upper endpoint";return created;
});
edge(approach,stair[0]);for(let i=1;i<stair.length;i++)edge(stair[i-1],stair[i],"stairs");
const hub=place("north-corridor","Third-floor north circulation",38.7,54.7);edge(stair.at(-1)!,hub);
const specs=[{id:"D15",number:1,room:"308 A",x:43.514},{id:"D14",number:2,room:"309 A",x:52.644},{id:"D13",number:3,room:"310 A",x:61.864}];
let previous=hub;const destinations=[];
const architecture=modelColliders(roots[2]).filter(c=>/Walls|Columns|Glass/.test(c.mesh.name)).map(c=>c.mesh);
for(const s of specs){
  const door=doors.doorways.find((d:{id:string})=>d.id===s.id);
  if(!door || door.through!=="clear" || door.center[0]!==s.x || !door.stand[0] || !door.stand[1])throw new Error(`Unaccepted doorway facts: ${s.id}`);
  const texts=[`LABORATORIO INFORMATICA ${s.number}`,`AULA ${s.room}`];
  const labels=texts.map(text=>{
    const found=wing.labels.filter((l:{text:string})=>l.text===text);if(found.length!==1)throw new Error(`Missing/ambiguous source label: ${text}`);return found[0];
  });
  if(texts.some(text=>!door.visible_labels[1].some((l:{label:string})=>l.label===text)))throw new Error(`Door side does not corroborate room labels: ${s.id}`);
  const align=place(`lab-${s.number}-corridor-turn`,`Third-floor corridor near Computer Lab ${s.number}`,door.center[0],hub.y);edge(previous,align);previous=align;
  const out=place(`lab-${s.number}-outside`,`Floor 3 ${s.id} corridor stand`,...door.stand[0] as [number,number]);
  const centre=place(`lab-${s.number}-door`,`Floor 3 ${s.id} doorway centre`,...door.center as [number,number]);
  const inside=place(`computer-lab-${s.number}-entrance`,`Computer Laboratory ${s.number} (floor 3)`,...door.stand[1] as [number,number],3,9.87,"laboratory",`Computer Lab ${s.number} · ${s.room.replace(" ","")}`);
  edge(align,out);edge(out,centre);edge(centre,inside);
  const visibility=labels.map(l=>{
    const a=new Vector3(inside.x,inside.elevation_m+1.2,-inside.y),b=new Vector3(l.xy[0],inside.elevation_m+1.2,-l.xy[1]),direction=b.clone().sub(a);
    const hit=new Raycaster(a,direction.clone().normalize(),0,direction.length()).intersectObjects(architecture,false)[0];return {label:l.text,blockedBy:hit?.object.name ?? null};
  });
  destinations.push({code:inside.code,name:inside.name,doorway:door,sourceLabels:labels,architecturalLabelVisibility:visibility,assignment:"Literal laboratory/classroom co-labels and their drawn doorway inside stand; not two invented rooms or a label-centroid walking target."});
}
for(const [i,r] of reference.references.entries()){
  const p=place(`reference-${i+1}`,r.buildingName,r.planPosition![0],r.planPosition![1],3,reference.transform.translation[1],"reference");delete p.block_code;p.elevation_source="C16 structural P3 reference at unchanged B datum world9.38; not the A walking surface";
}
const data={scope:"ucc:floor3-connection",revision:"c16-third-floor-v1",source:provenance,places,paths};
const navigation=parseReference({...reference,label:"UCC third floor navigation",model:"floor-3.glb",alignment:"api"});
const allPlaces=[...first.places,...second.places,...places] as Building[],allPaths=[...first.paths,...second.paths,...paths],byCode=new Map(allPlaces.map(p=>[p.code,p]));
const aligned=validateAlignment(navigation,allPlaces);validateModelNodes(navigation,roots[2]);
const checks=[];
for(const e of allPaths)for(const reverse of [false,true]){
  const a=byCode.get(reverse ? e.target_code:e.source_code)!,b=byCode.get(reverse ? e.source_code:e.target_code)!;
  if(!a || !b)throw new Error(`Unknown endpoint: ${e.code}`);
  let current=new Vector3(a.x,a.elevation_m!,-a.y),samples=0,unsupported=false,blocker:string|null=null;
  const target=new Vector3(b.x,b.elevation_m!,-b.y),surfaces=e.kind==="outdoor" ? outside:supports;
  for(let guard=0;;guard++){
    if(guard>5000)throw new Error(`Stalled geometry check ${e.code}`);
    const delta=target.clone().sub(current),reached=delta.length()<=.035,expected=reached ? target.clone():current.clone().addScaledVector(delta,.035/delta.length());
    const next=["stairs","outdoor"].includes(e.kind) ? supportedStep(current,expected,surfaces):expected,foot=next && supportedStep(next,next,surfaces);
    if(!next || !foot || foot.distanceTo(next)>.001 || (!reached && next.distanceToSquared(current)<1e-14)){unsupported=true;break;}
    const hit=modelCollision(current,next,colliders);if(hit){blocker=hit.name;break;}current=next;samples++;if(reached)break;
  }
  checks.push({code:e.code,reverse,samples,unsupported,firstBlocker:blocker,lastPosition:current.toArray()});
}
await mkdir(output,{recursive:true});
await writeFile(`${output}/dataset-candidate.json`,JSON.stringify(data,null,2)+"\n");
await writeFile(`${output}/navigation-reference.json`,JSON.stringify(navigation,null,2)+"\n");
await writeFile(`${output}/geometry.json`,JSON.stringify({modelCommit:commit,inventoryCommit,sources,destinations,anchors:aligned.map(p=>({name:p.name,error:p.error})),places:allPlaces.length,paths:allPaths.length,checks,candidateOnly:true},null,2));
const failed=checks.filter(c=>c.unsupported || c.firstBlocker),semantic=destinations.flatMap(d=>d.architecturalLabelVisibility).filter(v=>v.blockedBy);
console.log(JSON.stringify({newPlaces:places.length,newPaths:paths.length,totalPlaces:allPlaces.length,totalPaths:allPaths.length,failed,semantic},null,2));
if(failed.length || semantic.length)throw new Error("Floor 3 candidate needs access/route review before export.");
if(process.argv.includes("--export-dataset")){
  await writeFile("../data/datasets/ucc-third-floor.json",JSON.stringify(data,null,2)+"\n");
  await mkdir("public/models/c16",{recursive:true});await writeFile("public/models/c16/floor-3-navigation-reference.json",JSON.stringify(navigation,null,2)+"\n");
  await writeFile("docs/blocks/floor3-door-accesses.json",JSON.stringify({version:1,source:sources.filter(s=>s.path.includes("floor3/")),frame:"Registered first-floor plan metres; +Y is the drawing axis, not geographic north.",doorways:destinations.map(d=>d.doorway),destinations:destinations.map(({doorway,...d})=>({...d,doorway:doorway.id}))},null,2)+"\n");
  console.log("Prepared third-floor scope and an owned API reference; no development DB, active manifest or model export changed.");
}

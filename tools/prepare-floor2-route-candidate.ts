import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Group, Raycaster, Vector3 } from "three";
import { parseModelGeometry } from "./model-geometry.ts";
import { committedAsset } from "./reviewed-assets.ts";
import { modelColliders, modelCollision, type ModelCollider } from "../src/scene/modelCollision.ts";
import { supportColliders, supportedStep } from "../src/scene/walkSupport.ts";
import { advanceWalk } from "../src/scene/navigation.ts";
import { parseReference, validateAlignment, validateModelNodes } from "../src/scene/modelReference.ts";
import type { Building } from "../src/api/types.ts";

// Offline graph preparation, never a runtime pathfinder or a database import.
const commit=process.env.UNINAV_FLOOR2_COMMIT ?? "a2dbda0";
const output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/h2-floor2-candidate";
await mkdir(output,{recursive:true});
const hash=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex");
const sources:{path:string;sha256:string}[]=[];
async function source(path:string) {
  const bytes=commit ? (await promisify(execFile)("git",["show",`${commit}:${path}`],{encoding:"buffer",maxBuffer:32*1024*1024,windowsHide:true})).stdout : await readFile(path);
  sources.push({path,sha256:hash(bytes)});return bytes;
}
const bytes=await source("public/models/floor-2/campus.glb");
const wing=JSON.parse((await source("model/tools/data/floor2/wing.json")).toString("utf8"));
const doorReferencePath="docs/blocks/floor2-door-accesses.json";
const doorReferenceBytes=await readFile(doorReferencePath);sources.push({path:doorReferencePath,sha256:hash(doorReferenceBytes)});
const doors=JSON.parse(doorReferenceBytes.toString("utf8"));
const reference=JSON.parse(await readFile("public/models/floor-2/campus-reference.json","utf8"));
const base=JSON.parse(await readFile("../data/datasets/ucc-first-floor.json","utf8"));
const lower=new Group();lower.position.y=3.5;lower.add((await parseModelGeometry(await committedAsset("a2dbda0","models/campus.glb"))).scene);lower.updateMatrixWorld(true);
const upper=new Group();upper.position.y=6.44;upper.add((await parseModelGeometry(bytes)).scene);upper.updateMatrixWorld(true);
const parsedReference=parseReference(reference);validateAlignment(parsedReference,[]);validateModelNodes(parsedReference,upper);
const colliders:ModelCollider[]=[...modelColliders(lower),...modelColliders(upper)];
const supports=[...supportColliders(lower,["Floor_Slab","Stair_A_East_1","Stair_A_West_1"]),...supportColliders(upper,["P2_Floor_Slab","P2_Stair_A_East_1","P2_Stair_A_West_1"])];
type Place={code:string;name:string;display_name?:string;x:number;y:number;floor:number;elevation_m:number;floor_code:string;building_type:string;elevation_source:string};
const places:Place[]=[],paths:{code:string;source_code:string;target_code:string;kind:"stairs"|"corridor";bidirectional:true}[]=[];
const position=(p:{x:number;y:number;elevation_m:number})=>new Vector3(p.x,p.elevation_m,-p.y);
const provenance=`C13 lower a2dbda0; upper ${commit ?? "working snapshot"} SHA256 ${hash(bytes)}; documented stair/model elevations, flattened A/B half-levels`;
function place(id:string,name:string,x:number,y:number,floor=2,elevation_m=6.44,type="waypoint") {
  const p={code:`ucc:f2:${id}`,name,display_name:name,x,y,floor,elevation_m,floor_code:floor===1 ? "ucc-first-floor":"ucc-second-floor",building_type:type,elevation_source:provenance};places.push(p);return p;
}
function edge(a:{code:string},b:{code:string},kind:"stairs"|"corridor"="corridor") {
  paths.push({code:`ucc:f2:e${String(paths.length+1).padStart(3,"0")}`,source_code:a.code,target_code:b.code,kind,bidirectional:true});
}
const west=base.places.find((p:Place)=>p.code==="ucc:floor1:p15") as Place,east=base.places.find((p:Place)=>p.code==="ucc:floor1:p16") as Place;
const junctionX=36.35,junctionY=west.y+(east.y-west.y)*(junctionX-west.x)/(east.x-west.x);
const junction=place("north-junction","North circulation / east stair junction",junctionX,junctionY,1,3.5);
// Retain the legacy direct corridor edge during migration. These two links lie
// on that same documented segment; they add its actual stair junction.
edge(west,junction);edge(junction,east);
const probe=JSON.parse(await readFile("docs/verification/c13/stair-clearance.json","utf8"));
const measured=probe.stairs.find((s:{name:string})=>s.name==="Stair_A_East").probePath as number[][];
const stair=measured.map(([x,h,z],i)=>place(`east-stair-${String(i).padStart(2,"0")}`,`East stair point ${i} (floors 1-2)`,x,-z,i===measured.length-1 ? 2:1,h));
edge(junction,stair[0]);for(let i=1;i<stair.length;i++)edge(stair[i-1],stair[i],"stairs");
const hub=place("north-corridor","Second-floor north circulation",38.7,54.7);edge(stair.at(-1)!,hub);
const labAlign=place("mixed-corridor-turn","Mixed reality corridor turn",46.604,54.7);edge(hub,labAlign);
const bioAlign=place("molecular-corridor-turn","Molecular biology corridor turn",47.122,54.7);edge(labAlign,bioAlign);
const researchAlign=place("research-corridor-turn","Medical research corridor turn",34.916,54.7);edge(hub,researchAlign);
const selected=[
  {id:"D14",center:[46.604,53.605],outside:0,align:labAlign,code:"mixed-reality",name:"Mixed Reality Laboratory (floor 2)",label:["LABORATORIO","REAL LIDAD","MIXTA"],type:"laboratory"},
  {id:"D15",center:[47.122,56.075],outside:1,align:bioAlign,code:"molecular-biology",name:"Molecular Biology Laboratory (floor 2)",label:["LABORATORIO BIOLOGIA MOLECULAR"],type:"laboratory"},
  {id:"D13",center:[34.916,53.58],outside:1,align:researchAlign,code:"medical-research",name:"Medical Research Centre (floor 2)",label:["CENTRO DE","INVESSTIGACIONES","MEDICAS"],type:"research"},
];
const destinations=[];
for(const s of selected) {
  const d=doors.doorways.find((d:{id:string})=>d.id===s.id);
  if(!d || d.through!=="clear" || Math.hypot(d.center[0]-s.center[0],d.center[1]-s.center[1])>0.01)throw new Error(`Doorway source differs: ${s.id}`);
  const labels=s.label.map(text=>wing.labels.find((l:{text:string})=>l.text===text));
  if(labels.some(l=>!l))throw new Error(`Missing literal CAD label: ${s.name}`);
  const outside=place(`${s.code}-outside`,`${s.id} corridor stand`,...d.stand[s.outside] as [number,number]);
  const door=place(`${s.code}-door`,`${s.id} doorway centre`,...d.center as [number,number]);
  const inside=place(`${s.code}-entrance`,s.id==="D13" ? "D13 interior stand":s.name,...d.stand[1-s.outside] as [number,number],2,6.44,s.id==="D13" ? "waypoint":s.type);
  edge(s.align,outside);edge(outside,door);edge(door,inside);
  let arrival=inside;
  if(s.id==="D13") {
    const a=place("research-interior-turn-1","Medical research interior turn 1",34.916,50.0);
    const b=place("research-interior-turn-2","Medical research interior turn 2",38.569,50.0);
    arrival=place("medical-research-arrival",s.name,38.569,51.782,2,6.44,s.type);
    edge(inside,a);edge(a,b);edge(b,arrival);
  }
  // Semantic corroboration only: source text is not a walking endpoint. A door
  // leaf or desk can obscure a label without creating another room. Movement
  // checks below still include every object, including all furniture and doors.
  const architecture=modelColliders(upper).filter(c=>/Walls|Columns|Glass/.test(c.mesh.name)).map(c=>c.mesh);
  const labelVisibility=labels.map(l=>{
    const a=position(arrival).add(new Vector3(0,1.2,0)),b=new Vector3(l.xy[0],7.64,-l.xy[1]),d=b.clone().sub(a);
    const hit=new Raycaster(a,d.clone().normalize(),0,d.length()).intersectObjects(architecture,false)[0];
    return {label:l.text,blockedBy:hit?.object.name ?? null};
  });
  destinations.push({name:s.name,code:arrival.code,doorway:d,sourceLabels:labels,
    architecturalLabelVisibility:labelVisibility,
    assignment:"Drawn doorway and its inside stand face the literal source labels; architectural partition checks and plan inspection corroborate the bay. Candidate pending complete route acceptance."});
}
for(const [i,r] of reference.references.entries())place(`reference-${i+1}`,r.buildingName,r.planPosition[0],r.planPosition[1],2,6.44,"reference");
const byCode=new Map([...base.places,...places].map((p:Place)=>[p.code,p])),checks=[];
for(const path of paths)for(const reverse of [false,true]) {
  const a=byCode.get(reverse ? path.target_code:path.source_code) as Place,b=byCode.get(reverse ? path.source_code:path.target_code) as Place;
  let current=position(a),samples=0,firstBlocker:string|null=null,unsupported=false;
  const target=position(b);
  for(let guard=0;;guard++) {
    if(guard>3000)throw new Error(`Stalled geometry check ${path.code}`);
    const advance=advanceWalk(current,a.floor,{position:target,floor:b.floor},0.035);
    const next=path.kind==="stairs" ? supportedStep(current,advance.position,supports):advance.position;
    if(!next || !supportedStep(next,next,supports)){unsupported=true;break;}
    const hit=modelCollision(current,next,colliders);if(hit){firstBlocker=hit.name;break;}
    current=next;samples++;if(advance.reached)break;
  }
  checks.push({path:path.code,from:a.name,to:b.name,reverse,kind:path.kind,samples,firstBlocker,unsupported,lastPosition:current.toArray()});
}
if(!commit)for(const s of sources)if(hash(await readFile(s.path))!==s.sha256)throw new Error(`Working source changed during review: ${s.path}`);
const dataset={scope:"ucc:floor2-connection",revision:`candidate-${hash(bytes).slice(0,12)}-${hash(Buffer.from(JSON.stringify({places,paths}))).slice(0,8)}`,source:provenance+"; floor2 doorway jambs/stand points and CAD labels; candidate pending semantic/route acceptance",places,paths};
await writeFile(`${output}/dataset-candidate.json`,JSON.stringify(dataset,null,2)+"\n");
const report={sourceCommit:commit ?? null,sources,destinations,checks,candidateOnly:true,
  note:"No development database or model manifest was changed. Legacy direct north corridor edge retained alongside its collinear junction links. Block identities and flattened A/B levels remain approximate."};
await writeFile(`${output}/route-candidate-checks.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({sources,places:places.length,paths:paths.length,failed:checks.filter(c=>c.firstBlocker || c.unsupported)},null,2));
if(checks.some(c=>c.firstBlocker || c.unsupported))throw new Error("Candidate graph has geometry conflicts; inspect route-candidate-checks.json before rehearsing it.");
if(process.env.UNINAV_EXPORT_FLOOR2_DATASET==="1") {
  const ready={...dataset,revision:`floor2-${commit.slice(0,7)}-${hash(Buffer.from(JSON.stringify({places,paths}))).slice(0,12)}`,
    source:provenance+"; selected DWG jamb/stand points in UniNav-Frontend/docs/blocks/floor2-door-accesses.json; three source destinations, reviewed model geometry; no physical block reassignment"};
  await writeFile("../data/datasets/ucc-second-floor.json",JSON.stringify(ready,null,2)+"\n");
  const navigationReference=parseReference({...reference,label:"UCC second floor navigation",alignment:"api"});
  validateAlignment(navigationReference,[...base.places,...places] as Building[]);validateModelNodes(navigationReference,upper);
  await writeFile("public/models/floor-2/campus-navigation-reference.json",JSON.stringify(navigationReference,null,2)+"\n");
  console.log("Prepared scoped backend dataset and API-aligned reference; no database or active manifest was changed.");
}

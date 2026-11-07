import { mkdir,readFile,writeFile } from "node:fs/promises";
import { Group,Vector3 } from "three";
import { committedAsset,committedRepositoryAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { modelColliders,modelCollision } from "../src/scene/modelCollision.ts";
import { supportColliders,supportedStep } from "../src/scene/walkSupport.ts";
import { advanceWalk } from "../src/scene/navigation.ts";
import { sha256 } from "../src/scene/modelManifest.ts";
import { parseReference,validateAlignment,validateModelNodes } from "../src/scene/modelReference.ts";
import type { Building } from "../src/api/types.ts";

// Prepare scoped data from committed evidence. Never opens a development DB or
// edits an export. Pending physical levels retain the candidate's flat model frame.
const commit="3177ca7",output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/c15";
const base=JSON.parse(await readFile("../data/datasets/ucc-first-floor.json","utf8"));
const upper=JSON.parse(await readFile("../data/datasets/ucc-second-floor.json","utf8"));
const zones=JSON.parse((await committedRepositoryAsset(commit,"docs/blocks/level-zones.json")).toString("utf8"));
const source=`C15 ${commit}; model/candidates/c15/README.md; level-zones @71fd98a; B datum world 3.5 m; Block A confirmed/derived levels; pending zones explicitly retain model-only flat heights`;
const first=structuredClone(base),second=structuredClone(upper);
first.revision="c15-first-floor-v1";first.source=source;
second.revision="c15-second-floor-v1";second.source=source;
const pending=[];
for(const p of first.places){
  const row=zones.floors["1"].places.find((r:{place:string})=>r.place===p.name);
  if(!row || Math.hypot(p.x-row.plan[0],p.y-row.plan[1])>0.001)throw new Error(`Missing/mismatched source assignment: ${p.name}`);
  const reference=p.building_type==="reference";
  p.elevation_m=reference || row.level===null ? 3.5:3.5+row.level;
  p.elevation_source=reference ? `C15 structural reference at unchanged B datum; ${row.status}; not a walking-floor elevation`:
    row.level===null ? `C15 pending physical level (${row.zone}); model-only flat world Y 3.5 retained; no physical height inferred`:
    `C15 level-zones ${row.zone}: N ${row.level}; ${row.status}; world B datum 3.5`;
  if(row.level===null && p.code!=="ucc:floor1:p09")pending.push({code:p.code,name:p.name,status:"pending",modelElevation:p.elevation_m});
  if(p.code==="ucc:floor1:p09"){
    p.y=47.6;p.elevation_m=3.5;p.elevation_source="C15 README hall before-point (28,47.6), off the treads, N 0.00; stable place ID retained";
  }
  if(p.code==="ucc:floor1:p02"){
    p.elevation_m=3.35;p.elevation_source="C15 Site mesh top at world 3.35 (0.15 m below B slab); model-only placement, not a surveyed N -0.15 level; access-zone physical datum remains derived";
  }
}
const template=first.places.find((p:{code:string})=>p.code==="ucc:floor1:p09");
const hall=[
  {code:"ucc:floor1:hall-tread-01",name:"Hall steps tread 1",y:(47.86+48.32)/2,elevation_m:3.5-0.1575},
  {code:"ucc:floor1:hall-tread-02",name:"Hall steps tread 2",y:(48.32+48.78)/2,elevation_m:3.5-0.315},
  {code:"ucc:floor1:hall-tread-03",name:"Hall steps tread 3",y:(48.78+49.23)/2,elevation_m:3.5-0.4725},
  {code:"ucc:floor1:hall-after",name:"Hall steps / Block A arrival",y:49.5,elevation_m:2.87},
].map(p=>({...template,...p,display_name:p.name,x:28,building_type:"waypoint",elevation_source:"C15 measured hall nosings/tread centres and documented after-point; four 0.1575 m risers; world B datum 3.5"}));
first.places.push(...hall);
const old=first.paths.find((p:{code:string})=>p.code==="ucc:floor1:e09");
old.source_code=hall.at(-1)!.code;old.kind="corridor"; // Retarget the original row atomically, leaving no direct bypass.
first.paths.find((p:{code:string})=>p.code==="ucc:floor1:e10").kind="stairs"; // Confirmed crossing, still a flat pending B region.
const chain=[template,...hall];
for(let i=1;i<chain.length;i++)first.paths.push({code:`ucc:floor1:hall:e${i}`,source_code:chain[i-1].code,target_code:chain[i].code,kind:"stairs",bidirectional:true});
for(const p of second.places){
  if(p.building_type==="reference"){
    p.elevation_source="C15 documented structural reference keeps the world 6.44 B datum; not the A walking surface";continue;
  }
  if(p.code.startsWith("ucc:f2:east-stair-")){
    p.elevation_m=Number((2.87+(p.elevation_m-3.5)*3.31/2.94).toFixed(9));
    p.elevation_source="C15 measured A stair, same tread layout; world foot 2.87, rise 3.31, top 6.18; waypoint floor metadata retained";
  }else{
    if(p.x<13.6 || p.y<49.23)throw new Error(`Upper point crosses an unresolved zone: ${p.name}`);
    p.elevation_m=p.floor===1 ? 2.87:6.18;
    p.elevation_source=`C15 confirmed A zone at N ${p.floor===1 ? "-0.63":"+2.68"}; world B datum 3.5`;
  }
}
const places=[...first.places,...second.places],paths=[...first.paths,...second.paths];
const byCode=new Map(places.map((p:Building&{code:string})=>[p.code,p]));
const roots:Group[]=[],sources=[];
for(const [floor,elevation] of [[1,3.5],[2,6.44]]){
  const path=`model/candidates/c15/floor-${floor}.glb`,bytes=await committedRepositoryAsset(commit,path);
  const root=new Group();root.position.y=elevation;root.add((await parseModelGeometry(bytes)).scene);root.updateMatrixWorld(true);roots.push(root);
  sources.push({path,commit,sha256:await sha256(bytes),workingMatches:await sha256(await readFile(path))===await sha256(bytes)});
}
const references=[];
for(const [i,path] of ["models/campus-reference.json","models/floor-2/campus-navigation-reference.json"].entries()){
  const ref=parseReference(JSON.parse((await committedAsset("389cfd9",path)).toString("utf8")));
  const aligned=validateAlignment(ref,places as Building[]);validateModelNodes(ref,roots[i]);
  references.push({path,anchors:aligned.map(p=>({name:p.name,error:p.error}))});
}
const colliders=roots.flatMap(r=>modelColliders(r));
const supports=[...supportColliders(roots[0],["Floor_Slab","Stair_A_East_1","Stair_A_West_1"]),...supportColliders(roots[1],["P2_Floor_Slab","P2_Stair_A_East_1","P2_Stair_A_West_1"])];
const outdoorSupports=[...supports,...supportColliders(roots[0],["Site"])];
const position=(p:Building)=>new Vector3(p.x,p.elevation_m!,-p.y),checks=[];
for(const edge of paths)for(const reverse of [false,true]){
  const a=byCode.get(reverse ? edge.target_code:edge.source_code) as Building,b=byCode.get(reverse ? edge.source_code:edge.target_code) as Building;
  if(!a || !b)throw new Error(`Unknown endpoint: ${edge.code}`);
  let current=position(a),samples=0,firstBlocker:string|null=null,unsupported=false;
  const target=position(b);
  for(let guard=0;;guard++){
    if(guard>5000)throw new Error(`Stalled ${edge.code}`);
    const advance=advanceWalk(current,a.floor,{position:target,floor:b.floor},0.035);
    const surfaces=edge.kind==="outdoor" ? outdoorSupports:supports;
    const next=["stairs","outdoor"].includes(edge.kind) ? supportedStep(current,advance.position,surfaces):advance.position;
    const foot=next && supportedStep(next,next,surfaces);
    if(!next || !foot || next.distanceTo(foot)>0.001){unsupported=true;break;}
    const blocker=modelCollision(current,next,colliders);if(blocker){firstBlocker=blocker.name;break;}
    current=next;samples++;if(advance.reached)break;
  }
  checks.push({code:edge.code,from:a.name,to:b.name,reverse,samples,firstBlocker,unsupported,lastPosition:current.toArray()});
}
const towerProbes=[];
const eastPoints=second.places.filter((p:Building)=>p.code!.startsWith("ucc:f2:east-stair-"));
for(const tower of ["east","west"])for(const reverse of [false,true]){
  // West centre lines are the previously reviewed inspection probe, not API places.
  const route=eastPoints.map((p:Building)=>position({...p,x:tower==="east" ? p.x:p.x<=37.55 ? 14.65+(p.x-36.35)*1.7/1.2:16.35+(p.x-37.55)*1.7/1.15}));
  if(reverse)route.reverse();let current=route[0].clone(),samples=0,firstBlocker:string|null=null,unsupported=false;
  for(const target of route.slice(1)){
    for(let guard=0;;guard++){
      if(guard>5000)throw new Error("Stalled tower inspection.");
      const advanced=advanceWalk(current,1,{position:target,floor:1},.035),next=supportedStep(current,advanced.position,supports);
      if(!next){unsupported=true;break;}const blocker=modelCollision(current,next,colliders);if(blocker){firstBlocker=blocker.name;break;}
      current=next;samples++;if(advanced.reached)break;
    }
    if(unsupported || firstBlocker)break;
  }
  towerProbes.push({tower,reverse,samples,unsupported,firstBlocker,lastPosition:current.toArray(),scope:"inspection only, no added API path"});
}
await mkdir(output,{recursive:true});
await writeFile(`${output}/first-floor-candidate.json`,JSON.stringify(first,null,2)+"\n");
await writeFile(`${output}/second-floor-candidate.json`,JSON.stringify(second,null,2)+"\n");
await writeFile(`${output}/geometry.json`,JSON.stringify({commit,sources,references,pending,places:places.length,paths:paths.length,checks,towerProbes,modelOnlyPendingZones:true},null,2));
const failed=[...checks,...towerProbes].filter(c=>c.firstBlocker || c.unsupported);
console.log(JSON.stringify({places:places.length,paths:paths.length,pending,directedChecks:checks.length,towerProbes,failed},null,2));
if(failed.length)throw new Error("C15 graph has geometry conflicts; inspect the report before exporting.");
if(process.argv.includes("--export-datasets")){
  await writeFile("../data/datasets/ucc-first-floor-c15.json",JSON.stringify(first,null,2)+"\n");
  await writeFile("../data/datasets/ucc-second-floor-c15.json",JSON.stringify(second,null,2)+"\n");
  console.log("Prepared two scoped C15 revisions; no database, public model or manifest changed.");
}

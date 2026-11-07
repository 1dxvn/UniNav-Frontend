import { readFile,mkdir,writeFile,readdir } from "node:fs/promises";
import { Group,Raycaster,Vector3 } from "three";
import { committedAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { modelColliders,modelCollision } from "../src/scene/modelCollision.ts";
import { supportedStep,supportColliders } from "../src/scene/walkSupport.ts";
import { projectOnSegment } from "../src/scene/navigation.ts";
import type { RouteResponse } from "../src/api/types.ts";

const output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/h2-stair-awareness";
const base=JSON.parse(await readFile("../data/datasets/ucc-first-floor.json","utf8")),patch=JSON.parse(await readFile("../data/datasets/ucc-first-floor-stairs.json","utf8"));
const root=new Group();root.position.y=3.5;root.add((await parseModelGeometry(await committedAsset("a2dbda0","models/campus.glb"))).scene);root.updateMatrixWorld(true);
const obstacles=modelColliders(root),surfaces=supportColliders(root,["Floor_Slab","Stair_A_East_1","Stair_A_West_1"]),checks=[];
for(const path of patch.paths){
  const a=base.places.find((p:{code:string})=>p.code===path.source_code),b=base.places.find((p:{code:string})=>p.code===path.target_code);
  for(const [origin,destination] of [[a,b],[b,a]]){
    let position=new Vector3(origin.x,3.5,-origin.y);const target=new Vector3(destination.x,3.5,-destination.y),count=Math.ceil(position.distanceTo(target)/0.06),start=position.clone();
    for(let i=1;i<=count;i++){
      const next=supportedStep(position,start.clone().lerp(target,i/count),surfaces);
      if(!next)throw new Error(`Missing C13 flat support: ${path.code} ${position.toArray()}`);
      const hit=modelCollision(position,next,obstacles);if(hit)throw new Error(`C13 blocker: ${path.code} ${hit.name}`);
      position=next;
    }
    checks.push({connectionCode:path.code,origin:origin.name,destination:destination.name,samples:count,supported:true,blocked:false});
  }
}
const browser=[];
for(const f of (await readdir(output)).filter(f=>/^first-.*-review\.json$/.test(f))){
  const report=JSON.parse(await readFile(`${output}/${f}`,"utf8"));
  for(const run of report.runs as {route:RouteResponse;samples:{position:string}[];finalErrorMetres:number}[]){
    const points=run.route.waypoints!.map(w=>new Vector3(w.x,w.elevation_m,-w.y));let checked=0;
    for(const s of run.samples){
      const p=new Vector3(...s.position.split(",").map(Number) as [number,number,number]);
      const near=points.slice(1).map((q,i)=>({i,d:projectOnSegment(p,points[i],q).distance})).sort((a,b)=>a.d-b.d)[0];
      if(near.d>0.25)throw new Error(`Browser left the graph: ${f}`);
      if(!patch.paths.some((e:{code:string})=>e.code===run.route.steps[near.i].connection_code))continue;
      const hits=new Raycaster(p.clone().add(new Vector3(0,0.01,0)),new Vector3(0,-1,0),0,0.03).intersectObjects(surfaces.map(s=>s.mesh),false);
      const error=Math.min(...hits.filter(h=>h.face && h.face.normal.clone().transformDirection(h.object.matrixWorld).y>0.65).map(h=>Math.abs(h.point.y-p.y)));
      if(error>0.001)throw new Error(`Browser lost flat support: ${f}`);
      checked++;
    }
    browser.push({file:f,checkedStairSamples:checked,totalSamples:run.samples.length,finalErrorMetres:run.finalErrorMetres});
  }
}
if(process.argv.includes("--require-browser") && browser.length!==8)throw new Error("Eight first-floor journeys are required.");
await mkdir(output,{recursive:true});await writeFile(`${output}/flat-stair-geometry.json`,JSON.stringify({sourceCommit:"a2dbda0",flatModelOnly:true,checks,browser},null,2));
console.log(JSON.stringify({directedChecks:checks.length,samples:checks.reduce((n,c)=>n+c.samples,0),browserJourneys:browser.length,browserStairSamples:browser.reduce((n,c)=>n+c.checkedStairSamples,0),physicalStepsModelled:false}));

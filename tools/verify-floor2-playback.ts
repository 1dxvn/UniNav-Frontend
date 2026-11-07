import { readFile,readdir,writeFile } from "node:fs/promises";
import { Group,Mesh,Raycaster,Vector3 } from "three";
import { committedAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { projectOnSegment } from "../src/scene/navigation.ts";
import type { RouteResponse } from "../src/api/types.ts";

const output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/h2-floor2-candidate",surfaces:Mesh[]=[];
for(const s of [{path:"models/campus.glb",y:3.5,names:["Floor_Slab","Stair_A_East_1"]},{path:"models/floor-2/campus.glb",y:6.44,names:["P2_Floor_Slab"]}]){
  const root=new Group();root.position.y=s.y;root.add((await parseModelGeometry(await committedAsset("a2dbda0",s.path))).scene);root.updateMatrixWorld(true);
  for(const name of s.names){const m=root.getObjectByName(name);if(!(m instanceof Mesh))throw new Error(`Missing support: ${name}`);surfaces.push(m);}
}
const results=[];
for(const file of (await readdir(output)).filter(f=>f.endsWith("-walks.json"))){
  const report=JSON.parse(await readFile(`${output}/${file}`,"utf8"));
  if(report.sourceCommit!=="a2dbda0")throw new Error(`Unreviewed source in ${file}`);
  for(const run of report.runs as {direction:string;route:RouteResponse;samples:{position:string;floor:string;state:string}[];finalErrorMetres:number}[]){
    const points=run.route.waypoints!.map(p=>new Vector3(p.x,p.elevation_m,-p.y));
    let checked=0,maxFootError=0,maxGraphDistance=0;
    for(const sample of run.samples){
      const p=new Vector3(...sample.position.split(",").map(Number) as [number,number,number]);
      const edges=points.slice(1).map((q,i)=>({i,distance:projectOnSegment(p,points[i],q).distance})).sort((a,b)=>a.distance-b.distance),edge=edges[0];
      if(edge.distance>0.25)throw new Error(`Browser left the reviewed graph: ${file} ${p.toArray()}`);
      maxGraphDistance=Math.max(maxGraphDistance,edge.distance);
      if(!run.route.steps[edge.i].connection_code?.startsWith("ucc:f2:"))continue;
      const hits=new Raycaster(p.clone().add(new Vector3(0,0.01,0)),new Vector3(0,-1,0),0,0.03).intersectObjects(surfaces,false);
      const errors=hits.filter(h=>h.face && h.face.normal.clone().transformDirection(h.object.matrixWorld).y>0.65).map(h=>Math.abs(p.y-h.point.y));
      const error=Math.min(...errors);if(error>0.001)throw new Error(`Unsupported new-scope browser feet: ${file} ${p.toArray()}`);
      checked++;maxFootError=Math.max(maxFootError,error);
    }
    if(!checked)throw new Error(`No new-scope samples: ${file}`);
    results.push({file,direction:run.direction,samples:run.samples.length,newScopeSupportSamples:checked,maxFootErrorMetres:maxFootError,maxDistanceFromGraphMetres:maxGraphDistance,finalErrorMetres:run.finalErrorMetres});
  }
}
if(results.length!==6)throw new Error("Six complete journeys are required.");
const candidate=JSON.parse(await readFile(`${output}/dataset-candidate.json`,"utf8")),ready=JSON.parse(await readFile("../data/datasets/ucc-second-floor.json","utf8"));
if(JSON.stringify(candidate.places)!==JSON.stringify(ready.places) || JSON.stringify(candidate.paths)!==JSON.stringify(ready.paths))throw new Error("Ready dataset differs from the browser-rehearsed graph.");
await writeFile(`${output}/browser-support.json`,JSON.stringify({results,readyGraphMatchesRehearsal:true,coordinateResolutionMetres:0.001,note:"Support checks cover the newly added scope, including stairs and floor 2. Legacy approach uses its existing flat-model convention; all observed positions are checked against the route."},null,2));
console.log(JSON.stringify(results,null,2));

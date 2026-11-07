import { readFile,readdir,writeFile } from "node:fs/promises";
import { Group,Mesh,Raycaster,Vector3 } from "three";
import { committedAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { projectOnSegment } from "../src/scene/navigation.ts";
import { sha256 } from "../src/scene/modelManifest.ts";
import type { RouteResponse } from "../src/api/types.ts";

const output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/h2-floor2-candidate",surfaces:Mesh[]=[];
const files=(await readdir(output)).filter(f=>f.endsWith("-walks.json"));
const reports=await Promise.all(files.map(async file=>({file,report:JSON.parse(await readFile(`${output}/${file}`,"utf8"))})));
const commits=new Set(reports.map(r=>r.report.sourceCommit));
if(commits.size!==1 || !/^[a-f0-9]{7,40}$/.test([...commits][0]))throw new Error("Playback requires one committed model revision.");
const commit=[...commits][0] as string,hashes=new Map<string,string>();
for(const s of [{path:"models/campus.glb",y:3.5,names:["Floor_Slab","Stair_A_East_1"]},{path:"models/floor-2/campus.glb",y:6.44,names:["P2_Floor_Slab"]}]){
  const bytes=await committedAsset(commit,s.path);hashes.set(s.path,await sha256(bytes));
  const root=new Group();root.position.y=s.y;root.add((await parseModelGeometry(bytes)).scene);root.updateMatrixWorld(true);
  for(const name of s.names){const m=root.getObjectByName(name);if(!(m instanceof Mesh))throw new Error(`Missing support: ${name}`);surfaces.push(m);}
}
const results=[];
for(const {file,report} of reports){
  if(report.modelHash!==hashes.get("models/floor-2/campus.glb") || (report.lowerModelHash && report.lowerModelHash!==hashes.get("models/campus.glb")))throw new Error(`Browser model/source mismatch: ${file}`);
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
const candidateDir=process.env.UNINAV_CANDIDATE_DIR ?? output;
const candidate=JSON.parse(await readFile(`${candidateDir}/dataset-candidate.json`,"utf8")),ready=JSON.parse(await readFile("../data/datasets/ucc-second-floor.json","utf8"));
// The visual export revision changes documentary provenance, not this accepted
// graph. All place fields except elevation_source, and every path field, must agree.
const geometry=(places:Record<string,unknown>[])=>places.map(({elevation_source,...place})=>place);
if(JSON.stringify(geometry(candidate.places))!==JSON.stringify(geometry(ready.places)) || JSON.stringify(candidate.paths)!==JSON.stringify(ready.paths))throw new Error("Ready dataset differs from the browser-rehearsed graph.");
await writeFile(`${output}/browser-support.json`,JSON.stringify({modelSourceCommit:commit,results,readyGraphMatchesRehearsal:true,coordinateResolutionMetres:0.001,note:"Support checks cover the newly added scope, including stairs and floor 2. Only documentary elevation_source may differ from the prepared dataset; coordinates, identities, names, types and paths agree. Legacy approach retains its flat-model convention."},null,2));
console.log(JSON.stringify(results,null,2));

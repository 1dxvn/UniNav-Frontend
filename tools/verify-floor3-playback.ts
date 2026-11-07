import { readFile,readdir,writeFile } from "node:fs/promises";
import { Group,Mesh,Raycaster,Vector3 } from "three";
import { committedRepositoryAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { projectOnSegment } from "../src/scene/navigation.ts";
import { sha256 } from "../src/scene/modelManifest.ts";
import type { RouteResponse } from "../src/api/types.ts";

const output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/floor3",supports:Mesh[]=[],outdoors:Mesh[]=[],hashes:string[]=[];
const reports=await Promise.all((await readdir(output)).filter(p=>p.endsWith("-walks.json")).map(async file=>({file,report:JSON.parse(await readFile(`${output}/${file}`,"utf8"))})));
const models=reports[0]?.report.models as {url:string;hash:string;source:{commit:string;path:string}}[];
if(!models || models.length<2)throw new Error("Playback requires both served model sources.");
const committedModels=new Map<string,Buffer>();
for(const model of models){
  const source=model.source;
  if(!source || !/^[a-f0-9]{7,40}$/.test(source.commit) || !/^model\/candidates\/[a-zA-Z0-9_-]+\/floor-[1-5]\.glb$/.test(source.path))throw new Error("Invalid committed playback source.");
  const bytes=await committedRepositoryAsset(source.commit,source.path);
  if(await sha256(bytes)!==model.hash || committedModels.has(source.path))throw new Error("Recorded model source/hash differs or is duplicated.");
  committedModels.set(source.path,bytes);
}
const walkingModels=[1,2,3].map(floor=>{
  const selected=models.filter(m=>m.source.path.endsWith(`/floor-${floor}.glb`));if(selected.length!==1)throw new Error("Playback needs one model per walking floor.");return selected[0];
});
for(const floor of [1,2,3]){
  const source=walkingModels[floor-1].source,bytes=committedModels.get(source.path)!;hashes.push(await sha256(bytes));
  const root=new Group();root.position.y=[0,3.5,6.44,9.38][floor];root.add((await parseModelGeometry(bytes)).scene);root.updateMatrixWorld(true);
  for(const name of floor===1 ? ["Floor_Slab","Stair_A_East_1","Stair_A_West_1","Site"]:[`P${floor}_Floor_Slab`,`P${floor}_Stair_A_East_1`,`P${floor}_Stair_A_West_1`]){
    const node=root.getObjectByName(name);if(!(node instanceof Mesh))throw new Error(`Missing support ${name}`);(name==="Site" ? outdoors:supports).push(node);
  }
}
type Sample={position:string;floor:string;state?:string};
function height(p:Vector3,surfaces:Mesh[],dx=0,dz=0){
  const top=p.clone().add(new Vector3(dx,0.201,dz));return new Raycaster(top,new Vector3(0,-1,0),0,0.403).intersectObjects(surfaces,false)
    .filter(h=>h.face && h.face.normal.clone().transformDirection(h.object.matrixWorld).y>0.65).map(h=>h.point.y);
}
function check(samples:Sample[],route?:RouteResponse,connector?:number[]){
  let checked=0,maxFootError=0,maxGraphDistance=0,outdoorSamples=0,nosingQuantizationSamples=0;
  const points=route?.waypoints!.map(p=>new Vector3(p.x,p.elevation_m,-p.y));
  // A recalculated API route starts at its graph endpoint. The UI first walks
  // the independently checked connector from the retained manual position.
  if(connector && points)points.unshift(new Vector3(...connector as [number,number,number]));
  for(const s of samples){
    if(s.state==="blocked")throw new Error("Browser reported a blockage.");
    const p=new Vector3(...s.position.split(",").map(Number) as [number,number,number]);
    const edges=points?.slice(1).map((q,i)=>({i,distance:projectOnSegment(p,points[i],q).distance})).sort((a,b)=>a.distance-b.distance);
    if(edges && edges[0].distance>0.251)throw new Error(`Outside graph: ${p.toArray()}`);
    if(edges)maxGraphDistance=Math.max(maxGraphDistance,edges[0].distance);
    // Site may support only the three explicitly outdoor approach connections.
    const outdoor=!!edges?.some(e=>e.distance<0.251 && route!.steps[e.i-(connector ? 1:0)]?.kind==="outdoor");
    const surfaces=outdoor ? [...supports,...outdoors]:supports;
    const centreError=Math.min(...height(p,surfaces).map(y=>Math.abs(y-p.y)));
    // The UI rounds every coordinate to 1 mm. At a vertical nosing, the rounded
    // X/Z can cross into the adjacent tread while Y still names the real tread.
    // Resolve only within that rounding cell, never by accepting a whole riser.
    const errors=[centreError];
    if(centreError>0.00101)for(const dx of [-.000501,0,.000501])for(const dz of [-.000501,0,.000501])errors.push(...height(p,surfaces,dx,dz).map(y=>Math.abs(y-p.y)));
    const error=Math.min(...errors);if(centreError>0.00101 && error<=0.00101)nosingQuantizationSamples++;
    if(error>0.00101)throw new Error(`Unsupported foot: ${p.toArray()} (${error} m)`);
    for(const [dx,dz] of [[-.12,0],[.12,0],[0,-.12],[0,.12]])if(!height(p,surfaces,dx,dz).some(y=>Math.abs(y-p.y)<.2011))throw new Error(`Unsupported footprint: ${p.toArray()}`);
    checked++;maxFootError=Math.max(error,maxFootError);if(outdoor)outdoorSamples++;
  }
  if(!checked)throw new Error("No browser samples.");return {samples:checked,outdoorSamples,nosingQuantizationSamples,maxFootErrorMetres:maxFootError,maxDistanceFromGraphMetres:maxGraphDistance};
}
const results=[];
for(const {file,report} of reports){
  if(report.profile!=="ucc-three-floors-c16" || JSON.stringify(report.models)!==JSON.stringify(models) || !hashes.every((h,i)=>h===walkingModels[i].hash))throw new Error(`Wrong served source ${file}`);
  for(const run of report.runs){
    if(!Number.isFinite(run.finalErrorMetres) || run.finalErrorMetres>.002)throw new Error("Browser did not reach its API destination.");
    if(run.direction==="outbound"){
      const high=(run.samples as Sample[]).filter(s=>{const [x,y,z]=s.position.split(",").map(Number);return Math.abs(x-38.7)<.02 && y>9.4 && y<9.8 && z< -56.65 && z> -57.1;});
      if(!high.length || high.some(s=>s.floor!=="2"))throw new Error("High stair treads lost explicit floor2 metadata before the upper endpoint.");
    }
    results.push({file,direction:run.direction,finalErrorMetres:run.finalErrorMetres,...check(run.samples,run.route)});
  }
}
if(results.length!==6)throw new Error(`Expected six journeys; got ${results.length}.`);
const interaction=JSON.parse(await readFile(`${output}/interaction.json`,"utf8"));
if(interaction.manual.length!==1 || interaction.manual[0].arrivals.length!==2)throw new Error("Both manual stair directions are required.");
const manual=interaction.manual.map((m:{name:string;samples:Sample[]})=>({name:m.name,...check(m.samples)}));
const beforeReplan=check(interaction.beforeReplanSamples);
const initialAutomatic=check(interaction.beforeReplanSamples.filter((s:Sample)=>s.state!=="idle"),interaction.initialRoute);
const replan=check(interaction.playback,interaction.route,interaction.beforeReplan);
await writeFile(process.env.UNINAV_SUPPORT_REPORT ?? `${output}/browser-support.json`,JSON.stringify({models,hashes,results,manual,beforeReplan,initialAutomatic,replan,replanConnectorStart:interaction.beforeReplan,coordinateResolutionMetres:0.001,note:"Independent downward rays test recorded feet and four footprint offsets against each recorded committed model source. At nosings only, X/Z rounding is resolved within the 0.5 mm half-cell and counted separately; vertical error must still be <=1 mm. Site is included only on outdoor route segments; interior holes cannot borrow its support. Free keyboard motion is checked against geometry, not the API centre line. Automatic motion is also checked against its route; after replan that includes the connector from the retained manual position to the API start waypoint. Pending B laboratory heights still represent the flat candidate, not confirmed physical survey levels."},null,2));
console.log(JSON.stringify({journeys:results.length,samples:results.reduce((s,r)=>s+r.samples,0),manual,replan,maxFootErrorMetres:Math.max(...results.map(r=>r.maxFootErrorMetres))},null,2));

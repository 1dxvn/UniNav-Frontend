import { readFile,writeFile } from "node:fs/promises";
import { Group,Mesh,Raycaster,Vector3 } from "three";
import { committedRepositoryAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { sha256 } from "../src/scene/modelManifest.ts";

const output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/c17/ramp",path="model/candidates/c17/floor-2.glb",commit="0f6a862";
const bytes=await committedRepositoryAsset(commit,path),hash=await sha256(bytes),root=new Group();root.position.y=6.44;root.add((await parseModelGeometry(bytes)).scene);root.updateMatrixWorld(true);
const node=root.getObjectByName("P2_Floor_Slab");if(!(node instanceof Mesh))throw new Error("No C17 slab");const slab:Mesh=node;
type Sample={position:string;floor:string;state?:string};
function check(samples:Sample[]){
  let maxError=0;
  for(const sample of samples){
    if(sample.floor!=="2" || sample.state==="blocked")throw new Error("Ramp playback changed floor or blocked.");
    const p=new Vector3(...sample.position.split(",").map(Number) as [number,number,number]);
    if(Math.abs(p.x-28.55)>.002)throw new Error("Ramp lane changed.");
    const height=(dx:number,dz:number)=>new Raycaster(p.clone().add(new Vector3(dx,.201,dz)),new Vector3(0,-1,0),0,.403).intersectObject(slab,false).filter(h=>h.face && h.face.normal.clone().transformDirection(h.object.matrixWorld).y>.65).map(h=>h.point.y);
    const error=Math.min(...height(0,0).map(y=>Math.abs(y-p.y)));if(error>.00101)throw new Error(`Unsupported C17 ramp foot: ${p.toArray()}, ${error}`);maxError=Math.max(maxError,error);
    for(const [dx,dz] of [[-.12,0],[.12,0],[0,-.12],[0,.12]])if(!height(dx,dz).some(y=>Math.abs(y-p.y)<.2011))throw new Error("Unsupported ramp footprint.");
    const analytic=6.44-.26*Math.max(0,Math.min(1,(-p.z-47.906)/1.369));if(Math.abs(analytic-p.y)>.00101)throw new Error("Ramp movement left the documented height profile.");
  }
  if(!samples.length)throw new Error("Empty ramp playback");return {samples:samples.length,maxFootErrorMetres:maxError};
}
const results=[];
for(const id of ["ucc-two-floors-c15","ucc-three-floors-c16"]){
  const report=JSON.parse(await readFile(`${output}/${id}.json`,"utf8"));
  if(!report.fixtureOnly || report.hash!==hash || report.source.commit!==commit || report.source.path!==path || report.errors.length || report.guided.length!==2 || report.manual.length!==2)throw new Error("Wrong ramp evidence source or missing directions.");
  if(!(report.paused[1]>6.20 && report.paused[1]<6.40))throw new Error("Pause was not on the sloping ramp.");
  const guided=(report.guided as {error:number;samples:Sample[]}[]).map(r=>{if(r.error>.002)throw new Error("Ramp arrival differs");return check(r.samples);});
  const manual=check(report.manualSamples),beforeReplan=check(report.beforeReplan),replan=check(report.playback);
  results.push({profile:id,guided,manual,beforeReplan,replan});
}
await writeFile(`${output}/browser-support.json`,JSON.stringify({source:{commit,path,hash},results,coordinateResolutionMetres:.001,note:"Independent rays against the committed C17 slab and its analytical source ramp profile; four footprint offsets. These are disconnected temporary graph fixtures, not public destinations or accessibility certification."},null,2));
console.log(JSON.stringify({guidedArrivals:4,profiles:2,samples:results.reduce((n,r)=>n+r.guided.reduce((s,g)=>s+g.samples,0)+r.manual.samples+r.beforeReplan.samples+r.replan.samples,0),results},null,2));

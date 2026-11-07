import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Group, Vector3 } from "three";
import { createHash } from "node:crypto";
import { committedAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { modelColliders, modelCollision, type ModelCollider } from "../src/scene/modelCollision.ts";
import { supportColliders, supportedStep } from "../src/scene/walkSupport.ts";
import { advanceWalk, manualStep, walkSegments } from "../src/scene/navigation.ts";
import type { Building, CampusPath } from "../src/api/types.ts";

const output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/h2-stair-support";
await mkdir(output,{ recursive:true }); await mkdir("tests/fixtures",{ recursive:true });
const probe=JSON.parse(await readFile("docs/verification/c13/stair-clearance.json","utf8"));
const stair=probe.stairs.find((s:{name:string}) => s.name==="Stair_A_East");
const sources=[{ path:"models/campus.glb",elevation:3.5,nodes:["Floor_Slab","Stair_A_East_1","Stair_A_West_1"] },
  { path:"models/floor-2/campus.glb",elevation:6.44,nodes:["P2_Floor_Slab","P2_Stair_A_East_1","P2_Stair_A_West_1"] }];
const colliders:ModelCollider[]=[],surfaces:ModelCollider[]=[];
for (const s of sources) {
  const bytes=await committedAsset("a2dbda0",s.path);
  if (!probe.sources.some((p:{sha256:string}) => p.sha256===createHash("sha256").update(bytes).digest("hex"))) throw new Error("Stair source revision differs.");
  const root=new Group(); root.position.y=s.elevation; root.add((await parseModelGeometry(bytes)).scene); root.updateMatrixWorld(true);
  colliders.push(...modelColliders(root)); surfaces.push(...supportColliders(root,s.nodes));
}
// These are the documented flight centre lines, measured exported treads and
// landing, then the literal CAD CIRCULACION label, not inferred room entrances.
const points=[...stair.probePath,[39.001,6.44,-55.896]] as number[][];
const places=points.map(([x,elevation_m,z],i) => ({ id:i+1,code:`test:east-stair:p${i}`,name:i===0 ? "East stair bottom (test)" : i===points.length-1 ? "CIRCULACION (floor 2 test)" : `East stair point ${i} (test)`,
  display_name:i===points.length-1 ? "Circulation (floor 2 test)" : null,x,y:-z,elevation_m,floor:i>=points.length-2 ? 2 : 1,
  floor_code:i>=points.length-2 ? "test-ucc-floor2" : "test-ucc-floor1",building_type:i===0 ? "entrance" : i===points.length-1 ? "service" : "waypoint",
  faculty:null,elevation_source:"C13 a2dbda0 model treads / vertical-connections.md; flat A/B approximation, not physical Block A elevations" }));
const paths=places.slice(1).map((p,i) => ({ id:i+1,code:`test:east-stair:e${i}`,source_id:places[i].id,target_id:p.id,source_code:places[i].code,target_code:p.code,
  source_name:places[i].name,target_name:p.name,kind:i===places.length-2 ? "corridor" as const : "stairs" as const,bidirectional:true,
  weight:new Vector3(...points[i] as [number,number,number]).distanceTo(new Vector3(...points[i+1] as [number,number,number])) }));
const segments=walkSegments(places as Building[],paths as CampusPath[]),checks=[];
for (const mode of ["automatic","manual"] as const) for (const direction of ["up","down"] as const) {
  const route=direction==="up" ? places : [...places].reverse();
  let position=new Vector3(route[0].x,route[0].elevation_m,-route[0].y),floor=route[0].floor,samples=0,maxFootError=0;
  for (let i=1;i<route.length;i++) {
    const p=route[i],target=new Vector3(p.x,p.elevation_m,-p.y),isStair=!(route[i-1].floor===2 && p.floor===2);
    for (let guard=0;;guard++) {
      if (guard>3000) throw new Error(`${mode} ${direction} stalled at ${i}: ${position.toArray()}`);
      let next:Vector3|undefined,reached=false,nextFloor=floor;
      if (mode==="automatic") {
        const advance=advanceWalk(position,floor,{ position:target,floor:p.floor },0.035);
        next=isStair ? supportedStep(position,advance.position,surfaces) : advance.position;
        reached=advance.reached; nextFloor=advance.floor;
      } else {
        const delta=target.clone().sub(position).setY(0),distance=delta.length();
        const expected=position.clone().addScaledVector(delta.normalize(),Math.min(0.035,distance));
        const step=manualStep(position,expected,segments,floor,(a,b) => supportedStep(a,b,surfaces),(a,b) => !!modelCollision(a,b,colliders));
        next=step?.position; nextFloor=step?.floor ?? floor;
        reached=!!next && Math.hypot(next.x-target.x,next.z-target.z)<0.00001;
      }
      if (!next || modelCollision(position,next,colliders)) throw new Error(`${mode} ${direction} blocked at ${i}: ${position.toArray()} -> ${next?.toArray()}`);
      const foot=supportedStep(next,next,surfaces);
      if (!foot) throw new Error(`Unsupported feet: ${next.toArray()}`);
      maxFootError=Math.max(maxFootError,Math.abs(next.y-foot.y));
      position=next;floor=nextFloor;samples++;
      if (reached) break;
    }
  }
  if (floor!==route.at(-1)!.floor || position.distanceTo(new Vector3(route.at(-1)!.x,route.at(-1)!.elevation_m,-route.at(-1)!.y))>0.001) throw new Error(`Wrong final metadata/position: ${mode} ${direction}`);
  checks.push({ mode,direction,samples,finalPosition:position.toArray(),floor,maxFootError });
}
const reference=JSON.parse((await committedAsset("a2dbda0","models/floor-2/campus-reference.json")).toString("utf8"));
const references=reference.references.map((p:{buildingName:string;planPosition:number[]},i:number) => ({ code:`test:floor2:ref${i}`,name:p.buildingName,x:p.planPosition[0],y:p.planPosition[1],floor:2,
  elevation_m:6.44,elevation_source:"C13 documented structural GLB anchors; test-only API alignment",building_type:"reference" }));
const dataset={ scope:"test:ucc-east-stair",revision:"c13-supported-v1",source:"a2dbda0 GLBs; docs/blocks/vertical-connections.md; C13 stair probe; floor2 CIRCULACION CAD label. Disposable fixture only, no room graph accepted.",
  places:[...places.map(({id,...p}) => p),...references],paths:paths.map(({id,source_id,target_id,source_name,target_name,...p}) => p) };
await writeFile("tests/fixtures/ucc-east-stair.json",JSON.stringify(dataset,null,2)+"\n");
await writeFile(`${output}/supported-stair-checks.json`,JSON.stringify({ sources:probe.sources,checks,fixtureOnly:true },null,2));
console.log(JSON.stringify(checks,null,2));

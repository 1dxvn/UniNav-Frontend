import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Group, Mesh, Raycaster, Vector3 } from "three";
import { committedAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { BODY_RAY_HEIGHTS } from "../src/scene/modelCollision.ts";

// Inspection probes, not API route data. Dimensions and plan centre lines:
// docs/blocks/vertical-connections.md and Claude's blender_stairs.py.
const output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/c11";
await mkdir(output,{ recursive:true });
const sources=[{ commit:process.env.UNINAV_STAIR_LOWER_COMMIT ?? "9ac3795",path:"models/campus.glb",elevation:3.5 },
  { commit:process.env.UNINAV_STAIR_UPPER_COMMIT ?? "099c212",path:"models/floor-2/campus.glb",elevation:6.44 }];
const roots:Group[]=[], sourceReports=[];
for (const source of sources) {
  const bytes=await committedAsset(source.commit,source.path);
  const gltf=await parseModelGeometry(bytes);
  const root=new Group(); root.position.y=source.elevation; root.add(gltf.scene); root.updateMatrixWorld(true); roots.push(root);
  sourceReports.push({ ...source,sha256:createHash("sha256").update(bytes).digest("hex") });
}
const meshes:Mesh[]=[], supportMeshes:Mesh[]=[];
for (const root of roots) root.traverse((object) => {
  if (object instanceof Mesh) { meshes.push(object); if (/Floor_Slab|Stair_A_/.test(object.name)) supportMeshes.push(object); }
});
function support(point:Vector3) {
  const hits=new Raycaster(point.clone().add(new Vector3(0,0.19,0)),new Vector3(0,-1,0),0,0.6).intersectObjects(supportMeshes,false);
  const hit=hits.find((candidate) => candidate.face && candidate.face.normal.clone().transformDirection(candidate.object.matrixWorld).y>0.5);
  return hit ? { name:hit.object.name,position:hit.point.toArray(),difference:point.y-hit.point.y } : null;
}
function collision(from:Vector3,to:Vector3,heights:readonly number[]) {
  const d=to.clone().sub(from),distance=d.length(); if (distance<0.000001) return null;
  d.normalize();
  for (const height of heights) for (const offset of [-0.22,0,0.22]) {
    const start=from.clone().add(new Vector3(-d.z*offset,height,d.x*offset));
    const hit=new Raycaster(start,d,0,distance+0.25).intersectObjects(meshes,false)[0];
    if (hit) return { mesh:hit.object.name,height,offset,point:hit.point.toArray(),from:from.toArray(),to:to.toArray() };
  }
  return null;
}
const stairReports=[];
for (const stair of [{ name:"Stair_A_West",a:14.65,b:18.05,c:16.35 },{ name:"Stair_A_East",a:36.35,b:38.70,c:37.55 }]) {
  const mesh=roots[0].getObjectByName(stair.name); if (!mesh) throw new Error(`Missing ${stair.name}.`);
  const points=[new Vector3(stair.a,3.5,-55.9)];
  const measured:number[][]=[];
  function tread(x:number,y:number) {
    const hit=new Raycaster(new Vector3(x,7,-y),new Vector3(0,-1,0),0,4).intersectObject(mesh!,true)[0];
    if (!hit) throw new Error(`No tread at ${x},${y}.`);
    measured.push(hit.point.toArray()); points.push(hit.point.clone());
  }
  for (let index=0;index<10;index++) tread(stair.a,56.35+index*0.3);
  for (const [x,y] of [[stair.a,59.35],[stair.c,60],[stair.b,59.35]]) tread(x,y);
  for (let index=0;index<10;index++) tread(stair.b,59.05-index*0.3);
  points.push(new Vector3(stair.b,6.44,-55.9));
  const passes=[];
  for (const direction of ["up","down"]) {
    const route=direction==="up" ? points : [...points].reverse();
    const blockers=[], torsoBlockers=[], supportConflicts=[];
    let samples=0;
    for (let i=1;i<route.length;i++) {
      const a=route[i-1],b=route[i],count=Math.max(1,Math.ceil(a.distanceTo(b)/0.05));
      for (let j=0;j<count;j++) {
        const from=a.clone().lerp(b,j/count),to=a.clone().lerp(b,(j+1)/count); samples++;
        const body=collision(from,to,BODY_RAY_HEIGHTS),torso=collision(from,to,[0.45,1.2]);
        if (body && blockers.length<16) blockers.push(body);
        if (torso && torsoBlockers.length<16) torsoBlockers.push(torso);
        const floor=support(from);
        if ((!floor || Math.abs(floor.difference)>0.15) && supportConflicts.length<16) supportConflicts.push({ position:from.toArray(),support:floor });
      }
    }
    passes.push({ direction,samples,blockers,torsoBlockers,supportConflicts });
  }
  stairReports.push({ name:stair.name,measuredTreadsAndLanding:measured,probePath:points.map((point) => point.toArray()),passes });
}
const report={ checkedAt:new Date().toISOString(),sources:sourceReports,rayHeights:BODY_RAY_HEIGHTS,
  note:"Measured centre-line probes; capped blocker/support-conflict examples, not accepted API paths or navigation.",stairs:stairReports };
await writeFile(`${output}/stair-clearance.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(stairReports.map((stair) => ({ name:stair.name,passes:stair.passes.map((pass) => ({ direction:pass.direction,samples:pass.samples,
  firstBlocker:pass.blockers[0] ?? null,firstTorsoBlocker:pass.torsoBlockers[0] ?? null,supportConflicts:pass.supportConflicts.length })) })),null,2));

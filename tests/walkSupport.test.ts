import test from "node:test";
import assert from "node:assert/strict";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { supportColliders, supportedStep } from "../src/scene/walkSupport.ts";
import { manualStep, nearbyStairFloors, routingStart, stairNetworks, walkSegments, walkWaypoints } from "../src/scene/navigation.ts";
import { parseManifest } from "../src/scene/modelManifest.ts";
import { readFile } from "node:fs/promises";
import type { Building,CampusPath } from "../src/api/types.ts";

function platform(name:string,x:number,top:number,width=1) {
  const mesh=new Mesh(new BoxGeometry(width,0.1,1),new MeshBasicMaterial());
  mesh.name=name;mesh.position.set(x,top-0.05,0);return mesh;
}
test("reviewed support steps onto treads but rejects holes, high risers and furniture",() => {
  const root=new Group();root.add(platform("lower",0,0),platform("tread",1,0.14),platform("high",2,0.5),platform("desk",3,0.14));
  const supports=supportColliders(root,["lower","tread","high"]);
  assert.ok(Math.abs(supportedStep(new Vector3(0.49,0,0),new Vector3(0.52,0.02,0),supports)!.y-0.14)<0.000001);
  assert.equal(supportedStep(new Vector3(1.49,0.14,0),new Vector3(1.52,0.16,0),supports),undefined);
  assert.equal(supportedStep(new Vector3(3,0.14,0),new Vector3(3.01,0.14,0),supports),undefined);
  assert.equal(supportedStep(new Vector3(0,0,0.4),new Vector3(0,0,0.49),supports),undefined);
  assert.throws(() => supportColliders(root,["missing"]),/node is missing/);
});
const places:Building[]=[
  { id:1,name:"Bottom",x:0,y:0,floor:1,elevation_m:3.5,faculty:null,building_type:"waypoint" },
  { id:2,name:"High landing",x:0,y:2,floor:1,elevation_m:5.04,faculty:null,building_type:"waypoint" },
  { id:3,name:"Top",x:1,y:0,floor:2,elevation_m:6.44,faculty:null,building_type:"waypoint" },
];
const paths:CampusPath[]=[
  { id:1,source_id:1,target_id:2,source_name:"Bottom",target_name:"High landing",kind:"stairs",bidirectional:false,weight:3 },
  { id:2,source_id:2,target_id:3,source_name:"High landing",target_name:"Top",kind:"stairs",bidirectional:true,weight:3 },
];
test("manual stairs require support and preserve metadata floors and direction",() => {
  const segments=walkSegments(places,paths),p=new Vector3(0,3.5,0),q=new Vector3(0,3.5,-0.05);
  assert.equal(manualStep(p,q,segments,1,()=>undefined,()=>false),undefined);
  const step=manualStep(p,q,segments,1,(_a,b)=>b,()=>false)!;
  assert.ok(step.position.y>3.5);assert.equal(step.floor,1);
  assert.equal(manualStep(step.position,p,segments,1,(_a,b)=>b,()=>false),undefined);
  assert.equal(manualStep(p,new Vector3(0,3.5,0.02),segments,1,(_a,b)=>b,()=>false),undefined);
  const raisedFoot=new Vector3(0,3.8,-0.3);
  assert.ok(manualStep(raisedFoot,new Vector3(0,3.8,-0.32),segments,1,(_a,b)=>b.setY(3.8),()=>false));
  assert.equal(manualStep(raisedFoot,new Vector3(0,3.8,-0.28),segments,1,(_a,b)=>b.setY(3.8),()=>false),undefined);
  assert.equal(manualStep(p,q,segments,1,(_a,b)=>b,()=>true),undefined);
  const almost=new Vector3(0.999,6.439,-0.001),end=new Vector3(1,6.44,0);
  assert.equal(manualStep(almost,end,segments,1,(_a,b)=>b,()=>false)?.floor,2);
  const nearTop=new Vector3(0.98,6.44,-0.04);
  assert.equal(manualStep(nearTop,new Vector3(1,6.44,-0.03),segments,1,(_a,b)=>b.setY(6.44),()=>false)?.floor,2);
});
test("cancelled stairs retain adjacent model floors and connector support kind",() => {
  const segments=walkSegments(places,paths),position=new Vector3(0,4.27,-1);
  assert.deepEqual(nearbyStairFloors(position,1,stairNetworks(segments)),[1,2]);
  assert.deepEqual(nearbyStairFloors(new Vector3(20,4.27,-1),1,stairNetworks(segments)),[]);
  const start=routingStart(position,places,segments,1);
  assert.equal(start.kind,"stairs");assert.equal(walkWaypoints(start,[start.place],paths)[1].kind,"stairs");
});
test("only navigable models can declare reviewed foot support nodes",async () => {
  const manifest=JSON.parse(await readFile(new URL("../public/models/campus-manifest.json",import.meta.url),"utf8"));
  const preview=manifest.models.find((m:{kind:string}) => m.kind==="floor-preview");
  preview.supportNodes=["P2_Floor_Slab"];
  assert.throws(()=>parseManifest(manifest),/Only navigable/);
});
test("keyboard cannot jump a storey along a zero-plan-length graph stair",()=>{
  const vertical=places.slice(0,2).map((p,i)=>({...p,x:0,y:0,floor:i+1,elevation_m:i ? 6.44:3.5}));
  const segments=walkSegments(vertical,[paths[0]]);
  assert.equal(manualStep(new Vector3(0,6.44,0),new Vector3(0.02,6.44,0),segments,2,(_a,b)=>b,()=>false),undefined);
});
test("outdoor walking follows explicitly supplied ground without changing the metadata floor",()=>{
  const outdoorPlaces=places.slice(0,2).map((p,i)=>({...p,x:i,y:0,elevation_m:i ? 3.35:3.5}));
  const segments=walkSegments(outdoorPlaces,[{...paths[0],kind:"outdoor",bidirectional:true}]);
  const kinds:unknown[]=[];
  const step=manualStep(new Vector3(0.5,3.35,0),new Vector3(0.55,3.35,0),segments,1,(_from,p,kind)=>{kinds.push(kind);return p.setY(3.35);},()=>false)!;
  assert.equal(step.position.y,3.35);assert.equal(step.floor,1);assert.deepEqual(kinds,["outdoor"]);
  assert.equal(manualStep(step.position,new Vector3(0.6,3.35,0),segments,1,()=>undefined,()=>false),undefined);
});

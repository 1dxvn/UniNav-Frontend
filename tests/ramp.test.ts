import test from "node:test";
import assert from "node:assert/strict";
import { Group,Vector3 } from "three";
import { committedRepositoryAsset } from "../tools/reviewed-assets.ts";
import { parseModelGeometry } from "../tools/model-geometry.ts";
import { manualStep,walkSegments } from "../src/scene/navigation.ts";
import { supportColliders,supportedStep } from "../src/scene/walkSupport.ts";
import { modelColliders,modelCollision } from "../src/scene/modelCollision.ts";
import type { Building,CampusPath } from "../src/api/types.ts";

test("keyboard follows C17's measured ramp surface in both directions",async()=>{
  const root=new Group();root.position.y=6.44;root.add((await parseModelGeometry(await committedRepositoryAsset("0f6a862","model/candidates/c17/floor-2.glb"))).scene);root.updateMatrixWorld(true);
  const ground=supportColliders(root,["P2_Floor_Slab"]),obstacles=modelColliders(root);
  const ys=[47.506,47.906,49.275,49.675],height=(y:number)=>6.44-.26*Math.max(0,Math.min(1,(y-47.906)/1.369));
  const places:Building[]=ys.map((y,i)=>({id:i+1,name:`Ramp point ${i}`,x:28.55,y,elevation_m:height(y),floor:2,faculty:null,building_type:"waypoint"}));
  const paths:CampusPath[]=places.slice(1).map((p,i)=>({id:i+1,source_id:i+1,target_id:p.id,source_name:places[i].name,target_name:p.name,weight:1,kind:"ramp",bidirectional:true}));
  const segments=walkSegments(places,paths);
  for(const reverse of [false,true]){
    const points=reverse ? [...places].reverse():places;
    let current=new Vector3(28.55,points[0].elevation_m!,-points[0].y);
    for(const dest of points.slice(1))for(let guard=0;;guard++){
      const dz=-dest.y-current.z;if(Math.abs(dz)<.001)break;assert.ok(guard<100,"Ramp stalled");
      const next=manualStep(current,current.clone().add(new Vector3(0,0,Math.sign(dz)*Math.min(.035,Math.abs(dz)))),segments,2,
        (from,expected)=>supportedStep(from,expected,ground),(from,to)=>!!modelCollision(from,to,obstacles));
      assert.ok(next,"Supported ramp move rejected");assert.equal(next.floor,2);current=next.position;
      assert.ok(Math.abs(current.y-height(-current.z))<.001,"Feet left the exported ramp surface");
    }
    assert.ok(Math.abs(current.y-points.at(-1)!.elevation_m!)<.001);
  }
});

test("ramp keyboard requires reviewed support and keeps its source floor",()=>{
  const a:Building={id:1,name:"A",x:0,y:0,elevation_m:1,floor:2,faculty:null,building_type:"waypoint"},b={...a,id:2,name:"B",y:2,elevation_m:.6};
  const segments=walkSegments([a,b],[{id:1,source_id:1,target_id:2,source_name:"A",target_name:"B",weight:2.1,kind:"ramp",bidirectional:true}]);
  assert.equal(manualStep(new Vector3(0,1,0),new Vector3(0,1,-.05),segments,2,()=>undefined,()=>false),undefined);
});

import { writeFile } from "node:fs/promises";
import { committedRepositoryAsset } from "./reviewed-assets.ts";
const config=JSON.parse((await committedRepositoryAsset("0f6a862","model/tools/real_levels_c17.json")).toString("utf8"));
const f=config.floors[2],r=f.ramp,ys=[r.y[0]-.4,r.y[0],r.y[0]+(r.y[1]-r.y[0])/3,r.y[0]+(r.y[1]-r.y[0])*2/3,r.y[1],r.y[1]+.4];
const places=ys.map((y,i)=>({code:`test:c17-ramp:p${i}`,name:`C17 ramp ${i===0 ? "B-side":i===5 ? "A-side":`point ${i}`} (test only)`,x:28.55,y,floor:2,
  elevation_m:f.datum_world+f.a_offset*Math.max(0,Math.min(1,(y-r.y[0])/(r.y[1]-r.y[0]))),floor_code:"test-c17-floor2",faculty:null,
  building_type:i===0 || i===5 ? "hall":"waypoint",elevation_source:"C17 config @0f6a862 and source-backed ramp strip; ephemeral test points only, no accepted public destination"}));
const data={scope:"test:c17-ramp",revision:"c17-ramp-support-v1",source:"Measured strip in model/tools/real_levels_c17.json @0f6a862. Disposable disconnected test graph; not a production scope, room or accessibility certification.",places,
  paths:places.slice(1).map((p,i)=>({code:`test:c17-ramp:e${i}`,source_code:places[i].code,target_code:p.code,kind:"ramp",bidirectional:true}))};
await writeFile("tests/fixtures/c17-ramp.json",JSON.stringify(data,null,2)+"\n");
console.log("Prepared disconnected test ramp only; no production dataset, model or manifest changed.");

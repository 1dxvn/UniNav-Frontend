import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dataFingerprint,parseManifest,type CampusManifest } from "../src/scene/modelManifest.ts";
import { selectModelProfile } from "../src/scene/modelProfiles.ts";
import type { Building,CampusPath } from "../src/api/types.ts";

const source=parseManifest(JSON.parse(await readFile(new URL("../public/models/campus-manifest.json",import.meta.url),"utf8")));
async function fixture(){
  const old:Building[]=["A","B","C"].map((name,i)=>({id:i+1,name,x:i,y:0,floor:1,faculty:null,building_type:"waypoint"}));
  const edge:CampusPath={id:1,code:"edge:1",source_id:1,target_id:2,source_name:"A",target_name:"B",weight:1,kind:"corridor",bidirectional:true};
  const expanded:Building[]=[...old.map(p=>({...p,code:`place:${p.id}`,floor_code:"floor1",elevation_m:3.5})),
    ...["U","V","W"].map((name,i)=>({id:i+4,name,x:i,y:1,floor:2,code:`place:${i+4}`,floor_code:"floor2",elevation_m:6.44,faculty:null,building_type:"waypoint"}))];
  const edges=[edge,{...edge,id:2,code:"edge:2",source_id:2,target_id:4,source_name:"B",target_name:"U",kind:"stairs" as const,weight:4}];
  const first=structuredClone(source.models.find(m=>m.id==="ucc-first-floor")!);
  first.binding={placeNames:old.map(p=>p.name),sha256:await dataFingerprint(old.map(p=>p.name),old,[edge])};
  const fullFirst={...first,binding:{placeNames:old.map(p=>p.name),sha256:await dataFingerprint(old.map(p=>p.name),expanded,edges)}};
  const upper={...source.profiles!.find(p=>p.id==="ucc-two-floors")!.models.find(m=>m.id==="ucc-second-floor")!,binding:{placeNames:["U","V","W"],sha256:await dataFingerprint(["U","V","W"],expanded,edges)}};
  const manifest:CampusManifest={version:1,catalog:source.catalog,identityPlaceNames:["A","B","C"],models:[first],profiles:[{id:"two-floors",label:"Two floors",requiresExplicitPositions:true,models:[fullFirst,upper]}]};
  return {manifest:parseManifest(manifest),old,expanded,edge,edges};
}
test("legacy API selects the preserved base while complete data selects the two-floor profile",async()=>{
  const f=await fixture();assert.equal((await selectModelProfile(f.manifest,f.old,[f.edge])).profile,"base");
  const selected=await selectModelProfile(f.manifest,f.expanded,f.edges);assert.equal(selected.profile,"two-floors");assert.equal(selected.recognized,true);
  assert.ok(selected.manifest.models.some(m=>m.id==="ucc-second-floor"));
});
test("correct effective positions do not substitute for the explicit API contract",async()=>{
  const f=await fixture(),partial=f.expanded.map(p=>({...p,effective_elevation_m:p.elevation_m!,elevation_m:null}));
  const selected=await selectModelProfile(f.manifest,partial,f.edges);assert.equal(selected.profile,"incompatible");assert.equal(selected.recognized,true);assert.ok(selected.error);
});
test("changed edges, missing nodes and duplicate scoped identities fail profile selection",async()=>{
  const f=await fixture();
  for(const [places,paths] of [[f.expanded,[f.edge,{...f.edges[1],weight:5}]],[f.expanded.slice(0,-1),f.edges],[f.expanded.map(p=>({...p,code:"same"})),f.edges]] as const){
    assert.equal((await selectModelProfile(f.manifest,[...places],[...paths])).profile,"incompatible");
  }
});
test("unrelated sample data stays in graph mode without UCC resources",async()=>{
  const f=await fixture(),sample=f.old.map(p=>({...p,name:`Sample ${p.id}`}));
  const selected=await selectModelProfile(f.manifest,sample,[]);assert.equal(selected.profile,"sample");assert.equal(selected.recognized,false);assert.deepEqual(selected.manifest.models,[]);
});
test("profile schema validates nested models and distinct profile identifiers",async()=>{
  const {manifest}=await fixture();
  assert.throws(()=>parseManifest({...manifest,profiles:[manifest.profiles![0],manifest.profiles![0]]}),/duplicate model profile/);
  const invalid=structuredClone(manifest);invalid.profiles![0].models[0].reference="models/../private.json";
  assert.throws(()=>parseManifest(invalid),/references, hashes/);
});
test("profile-specific stair footprints replace the legacy crossings only after the data matches",async()=>{
  const f=await fixture(),crossing={connectionCode:"stairs:new",originName:"A",destinationName:"B",source:"Reviewed new flight"};
  f.manifest.stairCrossings=[{...crossing,connectionCode:"stairs:old"}];f.manifest.profiles![0].stairCrossings=[crossing];
  assert.deepEqual((await selectModelProfile(f.manifest,f.expanded,f.edges)).manifest.stairCrossings,[crossing]);
  assert.equal((await selectModelProfile(f.manifest,f.old,[f.edge])).manifest.stairCrossings![0].connectionCode,"stairs:old");
  f.manifest.profiles![0].stairCrossings![0].originName="Unbound place";
  assert.throws(()=>parseManifest(f.manifest),/endpoints must belong/);
});
test("candidate sources and exterior-only foot support require safe committed declarations",()=>{
  const manifest=structuredClone(source),candidate=manifest.profiles!.find(p=>p.id==="ucc-two-floors-c15")!.models.find(m=>m.id==="ucc-first-floor")!;
  assert.equal(candidate.outdoorSupportNodes![0],"Site");assert.ok(parseManifest(manifest));
  for(const bad of [{commit:"HEAD",path:"model/candidates/c15/floor-1.glb"},{commit:"3177ca7",path:"model/candidates/../floor-1.glb"}]){
    candidate.modelSource=bad;assert.throws(()=>parseManifest(manifest),/committed source/);
  }
  candidate.modelSource={commit:"3177ca7",path:"model/candidates/c15/floor-1.glb"};candidate.outdoorSupportNodes=candidate.supportNodes;
  assert.throws(()=>parseManifest(manifest),/Outdoor support/);
});

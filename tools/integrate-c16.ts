import { mkdir,readFile,writeFile } from "node:fs/promises";
import { Group,Vector3 } from "three";
import { committedRepositoryAsset,reviewedAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { parseManifest,sha256 } from "../src/scene/modelManifest.ts";
import { parseReference,referenceMatrix,validateAlignment,validateModelNodes } from "../src/scene/modelReference.ts";
import { modelColliders,modelCollision,type ModelCollider } from "../src/scene/modelCollision.ts";
import { supportColliders,supportedStep } from "../src/scene/walkSupport.ts";
import type { Building } from "../src/api/types.ts";

const commit="002aaec",output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/c16";
const manifest=parseManifest(JSON.parse(await readFile("public/models/campus-manifest.json","utf8")));
const previous=parseManifest(JSON.parse((await committedRepositoryAsset("83faafe","public/models/campus-manifest.json")).toString("utf8")));
const profile=manifest.profiles!.find(p=>p.id==="ucc-two-floors-c15")!;
const config=JSON.parse((await committedRepositoryAsset(commit,"model/tools/real_levels.json")).toString("utf8"));
const datasets=await Promise.all(["ucc-first-floor-c15.json","ucc-second-floor-c15.json"].map(async file=>{
  const bytes=await readFile(`../data/datasets/${file}`);return {file,hash:await sha256(bytes),data:JSON.parse(bytes.toString("utf8"))};
}));
const places=datasets.flatMap(d=>d.data.places) as Building[],paths=datasets.flatMap(d=>d.data.paths),byCode=new Map(places.map(p=>[p.code,p]));
const roots:Group[]=[],sources:{floor:number;path:string;commit:string;sha256:string;worldDatum:number;aWorld:number}[]=[],anchors=[];
for(let floor=1;floor<=5;floor++){
  const entry=profile.models.find(m=>m.floors.includes(floor))!,path=`model/candidates/c16/floor-${floor}.glb`;
  const bytes=await committedRepositoryAsset(commit,path),hash=await sha256(bytes);
  if(await sha256(await readFile(path))!==hash)throw new Error(`Working C16 changed: ${path}. Review the committed export before integrating.`);
  const referenceBytes=await reviewedAsset(entry,entry.reference!,entry.referenceSha256!),reference=parseReference(JSON.parse(referenceBytes.toString("utf8")));
  if(reference.floor!==floor || Math.abs(reference.transform.translation[1]-config.floors[floor].datum_world)>.000001)throw new Error("C16/reference datum differs.");
  const root=new Group();root.position.y=config.floors[floor].datum_world;root.add((await parseModelGeometry(bytes)).scene);root.updateMatrixWorld(true);roots.push(root);
  const aligned=validateAlignment(reference,places);validateModelNodes(reference,root);
  anchors.push({floor,reference:entry.reference,sourceCommit:entry.sourceCommit,points:aligned.map((p,i)=>({name:p.name,error:p.error,
    nodeError:root.getObjectByName(reference.references[i].nodeName)!.getWorldPosition(new Vector3()).distanceTo(new Vector3(...reference.references[i].position).applyMatrix4(referenceMatrix(reference)))}))});
  sources.push({floor,path,commit,sha256:hash,worldDatum:config.floors[floor].datum_world,aWorld:config.floors[floor].datum_world+config.floors[floor].a_offset});
  entry.model=`models/c16/floor-${floor}.glb`;entry.modelSource={commit,path};entry.modelSha256=hash;entry.revision=`C16-floor-${floor}-${commit}`;
  if(entry.kind==="floor-preview")entry.sourceDocument=`model/candidates/c16/README.md @${commit}; docs/blocks/level-zones.md @fb39c86; Block A physical level, structural B datum anchors. Pending western and A/B junctions remain unresolved; inspection only, no API destinations or routes.`;
}
profile.label="UCC · two-floor data with C16 models";
const colliders=roots.flatMap(r=>modelColliders(r));
function surfaces(groups:Group[]){return groups.flatMap((root,i)=>{
  const prefix=i===0 ? "":`P${i+1}_`,names=[`${prefix}Floor_Slab`];
  if(i<4)names.push(`${prefix}Stair_A_East_1`,`${prefix}Stair_A_West_1`);
  return supportColliders(root,names);
});}
const supports=surfaces(roots),outside=[...supports,...supportColliders(roots[0],["Site"])];
function inspect(name:string,points:Vector3[],stepped:boolean,surfaces:ModelCollider[]=supports,obstacles:ModelCollider[]=colliders){
  let current=points[0].clone(),samples=0,firstBlocker:string|null=null,unsupported=false,noProgress=false;
  for(const target of points.slice(1)){
    for(let guard=0;;guard++){
      if(guard>5000)throw new Error(`Stalled inspection ${name}`);
      const delta=target.clone().sub(current),reached=delta.length()<=.035;
      const expected=reached ? target.clone():current.clone().addScaledVector(delta,.035/delta.length());
      const next=stepped ? supportedStep(current,expected,surfaces):expected;
      const foot=next && supportedStep(next,next,surfaces);
      if(!next || !foot || next.distanceTo(foot)>.001){unsupported=true;break;}
      const blocker=modelCollision(current,next,obstacles);if(blocker){firstBlocker=blocker.name;break;}
      if(!reached && next.distanceToSquared(current)<1e-14){unsupported=true;noProgress=true;break;}
      current=next;samples++;if(reached)break;
    }
    if(unsupported || firstBlocker)break;
  }
  return {name,samples,firstBlocker,unsupported,noProgress,lastPosition:current.toArray()};
}
const position=(p:Building)=>new Vector3(p.x,p.elevation_m!,-p.y),graph=[];
for(const edge of paths)for(const reverse of [false,true]){
  const a=byCode.get(reverse ? edge.target_code:edge.source_code)!,b=byCode.get(reverse ? edge.source_code:edge.target_code)!;
  if(!a || !b)throw new Error(`Unknown graph endpoint: ${edge.code}`);
  graph.push({...inspect(`${edge.code}${reverse ? " reverse":""}`,[position(a),position(b)],["stairs","outdoor"].includes(edge.kind),edge.kind==="outdoor" ? outside:supports),code:edge.code,reverse});
}
const eastPoints=places.filter(p=>p.code!.startsWith("ucc:f2:east-stair-"));
function towerPath(lower:number,tower:string){
  const bottom=sources[lower-1].aWorld,rise=sources[lower].aWorld-bottom;
  return eastPoints.map(p=>new Vector3(tower==="east" ? p.x:p.x<=37.55 ? 14.65+(p.x-36.35)*1.7/1.2:16.35+(p.x-37.55)*1.7/1.15,
    bottom+(p.elevation_m!-2.87)*rise/3.31,-p.y));
}
const towers=[];
for(let lower=1;lower<=4;lower++)for(const tower of ["east","west"])for(const reverse of [false,true]){
  const points=towerPath(lower,tower);if(reverse)points.reverse();
  towers.push({...inspect(`tower ${tower} ${lower}/${lower+1}${reverse ? " reverse":""}`,points,true),lower,upper:lower+1,tower,reverse,scope:"inspection only; no API connection added"});
}
const hall=config.floors[3].hall,nosings=hall.nosings as number[],datum=sources[2].worldDatum,offset=sources[2].aWorld-datum;
const hallPoints=[new Vector3(28,datum,-47.6),...nosings.slice(0,-1).map((n,i)=>new Vector3(28,datum+offset*(i+1)/4,-(n+nosings[i+1])/2)),new Vector3(28,datum+offset,-49.6)];
const hall3=[inspect("floor 3 hall up",hallPoints,true),inspect("floor 3 hall down",[...hallPoints].reverse(),true)];
const rejectedJunctions=[2,4,5].map(floor=>({...inspect(`unreviewed A/B junction ${floor}`,[new Vector3(28,sources[floor-1].worldDatum,-47.6),new Vector3(28,sources[floor-1].aWorld,-49.6)],true),floor,expectedRejected:true}));
// Negative control: a C15 stair to 9.38 cannot silently stand in for the C16
// physical stair to 9.87, even though the current two-floor graph still matches.
const oldUpper=new Group();oldUpper.position.y=6.44;oldUpper.add((await parseModelGeometry(await committedRepositoryAsset("3177ca7","model/candidates/c15/floor-2.glb"))).scene);oldUpper.updateMatrixWorld(true);
const mixed=[roots[0],oldUpper,...roots.slice(2)];
const mixedNeighbour={...inspect("C15 floor 2 with C16 floor 3",towerPath(2,"east"),true,surfaces(mixed),mixed.flatMap(r=>modelColliders(r))),expectedRejected:true};
const failed=[...graph,...towers,...hall3].filter(r=>r.firstBlocker || r.unsupported);
const unsafeAccepted=[...rejectedJunctions,mixedNeighbour].filter(r=>!r.firstBlocker && !r.unsupported);
const withoutTarget=(m:typeof manifest)=>({...m,profiles:m.profiles!.filter(p=>p.id!==profile.id)});
if(JSON.stringify(withoutTarget(manifest))!==JSON.stringify(withoutTarget(previous)))throw new Error("A preserved model profile or root metadata changed.");
const oldProfile=previous.profiles!.find(p=>p.id===profile.id)!;
if(JSON.stringify(profile.stairCrossings)!==JSON.stringify(oldProfile.stairCrossings))throw new Error("C16 changed current stair restrictions.");
for(const m of profile.models){
  if(JSON.stringify(m.binding)!==JSON.stringify(oldProfile.models.find(p=>p.id===m.id)!.binding))throw new Error("C16 changed data bindings.");
}
for(const d of datasets)if(await sha256(await readFile(`../data/datasets/${d.file}`))!==d.hash)throw new Error("Navigation dataset changed during inspection.");
parseManifest(manifest);await mkdir(output,{recursive:true});
await writeFile(`${output}/geometry.json`,JSON.stringify({commit,configurationCommit:commit,zonesCommit:"fb39c86",sources,anchors,datasets:datasets.map(({file,hash})=>({file,hash})),graph,towers,hall3,rejectedJunctions,mixedNeighbour,failed,unsafeAccepted,unchangedDataAndFourProfiles:true},null,2));
console.log(JSON.stringify({anchors:anchors.reduce((s,a)=>s+a.points.length,0),graph:graph.length,towers:towers.length,hall3:hall3.length,failed,unsafeAccepted},null,2));
if(failed.length || unsafeAccepted.length)throw new Error("C16 failed clearance/support or a negative control.");
if(process.argv.includes("--integrate")){
  await writeFile("public/models/campus-manifest.json",JSON.stringify(manifest,null,2)+"\n");console.log("Integrated five C16 resources in the existing C15 data profile; four prior profiles preserved. No datasets or exports changed.");
}

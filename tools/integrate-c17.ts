import { mkdir,readFile,writeFile } from "node:fs/promises";
import { Box3,Group,Mesh,Raycaster,Vector3 } from "three";
import { committedRepositoryAsset,reviewedAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { parseManifest,sha256 } from "../src/scene/modelManifest.ts";
import { parseReference,validateAlignment,validateModelNodes } from "../src/scene/modelReference.ts";
import { modelColliders,modelCollision,type ModelCollider } from "../src/scene/modelCollision.ts";
import { supportColliders,supportedStep } from "../src/scene/walkSupport.ts";
import type { Building } from "../src/api/types.ts";

const commit="0f6a862",output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/c17";
const previous=parseManifest(JSON.parse((await committedRepositoryAsset("fb11095","public/models/campus-manifest.json")).toString("utf8")));
const manifest=parseManifest(JSON.parse(await readFile("public/models/campus-manifest.json","utf8")));
const config=JSON.parse((await committedRepositoryAsset(commit,"model/tools/real_levels_c17.json")).toString("utf8"));
const datasets=await Promise.all(["ucc-first-floor-c15.json","ucc-second-floor-c15.json","ucc-third-floor.json"].map(async file=>{
  const bytes=await readFile(`../data/datasets/${file}`);return {file,hash:await sha256(bytes),data:JSON.parse(bytes.toString("utf8"))};
}));
const places=datasets.flatMap(d=>d.data.places) as Building[],paths=datasets.flatMap(d=>d.data.paths),byCode=new Map(places.map(p=>[p.code,p]));
const profileIds=["ucc-two-floors-c15","ucc-three-floors-c16"],profile=manifest.profiles!.find(p=>p.id===profileIds[1])!;
const roots:Group[]=[],sources:{floor:number;path:string;commit:string;sha256:string;worldDatum:number}[]=[],anchors=[];
for(let floor=1;floor<=5;floor++){
  const revision=floor===2 ? commit:"002aaec",path=`model/candidates/c${floor===2 ? 17:16}/floor-${floor}.glb`,bytes=await committedRepositoryAsset(revision,path),hash=await sha256(bytes);
  if(await sha256(await readFile(path))!==hash)throw new Error(`Working export changed: ${path}. Review it before integrating.`);
  const entry=profile.models.find(m=>m.floors.includes(floor))!,reference=parseReference(JSON.parse((await reviewedAsset(entry,entry.reference!,entry.referenceSha256!)).toString("utf8")));
  const root=new Group();root.position.y=config.floors[floor].datum_world;root.add((await parseModelGeometry(bytes)).scene);root.updateMatrixWorld(true);roots.push(root);
  validateModelNodes(reference,root);anchors.push({floor,reference:entry.reference,points:validateAlignment(reference,places).map(p=>({name:p.name,error:p.error}))});
  sources.push({floor,path,commit:revision,sha256:hash,worldDatum:config.floors[floor].datum_world});
}
const oldUpper=new Group();oldUpper.position.y=6.44;oldUpper.add((await parseModelGeometry(await committedRepositoryAsset("002aaec","model/candidates/c16/floor-2.glb"))).scene);oldUpper.updateMatrixWorld(true);
function surfaces(groups:Group[]){return groups.flatMap((root,i)=>supportColliders(root,[`${i ? `P${i+1}_`:""}Floor_Slab`,...(i<4 ? [`${i ? `P${i+1}_`:""}Stair_A_East_1`,`${i ? `P${i+1}_`:""}Stair_A_West_1`]:[])]));}
const supports=surfaces(roots),colliders=roots.flatMap(r=>modelColliders(r)),outside=[...supports,...supportColliders(roots[0],["Site"])];
function inspect(name:string,points:Vector3[],snap:boolean,ground:ModelCollider[]=supports,obstacles:ModelCollider[]=colliders){
  let current=points[0].clone(),samples=0,firstBlocker:string|null=null,unsupported=false;
  for(const target of points.slice(1)){
    for(let guard=0;;guard++){
      if(guard>5000)throw new Error(`Inspection stalled: ${name}`);
      const delta=target.clone().sub(current),reached=delta.length()<=.035,expected=reached ? target.clone():current.clone().addScaledVector(delta,.035/delta.length());
      const next=snap ? supportedStep(current,expected,ground):expected,foot=next && supportedStep(next,next,ground);
      if(!next || !foot || foot.distanceTo(next)>.001 || (!reached && next.distanceToSquared(current)<1e-14)){unsupported=true;break;}
      const blocker=modelCollision(current,next,obstacles);if(blocker){firstBlocker=blocker.name;break;}
      current=next;samples++;if(reached)break;
    }
    if(unsupported || firstBlocker)break;
  }
  return {name,samples,firstBlocker,unsupported,lastPosition:current.toArray()};
}
const position=(p:Building)=>new Vector3(p.x,p.elevation_m!,-p.y),graph=[];
for(const e of paths)for(const reverse of [false,true]){
  const a=byCode.get(reverse ? e.target_code:e.source_code)!,b=byCode.get(reverse ? e.source_code:e.target_code)!;
  if(!a || !b)throw new Error(`Unknown endpoint ${e.code}`);
  graph.push({...inspect(e.code,[position(a),position(b)],["stairs","outdoor"].includes(e.kind),e.kind==="outdoor" ? outside:supports),code:e.code,reverse});
}
const ramp=config.floors[2].ramp as {x:[number,number];y:[number,number]},rampHeight=(y:number)=>6.44-.26*Math.max(0,Math.min(1,(y-ramp.y[0])/(ramp.y[1]-ramp.y[0])));
const rampChecks=[],oldRampChecks=[],oldGroups=[roots[0],oldUpper,...roots.slice(2)];
for(const [x,margin] of [[27.8,.15],[28.55,.4],[29.3,.4]]){
  const ys=[ramp.y[0]-margin,...Array.from({length:11},(_,i)=>ramp.y[0]+(ramp.y[1]-ramp.y[0])*i/10),ramp.y[1]+.4],points=ys.map(y=>new Vector3(x,rampHeight(y),-y));
  for(const reverse of [false,true]){
    const p=reverse ? [...points].reverse():points;
    rampChecks.push({...inspect(`ramp x${x} ${reverse ? "up":"down"}`,p,false),x,reverse});
    oldRampChecks.push({...inspect(`C16 negative ramp x${x} ${reverse ? "up":"down"}`,p,false,surfaces(oldGroups),oldGroups.flatMap(r=>modelColliders(r))),expectedRejected:true});
  }
}
const slab=(root:Group)=>{const node=root.getObjectByName("P2_Floor_Slab");if(!(node instanceof Mesh))throw new Error("Missing floor2 slab");return node;};
const beforeSlab=slab(oldUpper),afterSlab=slab(roots[1]);
const top=(mesh:Mesh,x:number,y:number)=>new Raycaster(new Vector3(x,8,-y),new Vector3(0,-1,0),0,3).intersectObject(mesh,false)[0]?.point.y;
let heightSamples=0,changedInside=0,changedOutside=0,maxOutsideDifference=0;
const extent=new Box3().setFromObject(beforeSlab).union(new Box3().setFromObject(afterSlab)),grid=.4;
for(let x=Math.ceil(extent.min.x/grid)*grid;x<=extent.max.x;x+=grid)for(let y=Math.ceil(-extent.max.z/grid)*grid;y<=-extent.min.z;y+=grid){
  const a=top(beforeSlab,x,y),b=top(afterSlab,x,y);heightSamples++;
  const different=(a===undefined)!==(b===undefined) || (a!==undefined && b!==undefined && Math.abs(a-b)>.00001);
  if(different){if(x>=ramp.x[0] && x<=ramp.x[1] && y>=ramp.y[0] && y<=ramp.y[1])changedInside++;else{changedOutside++;maxOutsideDifference=Math.max(maxOutsideDifference,a!==undefined && b!==undefined ? Math.abs(a-b):Infinity);}}
}
const failed=[...graph,...rampChecks].filter(r=>r.firstBlocker || r.unsupported),unsafeAccepted=oldRampChecks.filter(r=>!r.firstBlocker && !r.unsupported);
const oldCatalog=previous.catalog,newCatalog=JSON.parse(await readFile("../data/campus-catalog.json","utf8"));
// Only identity evidence advances. Floors/datums and the historical flat model stay unchanged.
const normalizeCatalog=(c:typeof oldCatalog)=>({...c,revision:"",source:"",notes:[],blocks:c.blocks.map(b=>({...b,identity_evidence:"",source:""}))});
if(JSON.stringify(normalizeCatalog(newCatalog))!==JSON.stringify(normalizeCatalog(oldCatalog)))throw new Error("Catalogue changed floor evidence or levels.");
manifest.catalog=newCatalog;
for(const id of profileIds){
  const p=manifest.profiles!.find(p=>p.id===id)!,old=previous.profiles!.find(p=>p.id===id)!,entry=p.models.find(m=>m.floors.includes(2))!,source=sources[1];
  entry.model="models/c17/floor-2.glb";entry.modelSource={commit,path:source.path};entry.modelSha256=source.sha256;entry.revision="C17-floor-2-ramp-0f6a862";
  entry.sourceDocument="model/candidates/c17/README.md @0f6a862; drawn A/B ramp, world6.44 to6.18; step-free geometry, accessibility not certified. No new API connection.";
  p.label=id===profileIds[0] ? "UCC two-floor data with C17 ramp":"UCC three floors with C17 ramp";
  const unchanged=(v:typeof p)=>({...v,label:"",models:v.models.map(m=>m.floors.includes(2) ? {...m,model:"",modelSource:null,modelSha256:"",revision:"",sourceDocument:""}:m)});
  if(JSON.stringify(unchanged(p))!==JSON.stringify(unchanged(old)))throw new Error("C17 changed bindings, references or other models.");
}
const remaining=(m:typeof manifest)=>({...m,catalog:null,profiles:m.profiles!.filter(p=>!profileIds.includes(p.id))});
if(JSON.stringify(remaining(manifest))!==JSON.stringify(remaining(previous)))throw new Error("An older model profile changed.");
for(const d of datasets)if(await sha256(await readFile(`../data/datasets/${d.file}`))!==d.hash)throw new Error("Dataset changed during audit.");
parseManifest(manifest);await mkdir(output,{recursive:true});
await writeFile(`${output}/geometry.json`,JSON.stringify({sources,configurationCommit:commit,identityCommit:"b36d328",anchors,datasets:datasets.map(({file,hash})=>({file,hash})),graph,rampChecks,oldRampChecks,heightMap:{samples:heightSamples,gridMetres:grid,extent:extent.min.toArray().concat(extent.max.toArray()),changedInside,changedOutside,maxOutsideDifference},failed,unsafeAccepted,unchangedDatasets:true,unchangedFourOlderModelProfiles:true},null,2));
console.log(JSON.stringify({graph:graph.length,ramp:rampChecks.length,failed,unsafeAccepted,heightSamples,changedInside,changedOutside},null,2));
if(failed.length || unsafeAccepted.length || changedOutside || !changedInside)throw new Error("C17 failed support, clearance or the changed-region audit.");
if(process.argv.includes("--integrate")){await writeFile("public/models/campus-manifest.json",JSON.stringify(manifest,null,2)+"\n");console.log("Integrated C17 floor2 in both compatible data profiles. Four historical model profiles and all datasets preserved.");}

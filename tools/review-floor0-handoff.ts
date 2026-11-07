import { mkdir,readFile,writeFile } from "node:fs/promises";
import { Box3,Group,Raycaster,Vector3 } from "three";
import { committedRepositoryAsset,reviewedAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { parseManifest,sha256 } from "../src/scene/modelManifest.ts";
import { parseReference,validateAlignment,validateModelNodes } from "../src/scene/modelReference.ts";
import { supportColliders,supportedStep } from "../src/scene/walkSupport.ts";

const output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/floor0-handoff",commit="de3815e";
const zonesBytes=await committedRepositoryAsset(commit,"docs/blocks/level-zones.json"),zones=JSON.parse(zonesBytes.toString("utf8")).floors["0"];
const manifest=parseManifest(JSON.parse(await readFile("public/models/campus-manifest.json","utf8"))),profile=manifest.profiles!.find(p=>p.id==="ucc-three-floors-c16")!,entry=profile.models.find(m=>m.floors.includes(0))!;
if(entry.kind!=="floor-preview" || entry.navigable!==false)throw new Error("Floor0 must stay an inspection preview.");
const refBytes=await reviewedAsset(entry,entry.reference!,entry.referenceSha256!),ref=parseReference(JSON.parse(refBytes.toString("utf8")));
const modelURL=entry.model ?? `${entry.reference!.slice(0,entry.reference!.lastIndexOf("/")+1)}${ref.model}`,bytes=await reviewedAsset(entry,modelURL,entry.modelSha256!);
const lower=new Group();lower.position.set(...ref.transform.translation);lower.add((await parseModelGeometry(bytes)).scene);lower.updateMatrixWorld(true);
validateModelNodes(ref,lower);const anchors=validateAlignment(ref,[]).map(p=>({name:p.name,error:p.error}));
const stairNames:string[]=[];lower.traverse(o=>{if(/^P0_Stair_A_East_/.test(o.name))stairNames.push(o.name);});
const lowerGround=supportColliders(lower,["P0_Floor_Slab","P0_Stair_A_East_1"]);
const upperBytes=await committedRepositoryAsset("002aaec","model/candidates/c16/floor-1.glb"),upper=new Group();upper.position.y=3.5;upper.add((await parseModelGeometry(upperBytes)).scene);upper.updateMatrixWorld(true);
const upperGround=supportColliders(upper,["Floor_Slab"]);
const heights=(root:typeof lowerGround,x:number,y:number)=>new Raycaster(new Vector3(x,5,-y),new Vector3(0,-1,0),0,7).intersectObjects(root.map(c=>c.mesh),false).filter(h=>h.face && h.face.normal.clone().transformDirection(h.object.matrixWorld).y>.65).map(h=>h.point.y);
const join=zones.joins.find((j:{id:string})=>j.id==="A-east-tower-0-1");
if(join.rise!==3.5 || join.world[0]!==-.63 || join.world[1]!==2.87 || zones.labels.length!==7)throw new Error("Reviewed C18 endpoint facts changed.");
const marker=zones.labels.find((l:{where:string})=>l.where==="Block A, east tower foot");
const candidateFoot=new Vector3(marker.xy[0],join.world[0],-marker.xy[1]),upperStand=new Vector3(38.7,join.world[1],-55.9);
const observations={
  legacyLowerXYProbe:{plan:[36.35,55.9],surfaceHeights:heights(lowerGround,36.35,55.9),note:"Inspection coordinate only; not a confirmed floor0 walking endpoint"},
  unacceptedCopiedUpperXY:{plan:[38.7,55.9],surfaceHeights:heights(lowerGround,38.7,55.9),note:"Copied from the accepted upper-floor stand; not a confirmed floor0 walking endpoint"},
  legacyStairBounds:stairNames.map(name=>{const b=new Box3().setFromObject(lower.getObjectByName(name)!);return {name,min:b.min.toArray(),max:b.max.toArray()};}),
  acceptedFloor1Stand:{plan:[38.7,55.9],surfaceHeights:heights(upperGround,38.7,55.9)},
  sourceLevelMarkers:zones.labels.map((l:{xy:[number,number];level:number;where:string})=>({...l,requestedWorldElevation:3.5+l.level,previewSurfaceHeights:heights(lowerGround,...l.xy)})),
  oldPreviewRejectsPhysicalFoot:!supportedStep(candidateFoot,candidateFoot,lowerGround),
  floor1SupportsAcceptedTop:!!supportedStep(upperStand,upperStand,upperGround),
};
if(!observations.oldPreviewRejectsPhysicalFoot || !observations.floor1SupportsAcceptedTop)throw new Error("Expected incompatible preview / accepted upper stand control failed.");
const request={version:1,status:"model-request-not-navigation-data",navigationEnabled:false,source:{commit,path:"docs/blocks/level-zones.json",sha256:await sha256(zonesBytes)},
  frame:{planConvention:"(x,y) to (x,worldY,-y); +Y is drawing axis, not geographic north",worldOffsetFromSheetDatum:3.5,modelTranslation:ref.transform.translation},
  endpointLevels:join,regions:zones.zones,pendingJoins:zones.joins.filter((j:{id:string})=>!["A-east-tower-0-1","B-stair-north-flight"].includes(j.id)),
  requiredCandidate:{separateGLB:true,sourceExportAndReferenceSheet:true,preserveReferenceNodes:ref.references,preserveExistingPreview:true,
    physicalAandClinic:{sheetLevel:-4.13,worldLevel:-.63,localOffset:-1.19,extent:"C18 confirmed markers and derived zones only; ambiguous boundaries and southern rooms remain explicitly pending"},
    eastTower:{rise:3.5,footWorld:-.63,topWorld:2.87,layoutStatus:"C18 proposes compatible 21-riser tower layout; confirm actual plan centre line, return flight, landing and exported support surfaces before any API graph is accepted"},
    blockedUntilModelReview:["B south flight to floor1 pending laboratory level","west stair landing and opening","south-west ramp top","east-yard contradictory steps","southern rooms and unresolved B level boundary","elevator movement without reviewed shafts/doors/stops"]},
  runtimeChecks:{maxStepHeightMetres:.20,footprintRadiusMetres:.12,bodyRadiusMetres:.22,headHeightMetres:1.8,initialAnchorToleranceMetres:.15,recordedFootToleranceMetres:.001},
  existingPreview:{modelURL,modelSha256:await sha256(bytes),sourceCommit:entry.sourceCommit,referenceSha256:await sha256(refBytes)},upperNeighbour:{commit:"002aaec",path:"model/candidates/c16/floor-1.glb",sha256:await sha256(upperBytes)}};
await mkdir(output,{recursive:true});await writeFile(`${output}/review.json`,JSON.stringify({request,anchors,observations,noDatasetOrManifestChanges:true},null,2)+"\n");
await writeFile("docs/blocks/floor0-candidate-request.json",JSON.stringify(request,null,2)+"\n");
console.log(JSON.stringify({labels:zones.labels.length,anchors:anchors.length,observations,navigationEnabled:false},null,2));

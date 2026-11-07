import { mkdir,writeFile } from "node:fs/promises";
import { parseManifest } from "../src/scene/modelManifest.ts";
import { selectModelProfile } from "../src/scene/modelProfiles.ts";
import type { Building,CampusPath } from "../src/api/types.ts";

// Read-only deployment check: never imports data or restarts a process.
const base=(process.env.UNINAV_TEST_URL ?? "http://127.0.0.1:8001").replace(/\/$/,"");
async function get(path:string){const r=await fetch(base+path);if(!r.ok)throw new Error(`${path}: HTTP ${r.status}`);return r.json();}
const [raw,places,paths,openapi]=await Promise.all([get("/app/models/campus-manifest.json"),get("/buildings"),get("/paths"),get("/openapi.json")]);
const manifest=parseManifest(raw),selection=await selectModelProfile(manifest,places as Building[],paths as CampusPath[]);
const required:Record<string,string[]>={BuildingResponse:["code","floor_code","elevation_m"],PathResponse:["code"],RouteResponse:["waypoints"],RouteWaypoint:["id","code","floor","elevation_m","floor_code"]};
const missingContractFields=Object.entries(required).flatMap(([schema,fields])=>fields.filter(f=>!openapi.components?.schemas?.[schema]?.properties?.[f]).map(f=>`${schema}.${f}`));
if(!openapi.paths?.["/campus/datasets/import"])missingContractFields.push("/campus/datasets/import");
const report={url:base,places:places.length,paths:paths.length,selectedProfile:selection.profile,recognizedCampus:selection.recognized,
  expandedProfilePresent:manifest.profiles?.some(p=>p.id==="ucc-two-floors") ?? false,missingContractFields,
  apiContractSupportsPreparedData:missingContractFields.length===0,changesMade:false,
  publicFloor2Active:selection.profile==="ucc-two-floors",
  remainingPhysicalReview:"First-floor hall and B laboratory level changes are still flattened in C13. Resolve geometry, graph and Avoid stairs before public acceptance."};
const output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/h2-profiles";
await mkdir(output,{recursive:true});await writeFile(`${output}/deployment-profile.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(process.argv.includes("--require-expanded") && (!report.apiContractSupportsPreparedData || !report.publicFloor2Active))process.exitCode=1;

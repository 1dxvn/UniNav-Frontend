import type { Building,CampusPath } from "../api/types.ts";
import { dataFingerprint,type CampusManifest,type ModelEntry } from "./modelManifest.ts";

function navigable(models:ModelEntry[]) {return models.filter(m=>m.state==="ready" && m.kind!=="floor-preview" && m.kind!=="exterior");}
function explicitContract(models:ModelEntry[],places:Building[],paths:CampusPath[]):boolean {
  const names=new Set(navigable(models).flatMap(m=>m.binding?.placeNames ?? []));
  const scoped=places.filter(p=>names.has(p.name)),ids=new Set(scoped.map(p=>p.id));
  const edges=paths.filter(p=>ids.has(p.source_id) || ids.has(p.target_id));
  return scoped.length===names.size && new Set(scoped.map(p=>p.id)).size===scoped.length && new Set(scoped.map(p=>p.code)).size===scoped.length &&
    scoped.every(p=>Number.isSafeInteger(p.id) && p.id>0 && typeof p.code==="string" && !!p.code.trim() && typeof p.floor_code==="string" && !!p.floor_code.trim() && typeof p.elevation_m==="number" && Number.isFinite(p.elevation_m)) &&
    new Set(edges.map(e=>e.id)).size===edges.length && new Set(edges.map(e=>e.code)).size===edges.length &&
    edges.every(e=>Number.isSafeInteger(e.id) && e.id>0 && typeof e.code==="string" && !!e.code.trim());
}
async function compatible(models:ModelEntry[],places:Building[],paths:CampusPath[]):Promise<boolean>{
  const entries=navigable(models);if(!entries.length)return false;
  try{for(const e of entries)if(!e.binding || await dataFingerprint(e.binding.placeNames,places,paths)!==e.binding.sha256)return false;return true;}
  catch{return false;}
}
export interface ProfileSelection {manifest:CampusManifest;profile:string;recognized:boolean;error?:string}
export async function selectModelProfile(source:CampusManifest,places:Building[],paths:CampusPath[]):Promise<ProfileSelection>{
  for(const p of source.profiles ?? [])if(explicitContract(p.models,places,paths) && await compatible(p.models,places,paths))return {
    manifest:{version:1,catalog:source.catalog,models:p.models,stairCrossings:source.stairCrossings},profile:p.id,recognized:true};
  if(await compatible(source.models,places,paths))return {manifest:{version:1,catalog:source.catalog,models:source.models,stairCrossings:source.stairCrossings},profile:"base",recognized:true};
  const recognized=source.identityPlaceNames?.some(n=>places.some(p=>p.name===n)) ?? source.models.some(m=>m.binding?.placeNames.every(n=>places.some(p=>p.name===n)));
  return {manifest:{version:1,catalog:source.catalog,models:recognized ? source.models:[]},profile:recognized ? "incompatible":"sample",recognized,
    error:recognized ? "Model data revision differs: no reviewed profile matches this API contract. Reload compatible campus data.":undefined};
}

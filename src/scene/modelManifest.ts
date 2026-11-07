import type { Building, CampusPath } from "../api/types.ts";
import { parseCatalog, type CampusCatalog } from "./catalog.ts";
import { toScenePosition } from "./coordinates.ts";
import type { CampusReference } from "./modelReference.ts";

export interface ModelEntry {
  id: string; label: string; floors: number[]; state: "ready" | "pending";
  revision: string; reference?: string; modelSha256?: string;
  sourceCommit?: string; referenceSha256?: string;
  kind?: "floor" | "exterior" | "floor-preview"; navigable?: false;
  model?: string; transform?: CampusReference["transform"]; sourceDocument?: string;
  binding?: { placeNames: string[]; sha256: string };
  supportNodes?: string[];
  outdoorSupportNodes?:string[];
  modelSource?:{commit:string;path:string};
}
export interface ModelProfile { id:string; label:string; requiresExplicitPositions:true; models:ModelEntry[]; stairCrossings?:StairCrossing[] }
export interface StairCrossing { connectionCode:string; originName:string; destinationName:string; source:string; planBounds?:[number,number,number,number] }
export interface CampusManifest { version: 1; catalog: CampusCatalog; models: ModelEntry[]; identityPlaceNames?:string[]; profiles?:ModelProfile[]; stairCrossings?:StairCrossing[] }
const hashPattern = /^[a-f0-9]{64}$/;
const compare = (a: string,b: string) => a < b ? -1 : a > b ? 1 : 0;
export function parseManifest(value: unknown): CampusManifest {
  if (!value || typeof value !== "object") throw new Error("Invalid model manifest.");
  const manifest = value as CampusManifest;
  if (manifest.version !== 1 || !Array.isArray(manifest.models)) throw new Error("Unsupported model manifest.");
  parseCatalog(manifest.catalog);
  if(manifest.stairCrossings!==undefined){
    if(!Array.isArray(manifest.stairCrossings))throw new Error("Invalid mapped stair crossings.");
    const codes=new Set<string>();
    for(const c of manifest.stairCrossings){
      if(!c || typeof c.connectionCode!=="string" || !c.connectionCode.trim() || codes.has(c.connectionCode) ||
        typeof c.originName!=="string" || !c.originName.trim() || typeof c.destinationName!=="string" || !c.destinationName.trim() ||
        c.originName===c.destinationName || typeof c.source!=="string" || !c.source.trim())throw new Error("Mapped stair crossings need unique connections, endpoints and sources.");
      codes.add(c.connectionCode);
      if(c.planBounds!==undefined && (!Array.isArray(c.planBounds) || c.planBounds.length!==4 || c.planBounds.some(v=>!Number.isFinite(v)) ||
        c.planBounds[0]>=c.planBounds[2] || c.planBounds[1]>=c.planBounds[3]))throw new Error("Mapped stair bounds need a finite plan rectangle.");
    }
  }
  if(manifest.identityPlaceNames!==undefined && (!Array.isArray(manifest.identityPlaceNames) || manifest.identityPlaceNames.length<3 ||
    new Set(manifest.identityPlaceNames).size!==manifest.identityPlaceNames.length || manifest.identityPlaceNames.some(n=>typeof n!=="string" || !n.trim()))) throw new Error("Campus identity needs three distinct source place names.");
  if(manifest.profiles!==undefined){
    if(!Array.isArray(manifest.profiles) || !manifest.identityPlaceNames)throw new Error("Model profiles require a source identity.");
    const profileIds=new Set<string>();
    for(const profile of manifest.profiles){
      if(!profile || !/^[a-zA-Z0-9_-]+$/.test(profile.id) || ["base","sample","incompatible"].includes(profile.id) || profileIds.has(profile.id) || !profile.label?.trim() || profile.requiresExplicitPositions!==true)throw new Error("Invalid or duplicate model profile.");
      profileIds.add(profile.id);
      parseManifest({version:1,catalog:manifest.catalog,models:profile.models,stairCrossings:profile.stairCrossings});
      if(!profile.models.some(m=>m.state==="ready" && m.binding && m.kind!=="floor-preview" && m.kind!=="exterior"))throw new Error("A model profile needs a navigable data binding.");
    }
  }
  const ids = new Set<string>();
  for (const entry of manifest.models) {
    if (!entry || typeof entry.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(entry.id) || ids.has(entry.id) || !entry.label?.trim() || !entry.revision?.trim() ||
      !["ready","pending"].includes(entry.state) || ![undefined,"floor","exterior","floor-preview"].includes(entry.kind) ||
      !Array.isArray(entry.floors) || (entry.kind !== "exterior" && !entry.floors.length) ||
      entry.floors.some((f) => !Number.isInteger(f) || f < 0 || f > 7) || new Set(entry.floors).size !== entry.floors.length) throw new Error("Invalid or duplicate model entry.");
    ids.add(entry.id);
    if(entry.modelSource!==undefined && (!entry.modelSource || entry.kind==="exterior" || !/^[a-f0-9]{7,40}$/.test(entry.modelSource.commit) ||
      !/^model\/candidates\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.glb$/.test(entry.modelSource.path) ||
      !/^models\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.glb$/.test(entry.model ?? "")))throw new Error("Candidate models need a committed source path and an explicit safe model URL.");
    if(entry.model!==undefined && entry.kind!=="exterior" && !/^models\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.glb$/.test(entry.model))throw new Error("Invalid floor model URL.");
    if (entry.supportNodes !== undefined && (entry.kind === "floor-preview" || entry.kind === "exterior" ||
      !Array.isArray(entry.supportNodes) || !entry.supportNodes.length || new Set(entry.supportNodes).size !== entry.supportNodes.length ||
      entry.supportNodes.some((name) => typeof name !== "string" || !name.trim()))) throw new Error("Only navigable floors can declare distinct walking surface nodes.");
    if(entry.outdoorSupportNodes!==undefined && (entry.kind==="floor-preview" || entry.kind==="exterior" || !entry.supportNodes ||
      !Array.isArray(entry.outdoorSupportNodes) || !entry.outdoorSupportNodes.length || new Set(entry.outdoorSupportNodes).size!==entry.outdoorSupportNodes.length ||
      entry.outdoorSupportNodes.some(n=>typeof n!=="string" || !n.trim() || entry.supportNodes!.includes(n))))throw new Error("Outdoor support needs distinct reviewed nodes on a navigable floor.");
    if (entry.kind === "exterior") {
      const t = entry.transform;
      if (entry.floors.length || entry.navigable !== false || entry.binding ||
        (entry.state === "ready" && (!/^models\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.glb$/.test(entry.model ?? "") ||
        !/^[a-f0-9]{7,40}$/.test(entry.sourceCommit ?? "") || !hashPattern.test(entry.modelSha256 ?? "") ||
        !t || !Number.isFinite(t.scale) || t.scale <= 0 || !Number.isFinite(t.rotationYDegrees) ||
        !Array.isArray(t.translation) || t.translation.length !== 3 || t.translation.some((v) => !Number.isFinite(v)) ||
        typeof entry.sourceDocument !== "string" || !entry.sourceDocument.trim()))) throw new Error("Exterior entries need a reviewed transform and must remain non-navigable.");
      continue;
    }
    if (entry.kind === "floor-preview" && (entry.navigable !== false || entry.binding ||
      !entry.sourceDocument?.trim() || entry.floors.length !== 1)) throw new Error("Floor previews need a source and must remain non-navigable.");
    const reviewed = /^models\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.json$/.test(entry.reference ?? "") &&
      /^[a-f0-9]{7,40}$/.test(entry.sourceCommit ?? "") && hashPattern.test(entry.referenceSha256 ?? "") && hashPattern.test(entry.modelSha256 ?? "");
    const binding = entry.binding;
    const completeBinding = binding && hashPattern.test(binding.sha256) && Array.isArray(binding.placeNames) && binding.placeNames.length >= 3 &&
      binding.placeNames.every((name) => typeof name === "string" && !!name.trim()) && new Set(binding.placeNames).size === binding.placeNames.length;
    if (entry.state === "ready" && (!reviewed || (entry.kind !== "floor-preview" && !completeBinding))) throw new Error("Ready models need references, hashes and a complete data binding.");
  }
  const boundNames=new Set([...manifest.models,...(manifest.profiles ?? []).flatMap(p=>p.models)].flatMap(m=>m.binding?.placeNames ?? []));
  if(manifest.stairCrossings?.some(c=>!boundNames.has(c.originName) || !boundNames.has(c.destinationName)))throw new Error("Mapped stair endpoints must belong to a reviewed model binding.");
  return manifest;
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2,"0")).join("");
}

// Bind geometry to coordinates and graph topology, independent of database row IDs
// and API result ordering. Unconnected test-only places do not change the binding.
export async function dataFingerprint(placeNames: string[], places: Building[], paths: CampusPath[]): Promise<string> {
  const scope = new Set(placeNames), byId = new Map(places.map((place) => [place.id,place]));
  for (const name of scope) if (places.filter((place) => place.name === name).length !== 1) throw new Error(`Model binding needs one API place: ${name}.`);
  const edges = paths.filter((edge) => scope.has(byId.get(edge.source_id)?.name ?? "") || scope.has(byId.get(edge.target_id)?.name ?? ""));
  const names = new Set(scope);
  const connections = edges.map((edge) => {
    const a = byId.get(edge.source_id), b = byId.get(edge.target_id);
    if (!a || !b || !Number.isFinite(edge.weight)) throw new Error("Incomplete model graph binding.");
    names.add(a.name); names.add(b.name);
    const pair = edge.bidirectional ? [a.name,b.name].sort() : [a.name,b.name];
    return [pair[0],pair[1],edge.kind,edge.bidirectional,edge.weight];
  }).sort((a,b) => compare(JSON.stringify(a),JSON.stringify(b)));
  const points = places.filter((place) => names.has(place.name)).map((place) => [place.name,place.floor,...toScenePosition(place).toArray()])
    .sort((a,b) => compare(String(a[0]),String(b[0])));
  return sha256(new TextEncoder().encode(JSON.stringify({ points,connections })));
}

export function requiredModels(manifest: CampusManifest, viewFloor: number, avatarFloor: number, routeFloors: number[], overview = false): ModelEntry[] {
  const required = new Set([viewFloor,avatarFloor,...routeFloors]);
  if (overview) required.add(manifest.catalog.integrated_dataset.legacy_floor);
  return manifest.models.filter((entry) => entry.state === "ready" && (entry.kind === "exterior" ? overview :
    entry.kind === "floor-preview" ? !overview && entry.floors.includes(viewFloor) : entry.floors.some((floor) => required.has(floor))));
}

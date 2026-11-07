import type { Building, CampusPath } from "../api/types.ts";
import { parseCatalog, type CampusCatalog } from "./catalog.ts";
import { toScenePosition } from "./coordinates.ts";

export interface ModelEntry {
  id: string; label: string; floors: number[]; state: "ready" | "pending";
  revision: string; reference?: string; modelSha256?: string;
  sourceCommit?: string; referenceSha256?: string;
  binding?: { placeNames: string[]; sha256: string };
}
export interface CampusManifest { version: 1; catalog: CampusCatalog; models: ModelEntry[] }
const hashPattern = /^[a-f0-9]{64}$/;
const compare = (a: string,b: string) => a < b ? -1 : a > b ? 1 : 0;
export function parseManifest(value: unknown): CampusManifest {
  if (!value || typeof value !== "object") throw new Error("Invalid model manifest.");
  const manifest = value as CampusManifest;
  if (manifest.version !== 1 || !Array.isArray(manifest.models)) throw new Error("Unsupported model manifest.");
  parseCatalog(manifest.catalog);
  const ids = new Set<string>();
  for (const entry of manifest.models) {
    if (!entry || typeof entry.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(entry.id) || ids.has(entry.id) || !entry.label?.trim() || !entry.revision?.trim() ||
      !["ready","pending"].includes(entry.state) || !Array.isArray(entry.floors) || !entry.floors.length ||
      entry.floors.some((f) => !Number.isInteger(f) || f < 0 || f > 7) || new Set(entry.floors).size !== entry.floors.length) throw new Error("Invalid or duplicate model entry.");
    ids.add(entry.id);
    if (entry.state === "ready" && (!entry.reference || !/^models\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.json$/.test(entry.reference) ||
      !/^[a-f0-9]{7,40}$/.test(entry.sourceCommit ?? "") || !hashPattern.test(entry.referenceSha256 ?? "") ||
      !hashPattern.test(entry.modelSha256 ?? "") || !entry.binding || !hashPattern.test(entry.binding.sha256) ||
      !Array.isArray(entry.binding.placeNames) || entry.binding.placeNames.length < 3 ||
      entry.binding.placeNames.some((name) => typeof name !== "string" || !name.trim()) ||
      new Set(entry.binding.placeNames).size !== entry.binding.placeNames.length)) throw new Error("Ready models need references, hashes and a complete data binding.");
  }
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

export function requiredModels(manifest: CampusManifest, viewFloor: number, avatarFloor: number, routeFloors: number[]): ModelEntry[] {
  const required = new Set([viewFloor,avatarFloor,...routeFloors]);
  return manifest.models.filter((entry) => entry.state === "ready" && entry.floors.some((floor) => required.has(floor)));
}

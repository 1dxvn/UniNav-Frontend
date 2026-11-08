// Campus assistant (Plan 1 §11): resolves a need written in Spanish or English against the confirmed place catalogue
// returned by the API and offers navigation. It never invents places: every answer is an existing, routable place.
// No generative provider or key is involved.
import type { Building } from "./api/types.ts";

const HIDDEN = new Set(["waypoint", "junction", "corridor", "reference"]);
// Need words -> catalogue words. Each group expands a query term to the vocabulary used in names and types.
const SYNONYMS: string[][] = [
  ["bano", "banos", "wc", "restroom", "restrooms", "toilet", "aseo", "sanitario"],
  ["laboratorio", "laboratorios", "lab", "labs", "laboratory"],
  ["aula", "aulas", "salon", "clase", "classroom", "room"],
  ["informatica", "computo", "computacion", "computer", "computadores", "sistemas"],
  ["simulacion", "simulation", "clinica", "clinical"],
  ["espera", "waiting", "sala"],
  ["ascensor", "ascensores", "elevator", "elevators", "lift"],
  ["escalera", "escaleras", "stairs", "stair"],
  ["entrada", "acceso", "entrance", "access", "hall"],
  ["investigacion", "research", "investigaciones", "centro"],
  ["medicina", "medical", "medica", "medicas"],
  ["morfologia", "morphology"],
  ["preclinica", "preclinic"],
  ["realidad", "mixta", "mixed", "reality"],
  ["biologia", "molecular", "biology"],
  ["icetex", "credito", "financiacion"],
  ["cafeteria", "cafe", "cafetin", "comida", "food", "comer"],
];
const STOP = new Set(["el", "la", "los", "las", "un", "una", "de", "del", "al", "a", "en", "y", "o", "para", "por", "donde", "esta", "queda", "quiero", "ir", "necesito",
  "busco", "como", "llego", "me", "mi", "the", "a", "an", "of", "to", "in", "where", "is", "i", "want", "need", "go", "find", "how", "get", "please", "porfa", "favor"]);

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function expand(token: string): Set<string> {
  const out = new Set([token]);
  for (const group of SYNONYMS) if (group.includes(token)) group.forEach((word) => out.add(word));
  return out;
}

export interface AssistantMatch { place: Building; score: number; reason: string }
export interface AssistantAnswer { floor: number | null; matches: AssistantMatch[]; understood: string[] }

// "piso 3", "floor 3", "3er piso", "planta 0", "piso cero" -> floor filter
function floorFilter(text: string): number | null {
  const words: Record<string, number> = { cero: 0, zero: 0, primer: 1, primero: 1, first: 1, segundo: 2, second: 2, tercer: 3, tercero: 3, third: 3, cuarto: 4, fourth: 4, quinto: 5, fifth: 5 };
  const match = text.match(/\b(?:piso|planta|floor|nivel|level)\s+(\d|cero|zero|primer|primero|segundo|tercer|tercero|cuarto|quinto|first|second|third|fourth|fifth)\b/) ??
    text.match(/\b(\d|cero|primer|primero|segundo|tercer|tercero|cuarto|quinto|first|second|third|fourth|fifth)(?:er|ro|do|to|o|st|nd|rd|th)?\s+(?:piso|planta|floor)\b/);
  if (!match) return null;
  const value = match[1];
  return /^\d$/.test(value) ? Number(value) : words[value] ?? null;
}

export function askCampus(question: string, places: Building[], limit = 5): AssistantAnswer {
  const text = normalize(question), floor = floorFilter(text);
  const tokens = text.split(" ").filter((t) => t && !STOP.has(t) && !/^\d$/.test(t) && !["piso", "planta", "floor", "nivel", "level"].includes(t));
  const understood = [...new Set(tokens)];
  const matches: AssistantMatch[] = [];
  for (const place of places) {
    if (HIDDEN.has(place.building_type ?? "")) continue;
    if (floor !== null && place.floor !== floor) continue;
    const haystack = normalize(`${place.display_name ?? ""} ${place.name} ${place.building_type ?? ""} ${place.faculty ?? ""} ${place.block_code ? `bloque ${place.block_code} block ${place.block_code}` : ""}`);
    const words = new Set(haystack.split(" "));
    let score = 0; const hits: string[] = [];
    for (const token of understood) {
      const variants = expand(token);
      if ([...variants].some((v) => words.has(v))) { score += 2; hits.push(token); }
      else if ([...variants].some((v) => v.length > 3 && haystack.includes(v))) { score += 1; hits.push(token); }
      else if (/^\d{3}$/.test(token) && haystack.includes(token)) { score += 3; hits.push(token); }
    }
    if (!understood.length && floor !== null) score = 1;
    if (score > 0) matches.push({ place, score, reason: hits.length ? `matches ${hits.join(", ")}` : `on floor ${floor}` });
  }
  matches.sort((a, b) => b.score - a.score || (a.place.display_name ?? a.place.name).localeCompare(b.place.display_name ?? b.place.name));
  return { floor, matches: matches.slice(0, limit), understood };
}

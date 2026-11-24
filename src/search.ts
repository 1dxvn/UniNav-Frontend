// Campus search: runs in the browser, free and instant. It only returns places that exist in the API
// catalogue. The optional place guide (/campus/place-guide) adds reviewed categories, aliases and everyday
// needs ("tengo sed" → cafetería) and lists needs the map does not cover, so the answer can say so.
import type { Building } from "./api/types.ts";

export interface GuideCategory { label: string; priority: number; words: string[] }
export interface GuideNeed { words: string[]; categories: string[]; first?: string[] }
export interface GuideMissing { words: string[]; message: string; ask: string[] }
export interface GuidePlace { c: string; p: number; a?: string[]; s?: boolean }
export interface PlaceGuide {
  version: number;
  categories: Record<string, GuideCategory>;
  needs: Record<string, GuideNeed>;
  missing: Record<string, GuideMissing>;
  places: Record<string, GuidePlace>;
}
export const EMPTY_GUIDE: PlaceGuide = { version: 0, categories: {}, needs: {}, missing: {}, places: {} };
let activeGuide: PlaceGuide = EMPTY_GUIDE;
export function setPlaceGuide(guide: PlaceGuide | null | undefined): void {
  activeGuide = guide && guide.places ? guide : EMPTY_GUIDE;
  indexCache = new WeakMap();
}
export function placeGuide(): PlaceGuide { return activeGuide; }

export const HIDDEN_TYPES = new Set(["waypoint", "junction", "corridor", "reference"]);

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Built-in vocabulary, used with or without the guide. "aseo" is not a restroom in these drawings
// ("Aseo del bloque A" is the cleaning room), so it is not a synonym of baño.
const SYNONYMS: string[][] = [
  ["bano", "wc", "restroom", "toilet", "bathroom", "sanitario", "lavabo"],
  ["laboratorio", "lab", "laboratory"],
  ["aula", "salon", "clase", "classroom", "room"],
  ["informatica", "computo", "computacion", "computer", "computador", "sistemas"],
  ["simulacion", "simulation", "clinica", "clinical"],
  ["espera", "waiting", "sala"],
  ["ascensor", "elevator", "lift", "elevador"],
  ["escalera", "stairs", "stair", "grada"],
  ["entrada", "acceso", "entrance", "access", "hall"],
  ["investigacion", "research", "centro"],
  ["medicina", "medical", "medica"],
  ["morfologia", "morphology"],
  ["preclinica", "preclinic"],
  ["realidad", "mixta", "mixed", "reality"],
  ["biologia", "molecular", "biology"],
  ["icetex", "credito", "financiacion"],
  ["cafeteria", "cafe", "cafetin", "comida", "food", "comer"],
  ["biblioteca", "library", "hemeroteca"],
  ["oficina", "office"],
  ["mujer", "women", "woman", "dama", "female"],
  ["hombre", "men", "man", "caballero", "male"],
];
const STOP = new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "a", "en", "y", "o", "para", "por", "con", "donde", "esta", "estan",
  "queda", "quedan", "hay", "quiero", "ir", "necesito", "busco", "buscar", "como", "llego", "llegar", "me", "mi", "mis", "se", "que", "cual", "es", "lo", "le",
  "llevame", "lleva", "puedo", "puede", "favor", "porfa", "porfavor", "hola", "the", "an", "of", "to", "in", "on", "at", "where", "is", "are", "i", "want", "need",
  "go", "find", "how", "get", "please", "can", "take", "me", "my", "some", "any", "nearest", "closest", "near", "cerca", "cercano", "cercana", "mas", "proximo", "proxima", "aqui", "here"]);
const FLOOR_WORDS = new Set(["piso", "planta", "floor", "nivel", "level"]);
const NEAR = /\b(cerca|cercan[oa]s?|mas proxim[oa]|nearest|closest|near( me)?|nearby|al lado)\b/;

export function stem(word: string): string {
  if (word.length > 4 && /[rlndj]es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}
const synonymIndex = new Map<string, string[]>();
for (const group of SYNONYMS) for (const word of group) synonymIndex.set(stem(word), [...new Set([...(synonymIndex.get(stem(word)) ?? []), ...group.map(stem)])]);
function variants(token: string): string[] { const s = stem(token); return synonymIndex.get(s) ?? [s]; }

// Damerau–Levenshtein with a cut-off: 1 edit for 4–7 letters, 2 from 8 letters, none below 4.
export function closeEnough(a: string, b: string): boolean {
  const limit = Math.min(a.length, b.length) >= 8 ? 2 : Math.min(a.length, b.length) >= 4 ? 1 : 0;
  if (!limit || Math.abs(a.length - b.length) > limit) return false;
  let previous2: number[] = [], previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, previous2[j - 2] + 1);
      current.push(value); best = Math.min(best, value);
    }
    if (best > limit) return false;
    previous2 = previous; previous = current;
  }
  return previous[b.length] <= limit;
}

interface IndexedPlace {
  place: Building; name: string; nameWords: Set<string>; aliasWords: Set<string>; aliasText: string;
  categoryWords: Set<string>; extraWords: Set<string>; numbers: Set<string>; category: string; priority: number; supuesto: boolean;
  size: number; // meaningful words in the visible name
}
let indexCache = new WeakMap<Building[], IndexedPlace[]>();
const words = (text: string) => normalize(text).split(" ").filter(Boolean);
const stems = (text: string) => new Set(words(text).map(stem));

function indexPlaces(places: Building[]): IndexedPlace[] {
  const cached = indexCache.get(places);
  if (cached) return cached;
  const guide = activeGuide;
  const index = places.filter((place) => !HIDDEN_TYPES.has(place.building_type ?? "")).map((place) => {
    const entry = place.code ? guide.places[place.code] : undefined;
    const category = entry?.c ?? "";
    const name = normalize(`${place.display_name ?? ""} ${place.display_name ? "" : place.name}`);
    const aliasText = normalize((entry?.a ?? []).join(" "));
    return {
      place, name, nameWords: stems(`${place.display_name ?? ""} ${place.name}`), aliasWords: stems(aliasText), aliasText,
      categoryWords: stems((guide.categories[category]?.words ?? []).join(" ")),
      extraWords: stems(`${place.building_type ?? ""} ${place.faculty ?? ""} ${place.block_code ? `bloque ${place.block_code} block ${place.block_code}` : ""}`),
      numbers: new Set(words(`${place.display_name ?? ""} ${place.name}`).filter((w) => /^\d{2,4}$/.test(w))),
      category, priority: entry?.p ?? (place.building_type === "service" ? 1 : 2), supuesto: !!entry?.s,
      size: Math.max(1, words(place.display_name ?? place.name).filter((w) => w.length > 1 && !STOP.has(w)).length),
    };
  });
  indexCache.set(places, index);
  return index;
}

// "piso 3", "floor 3", "3er piso", "planta 0", "piso cero" -> floor filter
export function floorFilter(text: string): number | null {
  const named: Record<string, number> = { cero: 0, zero: 0, primer: 1, primero: 1, first: 1, segundo: 2, second: 2, tercer: 3, tercero: 3, third: 3, cuarto: 4, fourth: 4, quinto: 5, fifth: 5, sexto: 6, sixth: 6 };
  const match = text.match(/\b(?:piso|planta|floor|nivel|level)\s+(\d|cero|zero|primer|primero|segundo|tercer|tercero|cuarto|quinto|sexto|first|second|third|fourth|fifth|sixth)\b/) ??
    text.match(/\b(\d|cero|primer|primero|segundo|tercer|tercero|cuarto|quinto|sexto|first|second|third|fourth|fifth|sixth)(?:er|ro|do|to|o|st|nd|rd|th)?\s+(?:piso|planta|floor)\b/);
  if (!match) return null;
  return /^\d$/.test(match[1]) ? Number(match[1]) : named[match[1]] ?? null;
}
function blockFilter(text: string): string | null {
  const match = text.match(/\b(?:bloque|block|edificio|building)\s+([ab])\b/);
  return match ? match[1].toUpperCase() : null;
}
function phraseIn(text: string, phrase: string): boolean {
  const target = normalize(phrase);
  return !!target && (` ${text} `).includes(` ${target} `);
}

export interface SearchMatch { place: Building; score: number; reason: string; via: "name" | "need" | "category" | "fuzzy"; coverage: number }
export interface SearchAnswer {
  floor: number | null; block: string | null; matches: SearchMatch[]; understood: string[];
  need: string | null; near: boolean;
  missing: { message: string; ask: Building[] } | null;
  suggestion: string | null;
}
export interface SearchOptions { limit?: number; origin?: Building | null }

function distance(a: Building, b: Building): number {
  return Math.hypot(a.x - b.x, a.y - b.y) + Math.abs(a.floor - b.floor) * 25;
}

export function searchPlaces(question: string, places: Building[], options: SearchOptions = {}): SearchAnswer {
  const limit = options.limit ?? 5;
  const text = normalize(question);
  const floor = floorFilter(text), block = blockFilter(text), near = NEAR.test(text);
  const tokens = text.split(" ").filter((t) => t && !STOP.has(t) && !FLOOR_WORDS.has(t) && !/^\d$/.test(t) &&
    !["cero", "zero", "primer", "primero", "segundo", "tercer", "tercero", "cuarto", "quinto", "sexto", "bloque", "block"].includes(t) && !(block && t === block.toLowerCase()));
  const understood = [...new Set(tokens)];
  const numbers = understood.filter((t) => /^\d{2,4}$/.test(t));
  const guide = activeGuide;

  // Everyday needs and needs the map lacks, matched as whole words or phrases.
  let need: string | null = null, needSpec: GuideNeed | null = null;
  for (const [key, spec] of Object.entries(guide.needs)) if (spec.words.some((w) => phraseIn(text, w))) { need = key; needSpec = spec; break; }
  let missingKey: string | null = null;
  for (const [key, spec] of Object.entries(guide.missing)) if (spec.words.some((w) => phraseIn(text, w))) { missingKey = key; break; }
  const queryCategories = new Set<string>();
  for (const [key, category] of Object.entries(guide.categories)) if (category.words.some((w) => phraseIn(text, w))) queryCategories.add(key);
  const needWords = new Set((needSpec?.words ?? []).flatMap((w) => words(w)).map(stem));

  const scored: SearchMatch[] = [];
  for (const item of indexPlaces(places)) {
    const place = item.place;
    if (floor !== null && place.floor !== floor) continue;
    if (block && place.block_code && place.block_code !== block) continue;
    // A room number in the question must be in the place name ("aula 512" is not "Aula 608").
    if (numbers.length && !numbers.some((n) => item.numbers.has(n) || item.name.includes(n))) continue;
    let score = 0, via: SearchMatch["via"] = "name", named = 0, counted = 0;
    const hits: string[] = [];
    for (const token of understood) {
      if (/^\d{2,4}$/.test(token)) { counted++; if (item.numbers.has(token) || item.name.includes(token)) { score += 4; named++; hits.push(token); } continue; }
      if (needWords.has(stem(token))) continue; // handled as a need below
      counted++;
      const forms = variants(token);
      let best = 0;
      for (const v of forms) {
        if (item.nameWords.has(v)) best = Math.max(best, 3);
        else if (item.aliasWords.has(v)) best = Math.max(best, 2.5);
        else if (item.categoryWords.has(v)) best = Math.max(best, 1.6);
        else if (item.extraWords.has(v)) best = Math.max(best, 1);
        else if (v.length > 3 && (item.name.includes(v) || item.aliasText.includes(v))) best = Math.max(best, 1.2);
      }
      if (!best && token.length >= 4) {
        for (const word of [...item.nameWords, ...item.aliasWords]) if (closeEnough(stem(token), word)) { best = 2; via = "fuzzy"; break; }
      }
      // Start of a word, while typing or abbreviated: «hal» → hall, «bibl» → biblioteca.
      if (!best && token.length >= 3) for (const word of item.nameWords) if (word.length > token.length && word.startsWith(token)) { best = 2; break; }
      if (best) { score += best; hits.push(token); if (best >= 2) named++; }
    }
    // Tighter names first: «Hall de acceso» before «Baños del hall de acceso» for «hall de acceso».
    if (named) score += 2.5 * Math.min(1, named / item.size);
    // Whole-phrase bonus for several words; a single word only gets a small bonus when the name starts with it.
    const phraseWords = understood.filter((t) => !/^\d+$/.test(t));
    const phrase = phraseWords.join(" ");
    if (score > 0 && phraseWords.length > 1 && item.name.includes(phrase)) score += item.name.startsWith(phrase) ? 3 : 2;
    else if (score > 0 && phraseWords.length === 1 && phrase.length > 3 && item.name.startsWith(stem(phrase))) score += 1;
    if (needSpec && item.priority > 0) {
      const first = needSpec.first?.some((pattern) => item.name.includes(normalize(pattern)));
      if (first) { score += 6; via = "need"; }
      else if (needSpec.categories.includes(item.category)) { score += 3.5; via = "need"; }
    }
    if (queryCategories.has(item.category) && item.priority > 0) { score += 1.5; if (via === "name" && !hits.length) via = "category"; }
    if (!understood.length && !needSpec && floor !== null) score = 0.5;
    if (score <= 0) continue;
    // Technical rooms only when named explicitly; public places first.
    if (item.priority === 0 && (via !== "name" || score < 3)) continue;
    // Public places before staff or office ones, more so when the person asks for the nearest or a need.
    score += item.priority * (near || via === "need" || via === "category" || queryCategories.has(item.category) ? 1.2 : 0.6);
    if (options.origin) {
      const d = distance(options.origin, place);
      score += (near || via !== "name" || queryCategories.size ? 3 : 0.6) * Math.exp(-d / 45);
    }
    const reason = via === "need" ? "para lo que necesitas" : via === "fuzzy" ? `parecido a «${hits.join(", ")}»` :
      hits.length ? `coincide con ${hits.join(", ")}` : floor !== null ? `en el piso ${floor}` : "por su tipo";
    scored.push({ place, score, reason: item.supuesto ? `${reason} · por confirmar` : reason, via, coverage: counted ? named / counted : 0 });
  }
  // Places that match the words by name come first ("canchas" → the courts, not a nearby games room);
  // among equally named places the score decides (needs, proximity, public before private).
  scored.sort((a, b) => b.coverage - a.coverage || b.score - a.score || (a.place.display_name ?? a.place.name).localeCompare(b.place.display_name ?? b.place.name));

  let missing: SearchAnswer["missing"] = null;
  if (missingKey && (!scored.length || scored[0].via !== "name" || scored[0].score < 4)) {
    const spec = guide.missing[missingKey];
    const ask = spec.ask.map((pattern) => indexPlaces(places).find((item) => item.name.includes(normalize(pattern)))?.place).filter((p): p is Building => !!p);
    missing = { message: spec.message, ask };
  }
  let suggestion: string | null = null;
  if (!scored.length && understood.length) {
    const vocabulary = new Map<string, string>();
    for (const item of indexPlaces(places)) for (const word of words(item.place.display_name ?? item.place.name)) if (word.length >= 4) vocabulary.set(stem(word), word);
    const fixed = understood.map((token) => [...vocabulary].find(([key]) => closeEnough(stem(token), key))?.[1] ?? token);
    if (fixed.join(" ") !== understood.join(" ")) suggestion = fixed.join(" ");
  }
  return { floor, block, matches: missing && !scored.length ? [] : scored.slice(0, limit), understood, need, near, missing, suggestion };
}

// "estoy en la cafetería", "estoy junto al aula 201", "veo el hall", "I'm at the library" -> the place words.
const LOCATION_PHRASE = /^(?:(?:ahora |ya )?(?:estoy|me encuentro|ando|quede|me quede)(?: (?:en|junto a|junto al|al lado de|al lado del|cerca de|cerca del|frente a|frente al|dentro de|afuera de|por|entre))?|(?:estoy viendo|veo|llegue a|llegue al)|(?:i am|i m|im)(?: (?:at|in|near|next to|by|outside))?|(?:near|at|next to|by))\b\s*/;
export function locationQuery(question: string): string {
  const text = normalize(question).replace(LOCATION_PHRASE, "").replace(/^(el|la|los|las|un|una|the|a)\s+/, "");
  return text || normalize(question);
}

export function nearestOfCategory(places: Building[], category: string, from: Building, limit = 3): Building[] {
  return indexPlaces(places).filter((item) => item.category === category && item.priority > 0)
    .sort((a, b) => distance(from, a.place) - distance(from, b.place)).slice(0, limit).map((item) => item.place);
}
export function categoryOf(place: Building): string {
  return place.code ? activeGuide.places[place.code]?.c ?? "" : "";
}

// Campus assistant: a free, local conversational guide (no generative provider, no API key, no cost).
// It understands needs and follow-ups in Spanish or English and answers only with places that exist in the
// API catalogue (search.ts). Actions such as "route" or "locate" carry place ids chosen by the code, never text.
import type { Building } from "./api/types.ts";
import type { RouteInstruction } from "./routeInstructions.ts";
import { categoryOf, locationQuery, nearestOfCategory, normalize, searchPlaces, type SearchMatch } from "./search.ts";

export { normalize } from "./search.ts";

export interface AssistantMatch { place: Building; score: number; reason: string }
export interface AssistantAnswer { floor: number | null; matches: AssistantMatch[]; understood: string[] }

// One-shot search, kept for the search bar and older callers.
export function askCampus(question: string, places: Building[], limit = 5, origin?: Building | null): AssistantAnswer {
  const answer = searchPlaces(question, places, { limit, origin });
  return { floor: answer.floor, matches: answer.matches.map(({ place, score, reason }) => ({ place, score, reason })), understood: answer.understood };
}

export type AssistantAction =
  | { kind: "route"; place: Building }
  | { kind: "locate"; place: Building }
  | { kind: "avoid-stairs"; value: boolean }
  | { kind: "mode"; mode: "comfortable" | "shortest" }
  | { kind: "alternatives" };
export interface AssistantPlace { place: Building; detail: string }
export interface AssistantReply { text: string; places: AssistantPlace[]; actions: AssistantAction[]; lang: "es" | "en"; suggestions: string[] }
export interface AssistantRoute { instructions: RouteInstruction[]; active: number; remaining: number | null; points: Building[] }
export interface AssistantContext {
  places: Building[];
  // Places where the person can be located (connected and navigable); defaults to all places.
  locatable?: Building[];
  here: Building | null;
  destination: Building | null;
  route: AssistantRoute | null;
  avoidStairs: boolean;
  floorName(level: number): string;
}

const EN_WORDS = /\b(where|how|take|restroom|bathroom|toilet|nearest|closest|floor|lost|thanks|thank|hello|hi|next|repeat|far|stairs|elevator|library|eat|drink|room|want|need|please|what|which|the)\b/g;
const ES_WORDS = /\b(donde|como|llevame|bano|piso|perdido|gracias|hola|siguiente|repite|falta|escaleras|ascensor|biblioteca|comer|quiero|necesito|que|cual|el|la|los|las|estoy|hay)\b/g;
function language(text: string): "es" | "en" {
  return (text.match(EN_WORDS)?.length ?? 0) > (text.match(ES_WORDS)?.length ?? 0) ? "en" : "es";
}
const said = (text: string, pattern: RegExp) => pattern.test(text);
const P = {
  greet: /^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey|hello|hi|que tal|saludos)\b/,
  thanks: /\b(gracias|muchas gracias|thanks|thank you|genial|perfecto|listo)\b/,
  help: /\b(ayuda|ayudame|que puedes hacer|como funciona|que sabes hacer|help|what can you do)\b/,
  lost: /\b(estoy perdid[oa]|me perdi|no se donde estoy|i m lost|im lost|i am lost|lost)\b/,
  here: /\b(estoy en|estoy junto a|estoy al lado de|estoy cerca de|estoy frente a|acabo de llegar a|ahora estoy en|i am at|i m at|im at|i am near|i m near|i am next to)\b\s*(.*)$/,
  see: /\b(veo|estoy viendo|i see|i can see)\s+(.*)$/,
  remaining: /\b(cuanto (me )?falta|cuanto queda|cuanto demoro|how far|how long|how much longer)\b/,
  next: /\b(siguiente|que sigue|y ahora|ahora que|y despues|que hago|next|what now|then what|what next)\b/,
  repeat: /\b(repite|repitelo|repetir|otra vez|de nuevo|repeat|say again)\b/,
  noStairs: /\b(sin escaleras|no (puedo|quiero) (subir|usar|bajar) escaleras|silla de ruedas|movilidad reducida|accesible|muletas|coche de bebe|maleta pesada|wheelchair|no stairs|without stairs|accessible|step free)\b/,
  stairsOk: /\b(con escaleras|puedo (usar|subir) escaleras|escaleras esta bien|stairs are fine|use stairs)\b/,
  shortest: /\b(mas corta|mas corto|mas rapid[oa]|lo mas rapido|shortest|fastest|quickest)\b/,
  comfortable: /\b(mas comod[oa]|comod[oa]|menos esfuerzo|mas facil|comfortable|easier|easiest)\b/,
  other: /\b(otra ruta|otro camino|otra forma|alternativa|alternativas|another route|other way|alternative|different route)\b/,
  onTheWay: /\b(en el camino|por el camino|de paso|on the way|along the way)\b/,
  go: /\b(llevame|lleva me|como llego|como voy|como llegar|quiero ir|ir a|vamos a|guiame|take me|how do i get|guide me|navigate|route to|go to)\b/,
  where: /\b(donde (queda|esta|estan|hay|encuentro)|en que piso|where is|where are|where can i)\b/,
  floorInfo: /\b(que hay en el|que hay en la|whats on|what is on|what s on)\b/,
};
const ORDINALS: [RegExp, number][] = [
  [/^(el |la )?(primer[oa]?|1|uno|una|first)( (opcion|lugar|one))?$/, 0], [/^(el |la )?(segund[oa]|2|dos|second)( (opcion|lugar|one))?$/, 1],
  [/^(el |la )?(tercer[oa]?|3|tres|third)( (opcion|lugar|one))?$/, 2], [/^(ese|esa|ese mismo|esa misma|ahi|alli|that one|there|that)$/, 0],
];

function approxDistance(a: Building, b: Building): number { return Math.hypot(a.x - b.x, a.y - b.y) + Math.abs(a.floor - b.floor) * 25; }
const nameOf = (place: Building) => place.display_name ?? place.name;

export class CampusAssistant {
  private lastResults: Building[] = [];

  reply(message: string, context: AssistantContext): AssistantReply {
    const text = normalize(message);
    const lang = language(text);
    const t = (es: string, en: string) => (lang === "en" ? en : es);
    const out = (reply: string, places: AssistantPlace[] = [], actions: AssistantAction[] = [], suggestions: string[] = []): AssistantReply =>
      ({ text: reply, places, actions, lang, suggestions });
    const detail = (place: Building, reason?: string) => {
      const parts = [place.block_code ? `${t("Bloque", "Block")} ${place.block_code}` : "", context.floorName(place.floor)];
      if (context.here && context.here.id !== place.id) parts.push(`${t("a unos", "about")} ${Math.round(approxDistance(context.here, place) / 5) * 5} m`);
      if (reason) parts.push(reason);
      return parts.filter(Boolean).join(" · ");
    };
    const remember = (places: Building[]) => { if (places.length) this.lastResults = places; };
    const routeTo = (place: Building): AssistantAction[] => [{ kind: "route", place }];

    if (!text) return out(t("Cuéntame qué buscas o a dónde quieres ir.", "Tell me what you are looking for or where you want to go."), [], [], this.examples(lang));
    const words = text.split(" ");
    if (said(text, P.greet) && words.length <= 4) return out(t(
      "¡Hola! Soy el asistente de UniNav. Puedo encontrar lugares, llevarte paso a paso y ayudarte si te pierdes. ¿A dónde vas?",
      "Hi! I'm the UniNav assistant. I can find places, guide you step by step and help if you get lost. Where are you going?"), [], [], this.examples(lang));
    if (said(text, P.thanks) && words.length <= 4) return out(t("¡Con gusto! Si necesitas algo más, aquí estoy.", "You're welcome! I'm here if you need anything else."));
    if (said(text, P.help)) return out(t(
      "Puedes pedirme cosas como: «llévame al aula 512», «¿dónde hay un baño cerca?», «tengo hambre», «sin escaleras», «¿cuánto falta?» o «estoy en la cafetería».",
      "Try: “take me to room 512”, “nearest restroom”, “I'm hungry”, “no stairs”, “how far is it?” or “I'm at the cafeteria”."), [], [], this.examples(lang));

    // Where am I / I'm lost
    const here = text.match(P.here) ?? text.match(P.see);
    if (here && here[2]?.trim()) {
      const found = searchPlaces(locationQuery(here[2]), context.locatable?.length ? context.locatable : context.places, { limit: 3, origin: context.here });
      const best = found.matches[0]?.place;
      if (best) {
        remember(found.matches.map((m) => m.place));
        const recalc = context.destination && context.destination.id !== best.id ? routeTo(context.destination) : [];
        return out(t(`Listo, te ubiqué en ${nameOf(best)} (${context.floorName(best.floor)}).${recalc.length ? " Recalculo tu ruta desde ahí." : ""}`,
          `Got it, you're at ${nameOf(best)} (${context.floorName(best.floor)}).${recalc.length ? " Recalculating your route from there." : ""}`),
          [], [{ kind: "locate", place: best }, ...recalc]);
      }
      return out(t(`No encontré «${here[2]}» en el mapa. Dime el nombre de un aula, un baño o un hall que tengas cerca.`,
        `I couldn't find “${here[2]}” on the map. Tell me a nearby classroom, restroom or hall.`));
    }
    if (said(text, P.lost)) {
      const nearby = context.here ? context.places.filter((p) => p.floor === context.here!.floor && p.id !== context.here!.id && categoryOf(p) && categoryOf(p) !== "tecnico")
        .sort((a, b) => approxDistance(context.here!, a) - approxDistance(context.here!, b)).slice(0, 3) : [];
      remember(nearby);
      return out(t("Tranquilo, te ayudo. ¿Qué ves cerca? Escribe, por ejemplo, «estoy en la cafetería» o «veo el aula 201».",
        "No worries. What can you see nearby? Write, for example, “I'm at the cafeteria” or “I see room 201”."),
        nearby.map((place) => ({ place, detail: detail(place, t("cerca de tu última ubicación", "near your last position")) })));
    }

    // Following a route
    const route = context.route;
    if (said(text, P.remaining)) {
      if (!route || route.remaining === null) return out(t("No tienes una ruta activa. Dime a dónde quieres ir.", "You don't have an active route. Tell me where you want to go."));
      if (route.remaining < 1) return out(t(`Ya llegaste${context.destination ? ` a ${nameOf(context.destination)}` : ""}.`, `You have arrived${context.destination ? ` at ${nameOf(context.destination)}` : ""}.`));
      const minutes = Math.max(1, Math.round(route.remaining / 1.25 / 60));
      const current = route.instructions[Math.max(0, route.active)];
      return out(t(`Te faltan unos ${Math.round(route.remaining)} m (≈ ${minutes} min).${current ? ` Ahora: ${current.cue}.` : ""}`,
        `About ${Math.round(route.remaining)} m to go (≈ ${minutes} min).${current ? ` Now: ${current.cue}.` : ""}`));
    }
    if (said(text, P.next) || said(text, P.repeat)) {
      if (!route || !route.instructions.length) return out(t("No tienes una ruta activa. Dime a dónde quieres ir.", "You don't have an active route. Tell me where you want to go."));
      const index = Math.min(route.instructions.length - 1, Math.max(0, route.active) + (said(text, P.next) && route.active >= 0 ? 1 : 0));
      const step = route.instructions[index];
      return out(t(`Paso ${index + 1} de ${route.instructions.length}: ${step.cue}.`, `Step ${index + 1} of ${route.instructions.length}: ${step.cue}.`));
    }
    if (said(text, P.noStairs)) {
      const actions: AssistantAction[] = [{ kind: "avoid-stairs", value: true }, ...(context.destination ? routeTo(context.destination) : [])];
      return out(t("Entendido: busco rutas sin escaleras. Entre pisos uso el ascensor del bloque A (hall de ascensores).",
        "Understood: I'll look for routes without stairs, using the Block A elevators between floors."), [], actions);
    }
    if (said(text, P.stairsOk)) return out(t("Perfecto, vuelvo a incluir las escaleras.", "OK, stairs are allowed again."), [],
      [{ kind: "avoid-stairs", value: false }, ...(context.destination ? routeTo(context.destination) : [])]);
    if (said(text, P.shortest) || said(text, P.comfortable)) {
      const mode = said(text, P.shortest) ? "shortest" : "comfortable";
      return out(mode === "shortest" ? t("Uso la ruta más corta en metros.", "Using the shortest route in metres.") :
        t("Uso la ruta más cómoda: menos escaleras y lo que otras personas recomendaron.", "Using the most comfortable route: fewer stairs and what other people recommended."),
        [], [{ kind: "mode", mode }, ...(context.destination ? routeTo(context.destination) : [])]);
    }
    if (said(text, P.other)) {
      if (!context.destination) return out(t("Primero dime a dónde quieres ir.", "First tell me where you want to go."));
      return out(t("Te muestro las opciones de ruta en la tarjeta de tu recorrido.", "Here are the route options, in your route card."), [], [{ kind: "alternatives" }]);
    }
    if (said(text, P.onTheWay) && route?.points.length) {
      const query = text.replace(P.onTheWay, " ");
      const found = searchPlaces(query, context.places, { limit: 40 });
      const onRoute = found.matches.map((match) => ({ match, gap: Math.min(...route.points.filter((p) => p.floor === match.place.floor).map((p) => Math.hypot(p.x - match.place.x, p.y - match.place.y)), Infinity) }))
        .filter((item) => item.gap <= 20).sort((a, b) => a.gap - b.gap).slice(0, 3);
      remember(onRoute.map((item) => item.match.place));
      if (onRoute.length) return out(t("Esto queda en tu camino:", "This is on your way:"),
        onRoute.map((item) => ({ place: item.match.place, detail: detail(item.match.place, `${t("a", "")} ${Math.round(item.gap)} m ${t("de la ruta", "from the route")}`.trim()) })));
      return out(t("No encontré eso junto a tu ruta. Te muestro lo más cercano:", "I didn't find that next to your route. Here is the closest:"),
        found.matches.slice(0, 3).map((m) => ({ place: m.place, detail: detail(m.place, m.reason) })));
    }

    // Choosing one of the previous results
    for (const [pattern, index] of ORDINALS) {
      const bare = text.replace(P.go, "").trim();
      if (pattern.test(bare) && this.lastResults[index]) {
        const place = this.lastResults[index];
        return out(t(`Vamos a ${nameOf(place)} (${context.floorName(place.floor)}).`, `Heading to ${nameOf(place)} (${context.floorName(place.floor)}).`), [], routeTo(place));
      }
    }

    if (said(text, P.floorInfo)) {
      const found = searchPlaces(message, context.places, { limit: 50 });
      if (found.floor !== null) {
        const places = context.places.filter((p) => p.floor === found.floor && ["aula", "laboratorio", "bano", "comida", "biblioteca", "salud", "servicios", "tramites", "deporte", "bienestar", "estudio"].includes(categoryOf(p)));
        const picked = places.sort((a, b) => nameOf(a).localeCompare(nameOf(b))).slice(0, 8);
        remember(picked);
        return out(t(`En el ${context.floorName(found.floor).toLowerCase()} hay ${places.length} lugares con nombre. Algunos:`, `${context.floorName(found.floor)} has ${places.length} named places. Some of them:`),
          picked.map((place) => ({ place, detail: detail(place) })));
      }
    }

    // Default: understand the request as a search (needs, categories, names, typos, nearest).
    const query = text.replace(P.go, " ").replace(P.where, " ");
    const found = searchPlaces(query, context.places, { limit: 5, origin: context.here });
    if (found.missing && !found.matches.length) {
      remember(found.missing.ask);
      return out(found.missing.message + (found.missing.ask.length ? t(" Puedes preguntar en:", " You can ask at:") : ""),
        found.missing.ask.map((place) => ({ place, detail: detail(place) })));
    }
    if (!found.matches.length) {
      return out(found.suggestion ? t(`No encontré «${found.understood.join(" ")}». ¿Quisiste decir «${found.suggestion}»?`, `I couldn't find “${found.understood.join(" ")}”. Did you mean “${found.suggestion}”?`) :
        t("No encontré ese lugar en el mapa. Prueba con el nombre de un aula, un servicio o un piso.", "I couldn't find that place on the map. Try a classroom, a service or a floor."),
        [], [], found.suggestion ? [found.suggestion] : this.examples(lang));
    }
    const matches: SearchMatch[] = found.matches;
    remember(matches.map((m) => m.place));
    const best = matches[0], phrase = found.understood.filter((word) => !/^\d+$/.test(word)).join(" ");
    const clear = matches.length === 1 || best.score - matches[1].score >= 1.5 || best.coverage > matches[1].coverage ||
      (phrase.length > 3 && normalize(nameOf(best.place)).startsWith(phrase) && !normalize(nameOf(matches[1].place)).startsWith(phrase));
    if (said(text, P.go) && clear) {
      return out(t(`Te llevo a ${nameOf(best.place)} (${detail(best.place)}).`, `Taking you to ${nameOf(best.place)} (${detail(best.place)}).`),
        [{ place: best.place, detail: detail(best.place, best.reason) }], routeTo(best.place));
    }
    const intro = found.need ? t("Para eso te sirve:", "This should help:") :
      found.near || context.here ? t("Lo más cercano que encontré:", "The closest I found:") : t("Encontré esto:", "Here's what I found:");
    const extra = found.missing ? ` ${found.missing.message}` : "";
    return out(intro + extra, matches.map((m) => ({ place: m.place, detail: detail(m.place, m.reason) })));
  }

  examples(lang: "es" | "en"): string[] {
    return lang === "en" ? ["Nearest restroom", "I'm hungry", "Take me to the library", "No stairs"]
      : ["Baño más cercano", "Tengo hambre", "Llévame a la biblioteca", "Sin escaleras"];
  }

  // Exposed for the route card: closest places of the same category as a destination.
  similar(place: Building, places: Building[]): Building[] {
    const category = categoryOf(place);
    return category ? nearestOfCategory(places, category, place, 4).filter((p) => p.id !== place.id) : [];
  }
}

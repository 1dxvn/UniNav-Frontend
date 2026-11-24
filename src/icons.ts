// Icons of the app: stroke SVG symbols defined once in index.html (<svg class="icon-library">), used by
// reference. Never emoji or text symbols, so they look the same on every device and follow the text colour.
import type { Building } from "./api/types.ts";
import { categoryOf } from "./search.ts";

export type IconName =
  | "search" | "route" | "grid" | "close" | "fit" | "map" | "user" | "layers" | "location"
  | "arrow-right" | "arrow-left" | "arrow-up-right" | "chevron-down" | "chevron-up" | "check" | "pause" | "plus" | "minus"
  | "volume" | "thumbs-up" | "thumbs-down" | "origin" | "sliders" | "dots-vertical" | "walk" | "sparkle" | "clock" | "flag"
  | "users" | "shield" | "send" | "external" | "room" | "stairs" | "elevator" | "restroom" | "cup" | "book" | "board"
  | "flask" | "cross" | "heart" | "ball" | "briefcase" | "info" | "door" | "tree" | "stethoscope" | "store" | "wrench";

const SVG_NS = "http://www.w3.org/2000/svg";

export function icon(name: IconName, extraClass = ""): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", extraClass ? `icon ${extraClass}` : "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

// Text plus icon for a button or link; the icon is decorative, so the accessible name is the text.
export function setLabel(target: HTMLElement, text: string, name?: IconName, before = false): void {
  if (!name) { target.replaceChildren(text); return; }
  target.replaceChildren(...(before ? [icon(name), ` ${text}`] : [`${text} `, icon(name)]));
}
export function labelled(text: string, name: IconName, before = false): (Node | string)[] {
  return before ? [icon(name), ` ${text}`] : [`${text} `, icon(name)];
}

const CATEGORY_ICONS: Record<string, IconName> = {
  bano: "restroom", comida: "cup", biblioteca: "book", estudio: "book", aula: "board", laboratorio: "flask",
  salud: "cross", bienestar: "heart", deporte: "ball", tramites: "briefcase", docentes: "users", servicios: "info",
  ascensor: "elevator", escalera: "stairs", acceso: "door", zona_comun: "tree", clinica: "stethoscope", local: "store",
  tecnico: "wrench",
};
const TYPE_ICONS: Record<string, IconName> = {
  stairs: "stairs", elevator: "elevator", classroom: "board", laboratory: "flask", library: "book", entrance: "door",
};

// One recognisable icon per kind of place (from the reviewed place guide, else from the API type).
export function placeIcon(place: Building): IconName {
  return CATEGORY_ICONS[categoryOf(place)] ?? TYPE_ICONS[place.building_type ?? ""] ?? "room";
}

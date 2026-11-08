// Minimap (Plan 1 §11, "Mapa"), drawn as SVG: a top view of the observed floor, coordinated with the 3D view. It draws the floor's
// walkable graph, its places, the active route on that floor, the destination and the avatar with its heading.
// Plan coordinates: API (x, y) with +y up (the drawing axis, not geographic north); scene positions are (x, h, -y).
import type { Building, CampusPath } from "./api/types.ts";

const HIDDEN = new Set(["waypoint", "junction", "corridor", "reference"]);
export interface MinimapBounds { minX: number; maxX: number; minY: number; maxY: number }

export function floorBounds(places: Building[], floor: number, margin = 3): MinimapBounds | null {
  const own = places.filter((p) => p.floor === floor && p.building_type !== "reference");
  if (!own.length) return null;
  const xs = own.map((p) => p.x), ys = own.map((p) => p.y);
  return { minX: Math.min(...xs) - margin, maxX: Math.max(...xs) + margin, minY: Math.min(...ys) - margin, maxY: Math.max(...ys) + margin };
}

// Uniform scale so plan metres are not distorted; +y drawn upwards.
export function planToCanvas(bounds: MinimapBounds, width: number, height: number, pad = 10) {
  const scale = Math.min((width - 2 * pad) / Math.max(bounds.maxX - bounds.minX, 1), (height - 2 * pad) / Math.max(bounds.maxY - bounds.minY, 1));
  const ox = (width - scale * (bounds.maxX - bounds.minX)) / 2, oy = (height - scale * (bounds.maxY - bounds.minY)) / 2;
  return {
    scale,
    toCanvas: (x: number, y: number): [number, number] => [ox + (x - bounds.minX) * scale, height - oy - (y - bounds.minY) * scale],
    toPlan: (cx: number, cy: number): [number, number] => [bounds.minX + (cx - ox) / scale, bounds.minY + (height - oy - cy) / scale],
  };
}

export class Minimap {
  private places: Building[] = [];
  private paths: CampusPath[] = [];
  private route: Building[] = [];
  private floor = 0;
  private avatar: { x: number; y: number; floor: number; heading: number } | null = null;
  private destination: Building | null = null;
  private frame = 0;
  // SVG, not a second <canvas>: the 3D view stays the page's only canvas.
  private readonly svg: SVGSVGElement;
  private readonly onPick: (place: Building) => void;

  constructor(svg: SVGSVGElement, onPick: (place: Building) => void) {
    this.svg = svg; this.onPick = onPick;
    svg.addEventListener("click", (event) => {
      const bounds = floorBounds(this.places, this.floor); if (!bounds) return;
      const rect = svg.getBoundingClientRect(), map = planToCanvas(bounds, rect.width, rect.height);
      const [x, y] = map.toPlan(event.clientX - rect.left, event.clientY - rect.top);
      let best: Building | null = null, distance = 2.5;
      for (const p of this.places) if (p.floor === this.floor && !HIDDEN.has(p.building_type ?? "")) {
        const d = Math.hypot(p.x - x, p.y - y); if (d < distance) { distance = d; best = p; }
      }
      if (best) this.onPick(best);
    });
  }
  setCampus(places: Building[], paths: CampusPath[]): void { this.places = places; this.paths = paths; this.route = []; this.request(); }
  setFloor(floor: number): void { this.floor = floor; this.svg.dataset.floor = String(floor); this.request(); }
  setRoute(route: Building[] | null): void { this.route = route ?? []; this.request(); }
  setDestination(place: Building | null): void { this.destination = place; this.request(); }
  setAvatar(position: [number, number, number], floor: number): void {
    const x = position[0], y = -position[2], previous = this.avatar;
    const moved = previous && Math.hypot(x - previous.x, y - previous.y) > 0.02;
    const heading = moved ? Math.atan2(y - previous!.y, x - previous!.x) : previous?.heading ?? Math.PI / 2;
    if (previous && !moved && previous.floor === floor) return;
    this.avatar = { x, y, floor, heading };
    this.svg.dataset.avatar = `${x.toFixed(2)},${y.toFixed(2)},${floor}`;
    this.request();
  }
  private request(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.draw(); }); }
  private node<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  }
  draw(): void {
    const rect = this.svg.getBoundingClientRect(), width = Math.max(rect.width, 1), height = Math.max(rect.height, 1);
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const bounds = floorBounds(this.places, this.floor), parts: SVGElement[] = [];
    this.svg.dataset.routePoints = String(this.route.filter((p) => p.floor === this.floor).length);
    if (!bounds) {
      const t = this.node("text", { x: 10, y: height / 2, fill: "#7a857d", "font-size": 11 }); t.textContent = "No mapped places on this floor";
      this.svg.replaceChildren(this.title(), t); return;
    }
    const map = planToCanvas(bounds, width, height), byId = new Map(this.places.map((p) => [p.id, p]));
    const f = (v: number) => v.toFixed(1);
    let graph = "";
    for (const path of this.paths) {
      const a = byId.get(path.source_id), b = byId.get(path.target_id);
      if (!a || !b || a.floor !== this.floor || b.floor !== this.floor) continue;
      const [ax, ay] = map.toCanvas(a.x, a.y), [bx, by] = map.toCanvas(b.x, b.y); graph += `M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}`;
    }
    parts.push(this.node("path", { d: graph, stroke: "#c9d4c3", "stroke-width": 2, "stroke-linecap": "round", fill: "none" }));
    const onFloor = this.route.filter((p) => p.floor === this.floor);
    if (onFloor.length > 1) parts.push(this.node("polyline", { points: onFloor.map((p) => map.toCanvas(p.x, p.y).map(f).join(",")).join(" "), stroke: "#16846c", "stroke-width": 3.5, "stroke-linejoin": "round", fill: "none" }));
    for (const p of this.places) {
      if (p.floor !== this.floor || HIDDEN.has(p.building_type ?? "")) continue;
      const [x, y] = map.toCanvas(p.x, p.y); parts.push(this.node("circle", { cx: f(x), cy: f(y), r: 3, fill: "#315e50" }));
    }
    if (this.destination && this.destination.floor === this.floor) {
      const [x, y] = map.toCanvas(this.destination.x, this.destination.y);
      parts.push(this.node("circle", { cx: f(x), cy: f(y), r: 7, fill: "none", stroke: "#0e8b75", "stroke-width": 2.5 }));
    }
    if (this.avatar && this.avatar.floor === this.floor) {
      const [x, y] = map.toCanvas(this.avatar.x, this.avatar.y), h = -this.avatar.heading;
      const pts = [[x + Math.cos(h) * 8, y + Math.sin(h) * 8], [x + Math.cos(h + 2.5) * 5, y + Math.sin(h + 2.5) * 5], [x + Math.cos(h - 2.5) * 5, y + Math.sin(h - 2.5) * 5]];
      parts.push(this.node("polygon", { points: pts.map((q) => q.map(f).join(",")).join(" "), fill: "#e4823b", stroke: "#fff", "stroke-width": 1.2 }));
    }
    this.svg.replaceChildren(this.title(), ...parts);
  }
  private title(): SVGTitleElement {
    const title = this.node("title", {}); title.textContent = "Minimap · click a place to choose it"; return title;
  }
}

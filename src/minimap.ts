// Minimap (Plan 1 §11, "Mapa"): a top view of the observed floor, coordinated with the 3D view. It draws the floor's
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
  private readonly canvas: HTMLCanvasElement;
  private readonly onPick: (place: Building) => void;

  constructor(canvas: HTMLCanvasElement, onPick: (place: Building) => void) {
    this.canvas = canvas; this.onPick = onPick;
    canvas.addEventListener("click", (event) => {
      const bounds = floorBounds(this.places, this.floor); if (!bounds) return;
      const rect = canvas.getBoundingClientRect(), map = planToCanvas(bounds, rect.width, rect.height);
      const [x, y] = map.toPlan(event.clientX - rect.left, event.clientY - rect.top);
      let best: Building | null = null, distance = 2.5;
      for (const p of this.places) if (p.floor === this.floor && !HIDDEN.has(p.building_type ?? "")) {
        const d = Math.hypot(p.x - x, p.y - y); if (d < distance) { distance = d; best = p; }
      }
      if (best) this.onPick(best);
    });
  }
  setCampus(places: Building[], paths: CampusPath[]): void { this.places = places; this.paths = paths; this.route = []; this.request(); }
  setFloor(floor: number): void { this.floor = floor; this.canvas.dataset.floor = String(floor); this.request(); }
  setRoute(route: Building[] | null): void { this.route = route ?? []; this.request(); }
  setDestination(place: Building | null): void { this.destination = place; this.request(); }
  setAvatar(position: [number, number, number], floor: number): void {
    const x = position[0], y = -position[2], previous = this.avatar;
    const moved = previous && Math.hypot(x - previous.x, y - previous.y) > 0.02;
    const heading = moved ? Math.atan2(y - previous!.y, x - previous!.x) : previous?.heading ?? Math.PI / 2;
    if (previous && !moved && previous.floor === floor) return;
    this.avatar = { x, y, floor, heading };
    this.canvas.dataset.avatar = `${x.toFixed(2)},${y.toFixed(2)},${floor}`;
    this.request();
  }
  private request(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.draw(); }); }
  draw(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, 2), rect = this.canvas.getBoundingClientRect();
    const width = Math.max(rect.width, 1), height = Math.max(rect.height, 1);
    if (this.canvas.width !== Math.round(width * ratio)) { this.canvas.width = Math.round(width * ratio); this.canvas.height = Math.round(height * ratio); }
    const ctx = this.canvas.getContext("2d"); if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
    const bounds = floorBounds(this.places, this.floor);
    this.canvas.dataset.routePoints = String(this.route.filter((p) => p.floor === this.floor).length);
    if (!bounds) { ctx.fillStyle = "#7a857d"; ctx.font = "11px sans-serif"; ctx.fillText("No mapped places on this floor", 10, height / 2); return; }
    const map = planToCanvas(bounds, width, height), byId = new Map(this.places.map((p) => [p.id, p]));
    ctx.lineCap = "round"; ctx.strokeStyle = "#c9d4c3"; ctx.lineWidth = 2;
    for (const path of this.paths) {
      const a = byId.get(path.source_id), b = byId.get(path.target_id);
      if (!a || !b || a.floor !== this.floor || b.floor !== this.floor) continue;
      ctx.beginPath(); ctx.moveTo(...map.toCanvas(a.x, a.y)); ctx.lineTo(...map.toCanvas(b.x, b.y)); ctx.stroke();
    }
    const onFloor = this.route.filter((p) => p.floor === this.floor);
    if (onFloor.length > 1) {
      ctx.strokeStyle = "#16846c"; ctx.lineWidth = 3.5; ctx.beginPath();
      onFloor.forEach((p, i) => { const [x, y] = map.toCanvas(p.x, p.y); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
    }
    for (const p of this.places) {
      if (p.floor !== this.floor || HIDDEN.has(p.building_type ?? "")) continue;
      const [x, y] = map.toCanvas(p.x, p.y); ctx.fillStyle = "#315e50"; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    if (this.destination && this.destination.floor === this.floor) {
      const [x, y] = map.toCanvas(this.destination.x, this.destination.y);
      ctx.strokeStyle = "#0e8b75"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
    }
    if (this.avatar && this.avatar.floor === this.floor) {
      const [x, y] = map.toCanvas(this.avatar.x, this.avatar.y), h = -this.avatar.heading;
      ctx.fillStyle = "#e4823b"; ctx.beginPath();
      ctx.moveTo(x + Math.cos(h) * 8, y + Math.sin(h) * 8); ctx.lineTo(x + Math.cos(h + 2.5) * 5, y + Math.sin(h + 2.5) * 5); ctx.lineTo(x + Math.cos(h - 2.5) * 5, y + Math.sin(h - 2.5) * 5);
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.stroke();
    }
  }
}

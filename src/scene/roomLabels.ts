import { OrthographicCamera, Vector3 } from "three";
import type { Building } from "../api/types.ts";
import { orientationSymbol, presentRoomLabel, type RoomLabelDisplay } from "./roomLabelPolicy.ts";

export interface RoomAnnotation {
  code: string; floor: number; text: string; shortText: string; referenceName: string;
  status: "confirmed" | "provisional" | "unlabelled";
  anchor: [number, number, number]; bounds: [number, number, number, number]; area: number;
  placeCode: string | null; accessPending: boolean; source: string; sourceText: string[];
  relatedPlaceCodes?: string[];
}
export function parseRoomLabels(value: unknown): RoomAnnotation[] {
  const data = value as { version?: number; campus?: string; labels?: RoomAnnotation[] } | null;
  if (data?.version !== 1 || data.campus !== "ucc-pasto" || !Array.isArray(data.labels)) throw new Error("Catálogo de nombres no válido.");
  const codes = new Set<string>();
  const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
  for (const r of data.labels) {
    if (!r || !/^P[0-6]-R\d{3}$/.test(r.code) || codes.has(r.code) || !Number.isInteger(r.floor) || r.floor<0 || r.floor>6 ||
      !r.code.startsWith(`P${r.floor}-`) || !text(r.text) || !text(r.shortText) || !text(r.referenceName) || !text(r.source) ||
      !["confirmed", "provisional", "unlabelled"].includes(r.status) ||
      !Array.isArray(r.anchor) || r.anchor.length !== 3 || !r.anchor.every(Number.isFinite) ||
      !Array.isArray(r.bounds) || r.bounds.length !== 4 || !r.bounds.every(Number.isFinite) ||
      r.bounds[2] <= r.bounds[0] || r.bounds[3] <= r.bounds[1] || !Number.isFinite(r.area) || r.area <= 0 ||
      !(r.placeCode === null || text(r.placeCode)) || typeof r.accessPending !== "boolean" ||
      (r.accessPending && r.placeCode !== null) || !Array.isArray(r.sourceText) || !r.sourceText.every(text) ||
      (r.relatedPlaceCodes !== undefined && (!Array.isArray(r.relatedPlaceCodes) || !r.relatedPlaceCodes.every(text)))) throw new Error("Rótulo incompleto o duplicado.");
    codes.add(r.code);
  }
  return data.labels;
}

type Box = { left: number; right: number; top: number; bottom: number };
type Item = { room: RoomAnnotation; display: RoomLabelDisplay; button: HTMLButtonElement; line: SVGLineElement };
const intersects = (a: Box, b: Box, gap = 3): boolean => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
const UI = ".explorer-header > *,.explorer-panel,.view-controls,.explorer-dock,.map-tools,.minimap-wrap,.route-card,.map-heading,.compass,.more-tools-menu,#exit-focus";

/** Screen-facing room names, independent of route arrival points and model geometry. */
export class RoomLabels {
  private readonly layer = document.createElement("div");
  private readonly leaders = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  private readonly detail = document.createElement("section");
  private readonly abort = new AbortController();
  private readonly observer: MutationObserver;
  private readonly measure = document.createElement("canvas").getContext("2d")!;
  private items: Item[] = [];
  private places = new Map<string, Building>();
  private opened: Item | undefined;
  private dirty = true;
  private signature = "";
  private readonly floors = new Set<number>();
  private readonly textWidths = new Map<string, number>();
  private readonly styles = new WeakMap<HTMLButtonElement, string>();
  private lastLayout = 0;
  private layoutTimer: ReturnType<typeof setTimeout> | undefined;
  private font = "";
  private motionUntil = 0;
  private motionTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly container: HTMLElement;
  private readonly choose: (place: Building) => void;
  private readonly requestRender: () => void;

  constructor(container: HTMLElement, choose: (place: Building) => void, requestRender: () => void = () => undefined) {
    this.container = container;
    this.choose = choose;
    this.requestRender = requestRender;
    this.layer.className = "room-label-layer";
    this.layer.setAttribute("role", "group");
    this.layer.setAttribute("aria-label", "Lugares del piso");
    this.layer.hidden = true;
    this.leaders.classList.add("room-label-leaders");
    this.leaders.setAttribute("aria-hidden", "true");
    this.detail.className = "room-label-detail floating-card";
    this.detail.id = "room-label-detail";
    this.detail.setAttribute("role", "dialog");
    this.detail.setAttribute("aria-label", "Detalle del recinto");
    this.detail.hidden = true;
    this.layer.append(this.leaders, this.detail);
    container.append(this.layer);
    // Observe only application controls, never the label styles we write below.
    this.observer = new MutationObserver(() => this.invalidate());
    this.observer.observe(document.body, { attributes: true, attributeFilter: ["class", "data-panel"] });
    document.querySelectorAll(UI).forEach(el => this.observer.observe(el, {
      attributes: true, subtree: true, childList: true, attributeFilter: ["hidden", "class", "open"],
    }));
    const options = { signal: this.abort.signal };
    container.addEventListener("pointerdown", event => { if (!this.layer.contains(event.target as Node)) this.close(); }, options);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && this.opened) { event.stopPropagation(); this.close(true); }
    }, { ...options, capture: true });
    void document.fonts.ready.then(() => { this.textWidths.clear(); this.invalidate(); });
  }

  setData(rooms: RoomAnnotation[], places: Building[]): void {
    this.close();
    this.items.forEach(item => { item.button.remove(); item.line.remove(); });
    this.places = new Map(places.filter(p => p.code).map(p => [p.code!, p]));
    this.floors.clear();
    rooms.forEach(room => this.floors.add(room.floor));
    this.items = rooms.flatMap(room => {
      const display = presentRoomLabel(room);
      if (!display) return [];
      const button = document.createElement("button");
      button.type = "button";
      button.hidden = true;
      this.floors.add(room.floor);
      button.className = "room-label";
      button.dataset.roomCode = room.code;
      button.dataset.floor = String(room.floor);
      button.dataset.status = room.status;
      button.dataset.accessPending = String(room.accessPending);
      button.title = `${display.name} · Piso ${room.floor}`;
      button.setAttribute("aria-label", button.title);
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-controls", this.detail.id);
      button.setAttribute("aria-expanded", "false");
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.style.display = "none";
      this.leaders.append(line);
      this.layer.append(button);
      if (display.icon) button.append(orientationSymbol(display.icon));
      const item = { room, display, button, line };
      button.addEventListener("click", () => { if (this.opened === item) this.close(); else this.open(item); });
      return [item];
    });
    this.layer.dataset.count = String(this.items.length);
    this.invalidate();
  }
  hasFloor(floor: number): boolean { return this.floors.has(floor); }
  invalidate(): void { this.dirty = true; if (!this.abort.signal.aborted) this.requestRender(); }
  suspendDuringMotion(): void {
    this.motionUntil = performance.now() + 120;
    if (this.motionTimer !== undefined) return;
    // One visibility change for the entire gesture: no DOM projection/reflow
    // competes with the 3D camera. Restore all names after damping settles.
    this.layer.style.visibility = "hidden";
    const settle = () => {
      const remaining = this.motionUntil - performance.now();
      if (remaining > 0) { this.motionTimer = setTimeout(settle, remaining); return; }
      this.motionTimer = undefined;
      this.layer.style.visibility = "";
      this.invalidate();
    };
    this.motionTimer = setTimeout(settle, 120);
  }
  private textWidth(text: string): number {
    let width = this.textWidths.get(text);
    if (width === undefined) { width = this.measure.measureText(text).width; this.textWidths.set(text, width); }
    return width;
  }

  private close(focus = false): void {
    const previous = this.opened;
    this.opened = undefined;
    this.detail.hidden = true;
    previous?.button.setAttribute("aria-expanded", "false");
    if (focus && previous && !previous.button.hidden) previous.button.focus({ preventScroll: true });
    this.invalidate();
  }
  private open(item: Item): void {
    this.close();
    this.opened = item;
    item.button.setAttribute("aria-expanded", "true");
    const { room } = item;
    const close = document.createElement("button");
    close.type = "button"; close.className = "room-detail-close"; close.textContent = "×";
    close.setAttribute("aria-label", "Cerrar detalle del recinto");
    close.addEventListener("click", () => this.close(true));
    const heading = document.createElement("h3");
    heading.textContent = item.display.name;
    const meta = document.createElement("p");
    meta.className = "room-detail-meta"; meta.textContent = `Piso ${room.floor}`;
    this.detail.replaceChildren(close, meta, heading);
    if (room.accessPending) {
      const pending = document.createElement("p"); pending.className = "room-detail-pending";
      pending.textContent = "La ruta a este lugar todavía no está disponible.";
      this.detail.append(pending);
    }
    const place = room.placeCode ? this.places.get(room.placeCode) : undefined;
    if (place) {
      const action = document.createElement("button");
      action.type = "button"; action.className = "button button-dark room-detail-destination";
      action.textContent = "Elegir destino";
      action.addEventListener("click", () => { this.close(); this.choose(place); });
      this.detail.append(action);
    }
    this.detail.hidden = false;
    close.focus({ preventScroll: true });
    this.invalidate();
  }

  update(camera: OrthographicCamera, floor: number, enabled: boolean, destination?: string, origin?: string): void {
    if (this.motionTimer !== undefined) return;
    // Camera matrices also catch programmatic zoom/focus changes. Idle frames do no DOM layout work.
    const key = [floor, enabled, destination, origin, camera.zoom, ...camera.matrixWorld.elements, ...camera.projectionMatrix.elements].join(",");
    if (!this.dirty && key === this.signature) return;
    const now = performance.now();
    // Camera motion needs at most 20 label layouts/s, independently of the display refresh rate.
    // Always settle on the final camera position, even when the 3D render loop has stopped.
    if (!this.dirty && now - this.lastLayout < 50) {
      if (this.layoutTimer === undefined) this.layoutTimer = setTimeout(() => { this.layoutTimer = undefined; this.invalidate(); }, 50 - (now - this.lastLayout));
      return;
    }
    if (this.layoutTimer !== undefined) { clearTimeout(this.layoutTimer); this.layoutTimer = undefined; }
    this.lastLayout = now;
    this.signature = key; this.dirty = false;
    const visible = enabled && this.hasFloor(floor);
    if (this.layer.hidden === visible) this.layer.hidden = !visible;
    if (!visible) { if (this.opened) this.close(); return; }
    if (this.opened && this.opened.room.floor !== floor) this.close();
    if (this.layer.dataset.floor !== String(floor)) this.layer.dataset.floor = String(floor);
    const rect = this.container.getBoundingClientRect(), width = rect.width, height = rect.height;
    const obstacles: Box[] = [];
    document.querySelectorAll<HTMLElement>(UI).forEach(el => {
      if (!el.checkVisibility({ visibilityProperty: true })) return;
      const r = el.getBoundingClientRect();
      if (r.width && r.height) obstacles.push({ left: r.left - rect.left, right: r.right - rect.left, top: r.top - rect.top, bottom: r.bottom - rect.top });
    });
    const inside = (b: Box): boolean => b.left >= 8 && b.top >= 8 && b.right <= width - 8 && b.bottom <= height - 8;
    // Read the open card size once, before writing any positions.
    if (this.detail.hidden !== !this.opened) this.detail.hidden = !this.opened;
    const detailWidth = this.detail.hidden ? 0 : this.detail.offsetWidth;
    const detailHeight = this.detail.hidden ? 0 : this.detail.offsetHeight;
    const projected = new Vector3();
    const candidates = this.items.filter(item => item.room.floor === floor).map(item => {
      projected.fromArray(item.room.anchor).project(camera);
      return { item, x: (projected.x + 1) * width / 2, y: (1 - projected.y) * height / 2, depth: projected.z,
        important: item === this.opened || [item.room.placeCode, ...(item.room.relatedPlaceCodes ?? [])].some(code => !!code && [destination, origin].includes(code)) };
    }).filter(p => p.depth > -1 && p.depth < 1 && p.x > 8 && p.x < width - 8 && p.y > 8 && p.y < height - 8);
    const occupied = [...obstacles];
    let detailBox: Box | undefined;
    const openedPoint = candidates.find(p => p.item === this.opened);
    if (openedPoint && detailWidth) {
      const x = openedPoint.x, y = openedPoint.y;
      const options = [[x + 18, y - detailHeight / 2], [x - detailWidth - 18, y - detailHeight / 2], [x - detailWidth / 2, y + 24], [x - detailWidth / 2, y - detailHeight - 24]];
      const boxes = options.map(([left, top]) => {
        left = Math.max(10, Math.min(width - detailWidth - 10, left));
        top = Math.max(10, Math.min(height - detailHeight - 10, top));
        return { left, top, right: left + detailWidth, bottom: top + detailHeight };
      });
      detailBox = boxes.find(b => !obstacles.some(o => intersects(b, o, 5)));
      if (!detailBox) {
        // Look for an unobstructed card position when the room is next to the app controls.
        for (let top = 90; top + detailHeight < height - 75 && !detailBox; top += 24) for (let left = 12; left + detailWidth < width - 10; left += 30) {
          const b = { left, top, right: left + detailWidth, bottom: top + detailHeight };
          if (!obstacles.some(o => intersects(b, o, 5))) { detailBox = b; break; }
        }
      }
      if (detailBox) occupied.push(detailBox);
    }
    if (this.detail.hidden !== !detailBox) this.detail.hidden = !detailBox;
    if (detailBox) { this.detail.style.left = `${detailBox.left}px`; this.detail.style.top = `${detailBox.top}px`; }
    const scale = width * camera.zoom / (camera.right - camera.left);
    const fontSize = width < 600 ? 12 : 11;
    const font = `550 ${fontSize}px 'DM Sans Variable', 'Segoe UI', sans-serif`;
    if (font !== this.font) { this.font = font; this.measure.font = font; this.textWidths.clear(); }
    const offsets = [[0, 0], [0, -19], [0, 19], [-30, 0], [30, 0], [-24, -22], [24, -22], [-24, 22], [24, 22]];
    const layout: { item: Item; x: number; y: number; box: Box; mode: string; text: string; selected: boolean; shifted: boolean }[] = [];
    for (const p of candidates.sort((a, b) => Number(b.important) - Number(a.important) || b.item.room.area - a.item.room.area)) {
      const r = p.item.room;
      let maxWidth = Math.min(width < 600 ? 132 : 152, Math.max(74, (r.bounds[2] - r.bounds[0]) * scale));
      const roomPixels = Math.sqrt(r.area) * scale;
      const modes: { mode: string; text: string; width: number; height: number }[] = [];
      if (p.item.display.icon) modes.push({ mode: "symbol", text: "", width: 24, height: 24 });
      if (!p.item.display.icon && (p.important || roomPixels > 42 || r.area > 100)) {
        const text = roomPixels > 100 ? p.item.display.name : p.item.display.shortName;
        const words = text.split(/\s+/); let lines = 1, line = "", longest = 0;
        maxWidth = Math.min(width < 600 ? 132 : 152, Math.max(maxWidth, ...words.map(word => Math.ceil(this.textWidth(word)) + 18)));
        for (const word of words) {
          const next = line ? `${line} ${word}` : word;
          if (line && this.textWidth(next) > maxWidth - 12) { longest = Math.max(longest, this.textWidth(line)); lines++; line = word; }
          else line = next;
        }
        longest = Math.max(longest, this.textWidth(line));
        if (lines <= 2 && longest <= maxWidth - 12) modes.push({ mode: "name", text, width: Math.min(maxWidth, Math.ceil(longest) + 18), height: lines * 15 + 7 });
      }
      modes.push({ mode: "marker", text: "", width: 9, height: 9 });
      let placed = false;
      for (const mode of modes) {
        for (const [dx, dy] of offsets) {
          // Long names stay close to their room; fine markers may make room for neighbours.
          const b = { left: p.x + dx - mode.width / 2, right: p.x + dx + mode.width / 2, top: p.y + dy - mode.height / 2, bottom: p.y + dy + mode.height / 2 };
          if (!inside(b) || occupied.some(o => intersects(b, o, mode.mode === "marker" ? 2 : 3))) continue;
          occupied.push(b);
          layout.push({ item: p.item, x: p.x, y: p.y, box: b, mode: mode.mode, text: mode.text, selected: p.important, shifted: !!dx || !!dy });
          placed = true; break;
        }
        if (placed) break;
      }
      // A room behind UI is intentionally occluded, but dense rooms keep an anchor pin.
      if (!placed && !obstacles.some(o => intersects({ left: p.x - 5, right: p.x + 5, top: p.y - 5, bottom: p.y + 5 }, o))) {
        const b = { left: p.x - 4, right: p.x + 4, top: p.y - 4, bottom: p.y + 4 };
        layout.push({ item: p.item, x: p.x, y: p.y, box: b, mode: "marker", text: "", selected: p.important, shifted: false });
      }
    }
    // All reads and placement decisions are complete; batch the DOM writes.
    const shown = new Set(layout.map(p => p.item));
    this.items.forEach(item => {
      if (!shown.has(item) && !item.button.hidden) item.button.hidden = true;
      if (!shown.has(item) && item.line.style.display !== "none") item.line.style.display = "none";
    });
    for (const p of layout) {
      const button = p.item.button;
      const className = `room-label is-${p.mode}${p.selected ? " is-selected" : ""}`;
      if (button.className !== className) button.className = className;
      if (p.mode === "symbol") {
        if (!button.firstElementChild) button.replaceChildren(orientationSymbol(p.item.display.icon!));
      } else if (button.firstElementChild || button.textContent !== p.text) button.textContent = p.text;
      if (button.hidden) button.hidden = false;
      const style = `transform:translate3d(${p.box.left.toFixed(1)}px,${p.box.top.toFixed(1)}px,0);width:${p.box.right - p.box.left}px;height:${p.box.bottom - p.box.top}px;`;
      if (this.styles.get(button) !== style) { button.style.cssText = style; this.styles.set(button, style); }
      if (p.shifted) {
        const attrs = { x1: p.x, y1: p.y, x2: (p.box.left + p.box.right) / 2, y2: (p.box.top + p.box.bottom) / 2 };
        for (const [key, value] of Object.entries(attrs)) if (p.item.line.getAttribute(key) !== value.toFixed(1)) p.item.line.setAttribute(key, value.toFixed(1));
        if (p.item.line.style.display) p.item.line.style.display = "";
      } else if (p.item.line.style.display !== "none") p.item.line.style.display = "none";
    }
    if (this.layer.dataset.visible !== String(layout.length)) this.layer.dataset.visible = String(layout.length);
  }
  dispose(): void {
    this.abort.abort();
    if (this.layoutTimer !== undefined) clearTimeout(this.layoutTimer);
    if (this.motionTimer !== undefined) clearTimeout(this.motionTimer);
    this.observer.disconnect(); this.layer.remove();
  }
}

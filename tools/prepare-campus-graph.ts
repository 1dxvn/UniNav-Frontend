/** Offline navigation drafting only. Runtime routing remains in FastAPI. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { Vector3, Mesh } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { chromium } from "@playwright/test";

type Point = [number, number];
type Segment = [Point, Point];
const bytes = await readFile(new URL("../public/models/campus.glb", import.meta.url));
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
gltf.scene.updateMatrixWorld(true);
const barriers: Segment[] = [];
const floorTriangles: [Point, Point, Point][] = [];
gltf.scene.traverse((object) => {
  if (!(object instanceof Mesh)) return;
  if (!/^(Walls|Columns|Glass|Floor_Slab)/.test(object.name)) return;
  const geometry = object.geometry, positions = geometry.attributes.position;
  const index = geometry.index;
  for (let offset = 0; offset < (index?.count ?? positions.count); offset += 3) {
    const vertices = [0, 1, 2].map((delta) => new Vector3().fromBufferAttribute(positions, index ? index.getX(offset + delta) : offset + delta).applyMatrix4(object.matrixWorld));
    if (object.name === "Floor_Slab") {
      if (vertices.every((point) => Math.abs(point.y) < 0.01)) floorTriangles.push(vertices.map((point) => [point.x, -point.z]) as [Point, Point, Point]);
      continue;
    }
    const intersections: Point[] = [];
    for (let edge = 0; edge < 3; edge++) {
      const a = vertices[edge], b = vertices[(edge + 1) % 3];
      if ((a.y < 1 && b.y >= 1) || (b.y < 1 && a.y >= 1)) {
        const t = (1 - a.y) / (b.y - a.y);
        intersections.push([a.x + (b.x - a.x) * t, -(a.z + (b.z - a.z) * t)]);
      }
    }
    if (intersections.length === 2) barriers.push([intersections[0], intersections[1]]);
  }
});
function distance(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function inside(p: Point, triangle: [Point, Point, Point]): boolean {
  const signs = triangle.map((a, index) => { const b = triangle[(index + 1) % 3]; return (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]); });
  return !(signs.some((v) => v < -0.00001) && signs.some((v) => v > 0.00001));
}
const clearance = 0.38;
function free(p: Point): boolean {
  const outdoor = p[0] >= -5 && p[0] <= 21 && p[1] >= 0 && p[1] <= 42;
  return (outdoor || floorTriangles.some((triangle) => inside(p, triangle))) && barriers.every(([a, b]) => distance(p, a, b) > clearance);
}
function clear(a: Point, b: Point): boolean {
  const count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.15);
  for (let i = 0; i <= count; i++) if (!free([a[0] + (b[0] - a[0]) * i / Math.max(1, count), a[1] + (b[1] - a[1]) * i / Math.max(1, count)])) return false;
  return true;
}
const step = 0.5, cols = 175, rows = 153;
const point = (id: number): Point => [(id % cols) * step - 10, Math.floor(id / cols) * step - 8];
const cell = (p: Point): number => Math.round((p[1] + 8) / step) * cols + Math.round((p[0] + 10) / step);
const walkable = new Uint8Array(cols * rows);
for (let id = 0; id < walkable.length; id++) walkable[id] = Number(free(point(id)));
function findPath(start: Point, end: Point): Point[] {
  const startId = cell(start), endId = cell(end);
  if (!walkable[startId] || !walkable[endId]) throw new Error(`Blocked endpoint ${JSON.stringify({start,end,startFree:walkable[startId],endFree:walkable[endId]})}`);
  const costs = new Map<number, number>([[startId, 0]]), came = new Map<number, number>();
  const open = [startId], closed = new Set<number>();
  while (open.length) {
    open.sort((a, b) => (costs.get(b)! + Math.hypot(...point(b).map((v, i) => v - end[i]))) - (costs.get(a)! + Math.hypot(...point(a).map((v, i) => v - end[i]))));
    const current = open.pop()!;
    if (closed.has(current)) continue;
    if (current === endId) {
      const ids = [current]; while (came.has(ids[0])) ids.unshift(came.get(ids[0])!);
      const raw = [start, ...ids.map(point), end], simplified: Point[] = [start];
      for (let i = 0; i < raw.length - 1;) { let next = i + 1; for (let j = next + 1; j < raw.length; j++) { if (clear(raw[i], raw[j])) next = j; } simplified.push(raw[next]); i = next; }
      return simplified;
    }
    closed.add(current);
    const x = current % cols, y = Math.floor(current / cols);
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
      const nx = x + dx, ny = y + dy, id = ny * cols + nx;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows || !walkable[id] || closed.has(id) ||
        (dx && dy && (!walkable[y * cols + nx] || !walkable[ny * cols + x]))) continue;
      const cost = costs.get(current)! + Math.hypot(dx, dy) * step;
      if (cost < (costs.get(id) ?? Infinity)) { costs.set(id, cost); came.set(id, current); open.push(id); }
    }
  }
  throw new Error(`No walkable route to ${end}`);
}
const trunk: Point[] = [[0, 0], [6, 16.5], [21.5, 33.5]];
if (trunk.slice(1).some((p, i) => !clear(trunk[i], p))) throw new Error("The shared access path is obstructed.");
const destinations: { name: string; position: Point; type: string }[] = [
  { name: "ICETEX", position: [24.55,41.78], type: "service" },
  { name: "Morphology Laboratory", position: [42.96,27.77], type: "laboratory" },
  { name: "Preclinic / Dentistry Coordination", position: [56.84,51.96], type: "clinic" },
  { name: "Elevator and Restroom Hall", position: [25.77,51.97], type: "service" },
];
const routes = destinations.map((destination) => {
  try { return { ...destination, path: [...trunk.slice(0, -1), ...findPath(trunk.at(-1)!, destination.position)] }; }
  catch (error) { console.warn(String(error)); return { ...destination, path: [] as Point[] }; }
});
await mkdir("docs/verification", { recursive: true });
await writeFile("docs/verification/drafted-routes.json", JSON.stringify(routes, null, 2));
const convert = (p: Point): string => `${(p[0] + 10) * 14},${(68 - p[1]) * 14}`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1218" height="1064" viewBox="0 0 1218 1064"><rect width="1218" height="1064" fill="#f4f3ed"/>${barriers.map(([a,b]) => `<line x1="${(a[0]+10)*14}" y1="${(68-a[1])*14}" x2="${(b[0]+10)*14}" y2="${(68-b[1])*14}" stroke="#263c36" stroke-width="1.5"/>`).join("")}${routes.map((route, index) => `<polyline points="${route.path.map(convert).join(" ")}" fill="none" stroke="${["#008e77","#e27936","#427ac6","#ab55a3"][index]}" stroke-width="3"/><circle cx="${(route.position[0]+10)*14}" cy="${(68-route.position[1])*14}" r="5" fill="#263c36"/><text x="${(route.position[0]+10)*14+8}" y="${(68-route.position[1])*14-8}" font-size="12">${route.name.replaceAll("&","&amp;")}</text>`).join("")}</svg>`;
await writeFile("docs/verification/drafted-routes.svg", svg);
console.log(JSON.stringify({barriers:barriers.length, floorTriangles:floorTriangles.length, routes}, null, 2));
const browser = await chromium.launch({ executablePath: process.env.UNINAV_BROWSER ?? "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe", headless:true });
const page = await browser.newPage({viewport:{width:1218,height:1064}});
await page.setContent(`<style>body{margin:0}</style>${svg}`);
await page.screenshot({path:"docs/verification/drafted-routes.png"});
await browser.close();

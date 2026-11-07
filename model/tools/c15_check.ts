// Checks the C15 real-level candidate (model/candidates/c15/floor-1.glb at world Y 3.5, floor-2.glb at 6.44, with the
// C14 floor 3 at 9.38 for the upper stairs). For every walked segment, sampled every 0.05 m:
//   support: a short downward ray finds the floor/tread under the feet, at the expected height (±0.03 m, ±0.20 m on
//            stair treads, where the expected height is a straight line between waypoints);
//   body:    rays at 0.45, 1.2 and 1.8 m above the support, centre and ±0.22 m, 0.25 m ahead, against every mesh
//            (the runtime's rays; nothing is excluded by name).
// Walks: the hall descent (28, 47.6) -> (28, 49.5); the 16 first-floor API edges with Codex's proposed hall split;
// Codex's two-floor graph (docs/verification/h2-floor2-candidate/dataset-candidate.json) with its heights mapped to
// the real levels; the four A stairs (floor 1 -> 2 at 3.31 m, floor 2 -> 3 at 3.20 m).
// Usage (from UniNav-Frontend): node --experimental-strip-types model/tools/c15_check.ts [out.json]
import { readFile, writeFile } from "node:fs/promises";
import { Group, Mesh, Raycaster, Vector3, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

function withoutImages(glb: Buffer): ArrayBuffer {
  const n = glb.readUInt32LE(12); const json = JSON.parse(glb.subarray(20, 20 + n).toString("utf8"));
  delete json.images; delete json.textures; delete json.samplers;
  for (const m of json.materials ?? []) if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; }
  let t = Buffer.from(JSON.stringify(json)); if (t.length % 4) t = Buffer.concat([t, Buffer.alloc(4 - (t.length % 4), 0x20)]);
  const bin = glb.subarray(20 + n), h = Buffer.alloc(20);
  h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(20 + t.length + bin.length, 8); h.writeUInt32LE(t.length, 12); h.writeUInt32LE(0x4e4f534a, 16);
  const out = Buffer.concat([h, t, bin]); return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}
async function load(path: string, y: number): Promise<Object3D[]> {
  const g = await new GLTFLoader().parseAsync(withoutImages(await readFile(path)), "");
  const root = new Group(); root.position.y = y; root.add(g.scene); root.updateMatrixWorld(true);
  const out: Object3D[] = []; root.traverse((o) => { if (o instanceof Mesh) out.push(o); }); return out;
}
const F1 = await load("model/candidates/c15/floor-1.glb", 3.5);
const F2 = await load("model/candidates/c15/floor-2.glb", 6.44);
const F3 = await load("public/models/floor-3/campus.glb", 9.38);
const ALL = [...F1, ...F2, ...F3];
const SUPPORT = ALL.filter((m) => /Floor_Slab|Stair_A/.test(m.name));
const OUTDOOR = [...SUPPORT, ...ALL.filter((m) => /^Site/.test(m.name))];   // outdoor edges walk on the site ground (0.15 m below the slab top)

// zone offsets of the candidate (docs/blocks/level-zones.md), relative to each floor's B datum
const AY = 49.23, AX = 13.6, NOS = [47.86, 48.32, 48.78, 49.23], RISER = 0.63 / 4;
const inA = (x: number, y: number) => y >= AY && x >= AX;
function f1Height(x: number, y: number): number {
  if (x >= 27.33 && x <= 29.79 && y >= NOS[0] && y <= NOS[3]) return 3.5 - RISER * NOS.filter((n) => y >= n).length;
  return inA(x, y) ? 3.5 - 0.63 : 3.5;
}
const f2Height = (x: number, y: number) => (inA(x, y) ? 6.44 - 0.26 : 6.44);

type P = { x: number; y: number; h: number };
type Result = { name: string; samples: number; blocked: string[]; support: string[] };
function walk(name: string, pts: P[], stairTol = 0.03, outdoor = false): Result {
  const res: Result = { name, samples: 0, blocked: [], support: [] };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(len / 0.05)); const tol = Math.abs(b.h - a.h) > 0.05 || outdoor ? 0.2 : stairTol;
    if (len < 1e-4) continue;
    const dir = new Vector3(b.x - a.x, 0, -(b.y - a.y)).normalize();
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, he = a.h + (b.h - a.h) * t;
      const down = new Raycaster(new Vector3(x, he + 0.6, -y), new Vector3(0, -1, 0), 0, 1.2).intersectObjects(outdoor ? OUTDOOR : SUPPORT, false)[0];
      res.samples++;
      if (!down || Math.abs(down.point.y - he) > tol) {
        if (res.support.length < 6) res.support.push(`(${x.toFixed(2)}, ${y.toFixed(2)}) expected ${he.toFixed(3)} found ${down ? down.point.y.toFixed(3) : "none"}`);
        continue;
      }
      const foot = down.point.y;
      if (k === steps) continue;
      for (const hgt of [0.45, 1.2, 1.8]) for (const off of [-0.22, 0, 0.22]) {
        const s = new Vector3(x - dir.z * off, foot + hgt, -y + dir.x * off);
        const hit = new Raycaster(s, dir, 0, len / steps + 0.25).intersectObjects(ALL, false)[0];
        if (hit && res.blocked.length < 6) res.blocked.push(`${hit.object.name}@${hgt} near (${x.toFixed(2)}, ${y.toFixed(2)})`);
      }
    }
  }
  return res;
}

const results: Result[] = [];
// 1. hall descent, both directions
const hall = [{ x: 28, y: 47.6, h: f1Height(28, 47.6) }, ...NOS.map((n, i) => ({ x: 28, y: n + 0.23, h: f1Height(28, n + 0.23) })).slice(0, 3), { x: 28, y: 49.5, h: f1Height(28, 49.5) }];
results.push(walk("hall descent (28, 47.6) -> (28, 49.5)", hall, 0.03), walk("hall ascent (28, 49.5) -> (28, 47.6)", [...hall].reverse(), 0.03));

// 2. the 16 first-floor API edges, with p09 moved to (28, 47.6) and e09 split at (28, 49.5)
const src = await readFile("../scripts/ucc_floor1_data.py", "utf8");
const places = new Map<string, [number, number]>();
for (const m of src.matchAll(/\("([^"]+)",\s*([-\d.]+),\s*([-\d.]+)/g)) if (!places.has(m[1])) places.set(m[1], [Number(m[2]), Number(m[3])]);
places.set("Hall corridor north", [28, 47.6]);
const paths = [...src.matchAll(/\("([^"]+)",\s*"([^"]+)",\s*"(\w+)"\)/g)].map((m) => [m[1], m[2], m[3]]);
for (const [a, b, kind] of paths) {
  if (!places.has(a) || !places.has(b)) continue;
  let pts: P[] = [a, b].map((n) => { const [x, y] = places.get(n)!; return { x, y, h: f1Height(x, y) }; });
  if ((a === "Hall corridor north" && b === "Elevator and Restroom Hall") || (b === "Hall corridor north" && a === "Elevator and Restroom Hall")) {
    const e = places.get("Elevator and Restroom Hall")!;
    pts = [...hall.slice(0, -1), { x: 28, y: 49.5, h: f1Height(28, 49.5) }, { x: e[0], y: e[1], h: f1Height(e[0], e[1]) }];
    if (a === "Elevator and Restroom Hall") pts.reverse();
  }
  results.push(walk(`floor 1: ${a} -> ${b} (${kind})`, pts, 0.03, kind === "outdoor"), walk(`floor 1: ${b} -> ${a} (${kind})`, [...pts].reverse(), 0.03, kind === "outdoor"));
}

// 3. Codex's two-floor graph with heights mapped to the real levels
const ds = JSON.parse(await readFile("docs/verification/h2-floor2-candidate/dataset-candidate.json", "utf8"));
const order = [...places.keys()];
const pos = new Map<string, P>();
order.forEach((n, i) => { const [x, y] = places.get(n)!; pos.set(`ucc:floor1:p${String(i + 1).padStart(2, "0")}`, { x, y, h: f1Height(x, y) }); });
order.forEach((n, i) => { const [x, y] = places.get(n)!; pos.set(`ucc:floor1:p${i + 1}`, { x, y, h: f1Height(x, y) }); });
for (const p of ds.places) {
  const e = p.elevation_m as number; let h: number;
  if (e <= 3.5 + 1e-6) h = p.floor === 1 ? f1Height(p.x, p.y) : e;
  else if (e >= 6.44 - 1e-6) h = f2Height(p.x, p.y);
  else h = (3.5 - 0.63) + (e - 3.5) * (3.31 / 2.94);                       // east-stair treads and landing
  pos.set(p.code, { x: p.x, y: p.y, h });
}
let missing = 0;
for (const e of ds.paths) {
  const a = pos.get(e.source_code), b = pos.get(e.target_code);
  if (!a || !b) { missing++; continue; }
  const label = `two-floor ${e.code} ${e.source_code} -> ${e.target_code} (${e.kind})`;
  const od = e.kind === "outdoor";
  results.push(walk(label, [a, b], 0.03, od), walk(label + " reverse", [b, a], 0.03, od));
}

// 4. A stairs: foot -> flight 1 -> landing -> flight 2 -> top (the measured layout), real rises
const STAIRS = { West: { a: 14.65, b: 18.05 }, East: { a: 36.35, b: 38.7 } };
for (const [lo, base, rise] of [["1 -> 2", 2.87, 3.31], ["2 -> 3", 6.18, 3.2]] as const) for (const [nm, s] of Object.entries(STAIRS)) {
  const R = rise / 21, pts: P[] = [{ x: s.a, y: 55.9, h: base }];
  for (let k = 1; k <= 10; k++) pts.push({ x: s.a, y: 56.2 + (k - 0.5) * 0.3, h: base + k * R });
  pts.push({ x: s.a, y: 59.9, h: base + 11 * R }, { x: s.b, y: 59.9, h: base + 11 * R });
  for (let j = 0; j < 10; j++) pts.push({ x: s.b, y: 59.2 - (j + 0.5) * 0.3, h: base + (12 + j) * R });
  pts.push({ x: s.b, y: 55.9, h: base + rise });
  results.push(walk(`stair ${nm} ${lo}`, pts, 0.03));
}

const bad = results.filter((r) => r.blocked.length || r.support.length);
const out = { models: { floor1: "model/candidates/c15/floor-1.glb @ 3.5", floor2: "model/candidates/c15/floor-2.glb @ 6.44", floor3: "public/models/floor-3/campus.glb @ 9.38 (C14)" },
  walks: results.length, samples: results.reduce((s, r) => s + r.samples, 0), problems: bad, unresolvedPathCodes: missing };
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(out, null, 1) + "\n");
console.log(`${results.length} walks, ${out.samples} samples, ${bad.length} with problems, ${missing} two-floor paths with unknown endpoints`);
for (const r of bad) console.log(`  ${r.name}\n    blocked: ${r.blocked.join("; ") || "-"}\n    support: ${r.support.join("; ") || "-"}`);

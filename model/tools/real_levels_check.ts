// Checks the real-level candidate set of model/tools/real_levels.json (C16: floors 1-5, each at its C13/C14 world
// datum). Sampling every 0.05 m: support under the feet at the expected height (±0.03 m on floors, ±0.20 m between
// waypoints of different height) and body/head rays at 0.45, 1.2, 1.8 m (centre and ±0.22 m, 0.25 m ahead) against
// every mesh of every floor. Walks:
//   - floor 1: hall descent, the 16 API edges with the proposed hall split, Codex's two-floor graph (as for C15);
//   - floor 3: hall ascent (28, 47.6) -> (28, 49.6) over the four 0.1225 m risers;
//   - A stairs, both towers: 1 -> 2, 2 -> 3, 3 -> 4, 4 -> 5 with the configured rises (top must land on the next A floor);
//   - a straight line along the Block A north corridor on floors 2-5 between the two stair arrivals: inspection of
//     support only, since the straight line meets the elevator-hall walls (it is not a route).
// Usage (from UniNav-Frontend): node --experimental-strip-types model/tools/real_levels_check.ts [out.json]
import { readFile, writeFile } from "node:fs/promises";
import { Group, Mesh, Raycaster, Vector3, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const CFG = JSON.parse(await readFile("model/tools/real_levels.json", "utf8")); const CAND = CFG.candidate as string;
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
const ALL: Object3D[] = [];
for (const [fid, f] of Object.entries<any>(CFG.floors)) ALL.push(...await load(`model/candidates/${CAND}/floor-${fid}.glb`, f.datum_world));
const SUPPORT = ALL.filter((m) => /Floor_Slab|Stair_A/.test(m.name));
const OUTDOOR = [...SUPPORT, ...ALL.filter((m) => /^Site/.test(m.name))];

function height(fid: string, x: number, y: number): number {
  const f = CFG.floors[fid]; const h = f.hall;
  if (h && x >= h.x[0] && x <= h.x[1] && y >= h.nosings[0] && y <= h.nosings[h.nosings.length - 1])
    return f.datum_world + f.a_offset * h.nosings.filter((n: number) => y >= n).length / h.nosings.length;
  return f.datum_world + (y >= f.a_y && x >= f.a_x ? f.a_offset : 0);
}
const aWorld = (fid: string) => CFG.floors[fid].datum_world + CFG.floors[fid].a_offset;

type P = { x: number; y: number; h: number };
type Result = { name: string; samples: number; blocked: string[]; support: string[] };
function walk(name: string, pts: P[], outdoor = false): Result {
  const res: Result = { name, samples: 0, blocked: [], support: [] };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-4) continue;
    const steps = Math.max(1, Math.ceil(len / 0.05)), tol = Math.abs(b.h - a.h) > 0.05 || outdoor ? 0.2 : 0.03;
    const dir = new Vector3(b.x - a.x, 0, -(b.y - a.y)).normalize();
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, he = a.h + (b.h - a.h) * t;
      const down = new Raycaster(new Vector3(x, he + 0.6, -y), new Vector3(0, -1, 0), 0, 1.2).intersectObjects(outdoor ? OUTDOOR : SUPPORT, false)[0];
      res.samples++;
      if (!down || Math.abs(down.point.y - he) > tol) {
        if (res.support.length < 4) res.support.push(`(${x.toFixed(2)}, ${y.toFixed(2)}) expected ${he.toFixed(3)} found ${down ? down.point.y.toFixed(3) : "none"}`);
        continue;
      }
      if (k === steps) continue;
      for (const hg of [0.45, 1.2, 1.8]) for (const off of [-0.22, 0, 0.22]) {
        const s = new Vector3(x - dir.z * off, down.point.y + hg, -y + dir.x * off);
        const hit = new Raycaster(s, dir, 0, len / steps + 0.25).intersectObjects(ALL, false)[0];
        if (hit && res.blocked.length < 4) res.blocked.push(`${hit.object.name}@${hg} near (${x.toFixed(2)}, ${y.toFixed(2)})`);
      }
    }
  }
  return res;
}
const results: Result[] = [];
const hallWalk = (fid: string, y0: number, y1: number) => {
  const nos: number[] = CFG.floors[fid].hall.nosings;
  const pts: P[] = [{ x: 28, y: y0, h: height(fid, 28, y0) }];
  for (let k = 0; k < nos.length - 1; k++) { const y = (nos[k] + nos[k + 1]) / 2; pts.push({ x: 28, y, h: height(fid, 28, y) }); }
  pts.push({ x: 28, y: y1, h: height(fid, 28, y1) });
  return pts;
};
// floor 1 (unchanged from C15)
const hall1 = hallWalk("1", 47.6, 49.5);
results.push(walk("floor 1 hall descent", hall1), walk("floor 1 hall ascent", [...hall1].reverse()));
const src = await readFile("../scripts/ucc_floor1_data.py", "utf8");
const places = new Map<string, [number, number]>();
for (const m of src.matchAll(/\("([^"]+)",\s*([-\d.]+),\s*([-\d.]+)/g)) if (!places.has(m[1])) places.set(m[1], [Number(m[2]), Number(m[3])]);
const order = [...places.keys()];
places.set("Hall corridor north", [28, 47.6]);
for (const m of src.matchAll(/\("([^"]+)",\s*"([^"]+)",\s*"(\w+)"\)/g)) {
  const [a, b, kind] = [m[1], m[2], m[3]]; if (!places.has(a) || !places.has(b)) continue;
  let pts: P[] = [a, b].map((n) => { const [x, y] = places.get(n)!; return { x, y, h: height("1", x, y) }; });
  const pair = new Set([a, b]);
  if (pair.has("Hall corridor north") && pair.has("Elevator and Restroom Hall")) {
    const e = places.get("Elevator and Restroom Hall")!;
    pts = [...hall1, { x: e[0], y: e[1], h: height("1", e[0], e[1]) }];
    if (a === "Elevator and Restroom Hall") pts.reverse();
  }
  results.push(walk(`floor 1: ${a} -> ${b}`, pts, kind === "outdoor"), walk(`floor 1: ${b} -> ${a}`, [...pts].reverse(), kind === "outdoor"));
}
const ds = JSON.parse(await readFile("docs/verification/h2-floor2-candidate/dataset-candidate.json", "utf8"));
const pos = new Map<string, P>();
order.forEach((n, i) => { const [x, y] = places.get(n)!; const p = { x, y, h: height("1", x, y) }; pos.set(`ucc:floor1:p${String(i + 1).padStart(2, "0")}`, p); pos.set(`ucc:floor1:p${i + 1}`, p); });
const r12 = aWorld("2") - aWorld("1");
for (const p of ds.places) {
  const e = p.elevation_m as number;
  const h = e <= 3.5 + 1e-6 ? (p.floor === 1 ? height("1", p.x, p.y) : e) : e >= 6.44 - 1e-6 ? height("2", p.x, p.y) : aWorld("1") + (e - 3.5) * (r12 / 2.94);
  pos.set(p.code, { x: p.x, y: p.y, h });
}
for (const e of ds.paths) {
  const a = pos.get(e.source_code), b = pos.get(e.target_code); if (!a || !b) continue;
  results.push(walk(`two-floor ${e.code}`, [a, b], e.kind === "outdoor"), walk(`two-floor ${e.code} reverse`, [b, a], e.kind === "outdoor"));
}
// floor 3 hall ascent (B -> A)
const hall3 = hallWalk("3", 47.6, 49.6);
results.push(walk("floor 3 hall ascent", hall3), walk("floor 3 hall descent", [...hall3].reverse()));
// A stairs, both towers, every floor pair
const STAIRS = { West: { a: 14.65, b: 18.05 }, East: { a: 36.35, b: 38.7 } };
for (const [lo, hi] of [["1", "2"], ["2", "3"], ["3", "4"], ["4", "5"]]) for (const [nm, s] of Object.entries(STAIRS)) {
  const base = aWorld(lo), rise = aWorld(hi) - base, R = rise / 21, pts: P[] = [{ x: s.a, y: 55.9, h: base }];
  for (let k = 1; k <= 10; k++) pts.push({ x: s.a, y: 56.2 + (k - 0.5) * 0.3, h: base + k * R });
  pts.push({ x: s.a, y: 59.9, h: base + 11 * R }, { x: s.b, y: 59.9, h: base + 11 * R });
  for (let j = 0; j < 10; j++) pts.push({ x: s.b, y: 59.2 - (j + 0.5) * 0.3, h: base + (12 + j) * R });
  pts.push({ x: s.b, y: 55.9, h: base + rise });
  results.push(walk(`stair ${nm} ${lo} -> ${hi} (rise ${rise.toFixed(2)})`, pts));
}
// Block A north corridor on floors 2-5, between the two stair arrivals
const corridor: Result[] = [];
for (const fid of ["2", "3", "4", "5"]) {
  const h = aWorld(fid);
  const pts: P[] = [{ x: 38.7, y: 55.9, h }, { x: 38.7, y: 54.6, h }, { x: 18.05, y: 54.6, h }, { x: 18.05, y: 55.9, h }];
  corridor.push(walk(`floor ${fid} A corridor east stair -> west stair (inspection)`, pts));
}
const bad = results.filter((r) => r.blocked.length || r.support.length);
const out = { candidate: CAND, walks: results.length, samples: results.reduce((s, r) => s + r.samples, 0), problems: bad,
  corridorInspection: corridor.map((r) => ({ name: r.name, samples: r.samples, blocked: r.blocked, support: r.support })) };
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(out, null, 1) + "\n");
console.log(`${results.length} walks, ${out.samples} samples, ${bad.length} with problems`);
for (const r of bad) console.log(`  ${r.name}\n    blocked: ${r.blocked.join("; ") || "-"}\n    support: ${r.support.join("; ") || "-"}`);
for (const r of corridor) console.log(`  [inspection] ${r.name}: ${r.blocked.length || r.support.length ? "blocked " + r.blocked.join("; ") + " support " + r.support.join("; ") : "clear"}`);

"""Doorway inventory of an upper floor, from the DWG frame marks, for building its navigation graph.

On the upper sheets every door jamb carries a small frame mark (open polyline on layer 02, under 0.12 m). Two marks
0.6-1.9 m apart with free space between them (no wall, column or glass of the model) are a doorway. For each doorway
this writes the jambs, centre, clear width, the drawn leaves that belong to it, and two stand points 0.6 m either side
of the opening (moved to 0.9 or 1.2 m when closer than 0.3 m to a solid).

For each stand point it lists the room-name labels visible from it: within 12 m, on a straight line that crosses no
wall, column or glass of the model, nearest first (area labels such as "46.25 M2" are left out). A label seen from one
side only names the room on that side; a side that sees no label, or only CIRCULACION/HALL labels, is usually
circulation. Many walls on these sheets have open gaps, so no closed room outline is claimed.

These are geometry facts from the drawing, not graph data: whether a doorway is an entrance, and which stand point
becomes a waypoint, is decided by whoever builds the graph. Illustrative furniture inside a doorway passage is removed
from extras.json, so run this after extras.py and door_leaves_dwg.py, before the Blender detail step.
Usage: python doorways.py <dxf> data/floorN. Output: data/floorN/doorways.json (and the pruned extras.json).
Then `node --experimental-strip-types model/tools/doorway_rays.ts N` checks every doorway against the floor GLB.
"""
import sys, json, math, os, re, ezdxf
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union

DXF, FLOOR_DIR = sys.argv[1:3]
W = json.load(open(os.path.join(FLOOR_DIR, "wing.json"), encoding="utf-8"))
X = json.load(open(os.path.join(FLOOR_DIR, "extras.json"), encoding="utf-8"))
ox, oy = W["origin_cad"]; c = W["crop_cad"]
def polys(key): return [Polygon(p["outer"], p["holes"]).buffer(0) for p in W[key]]
solid = unary_union(polys("walls") + polys("columns") + polys("glass"))
solid_in = solid.buffer(-0.01)
foot = unary_union([Polygon(r["outer"], r["holes"]) for r in X["footprint"]])

marks = []
for e in ezdxf.readfile(DXF).modelspace().query('LWPOLYLINE[layer=="02"]'):
    raw = [(p[0], p[1]) for p in e.get_points("xy")]
    if e.closed or not raw or not all(c[0] <= x <= c[2] and c[1] <= y <= c[3] for x, y in raw): continue
    xs = [x - ox for x, _ in raw]; ys = [y - oy for _, y in raw]
    if max(max(xs) - min(xs), max(ys) - min(ys)) <= 0.12:
        marks.append(Point((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2))
# repeated marks (the DWG repeats some entities) count once
uniq = []
for m in marks:
    if all(m.distance(u) > 0.03 for u in uniq): uniq.append(m)
marks = uniq

# --- pair marks into doorways: free segment between them, nearest valid partner first, each mark used once
pairs = []
for i, a in enumerate(marks):
    for j in range(i + 1, len(marks)):
        b = marks[j]; d = a.distance(b)
        if not 0.6 <= d <= 1.9: continue
        seg = LineString([a, b])
        inner = LineString([seg.interpolate(0.08), seg.interpolate(d - 0.08)])
        if inner.intersects(solid_in) or not foot.buffer(0.3).contains(seg): continue
        pairs.append((d, i, j))
used, doorways = set(), []
for d, i, j in sorted(pairs):
    if i in used or j in used: continue
    used.update((i, j))
    a, b = marks[i], marks[j]
    ux, uy = (b.x - a.x) / d, (b.y - a.y) / d; nx, ny = -uy, ux
    cx, cy = (a.x + b.x) / 2, (a.y + b.y) / 2
    doorways.append({"jambs": [[round(a.x, 3), round(a.y, 3)], [round(b.x, 3), round(b.y, 3)]],
                     "center": [round(cx, 3), round(cy, 3)], "width": round(d, 3), "u": [ux, uy], "n": [nx, ny]})

# --- room-name labels visible from each stand point (no wall, column or glass on the line of sight)
AREA = re.compile(r"^[\d.,\s]+M2$", re.I)
names = [(l["text"].replace("\n", " ").strip(), Point(l["xy"])) for l in W["labels"]]
names = [(t, p) for t, p in names if t and not AREA.match(t) and not re.match(r"^[\d\W]+$", t) and len(t) > 1]
def visible(pt, own_door):
    """Labels seen from pt with the doorway itself closed, so the two sides do not see through it."""
    if pt is None: return []
    blockers = unary_union([solid_in, own_door])
    seen = {}
    for t, p in names:
        d = pt.distance(p)
        if d <= 12.0 and not LineString([pt, p]).intersects(blockers) and (t not in seen or d < seen[t]): seen[t] = d
    return [{"label": t, "distance": round(d, 2)} for t, d in sorted(seen.items(), key=lambda kv: kv[1])][:4]

leaves = [d for d in X["doors"]]
for dw in doorways:
    cx, cy = dw["center"]; nx, ny = dw["n"]; seg = LineString(dw["jambs"])
    own = seg.buffer(0.3, cap_style=2)      # the doorway and its jambs, closed for the visibility test
    sides = []
    for s in (1, -1):
        pt = None
        for off in (0.6, 0.9, 1.2):
            q = Point(cx + s * nx * off, cy + s * ny * off)
            if foot.contains(q) and q.distance(solid) > 0.3: pt = q; break
        sides.append((pt, visible(pt, own)))
    dw["stand"] = [[round(p.x, 3), round(p.y, 3)] if p else None for p, _ in sides]
    dw["visible_labels"] = [info for _, info in sides]
    dw["leaves"] = [[[round(v, 3) for v in d["a"]], [round(v, 3) for v in d["b"]]] for d in leaves
                    if LineString([d["a"], d["b"]]).distance(seg) < 0.15]
    del dw["u"], dw["n"]
doorways.sort(key=lambda d: (d["center"][1], d["center"][0]))
for k, dw in enumerate(doorways): dw["id"] = f"D{k + 1:02d}"

out = {"source": "DWG frame marks on layer 02 (jambs), wing.json/extras.json of this floor",
       "frame": "first-floor plan metres (x east, y north); glTF (x, h, -y)",
       "marks": len(marks), "unpaired_marks": [[round(m.x, 3), round(m.y, 3)] for k, m in enumerate(marks) if k not in used],
       "doorways": doorways,
}
json.dump(out, open(os.path.join(FLOOR_DIR, "doorways.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# Illustrative furniture must not stand in a doorway passage (stand point to stand point, 0.45 m either side):
# it is removed from extras.json. Sanitary fixtures come from the drawing and stay.
lanes = unary_union([LineString(dw["stand"]).buffer(0.45) for dw in doorways if dw["stand"][0] and dw["stand"][1]])
n_parts, n_items = len(X["furniture"]), len(X["items"])
X["furniture"] = [f for f in X["furniture"] if not Polygon(f["poly"]).buffer(0).intersects(lanes)]
X["items"] = [i for i in X["items"] if not Polygon(i["footprint"]).buffer(0).intersects(lanes)]
json.dump(X, open(os.path.join(FLOOR_DIR, "extras.json"), "w", encoding="utf-8"))
seen = sum(1 for dw in doorways for v in dw["visible_labels"] if v)
print(f"{FLOOR_DIR}: frame marks {len(marks)}, doorways {len(doorways)}, unpaired marks {len(out['unpaired_marks'])}, "
      f"stand points seeing a label {seen} of {2 * len(doorways)}; furniture removed from doorway passages: "
      f"{n_parts - len(X['furniture'])} parts, {n_items - len(X['items'])} items")

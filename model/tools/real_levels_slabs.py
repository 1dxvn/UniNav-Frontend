"""Slab pieces for the real-level candidate set described in real_levels.json (C16: floors 1-5).

Per floor: Block A (footprint with y >= a_y and x >= a_x) at a_offset from the floor's Block B datum; where the sheet
draws hall steps, the treads between the nosings at a_offset x k/4; where it draws a ramp, one sloped piece from 0.00 at
its south edge to a_offset at its north edge; the rest (Block B and the pending zones) at 0.00. Floors marked "from"
(reused from another candidate) are skipped. Also writes each floor's full outline (no stair wells) for the "inside the
building" test.
Output: data/<candidate>/slabs.json. Usage: python real_levels_slabs.py [config.json]   (default real_levels.json)
"""
import json, os, sys
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "data")
CFG = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "real_levels.json"), encoding="utf-8"))

def rings(geom):
    out = []
    for p in getattr(geom, "geoms", [geom]):
        if p.geom_type == "Polygon" and p.area > 0.01:
            out.append({"outer": [list(c) for c in p.exterior.coords[:-1]], "holes": [[list(c) for c in i.coords[:-1]] for i in p.interiors]})
    return out
def load(path, key, holes=True):
    d = json.load(open(os.path.join(DATA, path), encoding="utf-8"))
    return unary_union([(Polygon(r["outer"], r["holes"]) if holes else Polygon(r["outer"])).buffer(0) for r in d[key]])

out = {"candidate": CFG["candidate"], "floors": {}}
for fid, f in CFG["floors"].items():
    if f.get("from"): continue
    foot = load(f["slab"], "footprint_with_wells")
    outline = load(f["outline"], "footprint", holes=False)
    a_zone = box(f["a_x"], f["a_y"], 200, 200)
    pieces, strip = [], None
    if f["hall"]:
        (sx0, sx1), nos = f["hall"]["x"], f["hall"]["nosings"]
        strip = box(sx0, nos[0], sx1, nos[-1])
        for k in range(len(nos) - 1):
            pieces.append({"zone": f"hall-tread-{k + 1}", "top": round(f["a_offset"] * (k + 1) / (len(nos)), 4),
                           "rings": rings(foot.intersection(box(sx0, nos[k], sx1, nos[k + 1])))})
    a = foot.intersection(a_zone); rest = foot.difference(a_zone)
    if strip is not None: a = a.difference(strip); rest = rest.difference(strip)
    if f.get("ramp"):                                   # sloped piece: 0.00 at y0 (Block B side), a_offset at y1 (Block A side)
        (rx0, rx1), (ry0, ry1) = f["ramp"]["x"], f["ramp"]["y"]; rb = box(rx0, ry0, rx1, ry1)
        pieces.append({"zone": "ramp", "top": None, "ramp": {"a": f["a_offset"], "y0": ry0, "y1": ry1}, "rings": rings(foot.intersection(rb))})
        a = a.difference(rb); rest = rest.difference(rb)
    pieces.insert(0, {"zone": "A-north-bar", "top": f["a_offset"], "rings": rings(a)})
    pieces.append({"zone": "B-and-pending", "top": 0.0, "rings": rings(rest)})
    out["floors"][fid] = {"pieces": pieces, "outline": rings(outline)}
    print(fid, [(p["zone"], p["top"], round(sum(Polygon(r["outer"], r["holes"]).area for r in p["rings"]), 1)) for p in pieces])
os.makedirs(os.path.join(DATA, CFG["candidate"]), exist_ok=True)
json.dump(out, open(os.path.join(DATA, CFG["candidate"], "slabs.json"), "w", encoding="utf-8"))

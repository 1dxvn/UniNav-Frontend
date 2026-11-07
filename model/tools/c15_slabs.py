"""Slab pieces of the C15 real-level candidate (floors 1 and 2), from docs/blocks/level-zones.json.

Floor 1: Block A (footprint with y >= 49.23 and x >= 13.6) at -0.63, the hall steps as three treads between the
nosings y 47.86 / 48.32 / 48.78 / 49.23 (x 27.33-29.79) at -0.1575 / -0.315 / -0.4725, and the rest at 0.00.
Floor 2: Block A at -0.26 (N +2.68 against the B datum N +2.94), the rest at 0.00. Levels are relative to each floor's
Block B datum. Pending zones keep 0.00. Output: data/c15/slabs.json
Usage: python c15_slabs.py
"""
import json, os
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "data")
A_Y, A_X = 49.23, 13.6
NOSINGS = [47.86, 48.32, 48.78, 49.23]; SX0, SX1 = 27.33, 29.79; RISER = 0.63 / 4

def rings(geom):
    out = []
    for p in getattr(geom, "geoms", [geom]):
        if p.geom_type == "Polygon" and p.area > 0.01:
            out.append({"outer": [list(c) for c in p.exterior.coords[:-1]], "holes": [[list(c) for c in i.coords[:-1]] for i in p.interiors]})
    return out
def foot_of(path):
    d = json.load(open(path, encoding="utf-8"))
    return unary_union([Polygon(r["outer"], r["holes"]).buffer(0) for r in d["footprint_with_wells"]])

f1 = foot_of(os.path.join(DATA, "floor1_slab_wells.json"))
strip = box(SX0, NOSINGS[0], SX1, NOSINGS[-1])
a_zone = box(A_X, A_Y, 200, 200)
pieces1 = [{"zone": "A-north-bar", "top": -0.63, "rings": rings(f1.intersection(a_zone).difference(strip))}]
for k in range(3):
    tread = f1.intersection(box(SX0, NOSINGS[k], SX1, NOSINGS[k + 1]))
    pieces1.append({"zone": f"hall-tread-{k + 1}", "top": round(-RISER * (k + 1), 4), "rings": rings(tread)})
pieces1.append({"zone": "B-and-pending", "top": 0.0, "rings": rings(f1.difference(a_zone).difference(strip))})

f2 = foot_of(os.path.join(DATA, "floor2", "wing.json"))
pieces2 = [{"zone": "A-north-bar", "top": -0.26, "rings": rings(f2.intersection(a_zone))},
           {"zone": "B-and-pending", "top": 0.0, "rings": rings(f2.difference(a_zone))}]

os.makedirs(os.path.join(DATA, "c15"), exist_ok=True)
# Full outlines without the stair wells, for the "inside the building" test (stairs stand inside the wells).
def outline(path, key):
    d = json.load(open(path, encoding="utf-8"))
    return rings(unary_union([Polygon(r["outer"]).buffer(0) for r in d[key]]))
out = {"a_zone": {"y_min": A_Y, "x_min": A_X}, "hall_strip": [SX0, NOSINGS[0], SX1, NOSINGS[-1]], "nosings": NOSINGS,
       "riser": RISER, "floor1": pieces1, "floor2": pieces2,
       "outline1": outline(os.path.join(DATA, "extras.json"), "footprint"),
       "outline2": outline(os.path.join(DATA, "floor2", "wing.json"), "footprint")}
json.dump(out, open(os.path.join(DATA, "c15", "slabs.json"), "w", encoding="utf-8"))
for name, ps in (("floor1", pieces1), ("floor2", pieces2)):
    print(name, [(p["zone"], p["top"], round(sum(Polygon(r["outer"], r["holes"]).area for r in p["rings"]), 2)) for p in ps])

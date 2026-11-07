"""Stair wells: cuts the footprint of the Block A U-stairs (flights + semicircular landing) out of the slab of every floor
that a stair arrives at from the floor below. Writes "footprint_with_wells" into data/floor<N>/wing.json.
Args: data_dir floor_ids (e.g. "2,3,4,5")"""
import sys, json, os, math
from shapely.geometry import Polygon, box, Point
from shapely.ops import unary_union

DATA, IDS = sys.argv[1], sys.argv[2].split(",")
STAIRS = {"Stair_A_West": ((13.6, 15.7), (17.0, 19.1), (16.35, 59.2), 2.75),
          "Stair_A_East": ((35.3, 37.4), (37.6, 39.8), (37.55, 59.2), 2.25)}
Y0, YL = 56.2, 59.2
# Floors whose lower neighbour has each stair: floor 1 has both (candidate), floor 0 only the east one.
ARRIVING = {"2": ["Stair_A_West", "Stair_A_East"], "3": ["Stair_A_West", "Stair_A_East"],
            "4": ["Stair_A_West", "Stair_A_East"], "5": ["Stair_A_West", "Stair_A_East"]}
def well(name):
    (a0, a1), (b0, b1), (cx, cy), rl = STAIRS[name]
    half = Point(cx, cy).buffer(rl, 24).intersection(box(cx - rl, cy, cx + rl, cy + rl))
    # keep a 0.6 m strip at the south end so the top of flight 2 lands on the slab
    return unary_union([box(a0, Y0 + 0.6, b1, YL), half])
for n in IDS:
    p = os.path.join(DATA, f"floor{n}", "wing.json"); W = json.load(open(p, encoding="utf-8"))
    foot = unary_union([Polygon(r["outer"], r["holes"]).buffer(0) for r in W["footprint"]])
    wells = unary_union([well(s) for s in ARRIVING.get(n, [])]) if ARRIVING.get(n) else None
    cut = foot.difference(wells) if wells is not None else foot
    W["footprint_with_wells"] = [{"outer": [[round(x, 3), round(y, 3)] for x, y in list(q.exterior.coords)[:-1]],
                                  "holes": [[[round(x, 3), round(y, 3)] for x, y in list(i.coords)[:-1]] for i in q.interiors]}
                                 for q in getattr(cut, "geoms", [cut]) if q.geom_type == "Polygon" and q.area > 1]
    json.dump(W, open(p, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"floor {n}: wells {round(foot.area - cut.area, 1)} m2")

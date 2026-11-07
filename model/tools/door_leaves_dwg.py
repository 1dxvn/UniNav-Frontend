"""Door leaves drawn in the DWG for the floors other than the first.

On the upper sheets (and piso cero) most doors have no swing arc. The leaf is a thin closed rectangle on layer 02
(0.02-0.06 m by 0.55-1.3 m), drawn where the open leaf rests: at 90 degrees to the wall for hinged doors, along the
wall for sliding ones. extras.py only finds doorways as gaps between walls, so most of these doors were missing.

This appends each drawn leaf to extras.json as drawn (2.10 m high, 0.044 m thick, "src": "dwg") and removes the
furniture within one leaf length of it, so desks do not stand in the swing or the doorway. No swing arc is added,
because a leaf drawn along the wall may be a sliding door. Leaves within 0.3 m of a door extras.py already placed, or
within 0.6 m of the centre of a doorway it already filled, are skipped, as are leaves that cross a model solid or fall
outside the footprint. Re-running replaces the previous "dwg" leaves (run it right after extras.py).
Usage: python door_leaves_dwg.py <dxf> data/floorN
"""
import sys, json, math, os, ezdxf
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union

DXF, FLOOR_DIR = sys.argv[1:3]
W = json.load(open(os.path.join(FLOOR_DIR, "wing.json"), encoding="utf-8"))
XP = os.path.join(FLOOR_DIR, "extras.json"); X = json.load(open(XP, encoding="utf-8"))
ox, oy = W["origin_cad"]; c = W["crop_cad"]
def polys(key): return [Polygon(p["outer"], p["holes"]).buffer(0) for p in W[key]]
solid = unary_union(polys("walls") + polys("columns") + polys("glass"))
foot = unary_union(polys("footprint")).buffer(0.3)

X["doors"] = [d for d in X["doors"] if d.get("src") != "dwg"]
have_open = [Point(o["center"]) for o in X["openings"] if o.get("door")]
have_leaf = unary_union([LineString([d["a"], d["b"]]) for d in X["doors"]]) if X["doors"] else None

leaves = []
for e in ezdxf.readfile(DXF).modelspace().query('LWPOLYLINE[layer=="02"]'):
    raw = [(p[0], p[1]) for p in e.get_points("xy")]
    if not e.closed or len(raw) != 4 or not all(c[0] <= x <= c[2] and c[1] <= y <= c[3] for x, y in raw): continue
    poly = Polygon([(x - ox, y - oy) for x, y in raw])
    if not poly.is_valid or poly.area <= 0: continue
    m = list(poly.minimum_rotated_rectangle.exterior.coords)
    e1 = (m[1][0] - m[0][0], m[1][1] - m[0][1]); e2 = (m[2][0] - m[1][0], m[2][1] - m[1][1])
    l1, l2 = math.hypot(*e1), math.hypot(*e2)
    if l1 < l2: e1, l1, l2 = e2, l2, l1
    if l2 <= 0.065 and 0.55 <= l1 <= 1.3: leaves.append((poly, (e1[0] / l1, e1[1] / l1), l1))

added, skipped, clear = 0, {"duplicate": 0, "solid": 0, "outside": 0}, []
for poly, (ux, uy), L in leaves:
    cx, cy = poly.centroid.x, poly.centroid.y
    a = (cx - ux * L / 2, cy - uy * L / 2); b = (cx + ux * L / 2, cy + uy * L / 2); line = LineString([a, b])
    if not foot.contains(poly): skipped["outside"] += 1; continue
    if poly.buffer(-0.005).intersects(solid): skipped["solid"] += 1; continue
    if (have_leaf is not None and line.distance(have_leaf) < 0.3) or any(line.distance(o) < 0.6 for o in have_open):
        skipped["duplicate"] += 1; continue
    X["doors"].append({"a": [a[0], a[1]], "b": [b[0], b[1]], "thick": 0.044, "height": 2.10, "glass": False, "src": "dwg"})
    clear.append(line.buffer(min(L, 0.9))); added += 1

removed_parts = removed_items = 0
if clear:
    zone = unary_union(clear)
    keep = [f for f in X["furniture"] if not Polygon(f["poly"]).buffer(0).intersects(zone)]
    removed_parts = len(X["furniture"]) - len(keep); X["furniture"] = keep
    keep = [i for i in X["items"] if not Polygon(i["footprint"]).buffer(0).intersects(zone)]
    removed_items = len(X["items"]) - len(keep); X["items"] = keep
json.dump(X, open(XP, "w", encoding="utf-8"))
print(f"{FLOOR_DIR}: DWG leaves {len(leaves)}, added {added}, skipped {skipped}, furniture parts removed {removed_parts}, "
      f"items removed {removed_items}, doors now {len(X['doors'])}")

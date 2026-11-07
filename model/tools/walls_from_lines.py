"""Completes the walls of a registered floor sheet from the double wall lines on layer '01'.
Faces of the polygonized linework that are thin (equivalent thickness 2·area/perimeter < MAXT) are walls.
They are merged with the solid hatches already in wing.json. Door-schedule and section-mark areas are excluded.
Args: dxf wing.json(in/out) "dx,dy" [maxt]"""
import sys, json, math, ezdxf
from ezdxf import path as dpath
from shapely.geometry import Polygon, LineString, box, Point
from shapely.ops import unary_union, polygonize

DXF, WING, SH = sys.argv[1:4]
MAXT = float(sys.argv[4]) if len(sys.argv) > 4 else 0.45
dx, dy = map(float, SH.split(","))
W = json.load(open(WING, encoding="utf-8"))
O = (5915.0, -1792.0)
BUILD = box(-9, 9, 72, 70).difference(box(63.5, 0, 80, 39.5))     # building window, without the door schedule
doc = ezdxf.readfile(DXF); msp = doc.modelspace()
segs = []
for e in msp.query('LINE LWPOLYLINE[layer=="01"]'):
    try: pts = [(v.x + dx - O[0], v.y + dy - O[1]) for v in dpath.make_path(e).flattening(0.05)]
    except Exception: continue
    for a, b in zip(pts, pts[1:]):
        s = LineString([a, b])
        if s.length > 0.02 and BUILD.contains(s.centroid): segs.append(s)
faces = list(polygonize(unary_union(segs)))
thin = [f for f in faces if f.area > 0.02 and 2 * f.area / f.length < MAXT and f.area < 25]
def polys(rings): return [Polygon(r["outer"], r["holes"]).buffer(0) for r in rings]
def is_block(p):
    """The repeated 0.34 x 1.38 m solid hatches (rows in labs and classrooms) are not walls."""
    mrr = p.minimum_rotated_rectangle; c = list(mrr.exterior.coords)
    a = LineString(c[0:2]).length; b = LineString(c[1:3]).length
    return 0.28 <= min(a, b) <= 0.40 and 1.25 <= max(a, b) <= 1.50 and p.area > 0.8 * mrr.area
anchors = [Point(l["xy"]) for l in W["labels"]]
def is_tag(p):
    """Small filled bars drawn at each room label anchor (part of the room tag, not a wall)."""
    mrr = p.minimum_rotated_rectangle; c = list(mrr.exterior.coords)
    a = LineString(c[0:2]).length; b = LineString(c[1:3]).length
    return p.area < 1.0 and max(a, b) < 1.7 and any(p.centroid.distance(q) < 1.6 for q in anchors)
# Each hatch boundary path on its own (extract.py merges them), so adjacent tag bars are judged one by one.
cand = []
for e in msp.query('HATCH[layer=="linea de corte"]'):
    if not e.dxf.solid_fill: continue
    try: paths = list(e.paths.rendering_paths(e.dxf.hatch_style))
    except Exception: continue
    for pth in paths:
        pts = [(v.x + dx - O[0], v.y + dy - O[1]) for v in dpath.from_hatch_boundary_path(pth).flattening(0.02)]
        if len(pts) < 3: continue
        pg = Polygon(pts).buffer(0)
        if not pg.is_empty and BUILD.contains(pg.representative_point()): cand.append(pg)
W["blocks_034x138"] = [[[round(x, 3), round(y, 3)] for x, y in list(p.exterior.coords)[:-1]] for p in cand if is_block(p) or is_tag(p)]
hatched = unary_union([p for p in cand if not (is_block(p) or is_tag(p))])
tag_faces = [f for f in thin if is_tag(f) or is_block(f)]
thin = [f for f in thin if not (is_tag(f) or is_block(f))]
W["blocks_034x138"] += [[[round(x, 3), round(y, 3)] for x, y in list(f.exterior.coords)[:-1]] for f in tag_faces]
walls = unary_union([hatched] + thin)
walls = walls.difference(unary_union(polys(W["columns"])))
print("repeated 0.34 x 1.38 m blocks kept out of the walls:", len(W.get("blocks_034x138", [])))
def ring(p): return {"outer": [[round(x, 3), round(y, 3)] for x, y in list(p.exterior.coords)[:-1]], "holes": [[[round(x, 3), round(y, 3)] for x, y in list(i.coords)[:-1]] for i in p.interiors]}
before = hatched.area
W["walls"] = [ring(p) for p in getattr(walls, "geoms", [walls]) if p.geom_type == "Polygon" and p.area > 0.01]
W["columns"] = [r for r in W["columns"] if BUILD.contains(Polygon(r["outer"]).representative_point())]
W["glass"] = [r for r in W["glass"] if BUILD.contains(Polygon(r["outer"]).representative_point())]
W["glass_lines"] = [g for g in W.get("glass_lines", []) if BUILD.contains(LineString(g).centroid)]
W["ramps"] = [r for r in W["ramps"] if BUILD.contains(Polygon(r["outer"]).representative_point())]
solid = unary_union([walls] + polys(W["columns"]) + polys(W["glass"]))
foot = solid.buffer(4.5, join_style=2).buffer(-4.5, join_style=2)
foot = unary_union([Polygon(p.exterior) for p in getattr(foot, "geoms", [foot]) if p.geom_type == "Polygon" and p.area > 30])
W["footprint"] = [ring(p) for p in getattr(foot, "geoms", [foot]) if p.geom_type == "Polygon"]
W["walls_method"] = f"solid hatches + thin faces of layer 01 (t < {MAXT} m)"
json.dump(W, open(WING, "w", encoding="utf-8"), ensure_ascii=False)
print(f"faces {len(faces)}, thin {len(thin)}; wall area {before:.1f} -> {walls.area:.1f} m2; footprint {foot.area:.1f} m2")

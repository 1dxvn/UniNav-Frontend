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
# Long tag bars: under long room names ("AULA No 205 B", "HALL ASCENSORES") the filled tag bar is 1.2-3 m long, too
# long for is_tag, and the label anchor may sit up to ~1 m from it. Such a bar is a solid hatch, it stands alone in its
# room (it touches no wall, column or glass) and a label anchor lies within 1.1 m. Without this test it became a
# free-standing wall in the middle of the room. Layer-01 partitions (not hatched) are never taken for tags.
others = unary_union(polys(W["columns"]) + polys(W["glass"]))
parts = [p for p in getattr(walls, "geoms", [walls]) if p.geom_type == "Polygon"]
def long_tag(i, p):
    mrr = p.minimum_rotated_rectangle; c = list(mrr.exterior.coords)
    a = LineString(c[0:2]).length; b = LineString(c[1:3]).length
    if not (0.18 <= min(a, b) <= 0.45 and 1.2 <= max(a, b) < 3.0 and p.area > 0.9 * mrr.area): return False
    if p.intersection(hatched).area < 0.9 * p.area: return False
    if not any(p.distance(q) < 1.1 for q in anchors) or p.distance(others) < 0.03: return False
    return all(p.distance(o) >= 0.03 for j, o in enumerate(parts) if j != i)
long_tags = [p for i, p in enumerate(parts) if long_tag(i, p)]
walls_out = walls      # the footprint below still uses all solids, so removing the bars leaves the slab unchanged
if long_tags:
    walls_out = unary_union([p for p in parts if not any(p is t for t in long_tags)])
    W["blocks_034x138"] += [[[round(x, 3), round(y, 3)] for x, y in list(p.exterior.coords)[:-1]] for p in long_tags]
print("long tag bars kept out of the walls:", len(long_tags))
print("repeated 0.34 x 1.38 m blocks kept out of the walls:", len(W.get("blocks_034x138", [])))
def ring(p): return {"outer": [[round(x, 3), round(y, 3)] for x, y in list(p.exterior.coords)[:-1]], "holes": [[[round(x, 3), round(y, 3)] for x, y in list(i.coords)[:-1]] for i in p.interiors]}
before = hatched.area
W["walls"] = [ring(p) for p in getattr(walls_out, "geoms", [walls_out]) if p.geom_type == "Polygon" and p.area > 0.01]
W["columns"] = [r for r in W["columns"] if BUILD.contains(Polygon(r["outer"]).representative_point())]
W["glass"] = [r for r in W["glass"] if BUILD.contains(Polygon(r["outer"]).representative_point())]
W["glass_lines"] = [g for g in W.get("glass_lines", []) if BUILD.contains(LineString(g).centroid)]
W["ramps"] = [r for r in W["ramps"] if BUILD.contains(Polygon(r["outer"]).representative_point())]
solid = unary_union([walls] + polys(W["columns"]) + polys(W["glass"]))
foot = solid.buffer(4.5, join_style=2).buffer(-4.5, join_style=2)
# Large rooms enclosed by walls and glass (doorways closed by a 0.7 m margin) also get a floor, whatever their size.
enclosed = [Polygon(i).buffer(0.7, join_style=2) for p in getattr(solid.buffer(0.7, join_style=2), "geoms", [solid.buffer(0.7, join_style=2)])
            if p.geom_type == "Polygon" for i in p.interiors if Polygon(i).area > 4]
foot = unary_union([foot] + enclosed)
foot = unary_union([Polygon(p.exterior) for p in getattr(foot, "geoms", [foot]) if p.geom_type == "Polygon" and p.area > 30])
# Rooms that a wide 9 m closing adds are kept only if they are enclosed: >= 92 % of their outline runs along the
# existing floor, walls or glass. Open facade notches fail this test and stay open.
big = solid.buffer(9.0, join_style=2).buffer(-9.0, join_style=2)
edge = unary_union([foot.buffer(0.3), solid.buffer(0.3)])
added = []
cands = big.difference(foot).difference(solid.buffer(0.15))      # split candidates along walls and glass
for p in getattr(cands, "geoms", [cands]):
    if p.geom_type != "Polygon" or p.area < 6: continue
    share = p.exterior.intersection(edge).length / p.exterior.length
    if share >= 0.92: added.append(p.buffer(0.2, join_style=2))
# The glass-walled north-west block (cafeteria on floor 1, library on floor 2, periodicals room on floor 3) gets the
# convex hull of its walls and glass, as on the first floor.
west = solid.intersection(box(-8, 41.5, 13.6, 64.5))
west = unary_union([p for p in getattr(west, "geoms", [west]) if p.geom_type == "Polygon" and p.area > 0.25])   # ignore stray stubs
south_edge = solid.intersection(box(-8, 41.5, 13.6, 44.0)).area      # the block's south glazing (floors 1-3 only)
if not west.is_empty and west.area > 1 and south_edge > 0.5:
    added.append(west.convex_hull.buffer(0.02, join_style=2))
foot = unary_union([foot] + added)
foot = unary_union([Polygon(p.exterior) for p in getattr(foot, "geoms", [foot]) if p.geom_type == "Polygon" and p.area > 30])
print("enclosed rooms added to the slab:", len(added), round(sum(a.area for a in added), 1), "m2")
W["footprint"] = [ring(p) for p in getattr(foot, "geoms", [foot]) if p.geom_type == "Polygon"]
W["walls_method"] = f"solid hatches + thin faces of layer 01 (t < {MAXT} m)"
json.dump(W, open(WING, "w", encoding="utf-8"), ensure_ascii=False)
print(f"faces {len(faces)}, thin {len(thin)}; wall area {before:.1f} -> {walls.area:.1f} m2; footprint {foot.area:.1f} m2")

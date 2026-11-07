"""Site elements of the first-floor crop in plan metres -> site.json.
Args: dxf wing.json extras.json graph.py out.json
Every element that reaches body height is checked against the API route centre lines."""
import sys, json, math, re, ezdxf
from ezdxf import path as dpath
from shapely.geometry import Polygon, Point, LineString, box, MultiPoint
from shapely.ops import unary_union

DXF, WING, EXTRAS, GRAPH, OUT = sys.argv[1:6]
W = json.load(open(WING, encoding="utf-8")); X = json.load(open(EXTRAS, encoding="utf-8"))
O = W["origin_cad"]
CROP_L = box(-10, -8, 77, 68)
loc = lambda x, y: (x - O[0], y - O[1])
g = {}; exec(open(GRAPH, encoding="utf-8").read(), g)
P = {r[0]: (r[1], r[2]) for r in g["PLACES"]}
routes = unary_union([LineString([P[a], P[b]]) for a, b, _ in g["PATHS"]])
def polys(rings): return unary_union([Polygon(p["outer"], p["holes"]).buffer(0) for p in rings])
solid = unary_union([polys(W["walls"]), polys(W["columns"]), polys(W["glass"])])
foot = polys(X["footprint"])

doc = ezdxf.readfile(DXF); msp = doc.modelspace()
def pts_of(e, tol=0.03):
    try: return [loc(q.x, q.y) for q in dpath.make_path(e).flattening(tol)]
    except Exception: return []
def in_crop(xy): return CROP_L.contains(Point(xy))
report = {}

# ---- labelled green areas: closed polylines whose area matches the label's "xx M2"
labels = [(l["text"].replace("\n", " ").strip(), Point(l["xy"])) for l in W["labels"]]
areas = []
for t, pt in labels:
    m = re.match(r"^([\d.,]+)\s*M2$", t.upper())
    if m:
        try: areas.append((float(m.group(1).replace(",", ".")), pt))
        except ValueError: pass
closed = []
for e in msp.query("LWPOLYLINE POLYLINE"):
    try:
        if not e.closed and e.dxftype() == "LWPOLYLINE": continue
    except Exception: pass
    p = pts_of(e, 0.05)
    if len(p) < 3: continue
    if not any(in_crop(q) for q in p[:: max(1, len(p) // 6)]): continue
    poly = Polygon(p).buffer(0)
    if poly.is_valid and poly.area > 1.0: closed.append((poly, e.dxf.layer))
green = []
for t, pt in labels:
    if not re.search(r"JARDIN|ZONA VERDE", t.upper()): continue
    near = [a for a in areas if a[1].distance(pt) < 1.2]
    target = min(near, key=lambda a: a[1].distance(pt))[0] if near else None
    cands = [(poly, L) for poly, L in closed if poly.contains(pt)]
    if target:
        cands = [c for c in cands if abs(c[0].area - target) / target < 0.2]
    if not cands and target:
        # The outline is drawn as loose segments: node every segment near the label and polygonize.
        win = pt.buffer(math.sqrt(target) * 2.5 + 4)
        segs = []
        for e in msp.query("LINE LWPOLYLINE ARC POLYLINE"):
            if e.dxf.layer in ("VEGETACION-A", "VEGETACION 2", "SUMIDEROS", "03", "Cotas2"): continue
            p = pts_of(e, 0.05)
            if len(p) >= 2:
                ls = LineString(p)
                if ls.intersects(win): segs.append(ls.intersection(win.buffer(2)))
        from shapely.ops import polygonize
        faces = list(polygonize(unary_union(segs)))
        cands = [(f, "polygonized") for f in faces if f.contains(pt) and abs(f.area - target) / target < 0.25]
    if cands:
        best = min(cands, key=lambda c: abs(c[0].area - (target or c[0].area)))
        green.append(best[0].difference(solid))
        report.setdefault("green", []).append((t, round(best[0].area, 1), target, best[1]))
    else:
        report.setdefault("green_missing", []).append((t, target))
green = unary_union(green).intersection(CROP_L)

# ---- trees (blocks) with crown radius from block extents
def bbox_radius(e):
    xs, ys = [], []
    for v in e.virtual_entities():
        for q in pts_of(v, 0.1): xs.append(q[0]); ys.append(q[1])
    if not xs: return None, None
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    return (cx, cy), max(max(xs) - min(xs), max(ys) - min(ys)) / 2
trees = []
for e in msp.query("INSERT"):
    if e.dxf.layer not in ("VEGETACION-A", "ARBOL"): continue
    ins = loc(e.dxf.insert.x, e.dxf.insert.y)
    if not in_crop(ins): continue
    c, r = bbox_radius(e)
    if c is None: continue
    trees.append({"xy": c, "r": round(min(max(r, 0.6), 4.5), 2), "kind": "existing" if e.dxf.layer == "ARBOL" else "tree", "block": e.dxf.name})
# shrubs: VEGETACION-A / VEGETACION 2 polylines, grouped
shrub_geoms = []
for e in msp.query('LWPOLYLINE[layer=="VEGETACION-A" | layer=="VEGETACION 2"]'):
    p = pts_of(e, 0.05)
    if len(p) >= 3 and in_crop(p[0]): shrub_geoms.append(MultiPoint(p).convex_hull)
shrubs = []
for sg in getattr(unary_union([s.buffer(0.05) for s in shrub_geoms]), "geoms", []):
    c = sg.centroid; r = math.sqrt(sg.area / math.pi)
    if 0.15 < r < 2.5: shrubs.append({"xy": (c.x, c.y), "r": round(r, 2)})

# ---- PISO4 circles: slender trees along the walk (approximate, documented)
cypress = []
for e in msp.query('CIRCLE[layer=="PISO4"]'):
    c = loc(e.dxf.center.x, e.dxf.center.y)
    if in_crop(c): cypress.append({"xy": c, "r": round(e.dxf.radius, 2)})

# ---- stone walls (MUROPIEDRA) and planters (JARDINERA): 0.30 m thick lines
def line_band(layer, width):
    out = []
    for e in msp.query(f'LWPOLYLINE LINE[layer=="{layer}"]'):
        p = pts_of(e, 0.05)
        if len(p) >= 2 and any(in_crop(q) for q in p): out.append(LineString(p).buffer(width / 2, cap_style=2, join_style=2))
    return unary_union(out).intersection(CROP_L) if out else None
stone = line_band("MUROPIEDRA", 0.30)
planter = line_band("JARDINERA", 0.20)

# ---- green wall (MUROTUBOS circles on the west edge) and tube fence (east group)
tubes = [loc(e.dxf.center.x, e.dxf.center.y) for e in msp.query('CIRCLE[layer=="MUROTUBOS"]')]
tubes = [t for t in tubes if in_crop(t) or (-10.6 < t[0] < -9.0 and -8 < t[1] < 68)]
west = sorted([t for t in tubes if t[0] < -5], key=lambda t: t[1])
east = sorted([t for t in tubes if t[0] > 15], key=lambda t: (t[0], t[1]))
greenwall = LineString([(sum(t[0] for t in west) / len(west), west[0][1]), (sum(t[0] for t in west) / len(west), west[-1][1])]) if len(west) > 2 else None
fence = None
if len(east) > 2:
    mp = MultiPoint(east); mrr = mp.minimum_rotated_rectangle; c = list(mrr.exterior.coords)
    e1 = LineString([c[0], c[1]]); e2 = LineString([c[1], c[2]])
    long_e = e1 if e1.length >= e2.length else e2
    mid = mrr.centroid; dx = (long_e.coords[1][0] - long_e.coords[0][0]) / 2; dy = (long_e.coords[1][1] - long_e.coords[0][1]) / 2
    fence = LineString([(mid.x - dx, mid.y - dy), (mid.x + dx, mid.y + dy)])

# ---- luminaires
lamps = []
for e in msp.query("INSERT"):
    if "LUMINARIA" in e.dxf.layer.upper() or "ILUMINACI" in e.dxf.layer.upper():
        xy = loc(e.dxf.insert.x, e.dxf.insert.y)
        if in_crop(xy): lamps.append({"xy": xy, "layer": e.dxf.layer})

# ---- overhangs (VOLADO) and pedestals (PEDESTAL)
volado = []
for e in msp.query('LWPOLYLINE LINE[layer=="VOLADO"]'):
    p = pts_of(e, 0.05)
    if len(p) >= 2 and any(in_crop(q) for q in p): volado.append({"pts": p, "closed": bool(getattr(e, "closed", False))})
pedestals = []
for e in msp.query('LWPOLYLINE[layer=="PEDESTAL"]'):
    p = pts_of(e, 0.02)
    if len(p) >= 3 and in_crop(p[0]):
        poly = Polygon(p).buffer(0); pedestals.append({"xy": (poly.centroid.x, poly.centroid.y), "size": [round(v, 2) for v in poly.bounds]})

# ---- clearance filter for anything at body height
def keep(geom, need):
    return geom.distance(routes) >= need
def ring(p): return {"outer": [list(c) for c in p.exterior.coords[:-1]], "holes": [[list(c) for c in i.coords[:-1]] for i in p.interiors]}
def polylist(g):
    if g is None or g.is_empty: return []
    return [ring(p) for p in getattr(g, "geoms", [g]) if p.geom_type == "Polygon" and p.area > 0.01]

dropped = {}
def filt(items, need, geom_of, key):
    out = []
    for it in items:
        if keep(geom_of(it), need): out.append(it)
        else: dropped[key] = dropped.get(key, 0) + 1
    return out
trees = filt(trees, 0.65, lambda t: Point(t["xy"]).buffer(0.18), "trees")
cypress = filt(cypress, 0.65, lambda t: Point(t["xy"]).buffer(0.35), "cypress")
shrubs = filt(shrubs, 0.65, lambda t: Point(t["xy"]).buffer(min(t["r"], 0.9)), "shrubs")
lamps = filt(lamps, 0.65, lambda t: Point(t["xy"]).buffer(0.08), "lamps")
stone_list = [p for p in polylist(stone) if keep(Polygon(p["outer"]), 0.6)]
planter_list = [p for p in polylist(planter) if keep(Polygon(p["outer"]), 0.6)]
dropped["stone_segments"] = len(polylist(stone)) - len(stone_list)
dropped["planter_segments"] = len(polylist(planter)) - len(planter_list)

# planting beds around vegetation clusters (gardens drawn without closed outlines)
beds = unary_union([Point(t["xy"]).buffer(t["r"] * 0.9 + 0.5) for t in trees] + [Point(s["xy"]).buffer(s["r"] + 0.45) for s in shrubs])
beds = unary_union([b for b in getattr(beds, "geoms", [beds]) if b.area > 6]).simplify(0.08)
green = unary_union([green, beds]).difference(solid.buffer(0.05)).difference(foot).intersection(CROP_L)
# keep a clear 1.2 m band along the routes (no planting bed lip under the avatar)
green = green.difference(routes.buffer(1.2))

# glass segments (VIDRIO) for frames and mullions
glass_lines = []
for e in msp.query('LINE LWPOLYLINE[layer=="VIDRIO"]'):
    p = pts_of(e, 0.05)
    for a, b in zip(p, p[1:]):
        s = LineString([a, b]).intersection(CROP_L)
        if s.geom_type == "LineString" and s.length > 0.05: glass_lines.append([list(s.coords[0]), list(s.coords[-1])])

json.dump({
    "glass_lines": glass_lines,
    "green": polylist(green),
    "trees": trees, "cypress": cypress, "shrubs": shrubs, "lamps": lamps,
    "stone": stone_list, "planters": planter_list,
    "greenwall": list(greenwall.coords) if greenwall else None, "fence": list(fence.coords) if fence else None,
    "volado": volado, "pedestals": pedestals,
}, open(OUT, "w", encoding="utf-8"))
print("green areas", report.get("green"), "missing", report.get("green_missing"))
print("trees", len(trees), "cypress", len(cypress), "shrubs", len(shrubs), "lamps", len(lamps))
print("stone", len(stone_list), "planters", len(planter_list), "greenwall", greenwall, "fence", fence)
print("volado", [(len(v["pts"]), v["closed"], [round(c, 1) for c in v["pts"][0]]) for v in volado])
print("pedestals", pedestals)
print("dropped near routes", dropped)

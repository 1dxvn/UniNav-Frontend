"""Extracts the first-floor wing of PLANOS UCC 2025 - B into local-coordinate JSON for Blender."""
import sys, json, ezdxf
from ezdxf import path as dpath
from shapely.geometry import Polygon, LineString, box, mapping
from shapely.ops import unary_union
from shapely.validation import make_valid

SRC, OUT = sys.argv[1], sys.argv[2]
# Optional third argument "dx,dy": the shift that registers another floor sheet onto the first-floor sheet
# (data/grid_axes.json, "to_first_floor"). Output coordinates are always first-floor plan coordinates.
SHIFT = tuple(float(v) for v in sys.argv[3].split(",")) if len(sys.argv) > 3 else (0.0, 0.0)
ORIGIN = (5915.0 - SHIFT[0], -1792.0 - SHIFT[1])            # entrance threshold, HALL ACCESO (in this sheet)
CROP = box(5905 - SHIFT[0], -1800 - SHIFT[1], 5992 - SHIFT[0], -1724 - SHIFT[1])  # wing crop, CAD metres of this sheet

doc = ezdxf.readfile(SRC); msp = doc.modelspace()
loc = lambda x, y: (round(x - ORIGIN[0], 3), round(y - ORIGIN[1], 3))

def polys_from_hatch(h):
    rings = []
    for p in h.paths.rendering_paths(h.dxf.hatch_style) if hasattr(h.paths, "rendering_paths") else h.paths:
        pts = [(v.x, v.y) for v in dpath.from_hatch_boundary_path(p).flattening(0.02)]
        if len(pts) >= 3: rings.append(pts)
    out = []
    for r in rings:
        g = make_valid(Polygon(r))
        out.append(g)
    # even-odd: XOR rings
    g = None
    for r in out:
        g = r if g is None else g.symmetric_difference(r)
    return g

walls, ramps, columns, glass = [], [], [], []
for e in msp.query('HATCH[layer=="linea de corte"]'):
    try: g = polys_from_hatch(e)
    except Exception: continue
    if g is None or g.is_empty or not g.intersects(CROP): continue
    g = g.intersection(CROP)
    (walls if e.dxf.solid_fill else ramps).append(g)
for e in msp.query('LWPOLYLINE[layer=="06"]'):
    pts = [(p[0], p[1]) for p in e.get_points()]
    if len(pts) >= 3:
        g = make_valid(Polygon(pts))
        if 0.01 < g.area < 3 and g.intersects(CROP): columns.append(g)
glass_lines = []
for e in msp.query('LINE[layer=="VIDRIO"]'):
    s = LineString([(e.dxf.start.x, e.dxf.start.y), (e.dxf.end.x, e.dxf.end.y)])
    if s.length > 0.05 and s.intersects(CROP):
        s = s.intersection(CROP); glass.append(s.buffer(0.04, cap_style=2))
        if s.geom_type == "LineString": glass_lines.append([loc(*s.coords[0]), loc(*s.coords[-1])])

wall_u = unary_union(walls); col_u = unary_union(columns); glass_u = unary_union(glass).difference(wall_u)
solid = unary_union([wall_u, col_u, glass_u])
# Footprint: close gaps between walls so rooms and corridors get a floor.
foot = solid.buffer(4.5, join_style=2).buffer(-4.5, join_style=2)
foot = unary_union([Polygon(p.exterior) for p in getattr(foot, "geoms", [foot]) if p.area > 30])

def to_local(g):
    polys = [p for p in getattr(g, "geoms", [g]) if p.geom_type == "Polygon" and p.area > 1e-4]
    res = []
    for p in polys:
        p = p.simplify(0.005)
        res.append({"outer": [loc(*c) for c in list(p.exterior.coords)[:-1]],
                    "holes": [[loc(*c) for c in list(i.coords)[:-1]] for i in p.interiors]})
    return res

def flat(gs):
    out = []
    for g in gs:
        g = make_valid(g)
        for p in getattr(g, "geoms", [g]):
            if p.geom_type == "Polygon": out.append(p)
            elif p.geom_type in ("MultiPolygon", "GeometryCollection"): out += [q for q in p.geoms if q.geom_type == "Polygon"]
    return out

labels = []
for e in msp.query("TEXT MTEXT"):
    p = e.dxf.insert
    if CROP.contains(box(p.x, p.y, p.x, p.y).centroid) and e.dxf.layer == "03":
        t = (e.plain_text() if e.dxftype() == "MTEXT" else e.dxf.text).strip()
        if t: labels.append({"text": t, "xy": loc(p.x, p.y)})

data = {
    "origin_cad": ORIGIN, "units": "m", "crop_cad": list(CROP.bounds), "sheet_shift": SHIFT, "glass_lines": glass_lines,
    "walls": to_local(wall_u), "columns": to_local(col_u), "glass": to_local(glass_u),
    "ramps": to_local(unary_union(flat(ramps))), "footprint": to_local(foot),
    "site": to_local(CROP), "labels": labels,
}
json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
print({k: len(v) for k, v in data.items() if isinstance(v, list)}, "wall area", round(wall_u.area, 1), "foot area", round(foot.area, 1))

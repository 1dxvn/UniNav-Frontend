"""Exterior massing data for Blocks A and B from the registered upper-floor sheets.
For each floor: building outline (closing of cut walls + columns + glass), split into Block A (north bar) and
Block B (south body), and the glass segments that lie on the outline (exterior glazing).
Args: dxf grid_axes.json out.json"""
import sys, json, ezdxf
from ezdxf import path as dpath
from shapely.geometry import Polygon, LineString, box, Point
from shapely.ops import unary_union
from shapely.validation import make_valid

DXF, GRID, OUT = sys.argv[1:4]
grid = json.load(open(GRID)); O = (5915.0, -1792.0)
doc = ezdxf.readfile(DXF); msp = doc.modelspace()
BUILDING = box(-9, 9, 72, 70)               # plan window of the building (excludes title block and schedules)
A_ZONE, B_ZONE = box(-12, 47.0, 75, 72), box(-12, 5, 75, 47.0)
FLOORS = ["SEGUNDO PISO", "TERCER PISO", "CUARTO PISO", "QUINTO PISO", "AZOTEA CANCHAS SINTETICAS"]

def to_plan(name):
    dx, dy = grid[name]["to_first_floor"]
    return lambda x, y: (x + dx - O[0], y + dy - O[1])
data = {}
hatches = list(msp.query("HATCH"))
cols06 = list(msp.query('LWPOLYLINE[layer=="06"]'))
glass_e = list(msp.query('LINE LWPOLYLINE[layer=="VIDRIO"]'))
for name in FLOORS:
    T = to_plan(name); solids, glass_lines = [], []
    for e in hatches:
        if e.dxf.layer != "linea de corte" or not e.dxf.solid_fill: continue
        try: paths = list(e.paths.rendering_paths(e.dxf.hatch_style))
        except Exception: continue
        for p in paths:
            pts = [T(v.x, v.y) for v in dpath.from_hatch_boundary_path(p).flattening(0.05)]
            if len(pts) >= 3 and BUILDING.contains(Point(pts[0])): solids.append(make_valid(Polygon(pts)).buffer(0))
    for e in cols06:
        pts = [T(q[0], q[1]) for q in e.get_points()]
        if len(pts) >= 3 and BUILDING.contains(Point(pts[0])):
            g = make_valid(Polygon(pts)).buffer(0)
            if 0.01 < g.area < 3: solids.append(g)
    for e in glass_e:
        try: pts = [T(v.x, v.y) for v in dpath.make_path(e).flattening(0.05)]
        except Exception: continue
        for a, b in zip(pts, pts[1:]):
            s = LineString([a, b])
            if s.length > 0.05 and BUILDING.contains(s.centroid): glass_lines.append(s)
    solid = unary_union(solids + [g.buffer(0.04, cap_style=2) for g in glass_lines])
    outline = solid.buffer(3.0, join_style=2).buffer(-3.0, join_style=2)
    outline = unary_union([Polygon(p.exterior).simplify(0.12) for p in getattr(outline, "geoms", [outline]) if p.geom_type == "Polygon" and p.area > 30])
    ring = outline.boundary
    ext_glass = [s for s in glass_lines if s.centroid.distance(ring) < 0.6]
    def rings(g):
        return [[list(c) for c in p.exterior.coords[:-1]] for p in getattr(g, "geoms", [g]) if p.geom_type == "Polygon" and p.area > 8]
    data[name] = {"A": rings(outline.intersection(A_ZONE)), "B": rings(outline.intersection(B_ZONE)),
                  "glass": [[list(s.coords[0]), list(s.coords[-1])] for s in ext_glass],
                  "area": round(outline.area, 1)}
    data[name]["_outline"] = outline
    print(f"{name:28s} outline {outline.area:7.1f} m2  A parts {len(data[name]['A'])}  B parts {len(data[name]['B'])}  exterior glass {len(ext_glass)} of {len(glass_lines)}")
# Roofs: the part of each storey that the storey above does not cover (terraces), per block.
STOREYS = ["SEGUNDO PISO", "TERCER PISO", "CUARTO PISO", "QUINTO PISO"]
for i, name in enumerate(STOREYS):
    here = data[name]["_outline"]
    above = data[STOREYS[i + 1]]["_outline"] if i + 1 < len(STOREYS) else None
    for blk, zone in (("A", A_ZONE), ("B", B_ZONE)):
        part = here.intersection(zone)
        if above is not None: part = part.difference(above.intersection(zone).buffer(0.05, join_style=2))
        part = part.buffer(-0.05, join_style=2).buffer(0.05, join_style=2)
        data[name][f"roof_{blk}"] = [[list(c) for c in p.exterior.coords[:-1]] for p in getattr(part, "geoms", [part])
                                     if p.geom_type == "Polygon" and p.area > 6]
        print(f"  roof {name} {blk}: {round(sum(Polygon(r).area for r in data[name][f'roof_{blk}']), 1)} m2")
for name in data: data[name].pop("_outline", None)
json.dump(data, open(OUT, "w"), indent=0)

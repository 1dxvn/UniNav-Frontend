"""Floor-by-floor inventory of the DWG in first-floor plan coordinates (origin Hall Acceso, CAD 5915, -1792).
Uses data/grid_axes.json (sheet registration by structural grid). Args: dxf grid_axes.json out.json out.png"""
import sys, json, re, ezdxf, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from ezdxf import path as dpath
from shapely.geometry import Polygon, Point, box
from shapely.ops import unary_union
from shapely.validation import make_valid

DXF, GRID, OUT, PNG = sys.argv[1:5]
grid = json.load(open(GRID))
O = (5915.0, -1792.0)
doc = ezdxf.readfile(DXF); msp = doc.modelspace()
ORDER = ["PISO CERO", "PRIMER PISO", "SEGUNDO PISO", "TERCER PISO", "CUARTO PISO", "QUINTO PISO", "AZOTEA CANCHAS SINTETICAS"]
floors = {}
for name in ORDER:
    g = grid[name]; dx, dy = g["to_first_floor"]
    cx = [v[0] for v in g["cols"].values()]; ry = [v[1] for v in g["rows"].values()]
    # sheet window in its own CAD coordinates, from the grid bubble extents
    win = box(min(cx) - 12, min(ry) - 25, max(cx) + 12, max(ry) + 12)
    floors[name] = {"shift": (dx, dy), "win": win, "walls": [], "texts": []}
for e in msp.query("HATCH"):
    if e.dxf.layer != "linea de corte" or not e.dxf.solid_fill: continue
    try:
        rings = [[(v.x, v.y) for v in dpath.from_hatch_boundary_path(p).flattening(0.05)] for p in e.paths.rendering_paths(e.dxf.hatch_style)]
    except Exception:
        continue
    for name, f in floors.items():
        polys = [make_valid(Polygon(r)) for r in rings if len(r) >= 3]
        if polys and f["win"].contains(polys[0].representative_point()):
            dx, dy = f["shift"]
            for p in polys:
                f["walls"].append(Polygon([(x + dx - O[0], y + dy - O[1]) for x, y in (p.exterior.coords if p.geom_type == "Polygon" else [])]) if p.geom_type == "Polygon" else None)
            break
for e in msp.query("TEXT MTEXT"):
    t = (e.plain_text() if e.dxftype() == "MTEXT" else e.dxf.text).strip().replace("\n", " ")
    if not t: continue
    p = e.dxf.insert
    for name, f in floors.items():
        if f["win"].contains(Point(p.x, p.y)):
            dx, dy = f["shift"]; f["texts"].append((t, round(p.x + dx - O[0], 2), round(p.y + dy - O[1], 2))); break

inv = {}
fig, ax = plt.subplots(figsize=(22, 20), dpi=70)
colors = ["#8c564b", "#d62728", "#1f77b4", "#2ca02c", "#9467bd", "#ff7f0e", "#7f7f7f"]
for (name, f), c in zip(floors.items(), colors):
    walls = unary_union([w.buffer(0) for w in f["walls"] if w is not None and w.is_valid and w.area > 0])
    foot = walls.buffer(4.5, join_style=2).buffer(-4.5, join_style=2) if not walls.is_empty else walls
    foot = unary_union([Polygon(p.exterior) for p in getattr(foot, "geoms", [foot]) if p.geom_type == "Polygon" and p.area > 40])
    texts = f["texts"]
    def grab(rx): return sorted({(t, x, y) for t, x, y in texts if re.search(rx, t, re.I)}, key=lambda v: (v[1], v[2]))
    levels = sorted({t for t, x, y in texts if re.fullmatch(r"N\s*[+-]?\s*\d+[.,]\d+", t)})
    inv[name] = {
        "shift_cad_to_first_floor": f["shift"],
        "footprint_bbox_plan": [round(v, 1) for v in foot.bounds] if not foot.is_empty else None,
        "footprint_area_m2": round(foot.area, 1),
        "levels": levels,
        "blocks": grab(r"^BLOQUE"),
        "elevators": grab(r"ASEN?SOR|HALL ASCENSORES"),
        "halls": grab(r"^HALL|ACCESO$"),
        "rooms_A": sorted({t for t, x, y in texts if re.search(r"\b\d{3}\s?A\b|\b\d{3}A\b", t)}),
        "rooms_B": sorted({t for t, x, y in texts if re.search(r"\b\d{3}\s?B\b|\b\d{3}B\b", t)}),
        "n_labels": len(texts),
    }
    for p in getattr(foot, "geoms", [foot]):
        if p.geom_type == "Polygon":
            xs, ys = p.exterior.xy; ax.plot(xs, ys, color=c, lw=2, label=name)
    for t, x, y in inv[name]["blocks"] + inv[name]["elevators"][:2]:
        ax.text(x, y, f"{name[:6]}: {t}", color=c, fontsize=8)
h, l = ax.get_legend_handles_labels(); uniq = dict(zip(l, h))
ax.legend(uniq.values(), uniq.keys(), fontsize=10); ax.set_aspect("equal"); ax.grid(True, lw=0.3)
fig.savefig(PNG, bbox_inches="tight")
json.dump(inv, open(OUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
for k, v in inv.items():
    print(k, v["footprint_bbox_plan"], v["footprint_area_m2"], "levels", v["levels"][:8], "blocks", v["blocks"], "A", len(v["rooms_A"]), "B", len(v["rooms_B"]))

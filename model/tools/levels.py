"""Level marks (N ±x.xx) of every floor sheet in first-floor plan coordinates. Args: dxf grid_axes.json"""
import sys, json, re, ezdxf
from shapely.geometry import box, Point

grid = json.load(open(sys.argv[2])); O = (5915.0, -1792.0)
doc = ezdxf.readfile(sys.argv[1]); msp = doc.modelspace()
wins = {}
for n, g in grid.items():
    cx = [v[0] for v in g["cols"].values()]; ry = [v[1] for v in g["rows"].values()]
    wins[n] = (box(min(cx) - 12, min(ry) - 25, max(cx) + 12, max(ry) + 12), g["to_first_floor"])
rows = []
for e in msp.query("TEXT MTEXT"):
    t = (e.plain_text() if e.dxftype() == "MTEXT" else e.dxf.text).strip()
    if not re.fullmatch(r"N\s*[+-]?\s*\d+[.,]\d+", t): continue
    p = e.dxf.insert
    for n, (w, (dx, dy)) in wins.items():
        if w.contains(Point(p.x, p.y)):
            rows.append((n, round(p.x + dx - O[0], 1), round(p.y + dy - O[1], 1), t)); break
for r in sorted(rows): print(f"{r[0]:14s} ({r[1]:6.1f},{r[2]:6.1f})  {r[3]}  zone={'north (A)' if r[2] >= 47 else 'south (B)'}")

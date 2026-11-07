"""Room labels of one floor sheet inside a plan-coordinate window. Args: dxf grid_axes.json "SHEET NAME" x0,x1,y0,y1"""
import sys, json, re, ezdxf
from shapely.geometry import box, Point

grid = json.load(open(sys.argv[2])); O = (5915.0, -1792.0)
name = sys.argv[3]; x0, x1, y0, y1 = map(float, sys.argv[4].split(","))
g = grid[name]; dx, dy = g["to_first_floor"]
doc = ezdxf.readfile(sys.argv[1]); msp = doc.modelspace()
seen = set()
for e in msp.query("TEXT MTEXT"):
    t = (e.plain_text() if e.dxftype() == "MTEXT" else e.dxf.text).strip().replace("\n", " ")
    p = e.dxf.insert; x, y = p.x + dx - O[0], p.y + dy - O[1]
    if not (x0 <= x <= x1 and y0 <= y <= y1): continue
    if re.fullmatch(r"[\d.,]+\s*M2|P-?\d+|\d+|S|[A-K]|PISO .*", t, re.I) or t in seen: continue
    seen.add(t); print(f"({x:6.1f},{y:6.1f}) {t[:50]}")

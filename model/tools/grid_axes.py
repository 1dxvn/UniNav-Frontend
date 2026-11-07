"""Finds structural grid bubbles (a 1-2 character label inside a circle) on every floor sheet of the DWG
and derives the translation that registers each sheet onto the first-floor sheet.
Args: dxf out.json"""
import sys, json, re, ezdxf
from collections import defaultdict

DXF, OUT = sys.argv[1:3]
doc = ezdxf.readfile(DXF); msp = doc.modelspace()
SHEETS = {  # title positions (CAD) of each "PLANTA ..." sheet title
    "PISO CERO": (5897.8, -1633.6), "PRIMER PISO": (5897.8, -1785.2), "SEGUNDO PISO": (5897.8, -1904.3),
    "TERCER PISO": (5899.2, -2041.2), "CUARTO PISO": (5699.4, -1633.6), "QUINTO PISO": (5699.4, -1762.1),
    "AZOTEA CANCHAS SINTETICAS": (5699.4, -1904.3), "AZOTEA CUBIERTAS": (5699.4, -2069.5),
}
circles = [(e.dxf.center.x, e.dxf.center.y, e.dxf.radius) for e in msp.query("CIRCLE") if 0.2 <= e.dxf.radius <= 0.8]
bubbles = []
for e in msp.query("TEXT MTEXT"):
    t = (e.plain_text() if e.dxftype() == "MTEXT" else e.dxf.text).strip()
    if not re.fullmatch(r"[A-K]|1[0-2]|[1-9]", t): continue
    p = e.dxf.insert
    for cx, cy, r in circles:
        if abs(cx - p.x) < r * 1.6 and abs(cy - p.y) < r * 1.6:
            bubbles.append((t, cx, cy)); break
def sheet_of(x, y):
    # A sheet spans roughly 110 m to the right of and 30 m below / 90 m above its title.
    best = None
    for name, (tx, ty) in SHEETS.items():
        if tx - 5 <= x <= tx + 110 and ty - 30 <= y <= ty + 95:
            d = abs(y - ty)
            if best is None or d < best[0]: best = (d, name)
    return best[1] if best else None
per = defaultdict(lambda: {"cols": {}, "rows": {}})
for t, x, y in bubbles:
    s = sheet_of(x, y)
    if s is None: continue
    (per[s]["cols"] if t.isdigit() else per[s]["rows"]).setdefault(t, []).append((round(x, 3), round(y, 3)))
ref = per["PRIMER PISO"]
result = {}
for s, d in per.items():
    # columns give x (bubbles on a row above the plan), rows give y (bubbles on a column left of the plan)
    dx = [ref["cols"][k][0][0] - v[0][0] for k, v in d["cols"].items() if k in ref["cols"]]
    dy = [ref["rows"][k][0][1] - v[0][1] for k, v in d["rows"].items() if k in ref["rows"]]
    mx = sorted(dx)[len(dx) // 2] if dx else None
    my = sorted(dy)[len(dy) // 2] if dy else None
    spread = (round(max(dx) - min(dx), 3) if dx else None, round(max(dy) - min(dy), 3) if dy else None)
    result[s] = {"to_first_floor": [mx, my], "spread_xy": spread, "n_cols": len(dx), "n_rows": len(dy),
                 "cols": {k: v[0] for k, v in sorted(d["cols"].items(), key=lambda kv: int(kv[0]))},
                 "rows": {k: v[0] for k, v in sorted(d["rows"].items())}}
    print(f"{s:28s} shift to first floor dx={mx} dy={my} spread={spread} cols={len(dx)} rows={len(dy)}")
json.dump(result, open(OUT, "w"), indent=1)

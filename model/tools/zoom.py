"""Zoomed plot: raw DXF linework (all layers) + model solids + openings + labels. Args: dxf wing extras graph out x0,x1,y0,y1"""
import sys, json, math, ezdxf, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from ezdxf import path as dpath
from shapely.geometry import box
DXF, WING, EXTRAS, GRAPH, OUT, BB = sys.argv[1:7]
x0, x1, y0, y1 = map(float, BB.split(","))
W = json.load(open(WING, encoding="utf-8")); X = json.load(open(EXTRAS, encoding="utf-8"))
O = W["origin_cad"]
g = {}; exec(open(GRAPH, encoding="utf-8").read(), g)
P = {r[0]: (r[1], r[2]) for r in g["PLACES"]}
doc = ezdxf.readfile(DXF); msp = doc.modelspace()
win = box(O[0] + x0, O[1] + y0, O[0] + x1, O[1] + y1)
fig, ax = plt.subplots(figsize=(18, 18 * (y1 - y0) / (x1 - x0)), dpi=90)
for key, c in (("walls", "0.55"), ("columns", "#c86"), ("glass", "#9cd")):
    for p in W[key]:
        xs, ys = zip(*p["outer"]); ax.fill(xs, ys, color=c, lw=0, alpha=0.6)
cols = {}
for e in msp:
    if e.dxftype() in ("TEXT", "MTEXT", "HATCH", "DIMENSION"): continue
    try:
        es = list(e.virtual_entities()) if e.dxftype() == "INSERT" else [e]
    except Exception:
        continue
    for v in es:
        try:
            pts = [(q.x, q.y) for q in dpath.make_path(v).flattening(0.03)]
        except Exception:
            continue
        if len(pts) < 2: continue
        if not any(win.contains(box(px, py, px, py).centroid) for px, py in pts[:: max(1, len(pts) // 8)] + [pts[-1]]): continue
        L = e.dxf.layer
        c = cols.setdefault(L, plt.cm.tab20(len(cols) % 20))
        ax.plot([p[0] - O[0] for p in pts], [p[1] - O[1] for p in pts], color=c, lw=0.8)
for o in X["openings"]:
    ax.plot(*o["center"], "o", color="green", ms=6)
for d in X["doors"]:
    ax.plot([d["a"][0], d["b"][0]], [d["a"][1], d["b"][1]], color="brown", lw=3)
for l in W["labels"]:
    x, y = l["xy"]
    if x0 <= x <= x1 and y0 <= y <= y1: ax.text(x, y, l["text"][:22], fontsize=7)
for a, b, _ in g["PATHS"]:
    ax.plot([P[a][0], P[b][0]], [P[a][1], P[b][1]], color="red", lw=1.5)
for n, (x, y) in P.items():
    if x0 <= x <= x1 and y0 <= y <= y1: ax.plot(x, y, "r*", ms=10)
ax.legend(handles=[plt.Line2D([], [], color=c, label=L) for L, c in cols.items()], fontsize=6, loc="upper left", ncol=3)
ax.set_xlim(x0, x1); ax.set_ylim(y0, y1); ax.set_aspect("equal"); ax.grid(True, lw=0.3)
ax.set_xticks(range(int(x0), int(x1) + 1)); ax.set_yticks(range(int(y0), int(y1) + 1)); ax.tick_params(labelsize=6)
fig.savefig(OUT, bbox_inches="tight")

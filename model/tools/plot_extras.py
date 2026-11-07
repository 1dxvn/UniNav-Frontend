import sys, json, math, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
W = json.load(open(sys.argv[1], encoding="utf-8")); X = json.load(open(sys.argv[2], encoding="utf-8"))
g = {}; exec(open(sys.argv[3], encoding="utf-8").read(), g)
P = {r[0]: (r[1], r[2]) for r in g["PLACES"]}
xl = [float(v) for v in sys.argv[5].split(",")] if len(sys.argv) > 5 else [-10, 77, -8, 68]
fig, ax = plt.subplots(figsize=(26, 23), dpi=70)
def fill(rings, **kw):
    for p in rings:
        xs, ys = zip(*p["outer"]); ax.fill(xs, ys, **kw)
fill(X["footprint"], color="#ece4d4", lw=0)
fill(W["walls"] + W["columns"], color="0.25", lw=0)
fill(W["glass"], color="#7fb4d8", lw=0)
for o in X["openings"]:
    ax.plot(*o["center"], "o", color="green" if o["door"] else "red", ms=4)
for d in X["doors"]:
    ax.plot([d["a"][0], d["b"][0]], [d["a"][1], d["b"][1]], color="#8a5a2b", lw=2.5)
for a in X["arcs"]:
    ts = [a["a0"] + a["da"] * i / 20 for i in range(21)]
    ax.plot([a["center"][0] + a["r"] * math.cos(t) for t in ts], [a["center"][1] + a["r"] * math.sin(t) for t in ts], color="#8a5a2b", lw=0.6)
for f in X["fixtures"]:
    xs, ys = zip(*f["poly"]); ax.fill(xs, ys, color="#3a7ab8")
for f in X["furniture"]:
    xs, ys = zip(*f["poly"]); ax.fill(xs, ys, color={"Furniture_Wood": "#b07a45", "Furniture_Seat": "#4a6a8a", "Furniture_Lab": "#e0e0e0", "Furniture_Felt": "#2f7a4a", "Furniture_Metal": "#888"}[f["mat"]], ec="k", lw=0.3)
for a, b, _ in g["PATHS"]:
    ax.plot([P[a][0], P[b][0]], [P[a][1], P[b][1]], color="#e5383b", lw=1.5)
ax.set_xlim(xl[0], xl[1]); ax.set_ylim(xl[2], xl[3]); ax.set_aspect("equal"); ax.grid(True, lw=0.3)
fig.savefig(sys.argv[4], bbox_inches="tight")

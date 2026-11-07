"""Overview of one DWG sheet window: cut walls (solid hatches on 'linea de corte'), all linework in grey, and every text label.
Args: dxf out.png x0,x1,y0,y1 (CAD coordinates) [min_text_height]"""
import sys, ezdxf, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from ezdxf import path as dpath
from shapely.geometry import box, Point

DXF, OUT, BB = sys.argv[1:4]
MINH = float(sys.argv[4]) if len(sys.argv) > 4 else 0.12
x0, x1, y0, y1 = map(float, BB.split(","))
win = box(x0, y0, x1, y1)
doc = ezdxf.readfile(DXF); msp = doc.modelspace()
W = 26; fig, ax = plt.subplots(figsize=(W, W * (y1 - y0) / (x1 - x0)), dpi=70)
def inside(pts): return any(win.contains(Point(p)) for p in pts[:: max(1, len(pts) // 6)] + [pts[-1]])
for e in msp:
    t = e.dxftype()
    try:
        if t == "HATCH":
            if e.dxf.layer != "linea de corte" or not e.dxf.solid_fill: continue
            for p in e.paths.rendering_paths(e.dxf.hatch_style):
                pts = [(v.x, v.y) for v in dpath.from_hatch_boundary_path(p).flattening(0.05)]
                if len(pts) > 2 and inside(pts):
                    xs, ys = zip(*pts); ax.fill(xs, ys, color="0.15", lw=0)
        elif t in ("LINE", "LWPOLYLINE", "ARC", "CIRCLE", "POLYLINE"):
            pts = [(v.x, v.y) for v in dpath.make_path(e).flattening(0.1)]
            if len(pts) > 1 and inside(pts):
                xs, ys = zip(*pts); ax.plot(xs, ys, color="0.7", lw=0.4)
        elif t in ("TEXT", "MTEXT"):
            p = e.dxf.insert
            h = e.dxf.char_height if t == "MTEXT" else e.dxf.height
            if h < MINH or not win.contains(Point(p.x, p.y)): continue
            s = (e.plain_text() if t == "MTEXT" else e.dxf.text).strip().replace("\n", " ")
            if s and not s.upper().startswith("PISO ") and "M2" not in s.upper():
                ax.text(p.x, p.y, s[:28], fontsize=7 if h < 0.5 else 12, color="crimson" if "BLOQUE" in s.upper() else ("navy" if s.upper().startswith("N ") else "black"))
    except Exception:
        continue
ax.set_xlim(x0, x1); ax.set_ylim(y0, y1); ax.set_aspect("equal"); ax.grid(True, lw=0.3)
fig.savefig(OUT, bbox_inches="tight")

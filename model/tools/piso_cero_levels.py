"""Piso cero level map for the source handoff in docs/blocks/level-zones.md ("Piso cero").

Draws the floor-0 walls, footprint and facade openings from data/floor0/wing.json, the sheet's level labels, the drawn
stairs and ramp, and the elevator cars. It assigns no level to any region: only the sheet's labels are printed.
Output: docs/blocks/piso-cero-levels.png. Usage (from model/tools, Python with shapely and matplotlib):
    python piso_cero_levels.py
"""
import json, os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, Polygon as MplPolygon
from shapely.geometry import Polygon
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "docs", "blocks", "piso-cero-levels.png")
W = json.load(open(os.path.join(HERE, "data", "floor0", "wing.json"), encoding="utf-8"))

# Level labels of the PLANTA PISO CERO sheet (plan metres, registered on the first floor).
LEVELS = [((37.04, 55.91), "N -4.13", "A, east tower"), ((39.21, 35.15), "N -4.13", "B stair foot"),
          ((48.48, 39.70), "N -4.13", "clinic"), ((75.19, 52.03), "N -4.13", "outside"),
          ((75.18, 54.33), "N -2.93", "outside"), ((35.64, 34.01), "N -2.94", "B stair landing"),
          ((20.00, 15.33), "N -2.94", "compressors")]
# Drawn flights: (start, end, label); arrows point up the flight.
FLIGHTS = [((38.40, 34.20), (36.87, 34.20), "B stair 1-6"), ((36.49, 32.40), (37.40, 32.40), "B stair 7-9 (cut)"),
           ((37.85, 48.30), (36.05, 48.30), "west stair 1-6"), ((25.27, 48.30), (20.84, 48.30), "west stair 7-18"),
           ((37.45, 56.20), (37.45, 59.20), "A east tower 1-10"), ((74.77, 52.17), (74.77, 53.37), "outside 1-4")]

fig, ax = plt.subplots(figsize=(13, 10), dpi=110)
foot = unary_union([Polygon(r["outer"]).buffer(0) for r in W["footprint"]])
for g in getattr(foot, "geoms", [foot]):
    ax.add_patch(MplPolygon(list(g.exterior.coords), closed=True, fc="#f4f1ea", ec="#999", lw=0.8))
for key, colour in (("walls", "#555"), ("columns", "#222"), ("glass", "#6aa6c8")):
    for r in W[key]:
        ax.add_patch(MplPolygon(r["outer"], closed=True, fc=colour, ec="none"))
ax.axhline(49.08, color="#c0392b", lw=0.8, ls="--")
ax.text(70.6, 49.25, "Block A facade band (y 49.02-49.16)", color="#c0392b", fontsize=8, ha="left")
for (s, e, name) in FLIGHTS:
    ax.add_patch(FancyArrowPatch(s, e, arrowstyle="-|>", mutation_scale=12, color="#1f6f43", lw=1.6))
    ax.text((s[0] + e[0]) / 2, (s[1] + e[1]) / 2 - 0.9, name, color="#1f6f43", fontsize=7, ha="center")
ax.add_patch(MplPolygon([(25.6, 47.6), (36.05, 47.6), (36.05, 49.0), (25.6, 49.0)], closed=True, fc="none", ec="#1f6f43", ls=":"))
ax.text(30.8, 47.0, "PASILLO landing (no level label)", color="#1f6f43", fontsize=7, ha="center")
ax.text(19.1, 18.9, "RAMPA (S at 19.73, 15.02)", color="#1f6f43", fontsize=7, ha="center")
for (x, y) in ((24.12, 55.15), (26.38, 55.14)):
    ax.plot(x, y, "s", color="#7d3c98", ms=7)
ax.text(25.2, 56.2, "elevators", color="#7d3c98", fontsize=7, ha="center")
for (x, y), txt, where in LEVELS:
    c = "#b03a2e" if "4.13" in txt else "#1a5276"
    ax.plot(x, y, "o", color=c, ms=7)
    ax.text(x + 0.6, y + 0.4, f"{txt}  ({where})", color=c, fontsize=8, weight="bold")
ax.set_xlim(12, 82); ax.set_ylim(10, 70); ax.set_aspect("equal")
ax.set_xlabel("plan x (m)"); ax.set_ylabel("plan y (m)")
ax.set_title("Piso cero: level labels and drawn level changes (sheet PLANTA PISO CERO)\n"
             "Red: N -4.13. Blue: N -2.94 / -2.93. Green arrows point up each drawn flight", fontsize=10)
fig.tight_layout(); fig.savefig(OUT); print("wrote", os.path.normpath(OUT))

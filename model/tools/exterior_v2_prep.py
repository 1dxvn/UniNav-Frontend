"""Polished campus-exterior data (Plan 4, candidate C19), derived from the C5 exterior data and the floor sheets.

Fixes made here, before any geometry is built:
- floating blocks: every upper storey is trimmed to the first-floor building outline (closing of the floor-1 walls,
  columns and glass, buffered 1.5 m), so nothing hangs over the street or the neighbouring lot;
- stair towers: the outline is cut at the two recesses between the wings and the central block (facade line y 56.25)
  and at the towers' "D" shape (stair box + semicircle). The towers become their own glass volumes, so no brick wall
  covers them;
- caps and terraces: each storey keeps its full outline (it gets a ceiling cap) and its terrace is the part not covered
  by the storey above, with parapets;
- single-storey parts of the first floor (access zone, games room, locales, small pieces by the towers) get roofs,
  except the open plazoleta; the access pavilion gets its own glazed gable roof;
- glazing: all glass lines of each floor sheet are kept, so the recess facades get their windows; the west block over
  the cafeteria gets large windows on its street and plaza faces (night photo);
- rooftop (sheet PLANTA AZOTEA CANCHAS SINTETICAS): closed rooms (music room with its glass north wall, machine room),
  open covered circulations on posts, both courts with their markings, perimeter fences and gates towards the
  circulations.
Output: data/exterior_v2.json. Usage: python exterior_v2_prep.py
"""
import json, os
from shapely.geometry import Polygon, Point, box, LineString
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, "data")
E = json.load(open(os.path.join(D, "exterior.json"), encoding="utf-8"))
W1 = json.load(open(os.path.join(D, "wing.json"), encoding="utf-8"))
SHEET_DATA = {"SEGUNDO PISO": "floor2", "TERCER PISO": "floor3", "CUARTO PISO": "floor4", "QUINTO PISO": "floor5"}
STOREYS = ["SEGUNDO PISO", "TERCER PISO", "CUARTO PISO", "QUINTO PISO"]
ROOFTOP = "AZOTEA CANCHAS SINTETICAS"

def parts(g, min_area=0.0):
    return [p for p in getattr(g, "geoms", [g]) if p.geom_type == "Polygon" and p.area > min_area]
def rings(g, min_area=4.0):
    return [{"outer": [[round(x, 3), round(y, 3)] for x, y in p.exterior.coords[:-1]],
             "holes": [[[round(x, 3), round(y, 3)] for x, y in h.coords[:-1]] for h in p.interiors if Polygon(h).area > 1.0]}
            for p in parts(g, min_area)]
def clean(g):
    return unary_union([p.buffer(0) for p in parts(g.buffer(0))]).buffer(-0.05, join_style=2).buffer(0.05, join_style=2)

# --- first-floor building outline (support) -------------------------------------------------------------------------
solid1 = unary_union([Polygon(r["outer"]).buffer(0) for k in ("walls", "columns", "glass") for r in W1[k]])
outline1 = solid1.buffer(3.0, join_style=2).buffer(-3.0, join_style=2)
outline1 = unary_union([Polygon(p.exterior) for p in parts(outline1, 30)] +
                       [Polygon(r["outer"]).buffer(0) for r in W1["footprint"]])        # + the slab footprint (south wing)
outline1 = unary_union([Polygon(p.exterior) for p in parts(outline1.buffer(0.05, join_style=2), 30)])
# The cafeteria is a glass block (floor-1 glass x -6.72..13.65, y 42.41..56.26) outside the slab footprint; it carries the
# west block's upper floors, so it is part of the support.
CAFETERIA = box(-6.72, 42.41, 13.65, 56.26)
support = outline1.union(CAFETERIA).buffer(1.5, join_style=2)

# --- stair towers and recesses (measured on the floor sheets; facade of the recesses at y 56.25) --------------------
FACADE_Y = 56.25
TOWERS = [{"name": "West", "c": [16.37, 59.22], "r": 2.74}, {"name": "East", "c": [37.97, 59.24], "r": 2.71}]
def tower_shape(t, pad=0.0):
    (cx, cy), R = t["c"], t["r"]
    return Point(cx, cy).buffer(R + pad, 64).union(box(cx - R - pad, FACADE_Y, cx + R + pad, cy))
RECESSES = [box(13.6, FACADE_Y, 21.0, 66.5), box(33.5, FACADE_Y, 42.5, 66.5)]
CUT = unary_union(RECESSES + [tower_shape(t, 0.05) for t in TOWERS])

# --- storeys ------------------------------------------------------------------------------------------------------------
out = {"source": "exterior.json (C5) + floor sheets; Plan 4 / C19", "towers": TOWERS, "facade_y": FACADE_Y, "storeys": {}, "removed": {}}
prev = {}
for fl in STOREYS:
    glass = json.load(open(os.path.join(D, SHEET_DATA[fl], "wing.json"), encoding="utf-8"))["glass_lines"]
    out["storeys"][fl] = {"glass": glass}
    for blk in ("A", "B"):
        g = unary_union([Polygon(r).buffer(0) for r in E[fl][blk]]) if E[fl][blk] else Polygon()
        kept = g.intersection(support).difference(CUT)
        if blk in prev: kept = kept.intersection(prev[blk].buffer(2.0, join_style=2).union(support))
        kept = clean(kept)
        out["removed"][f"{fl} {blk}"] = round(g.area - kept.area, 1)
        out["storeys"][fl][blk] = rings(kept)
        prev[blk] = kept
# terraces: part of each storey not covered by the storey above (the top storey is all terrace)
for i, fl in enumerate(STOREYS):
    for blk in ("A", "B"):
        here = unary_union([Polygon(r["outer"], r["holes"]) for r in out["storeys"][fl][blk]]) if out["storeys"][fl][blk] else Polygon()
        if i + 1 < len(STOREYS) and out["storeys"][STOREYS[i + 1]][blk]:
            above = unary_union([Polygon(r["outer"], r["holes"]) for r in out["storeys"][STOREYS[i + 1]][blk]])
            here = here.difference(above.buffer(0.05, join_style=2))
        out["storeys"][fl][f"terrace_{blk}"] = rings(clean(here), 3.0)

# --- first-floor roofs ----------------------------------------------------------------------------------------------------
p2 = unary_union([Polygon(r["outer"], r["holes"]) for blk in ("A", "B") for r in out["storeys"]["SEGUNDO PISO"][blk]])
PAVILION = {"box": [-4.3, -8.1, 4.6, 10.7], "eave": 3.4, "ridge": 5.3, "ridge_axis": "y"}
pav = box(*PAVILION["box"])
only1 = outline1.union(CAFETERIA).difference(p2.buffer(0.25, join_style=2)).difference(pav).difference(unary_union([tower_shape(t, 0.05) for t in TOWERS]))
OPEN_AIR = ("PLAZOLETA", "JARDIN", "PATIO", "TERRAZA")
roofs1 = []
for p in parts(clean(only1), 3.0):
    labels = [l["text"].upper() for l in W1["labels"] if p.contains(Point(l["xy"]))]
    if any(any(k in t for k in OPEN_AIR) for t in labels) and p.area < 80:
        print(f"  open air, no roof: {p.area:.0f} m2 {labels[:4]}"); continue
    c = p.representative_point(); level = 2.68 if (c.y >= 49.23 and c.x >= 13.6) else 2.94
    roofs1.append({"level": level, "rings": rings(p, 3.0), "labels": labels[:6], "area": round(p.area, 1)})
# The pergola terrace beside the pavilion (first-floor Canopy_Terrace_Frame, x 3.70-22.43, y -8.08..1.35, top 3.45) has a
# dark roof in the night photo and the user's capture asks for it: roofed at the frame top.
roofs1.append({"level": 3.45, "rings": rings(box(3.70, -8.08, 22.43, 1.35).difference(pav), 3.0), "labels": ["TERRAZA (pergola)"], "area": round(box(3.70, -8.08, 22.43, 1.35).difference(pav).area, 1), "kind": "pergola"})
out["floor1_roofs"] = roofs1
out["pavilion"] = PAVILION
out["west_block"] = [-12.0, 40.0, 13.6, 66.0]            # large windows on floors 2-5 (night photo)

# --- rooftop (sheet reading, +-0.2 m) -------------------------------------------------------------------------------------
out["rooftop"] = {
    "floor": 17.12, "top": 20.38,
    "rooms": [{"name": "Music room", "box": [20.75, FACADE_Y, 33.5, 62.85], "glass_north": True},
              {"name": "Machine room", "box": [22.6, 52.9, 30.25, FACADE_Y], "glass_north": False}],
    "canopies": [{"name": "Covered circulation west", "box": [12.0, 49.3, 22.6, FACADE_Y]},
                 {"name": "Covered circulation south", "box": [22.6, 49.3, 30.25, 52.9]}],
    "open": [{"name": "Circulation east", "box": [30.25, 49.3, 42.5, FACADE_Y]}],
    "courts": [{"name": "Cancha sintetica 2 (voleibol)", "box": [-5.5, 50.8, 10.5, 61.3], "area": [2.3, 6.3]},
               {"name": "Cancha sintetica 1 (futbol 5)", "box": [44.2, 50.8, 68.5, 61.3], "area": [2.8, 6.5]}],
    "fences": [{"zone": [-6.6, 49.5, 11.6, 63.0], "gate": {"side": "east", "y": [51.0, 53.2]}},
               {"zone": [42.9, 49.5, 71.6, 63.0], "gate": {"side": "west", "y": [51.0, 53.2]}}],
    "sign": {"text": "UNIVERSIDAD COOPERATIVA DE COLOMBIA", "x": [22.4, 31.8], "y": 62.95, "z": [19.55, 20.75]},
    "solar": {"box": [21.4, 57.0, 32.9, 62.2], "rows": 3, "cols": 7, "tilt_deg": 12},
    "glass": E[ROOFTOP]["glass"],
}
os.makedirs(D, exist_ok=True)
json.dump(out, open(os.path.join(D, "exterior_v2.json"), "w", encoding="utf-8"), indent=0)
print("outline1", round(outline1.area), "m2; removed (floating / tower walls):", out["removed"])
print("floor-1 roofs:", [(r["level"], r["area"], r["labels"][:3]) for r in roofs1])
for fl in STOREYS:
    print(fl, {k: (len(v) if isinstance(v, list) else "") for k, v in out["storeys"][fl].items() if k != "glass"})

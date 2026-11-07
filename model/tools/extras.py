"""Openings, door leaves, cafeteria slab and illustrative furniture for the first-floor model.
Inputs: wing.json, the DXF (CAD fixtures), the backend graph. Output: extras.json in plan metres."""
import sys, json, math, re, ezdxf
from ezdxf import path as dpath
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union
from shapely import affinity

WING, DXF, GRAPH, OUT = sys.argv[1:5]
CLASSROOMS = len(sys.argv) > 5 and sys.argv[5] == "classrooms"   # AULA labels get student desks (other floors)
W = json.load(open(WING, encoding="utf-8"))
O = tuple(W["origin_cad"])
def polys(key): return [Polygon(p["outer"], p["holes"]).buffer(0) for p in W[key]]
walls, cols, glass = unary_union(polys("walls")), unary_union(polys("columns")), unary_union(polys("glass"))
solid = unary_union([walls, cols, glass])
foot = unary_union(polys("footprint"))

# --- route centre lines from the backend graph (kept clear)
g = {}
exec(open(GRAPH, encoding="utf-8").read(), g)
P = {row[0]: (row[1], row[2]) for row in g["PLACES"]}
routes = unary_union([LineString([P[a], P[b]]) for a, b, _ in g["PATHS"]])
NO_ROUTES = routes.is_empty   # floors without API paths yet
def route_dist(geom): return 99.0 if NO_ROUTES else geom.distance(routes)
LEAF_CLEAR, FURN_CLEAR = 0.40, 1.00

# --- cafeteria / locales slab (glass-walled block at the top left)
cafe_zone = box(-8, 41.5, 13.6, 64.5)
cafe = solid.intersection(cafe_zone).convex_hull.buffer(0.02, join_style=2)
foot2 = unary_union([foot, cafe])

# --- openings: gaps that a closing fills, shaped like a doorway
R = 0.75
closed = solid.buffer(R, join_style=2, mitre_limit=2).buffer(-R, join_style=2, mitre_limit=2)
gaps = closed.difference(solid).intersection(foot2)
openings = []
for gp in getattr(gaps, "geoms", [gaps]):
    if gp.geom_type != "Polygon" or gp.area < 0.03:
        continue
    mrr = gp.minimum_rotated_rectangle
    c = list(mrr.exterior.coords)
    e1 = (c[1][0] - c[0][0], c[1][1] - c[0][1]); e2 = (c[2][0] - c[1][0], c[2][1] - c[1][1])
    l1, l2 = math.hypot(*e1), math.hypot(*e2)
    (wv, w), (dv, d) = ((e1, l1), (e2, l2)) if l1 >= l2 else ((e2, l2), (e1, l1))
    if not (0.65 <= w <= 1.9 and 0.05 <= d <= 0.45):
        continue
    if gp.area / mrr.area < 0.75:
        continue
    cx, cy = mrr.centroid.x, mrr.centroid.y
    ux, uy = wv[0] / w, wv[1] / w
    a = (cx - ux * w / 2, cy - uy * w / 2); b = (cx + ux * w / 2, cy + uy * w / 2)
    if Point(a).distance(solid) > 0.03 or Point(b).distance(solid) > 0.03:
        continue
    kind = "glass" if Point(a).distance(glass) < 0.05 and Point(b).distance(glass) < 0.05 else "wall"
    openings.append({"center": [cx, cy], "u": [ux, uy], "width": w, "depth": d, "kind": kind, "poly": mrr})

# --- door leaves: open 90 deg, hinge chosen to stay off route centre lines and inside free space
free = foot2.difference(solid)
free_tol = free.buffer(0.01)
solid_in = solid.buffer(-0.01)
doors, arcs = [], []
for op in openings:
    cx, cy = op["center"]; ux, uy = op["u"]; nx, ny = -uy, ux; w, d = op["width"], op["depth"]
    leaves = 2 if w > 1.25 else 1
    lw = w / leaves - 0.03
    hinge_sets = [(-1, 1)] if leaves == 2 else [(-1,), (1,)]
    best = None
    for side in (1, -1):
        for hinges in hinge_sets:
            parts = []
            for h in hinges:
                hx = cx + ux * h * (w / 2 - 0.03) + nx * side * d / 2
                hy = cy + uy * h * (w / 2 - 0.03) + ny * side * d / 2
                tip = (hx + nx * side * lw, hy + ny * side * lw)
                parts.append({"hinge": (hx, hy), "tip": tip, "h": h,
                              "leaf": LineString([(hx, hy), tip]).buffer(0.022, cap_style=2)})
            geom = unary_union([p["leaf"] for p in parts])
            if not free_tol.contains(geom) or geom.intersects(solid_in):
                continue
            clr = route_dist(geom)
            if clr < LEAF_CLEAR:
                continue
            if best is None or clr > best[0]:
                best = (clr, side, parts)
    op["door"] = best is not None
    if best is None:
        continue
    _, side, parts = best
    for p in parts:
        (hx, hy), (tx, ty) = p["hinge"], p["tip"]
        doors.append({"a": [hx, hy], "b": [tx, ty], "thick": 0.044, "height": 2.10, "glass": op["kind"] == "glass"})
        a0 = math.atan2(-uy * p["h"], -ux * p["h"])
        a1 = math.atan2(ny * side, nx * side)
        da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
        arcs.append({"center": [hx, hy], "r": lw, "a0": a0, "da": da})

# --- room regions: free space with doorways plugged
plugs = unary_union([op["poly"].buffer(0.02) for op in openings] + [solid])
rooms = foot2.difference(plugs)
rooms = [p for p in getattr(rooms, "geoms", [rooms]) if p.area > 2]

labels = [(l["text"].replace("\n", " ").strip(), Point(l["xy"])) for l in W["labels"]]
areas = []
for t, pt in labels:
    m = re.match(r"^([\d.,]+)\s*M2$", t.upper().strip())
    if m:
        try:
            areas.append((float(m.group(1).replace(",", ".")), pt))
        except ValueError:
            pass
def area_near(pt):
    best = min(areas, key=lambda a: a[1].distance(pt))
    return best[0] if best[1].distance(pt) < 1.5 else 12.0

openings_zone = unary_union([Point(op["center"]).buffer(0.85) for op in openings])
taken = [solid, openings_zone] + ([] if NO_ROUTES else [routes.buffer(FURN_CLEAR)])

# --- CAD fixtures (sanitarios blocks, lavabo, turnstiles)
doc = ezdxf.readfile(DXF); msp = doc.modelspace()
CROP = box(O[0] - 10, O[1] - 8, O[0] + 77, O[1] + 68)
def outline(e):
    pts = []
    for v in e.virtual_entities():
        try:
            pts += [(q.x - O[0], q.y - O[1]) for q in dpath.make_path(v).flattening(0.03)]
        except Exception:
            pass
    return Polygon(pts).convex_hull if len(pts) >= 3 else None
fixtures = []
for e in msp.query("INSERT"):
    L = e.dxf.layer
    if L not in ("sanitarios", "Objeto") or not CROP.contains(Point(e.dxf.insert.x, e.dxf.insert.y)):
        continue
    poly = outline(e)
    poly = poly.simplify(0.015) if poly is not None else None
    if poly is None or poly.geom_type != "Polygon" or not (0.02 < poly.area < 1.0):
        continue
    name = e.dxf.name.upper()
    h = 0.85 if name.startswith("MUBA") or "LAVABO" in name else 0.45
    fixtures.append({"poly": [list(c) for c in poly.exterior.coords[:-1]], "height": h, "mat": "Fixture", "src": e.dxf.name})
pts = []
for e in msp.query('LINE LWPOLYLINE CIRCLE[layer=="Objeto"]'):
    try:
        pts.append([(q.x - O[0], q.y - O[1]) for q in dpath.make_path(e).flattening(0.03)])
    except Exception:
        pass
turn = unary_union([LineString(p).buffer(0.04) for p in pts if len(p) > 1]).intersection(box(0, 1, 4, 2))
for t in getattr(turn, "geoms", [turn]):
    if t.geom_type == "Polygon" and t.area > 0.01:
        fixtures.append({"poly": [list(c) for c in t.convex_hull.exterior.coords[:-1]], "height": 1.0, "mat": "Furniture_Metal", "src": "torniquete"})
fixtures = [f for f in fixtures if route_dist(Polygon(f["poly"])) >= 0.7]
if fixtures:
    taken.append(unary_union([Polygon(f["poly"]).buffer(0.3) for f in fixtures]))

# --- illustrative furniture by room programme
def B(x, y, l, w, h, m): return {"t": "box", "c": [x, y], "s": [l, w, h], "mat": m}
def C(x, y, r, h, m): return {"t": "cyl", "c": [x, y], "r": r, "h": h, "mat": m}
KITS = {
    "office": (2.6, 2.4, 7, [B(0, 0, 1.20, 0.60, 0.75, "Furniture_Wood"), B(0, -0.58, 0.46, 0.46, 0.48, "Furniture_Seat")]),
    "lab": (2.9, 2.3, 9, [B(0, 0, 2.40, 0.80, 0.90, "Furniture_Lab")] + [C(x, -0.65, 0.18, 0.62, "Furniture_Seat") for x in (-0.8, 0, 0.8)]),
    "cafe": (2.5, 2.5, 6, [C(0, 0, 0.45, 0.75, "Furniture_Wood")] + [B(dx, dy, 0.42, 0.42, 0.46, "Furniture_Seat") for dx, dy in ((0.75, 0), (-0.75, 0), (0, 0.75), (0, -0.75))]),
    "wait": (2.2, 1.9, 5, [B(0, 0, 1.80, 0.50, 0.45, "Furniture_Seat")]),
    "pool": (4.4, 3.6, 14, [B(0, 0, 2.54, 1.42, 0.80, "Furniture_Felt")]),
    "clinic": (2.8, 2.6, 7, [B(0, 0, 1.90, 0.70, 0.60, "Furniture_Seat"), B(0.9, 0.7, 0.60, 0.50, 0.90, "Furniture_Lab")]),
    "gym": (2.6, 2.4, 8, [B(0, 0, 1.80, 0.75, 1.10, "Furniture_Metal")]),
    "store": (1.8, 1.6, 4, [B(0, 0, 1.20, 0.50, 1.80, "Furniture_Metal")]),
    "class": (1.15, 1.35, 1.7, [B(0, 0, 0.60, 0.45, 0.73, "Furniture_Wood"), B(0, -0.48, 0.42, 0.42, 0.86, "Furniture_Seat")]),
}
PROGRAMME = ([(r"^AULA|SALON", "class")] if CLASSROOMS else []) + [
    (r"CAFETERIA", "cafe"), (r"LABORATORIO|AULA|OSTEOTECA", "lab"), (r"JUEGOS DE SALON", "pool"),
    (r"^SALA$|^ESPERA$|^ICETEX$|CUB.CULOS", "wait"), (r"PRECLINICA|PRIMEROS", "clinic"), (r"GIMNASIO", "gym"),
    (r"ARCHIVO|BODEGA|ALMACEN|LOCKERS", "store"),
    (r"JEFE|E-LEARNING|CONTABILIDAD|TESORERIA|MERCADEO|INFRAESTRUCTURA|ANALISTA|SECRETARIA|DECANATURA|COORDINACION|CORRESPONDECIA|RECEPCI|VIGILANTES|ADMINISTRATIVO|AMI \d|AUX\. DARC|^DARC$|LOCAL \d|POSGRADO", "office"),
]
used_rooms = {}
furniture, report, items = [], [], []
for text, pt in labels:
    kind = next((k for rx, k in PROGRAMME if re.search(rx, text)), None)
    if kind is None:
        continue
    room = next((r for r in rooms if r.contains(pt)), None)
    if room is None:
        report.append((text, kind, "outside any room"))
        continue
    key = (round(pt.x, 0), round(pt.y, 0))
    if any(math.hypot(key[0] - k[0], key[1] - k[1]) < 1.2 for k in used_rooms):
        continue
    used_rooms[key] = text
    a = area_near(pt)
    zone = room.intersection(pt.buffer(max(2.4, math.sqrt(a) * 0.75))).buffer(-0.30, join_style=2)
    if zone.is_empty:
        report.append((text, kind, "too small"))
        continue
    disc = pt.buffer(max(3.0, math.sqrt(a)))
    hist = {}
    for ringc in [room.exterior] + list(room.interiors):
        cc = list(ringc.coords)
        for p0, p1 in zip(cc, cc[1:]):
            seg = LineString([p0, p1])
            if not seg.intersects(disc): continue
            t = math.degrees(math.atan2(p1[1] - p0[1], p1[0] - p0[0])) % 90
            k = round(t / 3) * 3 % 90
            hist[k] = hist.get(k, 0) + seg.intersection(disc).length
    base = math.radians(max(hist, key=hist.get)) if hist else 0.0
    px, py, per, parts = KITS[kind]
    cap = max(1, int(a / per))
    cx0, cy0 = zone.centroid.x, zone.centroid.y
    def candidates(ang):
        out = []
        ca, sa = math.cos(ang), math.sin(ang)
        for ox, oy in ((0, 0), (px / 2, py / 2)):
            for i in range(-8, 9):
                for j in range(-8, 9):
                    lx, ly = i * px + ox, j * py + oy
                    x, y = cx0 + lx * ca - ly * sa, cy0 + lx * sa + ly * ca
                    out.append((0, ox, math.hypot(x - pt.x, y - pt.y), x, y, ang))
        minx, miny, maxx, maxy = zone.bounds
        for i in range(int((maxx - minx) / 0.3) + 1):
            for j in range(int((maxy - miny) / 0.3) + 1):
                x, y = minx + i * 0.3, miny + j * 0.3
                out.append((1, 0, math.hypot(x - zone.centroid.x, y - zone.centroid.y), x, y, ang))
        return sorted(out)
    def fits(x, y, ang, local):
        ca, sa = math.cos(ang), math.sin(ang)
        world = []
        for p in parts:
            lx, ly = p["c"]
            wx, wy = x + lx * ca - ly * sa, y + lx * sa + ly * ca
            if p["t"] == "box":
                fp = affinity.rotate(box(-p["s"][0] / 2, -p["s"][1] / 2, p["s"][0] / 2, p["s"][1] / 2), ang, origin=(0, 0), use_radians=True)
            else:
                fp = Point(0, 0).buffer(p["r"], 3)
            world.append((p, affinity.translate(fp, wx, wy)))
        foot_all = unary_union([wp[1] for wp in world])
        if not zone.contains(foot_all) or any(t.intersects(foot_all.buffer(0.2)) for t in taken + local):
            return None
        return foot_all, world, (x, y, ang)
    best_plan = []
    for ang in (base, base + math.pi / 2):
        for lattice in (0, 0.5):
            plan, local = [], []
            for tier, ox, _, x, y, a2 in candidates(ang):
                if len(plan) >= cap or (tier == 1 and plan): break
                if tier == 0 and (ox != 0) != (lattice != 0): continue
                r = fits(x, y, a2, local)
                if r: plan.append(r); local.append(r[0])
            if len(plan) > len(best_plan): best_plan = plan
    placed = 0
    for foot_all, world, (ix, iy, iang) in best_plan:
        taken.append(foot_all)
        for p, fp in world:
            furniture.append({"poly": [list(q) for q in fp.exterior.coords[:-1]],
                              "height": p["s"][2] if p["t"] == "box" else p["h"], "mat": p["mat"], "room": text})
        # Pose of the whole item, so Blender can build shaped pieces inside the same footprint.
        items.append({"kind": kind, "x": ix, "y": iy, "ang": iang, "room": text,
                      "footprint": [list(q) for q in foot_all.convex_hull.exterior.coords[:-1]]})
        placed += 1
    report.append((text, kind, placed))

# --- floor zones by use (flat overlays in Blender): wet rooms, laboratories/clinics, offices
ZONE_RX = [(r"^BA.O|^WC$|DUCHA|VESTIER|^ASEO", "wet"), (r"LABORATORIO|AULA|OSTEOTECA|PRECLINICA|PRIMEROS", "lab")]
zone_geoms = {"wet": [], "lab": [], "office": []}
for text, pt in labels:
    kind = next((k for rx, k in ZONE_RX if re.search(rx, text)), None)
    if kind is None and any(re.search(rx, text) for rx, k in PROGRAMME if k == "office"):
        kind = "office"
    if kind is None:
        continue
    room = next((r for r in rooms if r.contains(pt)), None)
    if room is None:
        continue
    a = area_near(pt)
    if 0.55 * a <= room.area <= 1.6 * a:
        zone_geoms[kind].append(room)          # closed room matching its label: use all of it
        continue
    # Open room: clip it with a rectangle aligned to the nearby walls, sized from the labelled area,
    # so the floor change reads as a straight edge instead of leaking into the corridor as a disc.
    disc = pt.buffer(max(3.0, math.sqrt(a)))
    hist = {}
    for ringc in [room.exterior] + list(room.interiors):
        cc = list(ringc.coords)
        for p0, p1 in zip(cc, cc[1:]):
            seg = LineString([p0, p1])
            if not seg.intersects(disc): continue
            t = round((math.degrees(math.atan2(p1[1] - p0[1], p1[0] - p0[0])) % 90) / 3) * 3 % 90
            hist[t] = hist.get(t, 0) + seg.intersection(disc).length
    ang = math.radians(max(hist, key=hist.get)) if hist else 0.0
    half = math.sqrt(a) * 0.62
    rect = affinity.rotate(box(-half, -half, half, half), ang, origin=(0, 0), use_radians=True)
    z = room.intersection(affinity.translate(rect, pt.x, pt.y))
    if z.area > 0.4 * a:
        zone_geoms[kind].append(z)
zones = []
claimed = None
for kind in ("wet", "lab", "office"):
    g = unary_union(zone_geoms[kind]) if zone_geoms[kind] else None
    if g is None or g.is_empty: continue
    if claimed is not None: g = g.difference(claimed)
    claimed = g if claimed is None else unary_union([claimed, g])
    for p in getattr(g, "geoms", [g]):
        if p.geom_type == "Polygon" and p.area > 0.5:
            zones.append({"kind": kind, "outer": [list(c) for c in p.exterior.coords[:-1]], "holes": [[list(c) for c in i.coords[:-1]] for i in p.interiors]})
report.append(("zones", {k: round(sum(Polygon(z["outer"]).area for z in zones if z["kind"] == k), 1) for k in ("wet", "lab", "office")}))

def ring(p): return {"outer": [list(c) for c in p.exterior.coords[:-1]], "holes": [[list(c) for c in i.coords[:-1]] for i in p.interiors]}
json.dump({"footprint": [ring(p) for p in getattr(foot2, "geoms", [foot2])],
           "cafe_slab": ring(cafe),
           "openings": [{k: v for k, v in op.items() if k != "poly"} for op in openings],
           "doors": doors, "arcs": arcs, "fixtures": fixtures, "furniture": furniture,
           "items": items, "zones": zones},
          open(OUT, "w", encoding="utf-8"))
print("openings", len(openings), "with leaf", sum(o["door"] for o in openings), "leaves", len(doors))
print("fixtures", len(fixtures), "furniture parts", len(furniture))
for r in report:
    print(r)

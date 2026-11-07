# Run inside Blender (Plan 3, first visual pass). Rebuilds materials, UVs and site/decoration objects.
# Inputs: site.json, extras.json, textures in //textures (model/textures). Idempotent: re-running replaces Deco_* objects.
import bpy, bmesh, json, math, os, random
from mathutils import Vector, Matrix
from mathutils.geometry import tessellate_polygon

MODEL_DIR = os.path.dirname(bpy.data.filepath)
SCR = globals().get("DATA_DIR") or os.path.join(MODEL_DIR, "tools", "data")
TEX = os.path.join(os.path.dirname(bpy.data.filepath), "textures")
SITE = json.load(open(os.path.join(SCR, "site.json"), encoding="utf-8"))
EXTRAS = json.load(open(os.path.join(SCR, "extras.json"), encoding="utf-8"))
TEXSZ = json.load(open(os.path.join(TEX, "textures.json"), encoding="utf-8"))
G = {}; exec(open(globals().get("GRAPH_FILE") or os.path.join(MODEL_DIR, "..", "..", "scripts", "ucc_floor1_data.py"), encoding="utf-8").read(), G)
PL = {r[0]: (r[1], r[2]) for r in G["PLACES"]}
ROUTES = [(PL[a], PL[b]) for a, b, _ in G["PATHS"]]
col = bpy.data.collections["UCC_Piso1"]
random.seed(11)
log = []

# ---------------------------------------------------------------- materials
def bsdf(m): return next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
def flat_mat(name, rgb, rough=0.7, metal=0.0, alpha=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True; b = bsdf(m)
    for l in list(b.inputs["Base Color"].links): m.node_tree.links.remove(l)
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if alpha is not None:
        b.inputs["Alpha"].default_value = alpha
        try: m.surface_render_method = "BLENDED"
        except Exception: pass
    return m
def tex_mat(name, img, rough=0.8, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True; nt = m.node_tree; b = bsdf(m)
    node = next((n for n in nt.nodes if n.type == "TEX_IMAGE"), None) or nt.nodes.new("ShaderNodeTexImage")
    node.image = bpy.data.images.load(os.path.join(TEX, img), check_existing=True)
    node.image.filepath = "//textures/" + img
    node.location = (b.location.x - 320, b.location.y)
    nt.links.new(node.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    return m

M = {
    "Wall_Cut": flat_mat("Wall_Cut", (0.93, 0.91, 0.87), 0.85),          # interior plaster, warm white
    "Wall_Cap": flat_mat("Wall_Cap", (0.14, 0.13, 0.13), 0.9),           # cut poche
    "Wall_Brick": tex_mat("Wall_Brick", "brick.jpg", 0.85),
    "Column": flat_mat("Column", (0.64, 0.62, 0.59), 0.8),               # exposed concrete
    "Floor_Interior": tex_mat("Floor_Interior", "tiles.jpg", 0.45),
    "Site_Plaza": tex_mat("Site_Plaza", "pavers.jpg", 0.9),
    "Grass": tex_mat("Grass", "grass.jpg", 0.95),
    "Stone_Wall": tex_mat("Stone_Wall", "stone.jpg", 0.9),
    "Green_Wall": tex_mat("Green_Wall", "greenwall.jpg", 0.95),
    "Glass": flat_mat("Glass", (0.40, 0.53, 0.60), 0.08, 0.0, 0.32),
    "Frame_Dark": flat_mat("Frame_Dark", (0.10, 0.10, 0.11), 0.45, 0.5),
    "Metal_Light": flat_mat("Metal_Light", (0.66, 0.68, 0.70), 0.4, 0.6),
    "Metal_Dark": flat_mat("Metal_Dark", (0.17, 0.18, 0.19), 0.45, 0.6),
    "Planter": flat_mat("Planter", (0.62, 0.61, 0.58), 0.9),
    "Trunk": flat_mat("Trunk", (0.30, 0.22, 0.16), 0.9),
    "Foliage_A": flat_mat("Foliage_A", (0.20, 0.38, 0.15), 0.85),
    "Foliage_B": flat_mat("Foliage_B", (0.28, 0.45, 0.18), 0.85),
    "Foliage_Dark": flat_mat("Foliage_Dark", (0.12, 0.26, 0.12), 0.85),
    "Shrub": flat_mat("Shrub", (0.25, 0.42, 0.17), 0.9),
    "Shrub_Flower": flat_mat("Shrub_Flower", (0.62, 0.12, 0.14), 0.8),
    "Solar_Panel": flat_mat("Solar_Panel", (0.05, 0.08, 0.17), 0.25, 0.3),
    "Canopy_Translucent": flat_mat("Canopy_Translucent", (0.90, 0.93, 0.95), 0.3, 0.0, 0.16),
    "Swing_Line": flat_mat("Swing_Line", (0.32, 0.29, 0.26), 0.8),
    "Lamp_Head": flat_mat("Lamp_Head", (0.85, 0.85, 0.80), 0.4),
}
M["Floor_Interior"]  # keep reference
SZ = {"Wall_Brick": TEXSZ["brick.jpg"], "Floor_Interior": TEXSZ["tiles.jpg"], "Site_Plaza": TEXSZ["pavers.jpg"],
      "Grass": TEXSZ["grass.jpg"], "Stone_Wall": TEXSZ["stone.jpg"], "Green_Wall": TEXSZ["greenwall.jpg"]}

# ---------------------------------------------------------------- helpers
def set_uv(ob):
    me = ob.data
    uv = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    mw = ob.matrix_world
    for poly in me.polygons:
        mname = me.materials[poly.material_index].name if me.materials else ""
        sx, sy = SZ.get(mname, (1.0, 1.0))
        n = (mw.to_3x3() @ poly.normal).normalized()
        if abs(n.z) > 0.7:
            for li in poly.loop_indices:
                co = mw @ me.vertices[me.loops[li].vertex_index].co
                uv.data[li].uv = (co.x / sx, co.y / sy)
        else:
            t = Vector((-n.y, n.x, 0.0))
            t = t.normalized() if t.length > 1e-6 else Vector((1, 0, 0))
            for li in poly.loop_indices:
                co = mw @ me.vertices[me.loops[li].vertex_index].co
                uv.data[li].uv = ((co.x * t.x + co.y * t.y) / sx, co.z / sy)

def new_object(name, mats):
    old = bpy.data.objects.get(name)
    if old:
        me_old = old.data; bpy.data.objects.remove(old, do_unlink=True)
        if me_old and me_old.users == 0: bpy.data.meshes.remove(me_old)
    me = bpy.data.meshes.new(name)
    for m in mats: me.materials.append(M[m] if m in M else bpy.data.materials[m])
    ob = bpy.data.objects.new(name, me); col.objects.link(ob)
    return ob

def finish(ob, bm):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free()
    smooth = {i for i, m in enumerate(ob.data.materials) if m.name.startswith(("Foliage", "Shrub"))}
    for p in ob.data.polygons: p.use_smooth = p.material_index in smooth
    if any(m.name in SZ for m in ob.data.materials): set_uv(ob)
    log.append((ob.name, len(ob.data.polygons)))

def add_prism(bm, rings, z0, z1, mi, caps=True):
    rings = [[Vector((p[0], p[1])) for p in r] for r in rings if len(r) >= 3]
    if not rings: return
    vb = [[bm.verts.new((v.x, v.y, z0)) for v in r] for r in rings]
    vt = [[bm.verts.new((v.x, v.y, z1)) for v in r] for r in rings]
    fb = [v for r in vb for v in r]; ft = [v for r in vt for v in r]
    if caps:
        for tri in tessellate_polygon([[v.to_3d() for v in r] for r in rings]):
            try:
                bm.faces.new([ft[i] for i in tri]).material_index = mi
                bm.faces.new([fb[i] for i in reversed(tri)]).material_index = mi
            except ValueError: pass
    for rb, rt in zip(vb, vt):
        n = len(rb)
        for i in range(n):
            try: bm.faces.new([rb[i], rb[(i + 1) % n], rt[(i + 1) % n], rt[i]]).material_index = mi
            except ValueError: pass

def add_box(bm, c, size, ang, mi):
    ca, sa = math.cos(ang), math.sin(ang); hx, hy = size[0] / 2, size[1] / 2
    ring = [(c[0] + ca * x - sa * y, c[1] + sa * x + ca * y) for x, y in ((-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy))]
    add_prism(bm, [ring], c[2], c[2] + size[2], mi)

def add_seg_box(bm, a, b, width, z0, z1, mi):
    dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy)
    if L < 1e-4: return
    add_box(bm, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z0), (L, width, z1 - z0), math.atan2(dy, dx), mi)

def add_beam3d(bm, p0, p1, w, h, mi):
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0
    if d.length < 1e-4: return
    d.normalize(); side = d.cross(Vector((0, 0, 1)))
    side = side.normalized() if side.length > 1e-6 else Vector((1, 0, 0))
    up = side.cross(d).normalized()
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    a = [bm.verts.new(p0 + side * sx * w / 2 + up * sy * h / 2) for sx, sy in corners]
    b = [bm.verts.new(p1 + side * sx * w / 2 + up * sy * h / 2) for sx, sy in corners]
    for f in (list(reversed(a)), b, *[[a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]] for i in range(4)]):
        bm.faces.new(f).material_index = mi

def add_cyl(bm, x, y, r, z0, z1, segs, mi):
    add_prism(bm, [[(x + r * math.cos(2 * math.pi * k / segs), y + r * math.sin(2 * math.pi * k / segs)) for k in range(segs)]], z0, z1, mi)

def add_ico(bm, c, rx, ry, rz, mi, sub=1):
    mat = Matrix.Translation(c) @ Matrix.Diagonal((rx, ry, rz, 1.0))
    res = bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0, matrix=mat)
    for f in {f for v in res["verts"] for f in v.link_faces}: f.material_index = mi

def add_cone(bm, c, r, h, segs, mi):
    mat = Matrix.Translation((c[0], c[1], c[2] + h / 2))
    res = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r, radius2=0.0, depth=h, matrix=mat)
    for f in {f for v in res["verts"] for f in v.link_faces}: f.material_index = mi

def route_dist(x, y):
    best = 1e9
    for (ax, ay), (bx, by) in ROUTES:
        dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy
        t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) if L2 else 0
        best = min(best, math.hypot(x - ax - t * dx, y - ay - t * dy))
    return best

FOOT = [(r["outer"], r["holes"]) for r in EXTRAS["footprint"]]
def pip(x, y, ring):
    inside = False; n = len(ring); j = n - 1
    for i in range(n):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi: inside = not inside
        j = i
    return inside
def in_foot(x, y): return any(pip(x, y, o) and not any(pip(x, y, h) for h in hs) for o, hs in FOOT)

# ---------------------------------------------------------------- 1. walls and columns: exterior faces in brick
def classify(obname, brick_slot_name="Wall_Brick"):
    ob = bpy.data.objects[obname]; me = ob.data
    names = [m.name for m in me.materials]
    if brick_slot_name not in names: me.materials.append(M[brick_slot_name]); names.append(brick_slot_name)
    bi = names.index(brick_slot_name); side = names.index("Wall_Cut") if "Wall_Cut" in names else names.index("Column")
    ext = 0
    for poly in me.polygons:
        if abs(poly.normal.z) > 0.3: continue
        c = poly.center; n = Vector((poly.normal.x, poly.normal.y)).normalized()
        out = not in_foot(c.x + n.x * 0.3, c.y + n.y * 0.3)
        poly.material_index = bi if out else side
        ext += out
    set_uv(ob)
    log.append((obname, "exterior faces", ext, "of", len(me.polygons)))
classify("Walls"); classify("Columns")
fs = bpy.data.objects["Floor_Slab"]; set_uv(fs)

# ---------------------------------------------------------------- 2. site base (pavers) and grass
site = new_object("Site", ["Site_Plaza"]); bm = bmesh.new()
add_prism(bm, [[(-10, -8), (77, -8), (77, 68), (-10, 68)]], -0.35, -0.15, 0); finish(site, bm)
grass = new_object("Deco_Grass", ["Grass"]); bm = bmesh.new()
for r in SITE["green"]: add_prism(bm, [r["outer"]] + r["holes"], -0.16, -0.12, 0)
finish(grass, bm)

# ---------------------------------------------------------------- 3. vegetation, chunked by 25 m cells
for o in [o for o in col.objects if o.name.startswith("Deco_Trees_")]:
    me_old = o.data; bpy.data.objects.remove(o, do_unlink=True)
    if me_old.users == 0: bpy.data.meshes.remove(me_old)
cells = {}
for t in SITE["trees"]: cells.setdefault((int((t["xy"][0] + 10) // 25), int((t["xy"][1] + 8) // 25)), []).append(t)
for (ci, cj), trees in sorted(cells.items()):
    # Trunks and crowns are separate objects: crowns sit above 2 m, so the runtime's body-height rays skip them by bounding box.
    obt = new_object(f"Deco_Tree_Trunks_{ci}_{cj}", ["Trunk"]); bmt = bmesh.new()
    obc = new_object(f"Deco_Tree_Crowns_{ci}_{cj}", ["Foliage_A", "Foliage_B"]); bmc = bmesh.new()
    for t in trees:
        x, y = t["xy"]; rc = max(1.3, min(3.2, t["r"] * (1.6 if t["kind"] == "tree" else 1.9))) * random.uniform(0.9, 1.1)
        top = 2.05 + 0.85 * rc
        add_cyl(bmt, x, y, 0.13 if rc < 2 else 0.2, -0.15, top - 0.2, 6, 0)
        fol = random.choice((0, 1))
        add_ico(bmc, (x, y, top), rc, rc, rc * 0.8, fol, sub=2)
        for k in range(2):
            a = random.uniform(0, 2 * math.pi); off = rc * 0.45
            add_ico(bmc, (x + off * math.cos(a), y + off * math.sin(a), top + rc * random.uniform(0.0, 0.25)), rc * 0.62, rc * 0.62, rc * 0.55, fol)
    finish(obt, bmt); finish(obc, bmc)
ob = new_object("Deco_Cypress", ["Trunk", "Foliage_Dark"]); bm = bmesh.new()
for t in SITE["cypress"]:
    x, y = t["xy"]; h = random.uniform(3.4, 4.2)
    add_cyl(bm, x, y, 0.08, -0.15, 0.35, 6, 0); add_cone(bm, (x, y, 0.3), 0.42, h, 8, 1)
finish(ob, bm)
ob = new_object("Deco_Shrubs", ["Shrub", "Shrub_Flower"]); bm = bmesh.new()
for s in SITE["shrubs"]:
    x, y = s["xy"]; r = max(0.35, min(1.1, s["r"]))
    add_ico(bm, (x, y, -0.12 + r * 0.55), r, r, r * 0.6, 1 if random.random() < 0.18 else 0)
finish(ob, bm)

# ---------------------------------------------------------------- 4. hard landscape
ob = new_object("Deco_Stone_Walls", ["Stone_Wall"]); bm = bmesh.new()
for r in SITE["stone"]: add_prism(bm, [r["outer"]] + r["holes"], -0.15, 0.55, 0)
finish(ob, bm)
ob = new_object("Deco_Planters", ["Planter"]); bm = bmesh.new()
for r in SITE["planters"]: add_prism(bm, [r["outer"]] + r["holes"], -0.15, 0.45, 0)
finish(ob, bm)
gw = SITE["greenwall"]
if gw:
    ob = new_object("Deco_Green_Wall", ["Green_Wall", "Foliage_Dark"]); bm = bmesh.new()
    x = -10.05; y0, y1 = 9.2, max(gw[0][1], gw[1][1])
    add_prism(bm, [[(x - 0.2, y0), (x + 0.2, y0), (x + 0.2, y1), (x - 0.2, y1)]], -0.15, 3.3, 0)
    finish(ob, bm)
fe = SITE["fence"]
if fe:
    ob = new_object("Deco_Fence", ["Metal_Light"]); bm = bmesh.new()
    (ax, ay), (bx, by) = fe; L = math.hypot(bx - ax, by - ay); n = int(L / 0.12)
    for k in range(n + 1):
        t = k / n; add_box(bm, (ax + (bx - ax) * t, ay + (by - ay) * t, -0.15), (0.04, 0.04, 2.35), math.atan2(by - ay, bx - ax), 0)
    for z in (0.05, 2.05): add_seg_box(bm, (ax, ay), (bx, by), 0.05, z, z + 0.06, 0)
    finish(ob, bm)
ob = new_object("Deco_Lamps", ["Metal_Dark", "Lamp_Head"]); bm = bmesh.new()
for l in SITE["lamps"]:
    x, y = l["xy"]
    if route_dist(x, y) < 0.65: continue
    add_cyl(bm, x, y, 0.06, -0.15, 4.6, 8, 0)
    add_box(bm, (x + 0.25, y, 4.55), (0.7, 0.22, 0.1), 0.0, 1)
finish(ob, bm)

# ---------------------------------------------------------------- 5. solar bike canopy (VOLADO rectangle + PEDESTAL posts)
rect = next(v["pts"] for v in SITE["volado"] if v["closed"])[:4]
ob = new_object("Deco_Solar_Canopy", ["Solar_Panel", "Metal_Dark"]); bm = bmesh.new()
ys = [p[1] for p in rect]; ymin, ymax = min(ys), max(ys)
bv = [bm.verts.new((p[0], p[1], 2.65 + 0.45 * (p[1] - ymin) / (ymax - ymin))) for p in rect]
tv = [bm.verts.new((v.co.x, v.co.y, v.co.z + 0.07)) for v in bv]
for f in ([*reversed(bv)], tv, *[[bv[i], bv[(i + 1) % 4], tv[(i + 1) % 4], tv[i]] for i in range(4)]):
    bm.faces.new(f).material_index = 0
posts = {}
for p in SITE["pedestals"]: posts.setdefault((round(p["xy"][0]), round(p["xy"][1])), p["xy"])
for x, y in posts.values():
    add_cyl(bm, x, y, 0.09, -0.15, 2.7 + 0.45 * (y - ymin) / (ymax - ymin), 8, 1)
finish(ob, bm)

# ---------------------------------------------------------------- 6. access pavilion: translucent sloped roof + steel frame; terrace frame
def clip_poly_y(poly, ymin):
    out = []
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        ain, bin_ = a[1] >= ymin, b[1] >= ymin
        if ain: out.append(a)
        if ain != bin_:
            t = (ymin - a[1]) / (b[1] - a[1]); out.append((a[0] + t * (b[0] - a[0]), ymin))
    return out
def hspan(poly, y):
    xs = []
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        if (a[1] - y) * (b[1] - y) < 0 or (a[1] == y and b[1] != y):
            t = (y - a[1]) / (b[1] - a[1]); xs.append(a[0] + t * (b[0] - a[0]))
    return (min(xs), max(xs)) if len(xs) >= 2 else None
hall_raw = next(v["pts"] for v in SITE["volado"] if not v["closed"] and len(v["pts"]) >= 5)
hall = clip_poly_y([(-4.19, 10.53), (-4.14, -0.31), (3.61, -11.9), (4.49, 10.58)], -8.0)
zf = lambda y: 3.4 + 1.9 * (y + 8.0) / 18.6
ob = new_object("Canopy_Access_Roof", ["Canopy_Translucent"]); bm = bmesh.new()
vb = [bm.verts.new((x, y, zf(y))) for x, y in hall]; vt = [bm.verts.new((x, y, zf(y) + 0.03)) for x, y in hall]
bm.faces.new(list(reversed(vb))).material_index = 0; bm.faces.new(vt).material_index = 0
for i in range(len(hall)):
    j = (i + 1) % len(hall); bm.faces.new([vb[i], vb[j], vt[j], vt[i]]).material_index = 0
finish(ob, bm)
ob = new_object("Canopy_Access_Frame", ["Metal_Light"]); bm = bmesh.new()
for i in range(len(hall)):
    a, b = hall[i], hall[(i + 1) % len(hall)]
    za, zb = zf(a[1]), zf(b[1])
    dx, dy, dz = b[0] - a[0], b[1] - a[1], zb - za
    add_beam3d(bm, (a[0], a[1], za - 0.15), (b[0], b[1], zb - 0.15), 0.16, 0.26, 0)
y = -7.0
while y < 10.4:                     # rafters every 2 m with a light truss depth
    sp = hspan(hall, y)
    if sp: add_seg_box(bm, (sp[0], y), (sp[1], y), 0.10, zf(y) - 0.35, zf(y) - 0.02, 0)
    y += 2.0
cols_kept = 0
for x, y in hall:
    if route_dist(x, y) >= 0.65 and y > -7.9:
        add_cyl(bm, x, y, 0.11, -0.15, zf(y) - 0.02, 10, 0); cols_kept += 1
finish(ob, bm)
log.append(("access columns kept", cols_kept))
terrace = clip_poly_y([(4.1, 0.64), (3.65, -11.36), (22.33, -7.69), (21.8, 0.99), (13.86, 1.25), (13.77, 0.29)], -8.0)
ob = new_object("Canopy_Terrace_Frame", ["Metal_Light"]); bm = bmesh.new()
for i in range(len(terrace)):
    a, b = terrace[i], terrace[(i + 1) % len(terrace)]
    add_seg_box(bm, a, b, 0.16, 3.15, 3.45, 0)
y = -7.0
while y < 0.6:
    sp = hspan(terrace, y)
    if sp: add_seg_box(bm, (sp[0], y), (sp[1], y), 0.08, 3.2, 3.42, 0)
    y += 1.6
for x, y in terrace:
    if route_dist(x, y) >= 0.65 and y > -7.9: add_cyl(bm, x, y, 0.1, -0.15, 3.2, 10, 0)
finish(ob, bm)

# ---------------------------------------------------------------- 7. glass frames and mullions
for o in [o for o in col.objects if o.name.startswith("Glass_Frames") or o.name.startswith("Glass_Mullions")]:
    me_old = o.data; bpy.data.objects.remove(o, do_unlink=True)
    if me_old.users == 0: bpy.data.meshes.remove(me_old)
# Rails above and below the body-height rays are separate; mullions are chunked by 20 m cells.
top = new_object("Glass_Frames_Top", ["Frame_Dark"]); bmtop = bmesh.new()
base = new_object("Glass_Frames_Base", ["Frame_Dark"]); bmbase = bmesh.new()
mcells = {}
for (a, b) in SITE["glass_lines"]:
    L = math.hypot(b[0] - a[0], b[1] - a[1])
    if L < 0.15: continue
    add_seg_box(bmtop, a, b, 0.10, 2.50, 2.62, 0)
    add_seg_box(bmbase, a, b, 0.10, 0.0, 0.07, 0)
    n = max(1, round(L / 1.25)); ang = math.atan2(b[1] - a[1], b[0] - a[0])
    for k in range(n + 1):
        t = k / n; x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
        mcells.setdefault((int((x + 10) // 20), int((y + 8) // 20)), []).append((x, y, ang))
finish(top, bmtop); finish(base, bmbase)
for (ci, cj), ms in sorted(mcells.items()):
    ob = new_object(f"Glass_Mullions_{ci}_{cj}", ["Frame_Dark"]); bm = bmesh.new()
    for x, y, ang in ms: add_box(bm, (x, y, 0.07), (0.05, 0.11, 2.43), ang, 0)
    finish(ob, bm)

# ---------------------------------------------------------------- 8. door swing arcs: flat strips (no side faces)
ob = new_object("Door_Swings", ["Swing_Line"]); bm = bmesh.new()
for a in EXTRAS["arcs"]:
    segs = 8; prev = None
    for k in range(segs + 1):
        t = a["a0"] + a["da"] * k / segs
        o = bm.verts.new((a["center"][0] + (a["r"] + 0.012) * math.cos(t), a["center"][1] + (a["r"] + 0.012) * math.sin(t), 0.006))
        i = bm.verts.new((a["center"][0] + (a["r"] - 0.012) * math.cos(t), a["center"][1] + (a["r"] - 0.012) * math.sin(t), 0.006))
        if prev: bm.faces.new([prev[1], i, o, prev[0]]).material_index = 0
        prev = (o, i)
finish(ob, bm)

for row in log: print(row)
tot = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in col.objects if o.type == "MESH")
print("total tris", tot)

# Run inside Blender after blender_extras.py and blender_visual_c1.py (Plan 3, second visual pass: interiors).
# - Shaped furniture built from the item poses in extras.json, inside the footprints validated against the routes.
# - Floor overlays by use (wet rooms, laboratories/clinic, offices).
# - Hanging destination signs above 2.2 m at confirmed destinations and the entrance.
import bpy, bmesh, json, math, os
from mathutils import Vector, Matrix
from mathutils.geometry import tessellate_polygon

MODEL_DIR = os.path.dirname(bpy.data.filepath)
DATA = globals().get("DATA_DIR") or os.path.join(MODEL_DIR, "tools", "data")
TEX = os.path.join(MODEL_DIR, "textures")
X = json.load(open(os.path.join(DATA, "extras.json"), encoding="utf-8"))
TEXSZ = json.load(open(os.path.join(TEX, "textures.json"), encoding="utf-8"))
G = {}; exec(open(globals().get("GRAPH_FILE") or os.path.join(MODEL_DIR, "..", "..", "scripts", "ucc_floor1_data.py"), encoding="utf-8").read(), G)
PL = {r[0]: (r[1], r[2]) for r in G["PLACES"]}
col = bpy.data.collections[globals().get("TARGET_COLLECTION") or "UCC_Piso1"]
PFX = globals().get("NAME_PREFIX") or ""
log = []

def bsdf(m): return next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
def flat_mat(name, rgb, rough=0.7, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True; b = bsdf(m)
    for l in list(b.inputs["Base Color"].links): m.node_tree.links.remove(l)
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    return m
def tex_mat(name, img, rough=0.8):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True; nt = m.node_tree; b = bsdf(m)
    node = next((n for n in nt.nodes if n.type == "TEX_IMAGE"), None) or nt.nodes.new("ShaderNodeTexImage")
    node.image = bpy.data.images.load(os.path.join(TEX, img), check_existing=True); node.image.filepath = "//textures/" + img
    node.image.reload()
    nt.links.new(node.outputs["Color"], b.inputs["Base Color"]); b.inputs["Roughness"].default_value = rough
    return m

M = {
    "Furniture_Wood": flat_mat("Furniture_Wood", (0.60, 0.43, 0.27), 0.6),
    "Furniture_Seat": flat_mat("Furniture_Seat", (0.18, 0.29, 0.40), 0.8),
    "Furniture_Lab": flat_mat("Furniture_Lab", (0.90, 0.90, 0.88), 0.35),
    "Furniture_Felt": flat_mat("Furniture_Felt", (0.10, 0.38, 0.22), 0.95),
    "Furniture_Metal": flat_mat("Furniture_Metal", (0.55, 0.57, 0.60), 0.4, 0.6),
    "Furniture_Dark": flat_mat("Furniture_Dark", (0.13, 0.13, 0.14), 0.5, 0.3),
    "Locker_Blue": flat_mat("Locker_Blue", (0.24, 0.38, 0.55), 0.45, 0.3),
    "Floor_Wet": tex_mat("Floor_Wet", "floor_wet.jpg", 0.3),
    "Floor_Vinyl": tex_mat("Floor_Vinyl", "floor_vinyl.jpg", 0.5),
    "Floor_Wood": tex_mat("Floor_Wood", "floor_wood.jpg", 0.55),
}
SZ = {"Floor_Wet": TEXSZ["floor_wet.jpg"], "Floor_Vinyl": TEXSZ["floor_vinyl.jpg"], "Floor_Wood": TEXSZ["floor_wood.jpg"]}

def new_object(name, mats):
    name = PFX + name
    old = bpy.data.objects.get(name)
    if old:
        me_old = old.data; bpy.data.objects.remove(old, do_unlink=True)
        if me_old and me_old.users == 0: bpy.data.meshes.remove(me_old)
    me = bpy.data.meshes.new(name)
    for m in mats: me.materials.append(M.get(m) or bpy.data.materials[m])
    ob = bpy.data.objects.new(name, me); col.objects.link(ob); return ob

def finish(ob, bm, uv=False):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free()
    if uv:
        me = ob.data; layer = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            sx, sy = SZ.get(me.materials[poly.material_index].name, (1, 1))
            for li in poly.loop_indices:
                co = me.vertices[me.loops[li].vertex_index].co; layer.data[li].uv = (co.x / sx, co.y / sy)
    log.append((ob.name, len(ob.data.polygons)))

class Kit:
    """Local-frame builder: boxes and cylinders placed relative to an item pose (x, y, ang)."""
    def __init__(self, bm, mats, x, y, ang): self.bm, self.mats, self.x, self.y, self.ca, self.sa, self.ang = bm, mats, x, y, math.cos(ang), math.sin(ang), ang
    def w(self, lx, ly): return (self.x + lx * self.ca - ly * self.sa, self.y + lx * self.sa + ly * self.ca)
    def box(self, lx, ly, sx, sy, z0, z1, mat, rot=0.0):
        cx, cy = self.w(lx, ly); a = self.ang + rot; ca, sa = math.cos(a), math.sin(a)
        ring = [(cx + ca * u - sa * v, cy + sa * u + ca * v) for u, v in ((-sx / 2, -sy / 2), (sx / 2, -sy / 2), (sx / 2, sy / 2), (-sx / 2, sy / 2))]
        self._prism(ring, z0, z1, self.mats.index(mat))
    def cyl(self, lx, ly, r, z0, z1, mat, segs=8):
        cx, cy = self.w(lx, ly)
        self._prism([(cx + r * math.cos(2 * math.pi * k / segs), cy + r * math.sin(2 * math.pi * k / segs)) for k in range(segs)], z0, z1, self.mats.index(mat))
    def _prism(self, ring, z0, z1, mi):
        bm = self.bm; vb = [bm.verts.new((p[0], p[1], z0)) for p in ring]; vt = [bm.verts.new((p[0], p[1], z1)) for p in ring]
        bm.faces.new(list(reversed(vb))).material_index = mi; bm.faces.new(vt).material_index = mi
        n = len(ring)
        for i in range(n): bm.faces.new([vb[i], vb[(i + 1) % n], vt[(i + 1) % n], vt[i]]).material_index = mi

def chair(k, lx, ly, face_ang, seat_mat="Furniture_Seat"):
    """Chair at (lx, ly) facing +face_ang (local radians): seat, back on the far side, four legs."""
    c, s = math.cos(face_ang), math.sin(face_ang)
    def p(u, v): return (lx + u * c - v * s, ly + u * s + v * c)
    for u, v in ((-0.18, -0.18), (0.18, -0.18), (-0.18, 0.18), (0.18, 0.18)):
        q = p(u, v); k.box(q[0], q[1], 0.03, 0.03, 0.0, 0.44, "Furniture_Dark")
    q = p(0, 0); k.box(q[0], q[1], 0.42, 0.42, 0.44, 0.48, seat_mat, face_ang)
    q = p(-0.19, 0); k.box(q[0], q[1], 0.04, 0.42, 0.48, 0.86, seat_mat, face_ang)

def build_item(k, kind):
    if kind == "office":
        k.box(0, 0, 1.20, 0.60, 0.72, 0.75, "Furniture_Wood")
        for sx in (-0.57, 0.57): k.box(sx, 0, 0.03, 0.56, 0.0, 0.72, "Furniture_Wood")
        k.box(0, 0.26, 1.10, 0.02, 0.35, 0.72, "Furniture_Wood")
        k.box(0.25, 0.1, 0.5, 0.04, 0.75, 1.05, "Furniture_Dark")          # monitor
        k.cyl(0, -0.58, 0.03, 0.08, 0.44, "Furniture_Metal", 6)            # office chair on a pedestal
        k.box(0, -0.58, 0.5, 0.05, 0.03, 0.07, "Furniture_Dark"); k.box(0, -0.58, 0.05, 0.5, 0.03, 0.07, "Furniture_Dark")
        k.box(0, -0.58, 0.46, 0.46, 0.44, 0.49, "Furniture_Seat")
        k.box(0, -0.79, 0.44, 0.04, 0.49, 0.92, "Furniture_Seat")
    elif kind == "lab":
        k.box(0, 0, 2.40, 0.80, 0.86, 0.90, "Furniture_Lab")
        k.box(0, 0.05, 2.30, 0.66, 0.08, 0.86, "Furniture_Metal")
        k.box(0, 0.05, 2.30, 0.66, 0.0, 0.08, "Furniture_Dark")
        for i, sx in enumerate((-0.77, 0.0, 0.77)): k.box(sx, -0.285, 0.70, 0.02, 0.14, 0.80, "Furniture_Lab")   # cabinet doors
        k.box(0, 0.36, 2.40, 0.06, 0.90, 1.25, "Furniture_Lab")                                               # upstand / shelf
        for sx in (-0.8, 0.0, 0.8):
            k.cyl(sx, -0.65, 0.17, 0.0, 0.03, "Furniture_Dark", 8); k.cyl(sx, -0.65, 0.025, 0.03, 0.60, "Furniture_Metal", 6)
            k.cyl(sx, -0.65, 0.18, 0.60, 0.64, "Furniture_Seat", 10)
    elif kind == "cafe":
        k.cyl(0, 0, 0.22, 0.0, 0.03, "Furniture_Dark", 10); k.cyl(0, 0, 0.04, 0.03, 0.72, "Furniture_Metal", 6)
        k.cyl(0, 0, 0.45, 0.72, 0.75, "Furniture_Wood", 16)
        for a in (0, math.pi / 2, math.pi, -math.pi / 2):
            chair(k, 0.75 * math.cos(a), 0.75 * math.sin(a), a + math.pi)  # back on the outer side
    elif kind == "wait":
        for sx in (-0.82, 0.82): k.box(sx, 0, 0.05, 0.48, 0.0, 0.46, "Furniture_Metal")
        k.box(0, 0.02, 1.80, 0.46, 0.42, 0.46, "Furniture_Seat")
        k.box(0, -0.22, 1.80, 0.05, 0.46, 0.84, "Furniture_Seat")
    elif kind == "pool":
        for sx, sy in ((-1.05, -0.5), (1.05, -0.5), (-1.05, 0.5), (1.05, 0.5)): k.box(sx, sy, 0.16, 0.16, 0.0, 0.58, "Furniture_Wood")
        k.box(0, 0, 2.54, 1.42, 0.58, 0.80, "Furniture_Wood")
        k.box(0, 0, 2.30, 1.18, 0.80, 0.81, "Furniture_Felt")
    elif kind == "clinic":
        k.box(0, 0, 0.6, 0.5, 0.0, 0.42, "Furniture_Metal")
        k.box(0, 0, 1.30, 0.62, 0.42, 0.55, "Furniture_Seat")
        k.box(-0.62, 0, 0.12, 0.62, 0.55, 1.05, "Furniture_Seat")
        k.box(0.9, 0.7, 0.60, 0.50, 0.0, 0.90, "Furniture_Lab")
    elif kind == "gym":
        k.box(0, 0, 1.60, 0.62, 0.0, 0.20, "Furniture_Dark")
        k.box(0, 0, 1.40, 0.48, 0.20, 0.22, "Furniture_Metal")
        for sy in (-0.28, 0.28): k.box(0.78, sy, 0.06, 0.06, 0.20, 1.10, "Furniture_Metal")
        k.box(0.80, 0, 0.14, 0.62, 1.00, 1.10, "Furniture_Dark")
    elif kind == "class":
        k.box(0, 0, 0.60, 0.45, 0.70, 0.73, "Furniture_Wood")
        for sx in (-0.27, 0.27): k.box(sx, 0, 0.03, 0.40, 0.0, 0.70, "Furniture_Metal")
        chair(k, 0, -0.48, math.pi / 2)
    elif kind == "store":
        k.box(0, 0, 1.20, 0.50, 0.0, 1.80, "Locker_Blue")
        for sx in (-0.2, 0.2): k.box(sx, -0.252, 0.012, 0.012, 0.05, 1.75, "Furniture_Dark")
        k.box(0, -0.252, 1.18, 0.012, 0.92, 0.93, "Furniture_Dark")

# ---------------------------------------------------------------- 1. shaped furniture, in 20 m cells
for o in [o for o in col.objects if o.name.startswith(PFX + "Furniture_")]:
    me_old = o.data; bpy.data.objects.remove(o, do_unlink=True)
    if me_old.users == 0: bpy.data.meshes.remove(me_old)
FMATS = ["Furniture_Wood", "Furniture_Seat", "Furniture_Lab", "Furniture_Felt", "Furniture_Metal", "Furniture_Dark", "Locker_Blue"]
cells = {}
for it in X["items"]: cells.setdefault((int((it["x"] + 10) // 20), int((it["y"] + 8) // 20)), []).append(it)
for (ci, cj), its in sorted(cells.items()):
    ob = new_object(f"Furniture_{ci}_{cj}", FMATS); bm = bmesh.new()
    for it in its: build_item(Kit(bm, FMATS, it["x"], it["y"], it["ang"]), it["kind"])
    finish(ob, bm)

# ---------------------------------------------------------------- 2. floor overlays by use (flat, 8 mm above the slab)
ob = new_object("Floor_Zones", ["Floor_Wet", "Floor_Vinyl", "Floor_Wood"]); bm = bmesh.new()
KIND_MI = {"wet": 0, "lab": 1, "office": 2}
for z in X["zones"]:
    rings = [[Vector((p[0], p[1], 0.008)) for p in r] for r in [z["outer"]] + z["holes"] if len(r) >= 3]
    verts = [[bm.verts.new(v) for v in r] for r in rings]; flat = [v for r in verts for v in r]
    for tri in tessellate_polygon([[v.co for v in r] for r in verts]):
        try: bm.faces.new([flat[i] for i in tri]).material_index = KIND_MI[z["kind"]]
        except ValueError: pass
finish(ob, bm, uv=True)

# ---------------------------------------------------------------- 3. hanging destination signs (double-sided panels at 2.25-2.55 m)
SIGNS = [("ICETEX", "ICETEX doorway", "ICETEX approach", "sign_icetex.jpg"),
         ("Morphology Laboratory", "Laboratory corridor east", "Laboratory corridor west", "sign_morfologia.jpg"),
         ("Elevator and Restroom Hall", "Hall corridor north", "Hall corridor south", "sign_ascensores.jpg"),
         ("Preclinic / Dentistry Coordination", "Preclinic storeroom", "North circulation east", "sign_preclinica.jpg")]
for o in ([o for o in col.objects if o.name.startswith("Sign_")] if not PFX else []):
    me_old = o.data; bpy.data.objects.remove(o, do_unlink=True)
    if me_old.users == 0: bpy.data.meshes.remove(me_old)
def sign(name, img, cx, cy, face_dx, face_dy, z0=2.25, w=1.2, h=0.3):
    mat = tex_mat("Sign_" + name, img, 0.6)
    ob = new_object("Sign_" + name, ["Sign_" + name, "Furniture_Dark"]); bm = bmesh.new()
    L = math.hypot(face_dx, face_dy); nx, ny = face_dx / L, face_dy / L; tx, ty = -ny, nx    # panel faces (nx, ny)
    me = ob.data
    quads = []
    for side, off in ((1, 0.012), (-1, -0.012)):
        pts = [(cx + tx * u + nx * off, cy + ty * u + ny * off, z) for u, z in ((-w / 2 * side, z0), (w / 2 * side, z0), (w / 2 * side, z0 + h), (-w / 2 * side, z0 + h))]
        f = bm.faces.new([bm.verts.new(p) for p in pts]); f.material_index = 0; quads.append(f)
    for sx in (-0.45, 0.45):    # hanging rods
        p = (cx + tx * sx, cy + ty * sx)
        rv = [bm.verts.new((p[0] + dx, p[1] + dy, z)) for z in (z0 + h, z0 + h + 0.45) for dx, dy in ((-0.01, -0.01), (0.01, -0.01), (0.01, 0.01), (-0.01, 0.01))]
        for i in range(4): bm.faces.new([rv[i], rv[(i + 1) % 4], rv[4 + (i + 1) % 4], rv[4 + i]]).material_index = 1
    uvl = bm.loops.layers.uv.new("UVMap")
    for f in quads:
        for loop, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): loop[uvl].uv = uv
    bm.to_mesh(me); bm.free(); log.append((ob.name, len(me.polygons)))
for dest, at, came_from, img in (SIGNS if not PFX else []):
    (ax, ay), (bx, by) = PL[at], PL[came_from]
    sign(dest.split(" /")[0].split(" ")[0], img, ax, ay, bx - ax, by - ay)   # readable while approaching
None if PFX else sign("Acceso", "sign_acceso.jpg", PL["Hall Acceso"][0] + 0.6, PL["Hall Acceso"][1] + 1.6, 0.0, -1.0, z0=2.45)

for row in log: print(row)
tot = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in col.objects if o.type == "MESH")
print("total tris", tot)

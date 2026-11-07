# Run inside Blender: builds a cut floor model from a registered wing.json into its own scene and collection.
# Parameters (set before exec): FLOOR_ID (e.g. "2"), WING (path to data/floor<N>/wing.json).
# Objects are prefixed "P<N>_" (Blender names are unique per file). Materials are shared with the first floor.
import bpy, bmesh, json, math, os
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

FLOOR_ID = globals()["FLOOR_ID"]; WING = globals()["WING"]
W = json.load(open(WING, encoding="utf-8"))
MODEL_DIR = os.path.dirname(bpy.data.filepath)
TEXSZ = json.load(open(os.path.join(MODEL_DIR, "textures", "textures.json"), encoding="utf-8"))
P = f"P{FLOOR_ID}_"
main = bpy.data.scenes["Scene"]
sc = bpy.data.scenes.get(f"Piso{FLOOR_ID}") or bpy.data.scenes.new(f"Piso{FLOOR_ID}")
sc.render.engine = main.render.engine; sc.world = main.world
sc.view_settings.view_transform = main.view_settings.view_transform
coll = bpy.data.collections.get(f"UCC_Piso{FLOOR_ID}")
if coll is None:
    coll = bpy.data.collections.new(f"UCC_Piso{FLOOR_ID}"); sc.collection.children.link(coll)
for o in list(coll.objects):
    me = o.data; bpy.data.objects.remove(o, do_unlink=True)
    if me and me.users == 0: bpy.data.meshes.remove(me)
for n in ("Sun",):
    if bpy.data.objects.get(n) and n not in sc.collection.objects: sc.collection.objects.link(bpy.data.objects[n])
M = {n: bpy.data.materials[n] for n in ("Wall_Cut", "Wall_Cap", "Wall_Brick", "Column", "Glass", "Frame_Dark", "Floor_Interior", "Ramp_Stairs")}
SZ = {"Wall_Brick": TEXSZ["brick.jpg"], "Floor_Interior": TEXSZ["tiles.jpg"]}

FOOT = [(r["outer"], r["holes"]) for r in W["footprint"]]
def pip(x, y, ring):
    inside = False; n = len(ring); j = n - 1
    for i in range(n):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi: inside = not inside
        j = i
    return inside
def in_foot(x, y): return any(pip(x, y, o) and not any(pip(x, y, h) for h in hs) for o, hs in FOOT)

def new_object(name, mats):
    me = bpy.data.meshes.new(P + name)
    for m in mats: me.materials.append(M[m])
    ob = bpy.data.objects.new(P + name, me); coll.objects.link(ob); return ob
def add_prism(bm, rings, z0, z1, mi):
    rings = [[Vector((p[0], p[1])) for p in r] for r in rings if len(r) >= 3]
    if not rings: return
    vb = [[bm.verts.new((v.x, v.y, z0)) for v in r] for r in rings]; vt = [[bm.verts.new((v.x, v.y, z1)) for v in r] for r in rings]
    fb = [v for r in vb for v in r]; ft = [v for r in vt for v in r]
    for tri in tessellate_polygon([[v.to_3d() for v in r] for r in rings]):
        try:
            bm.faces.new([ft[i] for i in tri]).material_index = mi; bm.faces.new([fb[i] for i in reversed(tri)]).material_index = mi
        except ValueError: pass
    for rb, rt in zip(vb, vt):
        n = len(rb)
        for i in range(n):
            try: bm.faces.new([rb[i], rb[(i + 1) % n], rt[(i + 1) % n], rt[i]]).material_index = mi
            except ValueError: pass
def finish(ob, bm, classify=None):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free(); me = ob.data
    names = [m.name for m in me.materials]
    for poly in me.polygons:
        if poly.normal.z > 0.9 and "Wall_Cap" in names and classify: poly.material_index = names.index("Wall_Cap")
        elif abs(poly.normal.z) < 0.3 and classify:
            c = poly.center; n = Vector((poly.normal.x, poly.normal.y)).normalized()
            if not in_foot(c.x + n.x * 0.3, c.y + n.y * 0.3): poly.material_index = names.index("Wall_Brick")
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        sx, sy = SZ.get(names[poly.material_index], (1, 1)); n = poly.normal
        t = Vector((-n.y, n.x, 0)); t = t.normalized() if t.length > 1e-6 else Vector((1, 0, 0))
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co.x / sx, co.y / sy) if abs(n.z) > 0.7 else ((co.x * t.x + co.y * t.y) / sx, co.z / sy)
    return ob

def build(name, key, z0, z1, mats, classify=False):
    ob = new_object(name, mats); bm = bmesh.new()
    for r in W[key]: add_prism(bm, [r["outer"]] + r["holes"], z0, z1, 0)
    return finish(ob, bm, classify)
build("Floor_Slab", "footprint", -0.2, 0.0, ["Floor_Interior"])
build("Walls", "walls", 0.0, 2.8, ["Wall_Cut", "Wall_Cap", "Wall_Brick"], classify=True)
build("Columns", "columns", 0.0, 2.8, ["Column", "Wall_Cap", "Wall_Brick"], classify=True)
build("Glass", "glass", 0.0, 2.6, ["Glass"])
build("Ramps_Stairs", "ramps", 0.0, 0.05, ["Ramp_Stairs"])
# glass frames (rails above/below the body-height rays, mullions every ~1.25 m)
def seg_box(bm, a, b, w, z0, z1, mi):
    dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy)
    if L < 1e-3: return
    nx, ny = -dy / L * w / 2, dx / L * w / 2
    add_prism(bm, [[(a[0] + nx, a[1] + ny), (b[0] + nx, b[1] + ny), (b[0] - nx, b[1] - ny), (a[0] - nx, a[1] - ny)]], z0, z1, mi)
top = new_object("Glass_Frames_Top", ["Frame_Dark"]); bt = bmesh.new()
mul = new_object("Glass_Mullions", ["Frame_Dark"]); bmm = bmesh.new()
for a, b in W.get("glass_lines", []):
    L = math.hypot(b[0] - a[0], b[1] - a[1])
    if L < 0.15: continue
    seg_box(bt, a, b, 0.10, 2.50, 2.62, 0)
    n = max(1, round(L / 1.25)); ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
    for k in range(n + 1):
        cx, cy = a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n
        seg_box(bmm, (cx - ux * 0.025, cy - uy * 0.025), (cx + ux * 0.025, cy + uy * 0.025), 0.11, 0.0, 2.62, 0)
finish(top, bt); finish(mul, bmm)
# reference empties: three structural column centres shared with the first floor (set by REFS before exec)
for name, (x, y) in globals().get("REFS", {}).items():
    e = bpy.data.objects.get(P + name) or bpy.data.objects.new(P + name, None)
    if e.name not in coll.objects: coll.objects.link(e)
    e.empty_display_type = "PLAIN_AXES"; e.location = (x, y, 0.0)
print("built", sorted(o.name for o in coll.objects))
print("tris", sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in coll.objects if o.type == "MESH"))

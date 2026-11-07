# Run inside Blender: rebuilds Doors, Door_Swings, Fixtures and Furniture from extras.json.
import bpy, bmesh, json, math, os
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
MODEL_DIR = os.path.dirname(bpy.data.filepath)
X = json.load(open(os.path.join(globals().get("DATA_DIR") or os.path.join(MODEL_DIR, "tools", "data"), "extras.json"), encoding="utf-8"))
col = bpy.data.collections[globals().get("TARGET_COLLECTION") or "UCC_Piso1"]
PFX = globals().get("NAME_PREFIX") or ""

def add_prism(bm, rings, z0, z1, mi):
    rings = [[Vector((p[0], p[1])) for p in r] for r in rings if len(r) >= 3]
    if not rings: return
    vb = [[bm.verts.new((v.x, v.y, z0)) for v in r] for r in rings]
    vt = [[bm.verts.new((v.x, v.y, z1)) for v in r] for r in rings]
    fb = [v for r in vb for v in r]; ft = [v for r in vt for v in r]
    for tri in tessellate_polygon([[v.to_3d() for v in r] for r in rings]):
        try:
            bm.faces.new([ft[i] for i in tri]).material_index = mi
            bm.faces.new([fb[i] for i in reversed(tri)]).material_index = mi
        except ValueError: pass
    for rb, rt in zip(vb, vt):
        n = len(rb)
        for i in range(n):
            try: bm.faces.new([rb[i], rb[(i+1)%n], rt[(i+1)%n], rt[i]]).material_index = mi
            except ValueError: pass

def build(name, items, mats):
    name = PFX + name
    old = bpy.data.objects.get(name)
    if old:
        me_old = old.data; bpy.data.objects.remove(old, do_unlink=True); bpy.data.meshes.remove(me_old)
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    for rings, z0, z1, m in items: add_prism(bm, rings, z0, z1, mats.index(m))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(bpy.data.materials[m])
    ob = bpy.data.objects.new(name, me); col.objects.link(ob)

def seg_rect(a, b, t):
    dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dy); nx, ny = -dy/L*t/2, dx/L*t/2
    return [(a[0]+nx, a[1]+ny), (b[0]+nx, b[1]+ny), (b[0]-nx, b[1]-ny), (a[0]-nx, a[1]-ny)]

build("Doors", [([seg_rect(d["a"], d["b"], d["thick"])], 0.0, d["height"], "Glass" if d["glass"] else "Door_Wood") for d in X["doors"]], ["Door_Wood", "Glass"])
items = []
for a in X["arcs"]:
    o, i_ = [], []
    for k in range(17):
        t = a["a0"] + a["da"] * k / 16
        o.append((a["center"][0] + (a["r"] + 0.012) * math.cos(t), a["center"][1] + (a["r"] + 0.012) * math.sin(t)))
        i_.append((a["center"][0] + (a["r"] - 0.012) * math.cos(t), a["center"][1] + (a["r"] - 0.012) * math.sin(t)))
    items.append(([o + i_[::-1]], 0.002, 0.008, "Swing_Line"))
build("Door_Swings", items, ["Swing_Line"])
build("Fixtures", [([f["poly"]], 0.0, f["height"], f["mat"]) for f in X["fixtures"]], ["Fixture", "Furniture_Metal"])
# Furniture in 20 m cells: the runtime raycasts every mesh, and small bounding boxes keep that cheap.
for o in [o for o in col.objects if o.name == PFX + "Furniture" or o.name.startswith(PFX + "Furniture_")]:
    me_old = o.data; bpy.data.objects.remove(o, do_unlink=True)
    if me_old.users == 0: bpy.data.meshes.remove(me_old)
cells = {}
for f in X["furniture"]:
    cx = sum(p[0] for p in f["poly"]) / len(f["poly"]); cy = sum(p[1] for p in f["poly"]) / len(f["poly"])
    cells.setdefault((int((cx + 10) // 20), int((cy + 8) // 20)), []).append(f)
for (i, j), fs in sorted(cells.items()):
    build(f"Furniture_{i}_{j}", [([f["poly"]], 0.0, f["height"], f["mat"]) for f in fs],
          ["Furniture_Wood", "Furniture_Seat", "Furniture_Lab", "Furniture_Felt", "Furniture_Metal"])

if not globals().get("NO_EXPORT"):
  sc = bpy.context.scene
  sc.render.filepath = os.path.join(MODEL_DIR, "..", "public", "models", "campus-top.png")
  sc.camera = bpy.data.objects["Camera_Top"]
  bpy.ops.render.render(write_still=True)
  bpy.ops.object.select_all(action="DESELECT")
  for cn in ("UCC_Piso1", "References"):
      for ob in bpy.data.collections[cn].objects: ob.select_set(True)
  bpy.ops.export_scene.gltf(filepath=os.path.join(MODEL_DIR, "..", "public", "models", "campus.glb"),
      export_format="GLB", use_selection=True, export_yup=True, export_cameras=False, export_lights=False, export_apply=True)
  bpy.ops.wm.save_mainfile()
  import os
  b = os.path.splitext(bpy.data.filepath)[0] + ".blend1"
  if os.path.exists(b): os.remove(b)
print("doors", len(X["doors"]), "furniture", len(X["furniture"]))

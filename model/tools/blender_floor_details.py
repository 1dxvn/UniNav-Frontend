# Run inside Blender after blender_floor.py: adds the detail of one upper floor (doors, flat swing arcs, fixtures,
# shaped furniture, floor zones) from data/floor<N>/extras.json, then exports public/models/floor-<N>/campus.glb and
# its top capture. Set FLOOR_ID before exec. First-floor objects are never touched.
import bpy, bmesh, json, math, os

FLOOR_ID = globals()["FLOOR_ID"]
BASE = os.path.dirname(os.path.dirname(bpy.data.filepath))          # UniNav-Frontend
TOOLS = os.path.join(BASE, "model", "tools")
ns = {"TARGET_COLLECTION": f"UCC_Piso{FLOOR_ID}", "NAME_PREFIX": f"P{FLOOR_ID}_",
      "DATA_DIR": os.path.join(TOOLS, "data", f"floor{FLOOR_ID}"), "NO_EXPORT": True}
for script in ("blender_extras.py", "blender_interiors_c2.py"):
    g = dict(ns); g["__name__"] = "__detail__"
    exec(open(os.path.join(TOOLS, script), encoding="utf-8").read(), g)

# flat swing arcs
X = json.load(open(os.path.join(ns["DATA_DIR"], "extras.json"), encoding="utf-8"))
name = f"P{FLOOR_ID}_Door_Swings"
old = bpy.data.objects.get(name)
if old:
    me_old = old.data; bpy.data.objects.remove(old, do_unlink=True); bpy.data.meshes.remove(me_old)
me = bpy.data.meshes.new(name); me.materials.append(bpy.data.materials["Swing_Line"])
ob = bpy.data.objects.new(name, me); bpy.data.collections[ns["TARGET_COLLECTION"]].objects.link(ob)
bm = bmesh.new()
for a in X["arcs"]:
    prev = None
    for k in range(9):
        t = a["a0"] + a["da"] * k / 8
        o = bm.verts.new((a["center"][0] + (a["r"] + 0.012) * math.cos(t), a["center"][1] + (a["r"] + 0.012) * math.sin(t), 0.006))
        i = bm.verts.new((a["center"][0] + (a["r"] - 0.012) * math.cos(t), a["center"][1] + (a["r"] - 0.012) * math.sin(t), 0.006))
        if prev: bm.faces.new([prev[1], i, o, prev[0]])
        prev = (o, i)
bm.to_mesh(me); bm.free()

# export the floor scene and its top capture
SCN = bpy.data.scenes[f"Piso{FLOOR_ID}"]; WIN = bpy.context.window; MAIN = bpy.data.scenes["Scene"]
WIN.scene = MAIN
for o in MAIN.objects: o.select_set(False)
WIN.scene = SCN
COLL = bpy.data.collections[ns["TARGET_COLLECTION"]]
for o in SCN.objects: o.select_set(o.name in COLL.objects)
GLB = os.path.join(BASE, "public", "models", f"floor-{FLOOR_ID}", "campus.glb")
bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", use_selection=True, use_active_scene=True, export_yup=True,
                          export_cameras=False, export_lights=False, export_apply=True, export_image_format="AUTO")
SCN.camera = bpy.data.objects[f"Cam_P{FLOOR_ID}_Top"]; SCN.render.resolution_x, SCN.render.resolution_y = 1740, 1520
SCN.render.filepath = os.path.join(BASE, "public", "models", f"floor-{FLOOR_ID}", "campus-top.png")
bpy.ops.render.render(write_still=True)
WIN.scene = MAIN
print(f"floor {FLOOR_ID}: doors {len(X['doors'])}, furniture items {len(X['items'])}, glb {os.path.getsize(GLB)} bytes")

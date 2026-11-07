# Run inside Blender: applies the stair clearance fixes found by Codex's C11 stair probe and re-exports every floor.
# 1. Stairs rebuilt with a sloped soffit under flight 1 (headroom for the stacked flight below).
# 2. Slab wells keep only a 0.3 m strip at the top tread (no slab over the last treads).
# 3. Walls cut where they cross a stair: the small room under the west flight 2 on floor 1 (above 1.0 m) and the
#    stair-hall wall at y ~ 56 in front of every flight on the upper floors and on floor 0.
import bpy, bmesh, json, os
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

BASE = os.path.dirname(os.path.dirname(bpy.data.filepath)); TOOLS = os.path.join(BASE, "model", "tools")
TEXSZ = json.load(open(os.path.join(BASE, "model", "textures", "textures.json"))); TX, TY = TEXSZ["tiles.jpg"]
FLIGHTS = {"Stair_A_West": ((13.6, 15.7), (17.0, 19.1)), "Stair_A_East": ((35.3, 37.4), (37.6, 39.8))}
FLOORS = {  # key: (collection, prefix, stairs present, slab-well source)
    "1": ("UCC_Piso1", "", ["Stair_A_West", "Stair_A_East"], os.path.join(TOOLS, "data", "floor1_slab_wells.json")),
    "0": ("UCC_Piso0", "P0_", ["Stair_A_East"], None),
    "2": ("UCC_Piso2", "P2_", ["Stair_A_West", "Stair_A_East"], os.path.join(TOOLS, "data", "floor2", "wing.json")),
    "3": ("UCC_Piso3", "P3_", ["Stair_A_West", "Stair_A_East"], os.path.join(TOOLS, "data", "floor3", "wing.json")),
    "4": ("UCC_Piso4", "P4_", ["Stair_A_West", "Stair_A_East"], os.path.join(TOOLS, "data", "floor4", "wing.json")),
    "5": ("UCC_Piso5", "P5_", [], os.path.join(TOOLS, "data", "floor5", "wing.json")),
}
def rebuild_slab(ob, rings_json):
    me = ob.data; bm = bmesh.new()
    for r in rings_json:
        rings = [[Vector((p[0], p[1])) for p in ring] for ring in [r["outer"]] + r["holes"] if len(ring) >= 3]
        vb = [[bm.verts.new((v.x, v.y, -0.2)) for v in ring] for ring in rings]; vt = [[bm.verts.new((v.x, v.y, 0.0)) for v in ring] for ring in rings]
        fb = [v for ring in vb for v in ring]; ft = [v for ring in vt for v in ring]
        for tri in tessellate_polygon([[v.to_3d() for v in ring] for ring in rings]):
            try: bm.faces.new([ft[i] for i in tri]); bm.faces.new([fb[i] for i in reversed(tri)])
            except ValueError: pass
        for rb, rt in zip(vb, vt):
            n = len(rb)
            for i in range(n):
                try: bm.faces.new([rb[i], rb[(i + 1) % n], rt[(i + 1) % n], rt[i]])
                except ValueError: pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    uv = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co; uv.data[li].uv = (co.x / TX, co.y / TY)
def cut_walls(ob, boxes):
    """Boolean difference of axis-aligned boxes (x0, x1, y0, y1, z0, z1) from a wall object, applied."""
    if not boxes: return 0
    me = bpy.data.meshes.new("_cutter"); bm = bmesh.new()
    for x0, x1, y0, y1, z0, z1 in boxes:
        v = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
        for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)): bm.faces.new([v[i] for i in f])
    bm.to_mesh(me); bm.free()
    cutter = bpy.data.objects.new("_cutter", me); bpy.context.scene.collection.objects.link(cutter)
    mod = ob.modifiers.new("stair_cut", "BOOLEAN"); mod.operation = "DIFFERENCE"; mod.object = cutter; mod.solver = "EXACT"
    dg = bpy.context.evaluated_depsgraph_get(); ev = ob.evaluated_get(dg)
    new_me = bpy.data.meshes.new_from_object(ev); old = ob.data
    ob.modifiers.remove(mod); ob.data = new_me; new_me.name = old.name
    bpy.data.meshes.remove(old); bpy.data.objects.remove(cutter, do_unlink=True); bpy.data.meshes.remove(me)
    return len(boxes)

report = {}
win = bpy.context.window; MAIN = bpy.data.scenes["Scene"]
for key, (coll_name, pfx, stairs, slab_src) in FLOORS.items():
    scene = MAIN if key == "1" else bpy.data.scenes[f"Piso{key}"]
    win.scene = scene
    if stairs:
        g = {"TARGET_COLLECTION": coll_name, "NAME_PREFIX": pfx, "ONLY_STAIRS": stairs, "RISE": 2.94, "__name__": "__s__"}
        exec(open(os.path.join(TOOLS, "blender_stairs.py"), encoding="utf-8").read(), g)
    if slab_src:
        data = json.load(open(slab_src, encoding="utf-8"))["footprint_with_wells"]
        rebuild_slab(bpy.data.objects[pfx + "Floor_Slab"], data)
    boxes = []
    if key == "1":
        boxes.append((16.95, 19.15, 56.2, 59.25, 1.0, 3.2))                          # small room under the west flight 2
    else:
        names = list(FLIGHTS) if key != "0" else ["Stair_A_East"]
        for s in names:
            for (x0, x1) in FLIGHTS[s]:
                boxes.append((x0 - 0.05, x1 + 0.05, 55.35, 56.65, -0.3, 3.2))      # stair-hall wall in front of each flight
    n = cut_walls(bpy.data.objects[pfx + "Walls"], boxes)
    report[key] = {"stairs": stairs, "slab": bool(slab_src), "wall_cuts": n}
win.scene = MAIN
print(report)

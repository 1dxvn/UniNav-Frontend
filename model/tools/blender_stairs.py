# Run inside Blender: the two U-shaped stairs of Block A in the first-floor model (collection UCC_Piso1).
# Measured on the first-floor sheet: steps 1-10 rise northwards (y 56.2 -> 59.2, 0.30 m treads) on the first flight;
# a semicircular landing to the north (inside the glass tower); steps 11-20 return southwards on the second flight
# (drawn as projection, above the cut). West stair: second flight passes over a small room (LOCAL 5.2 m2).
# The rise is RISE (default 2.94 m, the model-to-model storey offset recommended for floor 2).
import bpy, bmesh, math

RISE = globals().get("RISE", 2.94)
STAIRS = {  # name: (flight 1 x-range, flight 2 x-range, landing centre, landing radius)
    "Stair_A_West": ((13.6, 15.7), (17.0, 19.1), (16.35, 59.2), 2.75),
    "Stair_A_East": ((35.3, 37.4), (37.6, 39.8), (37.55, 59.2), 2.25),
}
Y0, TREAD, YL = 56.2, 0.30, 59.2
col = bpy.data.collections[globals().get("TARGET_COLLECTION") or "UCC_Piso1"]
PFX = globals().get("NAME_PREFIX") or ""
ONLY = globals().get("ONLY_STAIRS")   # e.g. ["Stair_A_East"] where a tower is outside the floor
mat_step = bpy.data.materials.get("Stair_Tread") or bpy.data.materials.new("Stair_Tread")
mat_step.use_nodes = True
b = next(n for n in mat_step.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
b.inputs["Base Color"].default_value = (0.70, 0.69, 0.66, 1); b.inputs["Roughness"].default_value = 0.6
mats = [mat_step, bpy.data.materials["Frame_Dark"]]

def box(bm, x0, x1, y0, y1, z0, z1, mi):
    v = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)): bm.faces.new([v[i] for i in f]).material_index = mi

points = {}
for name, ((a0, a1), (b0, b1), (cx, cy), rl) in STAIRS.items():
    if ONLY and name not in ONLY: continue
    name = PFX + name
    old = bpy.data.objects.get(name)
    if old:
        me_old = old.data; bpy.data.objects.remove(old, do_unlink=True)
        if me_old.users == 0: bpy.data.meshes.remove(me_old)
    me = bpy.data.meshes.new(name)
    for m in mats: me.materials.append(m)
    ob = bpy.data.objects.new(name, me); col.objects.link(ob)
    bm = bmesh.new(); R = RISE / 21.0
    for i in range(10):                                         # flight 1: solid steps from the floor
        box(bm, a0, a1, Y0 + i * TREAD, Y0 + (i + 1) * TREAD, 0.0, (i + 1) * R, 0)
    zl = 11 * R                                                 # landing slab (semicircle + strip)
    segs = 14; ring = [(cx + rl * math.cos(math.pi * k / segs), cy + rl * math.sin(math.pi * k / segs)) for k in range(segs + 1)]
    for zz, flip in ((zl, False), (zl - 0.22, True)):
        c = bm.verts.new((cx, cy, zz)); vs = [bm.verts.new((x, y, zz)) for x, y in ring]
        for k in range(segs):
            f = [c, vs[k], vs[k + 1]] if not flip else [c, vs[k + 1], vs[k]]
            bm.faces.new(f).material_index = 0
    box(bm, min(a0, b0), max(a1, b1), YL - 0.02, YL + 0.01, zl - 0.22, zl, 0)
    for j in range(10):                                         # flight 2: a sloping slab with treads, southwards
        ya, yb = YL - (j + 1) * TREAD, YL - j * TREAD
        top = (12 + j) * R
        box(bm, b0, b1, ya, yb, max(0.0, top - 0.45), top, 0)    # flight 2 floats above the floor (room below on the west)
    box(bm, a1, b0, Y0, YL, 0.0, RISE + 0.9, 1)                  # wall / balustrade between the flights
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    points[name] = {"bottom_floor1": (round((a0 + a1) / 2, 2), round(Y0 - 0.3, 2)), "landing": (cx, round(cy + 0.8, 2)),
                    "top_floor2": (round((b0 + b1) / 2, 2), round(Y0 - 0.3, 2)), "landing_height": round(zl, 3), "rise": RISE}
print(points)

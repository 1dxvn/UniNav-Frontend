# Run inside Blender: builds the faceless "monito" avatar (1.7 m, origin at the feet) in scene "Avatar"
# with a simple armature (rigid parts, one bone each) and two looping clips: Idle (2 s) and Walk (1 s).
# Exported to public/models/avatar/avatar.glb. Forward is -Y in Blender (= +Z in glTF / Three.js).
import bpy, bmesh, math
from mathutils import Matrix, Vector

sc = bpy.data.scenes.get("Avatar") or bpy.data.scenes.new("Avatar")
main = bpy.data.scenes["Scene"]
sc.render.engine = main.render.engine; sc.world = main.world; sc.render.fps = 30
coll = bpy.data.collections.get("Monito")
if coll is None:
    coll = bpy.data.collections.new("Monito"); sc.collection.children.link(coll)
for o in list(coll.objects):
    d = o.data; bpy.data.objects.remove(o, do_unlink=True)
    if d is not None and d.users == 0:
        (bpy.data.meshes if isinstance(d, bpy.types.Mesh) else bpy.data.armatures).remove(d)
for a in [a for a in bpy.data.actions if a.name in ("Idle", "Walk")]: bpy.data.actions.remove(a)

def mat(name, rgb, rough):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    return m
MATS = [mat("Monito_Shirt", (0.05, 0.42, 0.37), 0.7),      # UniNav teal
        mat("Monito_Pants", (0.08, 0.15, 0.15), 0.8),      # dark slate
        mat("Monito_Head", (0.86, 0.80, 0.72), 0.6),       # light, faceless
        mat("Monito_Pack", (0.93, 0.55, 0.20), 0.6)]       # small accent

# --- armature (bone heads/tails in metres, Z up, character faces -Y)
BONES = {  # name: (head, tail, parent)
    "root": ((0, 0, 0), (0, 0.15, 0), None),
    "hips": ((0, 0, 0.92), (0, 0, 1.02), "root"),
    "spine": ((0, 0, 1.02), (0, 0, 1.38), "hips"),
    "head": ((0, 0, 1.40), (0, 0, 1.70), "spine"),
    "upper_arm.L": ((0.21, 0, 1.34), (0.25, 0, 1.08), "spine"), "forearm.L": ((0.25, 0, 1.08), (0.27, -0.02, 0.84), "upper_arm.L"),
    "upper_arm.R": ((-0.21, 0, 1.34), (-0.25, 0, 1.08), "spine"), "forearm.R": ((-0.25, 0, 1.08), (-0.27, -0.02, 0.84), "upper_arm.R"),
    "thigh.L": ((0.10, 0, 0.92), (0.10, 0, 0.50), "hips"), "shin.L": ((0.10, 0, 0.50), (0.10, 0.01, 0.08), "thigh.L"),
    "thigh.R": ((-0.10, 0, 0.92), (-0.10, 0, 0.50), "hips"), "shin.R": ((-0.10, 0, 0.50), (-0.10, 0.01, 0.08), "thigh.R"),
}
arm_data = bpy.data.armatures.new("Monito_Rig"); rig = bpy.data.objects.new("Monito_Rig", arm_data); coll.objects.link(rig)
win = bpy.context.window; prev = win.scene; win.scene = sc
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
for name, (h, t, p) in BONES.items():
    eb = arm_data.edit_bones.new(name); eb.head = h; eb.tail = t
    if p: eb.parent = arm_data.edit_bones[p]
bpy.ops.object.mode_set(mode="OBJECT")

# --- body parts (each fully weighted to one bone)
bm = bmesh.new(); groups = {}
def part(bone, mi, verts_fn):
    """New geometry is appended at the end, so the part is a range of vertex and face indices."""
    v0, f0 = len(bm.verts), len(bm.faces)
    verts_fn()
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    for i in range(f0, len(bm.faces)):
        bm.faces[i].material_index = mi; bm.faces[i].smooth = True
    groups.setdefault(bone, []).extend(range(v0, len(bm.verts)))
def ell(c, r, sub=2):
    return lambda: bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0, matrix=Matrix.Translation(c) @ Matrix.Diagonal((*r, 1)))
def cap(a, b, r, segs=10):
    """Capsule-like limb: cylinder between a and b with spherical-ish ends (cone ops + spheres)."""
    a, b = Vector(a), Vector(b); d = b - a; L = d.length
    rot = d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    def fn():
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r * 0.92, depth=L, matrix=Matrix.Translation((a + b) / 2) @ rot)
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r, matrix=Matrix.Translation(a))
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r * 0.92, matrix=Matrix.Translation(b))
    return fn
part("head", 2, ell((0, 0, 1.56), (0.125, 0.12, 0.14), 3))                    # faceless rounded head
part("head", 2, cap((0, 0, 1.38), (0, 0, 1.45), 0.05))                         # neck
part("spine", 0, ell((0, 0, 1.20), (0.20, 0.13, 0.22), 3))                     # torso
part("spine", 0, ell((0.17, 0, 1.33), (0.07, 0.07, 0.06), 2)); part("spine", 0, ell((-0.17, 0, 1.33), (0.07, 0.07, 0.06), 2))  # shoulders
part("spine", 3, ell((0, 0.17, 1.20), (0.15, 0.07, 0.18), 2))                  # backpack (on the back, +Y)
part("hips", 1, ell((0, 0, 0.95), (0.17, 0.11, 0.09), 2))                      # hips
for s in ("L", "R"):
    sx = 1 if s == "L" else -1
    part(f"upper_arm.{s}", 0, cap((0.21 * sx, 0, 1.31), (0.25 * sx, 0, 1.08), 0.05))
    part(f"forearm.{s}", 2, cap((0.25 * sx, 0, 1.08), (0.27 * sx, -0.02, 0.88), 0.043))
    part(f"forearm.{s}", 2, ell((0.275 * sx, -0.025, 0.83), (0.045, 0.035, 0.055), 2))           # hand
    part(f"thigh.{s}", 1, cap((0.10 * sx, 0, 0.90), (0.10 * sx, 0, 0.50), 0.07))
    part(f"shin.{s}", 1, cap((0.10 * sx, 0, 0.50), (0.10 * sx, 0.01, 0.12), 0.058))
    part(f"shin.{s}", 1, ell((0.10 * sx, -0.045, 0.045), (0.06, 0.12, 0.045), 2))                # foot, toe forward (-Y)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
group_idx = groups   # vertex index ranges per bone; to_mesh keeps vertex order
me = bpy.data.meshes.new("Monito"); bm.to_mesh(me); bm.free()
for m in MATS: me.materials.append(m)
body = bpy.data.objects.new("Monito", me); coll.objects.link(body)
for bone, idx in group_idx.items():
    body.vertex_groups.new(name=bone).add(idx, 1.0, "REPLACE")
body.parent = rig
mod = body.modifiers.new("Armature", "ARMATURE"); mod.object = rig

# --- animation
pb = rig.pose.bones
for b in pb: b.rotation_mode = "XYZ"
def key(frame, poses, hips_z=0.0):
    for b in pb: b.rotation_euler = (0, 0, 0)
    pb["hips"].location = (0, 0, 0)
    for name, rot in poses.items(): pb[name].rotation_euler = tuple(math.radians(a) for a in rot)
    pb["hips"].location = (0, hips_z, 0)          # bone-local Y is the bone axis (up for "hips")
    for b in pb:
        b.keyframe_insert("rotation_euler", frame=frame)
    pb["hips"].keyframe_insert("location", frame=frame)
rig.animation_data_create()
walk = bpy.data.actions.new("Walk"); rig.animation_data.action = walk
for f, ph in ((1, 0), (8, 1), (16, 2), (23, 3), (31, 4)):          # 1 s cycle, 30 fps
    s = [1, 0, -1, 0, 1][ph]                                          # +1: left leg forward
    lift = [0, 1, 0, 1, 0][ph]
    key(f, {"thigh.L": (-28 * s, 0, 0), "thigh.R": (28 * s, 0, 0),
            "shin.L": (32 if s < 0 else 6, 0, 0), "shin.R": (32 if s > 0 else 6, 0, 0),
            "upper_arm.L": (22 * s, 0, 0), "upper_arm.R": (-22 * s, 0, 0),
            "forearm.L": (-14, 0, 0), "forearm.R": (-14, 0, 0),
            "spine": (3, 0, 4 * s), "head": (-2, 0, -3 * s)}, hips_z=0.010 * lift)
idle = bpy.data.actions.new("Idle"); rig.animation_data.action = idle
for f, b in ((1, 0.0), (31, 1.0), (61, 0.0)):                        # 2 s breathing loop
    key(f, {"spine": (-1.5 * b, 0, 0), "head": (2 * b, 0, 1.5 * b), "upper_arm.L": (0, 0, 3 + b), "upper_arm.R": (0, 0, -3 - b),
            "forearm.L": (-6, 0, 0), "forearm.R": (-6, 0, 0)}, hips_z=0.006 * b)
for act in (walk, idle):
    for fc in getattr(act, "fcurves", []):
        for k in fc.keyframe_points: k.interpolation = "BEZIER"
# keep both clips on NLA tracks so the exporter writes both
rig.animation_data.action = None
for act in (idle, walk):
    tr = rig.animation_data.nla_tracks.new(); tr.name = act.name; tr.strips.new(act.name, 1, act)
win.scene = prev
print("verts", len(me.vertices), "groups", [g.name for g in body.vertex_groups], "actions", [a.name for a in bpy.data.actions if a.name in ("Idle", "Walk")])

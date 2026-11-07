# Run inside Blender: builds the C15 real-level candidate of floors 1 and 2 in its own scene "C15", from copies of the
# current floor objects (UCC_Piso1 + References, UCC_Piso2). The originals and their exports are not touched.
#
# Levels (docs/blocks/level-zones.md): Block A (y >= 49.23, x >= 13.6, inside the footprint) is lowered by 0.63 m on
# floor 1 and 0.26 m on floor 2; the hall steps become three treads between four 0.1575 m risers; every pending zone
# keeps its flat height. Vertices are moved by the offset of their own plan position; the lower part of tall objects
# (z <= 1.0) takes the lowest offset within 0.35 m, so walls on a boundary reach down to the lower floor. Flat overlays
# move by their own offset only. The A stairs are rebuilt with the real rises (floor 1 -> 2: 3.31 m; floor 2 -> 3: 3.20 m,
# joined to the flat C14 floor 3). Copies are named "<name>__c15"; the export strips the suffix.
import bpy, bmesh, json, os
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

BASE = os.path.dirname(os.path.dirname(bpy.data.filepath)); TOOLS = os.path.join(BASE, "model", "tools")
S = json.load(open(os.path.join(TOOLS, "data", "c15", "slabs.json"), encoding="utf-8"))
AY, AX = S["a_zone"]["y_min"], S["a_zone"]["x_min"]; SX0, SY0, SX1, SY1 = S["hall_strip"]; NOS = S["nosings"]; RISER = S["riser"]
TEX = json.load(open(os.path.join(BASE, "model", "textures", "textures.json"))); TX, TY = TEX["tiles.jpg"]
SUF = "__c15"

def inside(x, y, ring):
    hit = False
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0): hit = not hit
    return hit
def in_rings(x, y, rings):
    return any(inside(x, y, r["outer"]) and not any(inside(x, y, h) for h in r["holes"]) for r in rings)
FOOT = {"floor1": S["outline1"], "floor2": S["outline2"]}       # full outlines: the stairs stand inside the slab wells
def near_foot(x, y, key):
    return any(in_rings(x + dx, y + dy, FOOT[key]) for dx, dy in ((0, 0), (0.3, 0), (-0.3, 0), (0, 0.3), (0, -0.3)))
_foot_cache = {}
def offset(x, y, floor):
    key = "floor1" if floor == 1 else "floor2"
    in_strip = floor == 1 and SX0 <= x <= SX1 and SY0 <= y <= SY1
    if not in_strip and not (y >= AY and x >= AX): return 0.0      # B and pending zones: no change (cheap test first)
    k = (key, round(x, 2), round(y, 2))
    if k not in _foot_cache: _foot_cache[k] = near_foot(x, y, key)
    if not _foot_cache[k]: return 0.0                               # outside the building (site, trees)
    if in_strip: return -RISER * sum(1 for n in NOS if y >= n)
    return -0.63 if floor == 1 else -0.26
def low_offset(x, y, floor):
    return min(offset(x + dx, y + dy, floor) for dx in (-0.35, 0, 0.35) for dy in (-0.35, 0, 0.35))
def zone_offset(x, y, floor):
    """Offset by zone only, without the footprint test (the site ground under the building)."""
    if floor == 1 and SX0 <= x <= SX1 and SY0 <= y <= SY1: return -RISER * sum(1 for n in NOS if y >= n)
    if y >= AY and x >= AX: return -0.63 if floor == 1 else -0.26
    return 0.0

def split_offset(o, floor, use_foot=True):
    """Flat meshes: cut along the zone boundaries, separate faces of different zones, move each face by the offset of
    its centroid, so that no face is tilted across a boundary."""
    me = o.data; bm = bmesh.new(); bm.from_mesh(me)
    planes = [((0, AY, 0), (0, 1, 0)), ((AX, 0, 0), (1, 0, 0))]
    if floor == 1: planes += [((SX0, 0, 0), (1, 0, 0)), ((SX1, 0, 0), (1, 0, 0))] + [((0, n, 0), (0, 1, 0)) for n in NOS[:-1]]
    for co, no in planes:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no, dist=1e-5)
    f_off = lambda f: (offset if use_foot else zone_offset)(f.calc_center_median().x, f.calc_center_median().y, floor)
    offs = {f: f_off(f) for f in bm.faces}
    cut = [e for e in bm.edges if len({round(offs[f], 4) for f in e.link_faces}) > 1]
    if cut: bmesh.ops.split_edges(bm, edges=cut)
    target = {}
    for f in bm.faces:
        dz = f_off(f)
        for v in f.verts: target[v] = min(target.get(v, 0.0), dz) if v in target else dz
    moved = 0
    for v, dz in target.items():
        if dz: v.co.z += dz; moved += 1
    bm.to_mesh(me); bm.free(); me.update()
    return moved

def build_slab(ob, pieces):
    me = ob.data; bm = bmesh.new()
    for p in pieces:
        top = p["top"]
        for r in p["rings"]:
            rings = [[Vector((q[0], q[1])) for q in ring] for ring in [r["outer"]] + r["holes"] if len(ring) >= 3]
            vb = [[bm.verts.new((v.x, v.y, top - 0.2)) for v in ring] for ring in rings]
            vt = [[bm.verts.new((v.x, v.y, top)) for v in ring] for ring in rings]
            fb = [v for ring in vb for v in ring]; ft = [v for ring in vt for v in ring]
            for tri in tessellate_polygon([[v.to_3d() for v in ring] for ring in rings]):
                try: bm.faces.new([ft[i] for i in tri]); bm.faces.new([fb[i] for i in reversed(tri)])
                except ValueError: pass
            for rb, rt in zip(vb, vt):
                n = len(rb)
                for i in range(n):
                    try: bm.faces.new([rb[i], rb[(i + 1) % n], rt[(i + 1) % n], rt[i]])
                    except ValueError: pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    uv = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co; uv.data[li].uv = (co.x / TX, co.y / TY)

# --- scene and collections (rebuilt from scratch on each run)
scn = bpy.data.scenes.get("C15") or bpy.data.scenes.new("C15")
for cn in ("C15_Piso1", "C15_Piso2"):
    old = bpy.data.collections.get(cn)
    if old:
        for o in list(old.objects):
            d = o.data; bpy.data.objects.remove(o, do_unlink=True)
            if d is not None and d.users == 0 and isinstance(d, bpy.types.Mesh): bpy.data.meshes.remove(d)
        bpy.data.collections.remove(old)
cols = {}
for cn in ("C15_Piso1", "C15_Piso2"):
    c = bpy.data.collections.new(cn); scn.collection.children.link(c); cols[cn] = c

def copy_into(src_names, dst):
    out = []
    for cn in src_names:
        for o in bpy.data.collections[cn].all_objects:
            n = o.copy()
            if o.data is not None: n.data = o.data.copy(); n.data.name = o.data.name + SUF
            n.name = o.name + SUF
            for c in list(n.users_collection): c.objects.unlink(n)
            dst.objects.link(n); out.append(n)
    return out
obs1 = copy_into(["UCC_Piso1", "References"], cols["C15_Piso1"])
obs2 = copy_into(["UCC_Piso2"], cols["C15_Piso2"])

# --- A stairs with the real rises: rebuilt by blender_stairs.py into the candidate collections
win = bpy.context.window; prev = win.scene; win.scene = scn
for floor, col, pfx, rise, obs in ((1, "C15_Piso1", "", 3.31, obs1), (2, "C15_Piso2", "P2_", 3.20, obs2)):
    for s in ("Stair_A_West", "Stair_A_East"):
        o = bpy.data.objects.get(pfx + s + SUF)
        if o: d = o.data; obs.remove(o); bpy.data.objects.remove(o, do_unlink=True); bpy.data.meshes.remove(d)
    g = {"TARGET_COLLECTION": col, "NAME_PREFIX": "C15TMP_" + pfx, "ONLY_STAIRS": ["Stair_A_West", "Stair_A_East"], "RISE": rise, "__name__": "__s__"}
    exec(open(os.path.join(TOOLS, "blender_stairs.py"), encoding="utf-8").read(), g)
    for s in ("Stair_A_West", "Stair_A_East"):
        o = bpy.data.objects["C15TMP_" + pfx + s]; o.name = pfx + s + SUF; o.data.name = pfx + s + SUF; obs.append(o)

# --- vertical offsets
report = {}
for floor, obs in ((1, obs1), (2, obs2)):
    moved = 0
    for o in obs:
        if o.type == "EMPTY":
            if o.name.startswith("DEST_"): o.location.z = offset(o.location.x, o.location.y, floor)
            continue
        if o.type != "MESH" or o.name.split(SUF)[0].endswith("Floor_Slab"): continue
        me = o.data; zs = [v.co.z for v in me.vertices]
        if not zs: continue
        base = o.name.split(SUF)[0]
        if max(zs) - min(zs) < 0.25:                    # overlays, swing arcs, frames, hatches, site ground
            moved += split_offset(o, floor, use_foot=(base != "Site")); continue
        for v in me.vertices:
            x, y, z = v.co
            dz = offset(x, y, floor) if z > 1.0 else low_offset(x, y, floor)
            if dz: v.co.z = z + dz; moved += 1
        me.update()
    report[floor] = moved
build_slab(bpy.data.objects["Floor_Slab" + SUF], S["floor1"])
build_slab(bpy.data.objects["P2_Floor_Slab" + SUF], S["floor2"])
win.scene = prev
print("C15 built:", {k: len(v) for k, v in (("floor1", obs1), ("floor2", obs2))}, "vertices moved", report)

# --- export to model/candidates/c15/ (node and mesh names without the "__c15" suffix)
if globals().get("EXPORT", True):
    import struct
    OUT = os.path.join(BASE, "model", "candidates", "c15"); os.makedirs(OUT, exist_ok=True)
    def strip_names(path):
        b = open(path, "rb").read(); n = struct.unpack_from("<I", b, 12)[0]; j = json.loads(b[20:20 + n])
        for k in ("nodes", "meshes"):
            for e in j.get(k, []):
                if "name" in e: e["name"] = e["name"].replace(SUF, "")
        t = json.dumps(j, separators=(",", ":")).encode(); t += b" " * ((4 - len(t) % 4) % 4)
        rest = b[20 + n:]
        open(path, "wb").write(struct.pack("<III", 0x46546C67, 2, 20 + len(t) + len(rest)) + struct.pack("<II", len(t), 0x4E4F534A) + t + rest)
    win.scene = scn
    sizes = {}
    for cn, fname in (("C15_Piso1", "floor-1.glb"), ("C15_Piso2", "floor-2.glb")):
        for o in scn.objects: o.select_set(False)
        for o in bpy.data.collections[cn].objects: o.select_set(True)
        path = os.path.join(OUT, fname)
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, use_active_scene=True, export_yup=True,
                                  export_cameras=False, export_lights=False, export_apply=True, export_image_format="AUTO")
        strip_names(path); sizes[fname] = os.path.getsize(path)
    win.scene = prev
    print("C15 exported:", sizes)

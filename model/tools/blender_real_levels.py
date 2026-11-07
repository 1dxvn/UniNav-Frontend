# Run inside Blender: builds the real-level candidate set described in model/tools/real_levels.json (C16: floors 1-5) in
# its own scene, from copies of the floor objects, and exports model/candidates/<candidate>/floor-<N>.glb. The C13/C14
# objects and exports are not touched. Same method as blender_c15_levels.py:
# - each vertex moves by the offset of its own plan position (Block A, hall treads); the lower part of tall objects
#   (z <= 1.0) takes the lowest offset within 0.35 m, so walls on a boundary reach the lower floor;
# - flat meshes are cut along the zone boundaries and each face moves with its own zone;
# - the slab is rebuilt from data/<candidate>/slabs.json, each piece 0.2 m thick at its own level;
# - each A stair moves as one piece, by the offset at its centre;
# - the A stairs are rebuilt with stair_rise (from this floor's Block A to the next floor's Block A).
# Copies are named "<name>__<candidate>"; the export strips the suffix. Pending zones keep their flat height.
import bpy, bmesh, json, os, struct
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

BASE = os.path.dirname(os.path.dirname(bpy.data.filepath)); TOOLS = os.path.join(BASE, "model", "tools")
CFG = json.load(open(os.path.join(TOOLS, "real_levels.json"), encoding="utf-8")); CAND = CFG["candidate"]
SL = json.load(open(os.path.join(TOOLS, "data", CAND, "slabs.json"), encoding="utf-8"))["floors"]
TEX = json.load(open(os.path.join(BASE, "model", "textures", "textures.json"))); TX, TY = TEX["tiles.jpg"]
SUF = "__" + CAND
FLOORS = globals().get("FLOORS") or list(CFG["floors"])

def inside(x, y, ring):
    hit = False
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0): hit = not hit
    return hit
def in_outline(x, y, fid):
    return any(inside(x, y, r["outer"]) for r in SL[fid]["outline"])
_cache = {}
def near_outline(x, y, fid):
    k = (fid, round(x, 2), round(y, 2))
    if k not in _cache: _cache[k] = any(in_outline(x + dx, y + dy, fid) for dx, dy in ((0, 0), (0.3, 0), (-0.3, 0), (0, 0.3), (0, -0.3)))
    return _cache[k]
def zone_offset(x, y, fid):
    f = CFG["floors"][fid]; h = f["hall"]
    if h and h["x"][0] <= x <= h["x"][1] and h["nosings"][0] <= y <= h["nosings"][-1]:
        return f["a_offset"] * sum(1 for n in h["nosings"] if y >= n) / len(h["nosings"])
    if y >= f["a_y"] and x >= f["a_x"]: return f["a_offset"]
    return 0.0
def offset(x, y, fid):
    dz = zone_offset(x, y, fid)
    return dz if dz and near_outline(x, y, fid) else 0.0
def low_offset(x, y, fid):
    return min(offset(x + dx, y + dy, fid) for dx in (-0.35, 0, 0.35) for dy in (-0.35, 0, 0.35))

def split_offset(o, fid, use_outline=True):
    f = CFG["floors"][fid]; me = o.data; bm = bmesh.new(); bm.from_mesh(me)
    planes = [((0, f["a_y"], 0), (0, 1, 0)), ((f["a_x"], 0, 0), (1, 0, 0))]
    if f["hall"]:
        planes += [((f["hall"]["x"][0], 0, 0), (1, 0, 0)), ((f["hall"]["x"][1], 0, 0), (1, 0, 0))] + [((0, n, 0), (0, 1, 0)) for n in f["hall"]["nosings"]]
    for co, no in planes:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no, dist=1e-5)
    fo = lambda fc: (offset if use_outline else zone_offset)(fc.calc_center_median().x, fc.calc_center_median().y, fid)
    offs = {fc: fo(fc) for fc in bm.faces}
    cut = [e for e in bm.edges if len({round(offs[fc], 4) for fc in e.link_faces}) > 1]
    if cut: bmesh.ops.split_edges(bm, edges=cut)
    target = {}
    for fc in bm.faces:
        dz = fo(fc)
        for v in fc.verts: target[v] = min(target[v], dz) if v in target else dz
    moved = 0
    for v, dz in target.items():
        if dz: v.co.z += dz; moved += 1
    bm.to_mesh(me); bm.free(); me.update()
    return moved

def build_slab(ob, pieces):
    me = ob.data; bm = bmesh.new()
    for p in pieces:
        top = p["top"]; bottom = top - 0.2                   # a 0.2 m slab at its own level (a block down to the datum would invade the floor below)
        for r in p["rings"]:
            rr = [[Vector((q[0], q[1])) for q in ring] for ring in [r["outer"]] + r["holes"] if len(ring) >= 3]
            vb = [[bm.verts.new((v.x, v.y, bottom)) for v in ring] for ring in rr]
            vt = [[bm.verts.new((v.x, v.y, top)) for v in ring] for ring in rr]
            fb = [v for ring in vb for v in ring]; ft = [v for ring in vt for v in ring]
            for tri in tessellate_polygon([[v.to_3d() for v in ring] for ring in rr]):
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

# --- scene and collections, rebuilt from scratch
scn = bpy.data.scenes.get(CAND.upper()) or bpy.data.scenes.new(CAND.upper())
win = bpy.context.window; prev = win.scene
cols, obs = {}, {}
for fid in FLOORS:
    cn = f"{CAND.upper()}_Piso{fid}"
    old = bpy.data.collections.get(cn)
    if old:
        for o in list(old.objects):
            d = o.data; bpy.data.objects.remove(o, do_unlink=True)
            if d is not None and d.users == 0 and isinstance(d, bpy.types.Mesh): bpy.data.meshes.remove(d)
        bpy.data.collections.remove(old)
    c = bpy.data.collections.new(cn); scn.collection.children.link(c); cols[fid] = c
    f = CFG["floors"][fid]; obs[fid] = []
    for src in [f["collection"]] + f["extra_collections"]:
        for o in bpy.data.collections[src].all_objects:
            n = o.copy()
            if o.data is not None: n.data = o.data.copy(); n.data.name = o.data.name + SUF
            n.name = o.name + SUF
            for uc in list(n.users_collection): uc.objects.unlink(n)
            c.objects.link(n); obs[fid].append(n)

win.scene = scn
report = {}
for fid in FLOORS:
    f = CFG["floors"][fid]; pfx = f["prefix"]
    if f["stair_rise"]:
        have = [s for s in ("Stair_A_West", "Stair_A_East") if bpy.data.objects.get(pfx + s + SUF)]
        for s in have:
            o = bpy.data.objects[pfx + s + SUF]; d = o.data; obs[fid].remove(o); bpy.data.objects.remove(o, do_unlink=True); bpy.data.meshes.remove(d)
        if have:
            g = {"TARGET_COLLECTION": cols[fid].name, "NAME_PREFIX": "TMPRL_" + pfx, "ONLY_STAIRS": have, "RISE": f["stair_rise"], "__name__": "__s__"}
            exec(open(os.path.join(TOOLS, "blender_stairs.py"), encoding="utf-8").read(), g)
            for s in have:
                o = bpy.data.objects["TMPRL_" + pfx + s]; o.name = pfx + s + SUF; o.data.name = pfx + s + SUF; obs[fid].append(o)
    moved = 0
    for o in obs[fid]:
        if o.type == "EMPTY":
            if o.name.startswith("DEST_"): o.location.z = offset(o.location.x, o.location.y, fid)
            continue
        base = o.name.split(SUF)[0]
        if o.type != "MESH" or base.endswith("Floor_Slab"): continue
        me = o.data; zs = [v.co.z for v in me.vertices]
        if not zs: continue
        if max(zs) - min(zs) < 0.25:
            moved += split_offset(o, fid, use_outline=(base != "Site")); continue
        if "Stair_A" in base:                                  # a stair moves as one piece, by the offset at its centre
            xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]
            dz = offset((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, fid)
            for v in me.vertices: v.co.z += dz
            moved += len(me.vertices) if dz else 0; me.update(); continue
        for v in me.vertices:
            x, y, z = v.co
            dz = offset(x, y, fid) if z > 1.0 else low_offset(x, y, fid)
            if dz: v.co.z = z + dz; moved += 1
        me.update()
    build_slab(bpy.data.objects[f["prefix"] + "Floor_Slab" + SUF], SL[fid]["pieces"])
    report[fid] = moved

# --- export
OUT = os.path.join(BASE, "model", "candidates", CAND); os.makedirs(OUT, exist_ok=True)
def strip_names(path):
    b = open(path, "rb").read(); n = struct.unpack_from("<I", b, 12)[0]; j = json.loads(b[20:20 + n])
    for k in ("nodes", "meshes"):
        for e in j.get(k, []):
            if "name" in e: e["name"] = e["name"].replace(SUF, "")
    t = json.dumps(j, separators=(",", ":")).encode(); t += b" " * ((4 - len(t) % 4) % 4)
    rest = b[20 + n:]
    open(path, "wb").write(struct.pack("<III", 0x46546C67, 2, 20 + len(t) + len(rest)) + struct.pack("<II", len(t), 0x4E4F534A) + t + rest)
sizes = {}
if globals().get("EXPORT", True):
    for fid in FLOORS:
        for o in scn.objects: o.select_set(False)
        for o in cols[fid].objects: o.select_set(True)
        path = os.path.join(OUT, f"floor-{fid}.glb")
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, use_active_scene=True, export_yup=True,
                                  export_cameras=False, export_lights=False, export_apply=True, export_image_format="AUTO")
        strip_names(path); sizes[fid] = os.path.getsize(path)
win.scene = prev
print(f"{CAND} built: vertices moved {report}; exported {sizes}")

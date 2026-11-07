# Run inside Blender: exterior massing of Blocks A and B (floors 2-5, roofs, rooftop courts) in collection "Exterior".
# Data: tools/data/exterior.json (exterior_extract.py). Levels from docs/blocks/dwg-inventory.md.
# Exported separately to public/models/blocks/campus-exterior.glb; never part of campus.glb.
import bpy, bmesh, json, math, os
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

MODEL_DIR = os.path.dirname(bpy.data.filepath)
DATA = globals().get("DATA_DIR") or os.path.join(MODEL_DIR, "tools", "data")
TEX = os.path.join(MODEL_DIR, "textures")
E = json.load(open(os.path.join(DATA, "exterior.json"), encoding="utf-8"))
TEXSZ = json.load(open(os.path.join(TEX, "textures.json"), encoding="utf-8"))
LEVELS = {  # N levels (m) from the DWG, local z = N (first-floor B slab = 0)
    "A": {"SEGUNDO PISO": 2.68, "TERCER PISO": 6.37, "CUARTO PISO": 9.87, "QUINTO PISO": 13.37, "ROOF": 16.87, "ROOFTOP": 20.38},
    "B": {"SEGUNDO PISO": 2.94, "TERCER PISO": 5.88, "CUARTO PISO": 8.82, "QUINTO PISO": 11.76, "ROOF": 14.70},
}
ORDER = ["SEGUNDO PISO", "TERCER PISO", "CUARTO PISO", "QUINTO PISO"]

sc = bpy.context.scene
coll = bpy.data.collections.get("Exterior")
if coll is None:
    coll = bpy.data.collections.new("Exterior"); sc.collection.children.link(coll)
for o in list(coll.objects):
    me = o.data; bpy.data.objects.remove(o, do_unlink=True)
    if me and me.users == 0: bpy.data.meshes.remove(me)

def bsdf(m): return next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
def flat_mat(name, rgb, rough=0.7, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True; b = bsdf(m)
    for l in list(b.inputs["Base Color"].links): m.node_tree.links.remove(l)
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    return m
M = {"Wall_Brick": bpy.data.materials["Wall_Brick"], "Frame_Dark": bpy.data.materials["Frame_Dark"],
     "Glass_Facade": flat_mat("Glass_Facade", (0.10, 0.15, 0.20), 0.06, 0.4),
     "Concrete_Band": flat_mat("Concrete_Band", (0.72, 0.70, 0.66), 0.85),
     "Roof_Concrete": flat_mat("Roof_Concrete", (0.60, 0.60, 0.58), 0.9),
     "Turf": flat_mat("Turf", (0.16, 0.48, 0.24), 0.95),
     "Metal_Dark": bpy.data.materials["Metal_Dark"]}
BRICK_SZ = TEXSZ["brick.jpg"]

def new_object(name, mats):
    me = bpy.data.meshes.new(name)
    for m in mats: me.materials.append(M[m])
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob); return ob
def finish(ob, bm):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free()
    me = ob.data; uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        n = poly.normal; t = Vector((-n.y, n.x, 0)); t = t.normalized() if t.length > 1e-6 else Vector((1, 0, 0))
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = ((co.x / BRICK_SZ[0], co.y / BRICK_SZ[1]) if abs(n.z) > 0.7 else ((co.x * t.x + co.y * t.y) / BRICK_SZ[0], co.z / BRICK_SZ[1]))
def box_on_edge(bm, a, b, t0, t1, off0, off1, z0, z1, mi):
    """Box along edge a->b between parameters t0..t1, between offsets off0..off1 (+ = outward), heights z0..z1."""
    dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; nx, ny = uy, -ux
    p0 = (a[0] + dx * t0, a[1] + dy * t0); p1 = (a[0] + dx * t1, a[1] + dy * t1)
    ring = [(p0[0] + nx * off0, p0[1] + ny * off0), (p1[0] + nx * off0, p1[1] + ny * off0), (p1[0] + nx * off1, p1[1] + ny * off1), (p0[0] + nx * off1, p0[1] + ny * off1)]
    vb = [bm.verts.new((x, y, z0)) for x, y in ring]; vt = [bm.verts.new((x, y, z1)) for x, y in ring]
    bm.faces.new(list(reversed(vb))).material_index = mi; bm.faces.new(vt).material_index = mi
    for i in range(4): bm.faces.new([vb[i], vb[(i + 1) % 4], vt[(i + 1) % 4], vt[i]]).material_index = mi
def ccw(r):
    s = sum(r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1] for i in range(len(r)))
    return r if s > 0 else list(reversed(r))
def glass_intervals(a, b, glass):
    dx, dy = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dy * dy; L = math.sqrt(L2); out = []
    for g0, g1 in glass:
        gx, gy = g1[0] - g0[0], g1[1] - g0[1]; gl = math.hypot(gx, gy)
        if gl < 0.05 or abs(dx * gy - dy * gx) / (L * gl) > 0.18: continue          # not parallel
        t0 = ((g0[0] - a[0]) * dx + (g0[1] - a[1]) * dy) / L2; t1 = ((g1[0] - a[0]) * dx + (g1[1] - a[1]) * dy) / L2
        mid = ((g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2); tm = (t0 + t1) / 2
        dist = abs((mid[0] - a[0]) * dy - (mid[1] - a[1]) * dx) / L
        if dist > 0.7 or tm < -0.02 or tm > 1.02: continue
        out.append((max(0.0, min(t0, t1)), min(1.0, max(t0, t1))))
    out.sort(); merged = []
    for s in out:
        if merged and s[0] <= merged[-1][1] + 0.4 / L: merged[-1] = (merged[-1][0], max(merged[-1][1], s[1]))
        else: merged.append(s)
    return [s for s in merged if (s[1] - s[0]) * L > 0.5]
def storey(bm, ring, glass, z0, z1, sill=0.9, head=0.45):
    ring = ccw(ring)
    for i in range(len(ring)):
        a, b = ring[i], ring[(i + 1) % len(ring)]; L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L < 0.05: continue
        box_on_edge(bm, a, b, 0, 1, 0.02, -0.30, z0 - 0.25, z0, 1)        # slab edge band (concrete)
        cuts = glass_intervals(a, b, glass); t = 0.0
        for g0, g1 in cuts + [(1.0, 1.0)]:
            if g0 > t: box_on_edge(bm, a, b, t, g0, 0.0, -0.30, z0, z1, 0)     # solid brick
            if g1 > g0:
                box_on_edge(bm, a, b, g0, g1, 0.0, -0.30, z0, z0 + sill, 0)   # spandrel
                box_on_edge(bm, a, b, g0, g1, 0.0, -0.30, z1 - head, z1, 0)   # lintel
                box_on_edge(bm, a, b, g0, g1, -0.10, -0.16, z0 + sill, z1 - head, 2)   # glass, recessed 10 cm
                n = max(1, round((g1 - g0) * L / 1.3))
                for k in range(n + 1):
                    tm = g0 + (g1 - g0) * k / n; w = 0.03 / L
                    box_on_edge(bm, a, b, max(g0, tm - w), min(g1, tm + w), -0.06, -0.18, z0 + sill, z1 - head, 3)
            t = max(t, g1)

def roof(bm, ring, z, parapet=0.9):
    ring = ccw(ring); vs = [bm.verts.new((x, y, z)) for x, y in ring]
    for tri in tessellate_polygon([[v.co for v in vs]]):
        try: bm.faces.new([vs[i] for i in tri]).material_index = 4
        except ValueError: pass
    for i in range(len(ring)):
        a, b = ring[i], ring[(i + 1) % len(ring)]
        if math.hypot(b[0] - a[0], b[1] - a[1]) < 0.05: continue
        box_on_edge(bm, a, b, 0, 1, 0.0, -0.25, z, z + parapet, 0)
        box_on_edge(bm, a, b, 0, 1, 0.03, -0.28, z + parapet, z + parapet + 0.06, 1)   # coping

MATS = ["Wall_Brick", "Concrete_Band", "Glass_Facade", "Frame_Dark", "Roof_Concrete", "Turf", "Metal_Dark"]
log = []
for blk in ("A", "B"):
    for i, fl in enumerate(ORDER):
        z0 = LEVELS[blk][fl]; z1 = LEVELS[blk][ORDER[i + 1]] if i + 1 < len(ORDER) else LEVELS[blk]["ROOF"]
        ob = new_object(f"Ext_{blk}_P{i + 2}", MATS); bm = bmesh.new()
        for r in E[fl][blk]: storey(bm, r, E[fl]["glass"], z0, z1)
        finish(ob, bm); log.append((ob.name, z0, z1, len(ob.data.polygons)))
    # Roofs and terraces: the part of each storey not covered by the storey above, at that storey's top.
    ob = new_object(f"Ext_{blk}_Roof", MATS); bm = bmesh.new()
    for i, fl in enumerate(ORDER):
        ztop = LEVELS[blk][ORDER[i + 1]] if i + 1 < len(ORDER) else LEVELS[blk]["ROOF"]
        for r in E[fl].get(f"roof_{blk}", []): roof(bm, r, ztop)
    finish(ob, bm); log.append((ob.name, LEVELS[blk]["ROOF"], len(ob.data.polygons)))
# Block A rooftop: glazed pavilion over the courts sheet outline, synthetic turf on the remaining A roof
ob = new_object("Ext_A_Rooftop", MATS); bm = bmesh.new()
for r in E["AZOTEA CANCHAS SINTETICAS"]["A"]:
    storey(bm, r, E["AZOTEA CANCHAS SINTETICAS"]["glass"], LEVELS["A"]["ROOF"] + 0.25, LEVELS["A"]["ROOFTOP"])
    roof(bm, r, LEVELS["A"]["ROOFTOP"], parapet=0.4)
finish(ob, bm)
ob = new_object("Ext_A_Courts", MATS); bm = bmesh.new()
zc = LEVELS["A"]["ROOF"] + 0.03
for r in E["QUINTO PISO"]["A"]:
    xs = [p[0] for p in r]; ys = [p[1] for p in r]
    # two courts on the open roof east and west of the rooftop pavilion (approximate, documented)
    for cx0, cx1 in ((max(min(xs) + 2, -5), 10.5), (44.5, min(max(xs) - 2, 69.0))):
        y0, y1 = min(ys) + 2.0, max(ys) - 2.5
        if cx1 - cx0 < 8: continue
        vs = [bm.verts.new((x, y, zc)) for x, y in ((cx0, y0), (cx1, y0), (cx1, y1), (cx0, y1))]
        bm.faces.new(vs).material_index = 5
        for x, y in ((cx0, y0), (cx1, y0), (cx1, y1), (cx0, y1)):
            vb = [bm.verts.new((x + dx, y + dy, zc)) for dx, dy in ((-0.05, -0.05), (0.05, -0.05), (0.05, 0.05), (-0.05, 0.05))]
            vt = [bm.verts.new((v.co.x, v.co.y, zc + 6.0)) for v in vb]
            for k in range(4): bm.faces.new([vb[k], vb[(k + 1) % 4], vt[(k + 1) % 4], vt[k]]).material_index = 6
finish(ob, bm)
# Round glass stair towers of Block A (DWG arcs r 1.41 m centred at (16.42, 59.2) and (37.93, 59.2); glazing r ≈ 3.1 m,
# half cylinder on the north face, as in the photos). Radius of the glazing is an approximation.
M["Glass_Tower"] = flat_mat("Glass_Tower", (0.30, 0.45, 0.58), 0.05, 0.5)
MATS_T = ["Glass_Tower", "Frame_Dark", "Roof_Concrete"]
ob = bpy.data.meshes.new("Ext_A_Stair_Towers"); obj = bpy.data.objects.new("Ext_A_Stair_Towers", ob); coll.objects.link(obj)
for m in MATS_T: ob.materials.append(M[m])
bm = bmesh.new()
z0, z1 = LEVELS["A"]["SEGUNDO PISO"] - 0.25, LEVELS["A"]["ROOF"] + 1.5
SEG = 12
for cx, cy, R in ((16.35, 59.2, 2.85), (37.55, 59.2, 2.4)):
    angs = [math.pi * k / SEG for k in range(SEG + 1)]
    ring = [(cx + R * math.cos(a), cy + R * math.sin(a)) for a in angs]
    outer = [(cx + (R + 0.08) * math.cos(a), cy + (R + 0.08) * math.sin(a)) for a in angs]
    for k in range(SEG):                       # glass panels
        q = [bm.verts.new((*ring[k], z0)), bm.verts.new((*ring[k + 1], z0)), bm.verts.new((*ring[k + 1], z1)), bm.verts.new((*ring[k], z1))]
        bm.faces.new(q).material_index = 0
    for k in range(SEG + 1):                   # vertical mullions
        a = angs[k]; p = (cx + (R + 0.04) * math.cos(a), cy + (R + 0.04) * math.sin(a)); tx, ty = -math.sin(a), math.cos(a)
        vb = [bm.verts.new((p[0] + tx * u + math.cos(a) * v, p[1] + ty * u + math.sin(a) * v, z0)) for u, v in ((-0.03, -0.05), (0.03, -0.05), (0.03, 0.05), (-0.03, 0.05))]
        vt = [bm.verts.new((v.co.x, v.co.y, z1)) for v in vb]
        for i in range(4): bm.faces.new([vb[i], vb[(i + 1) % 4], vt[(i + 1) % 4], vt[i]]).material_index = 1
    for zl in [LEVELS["A"][f] for f in ORDER] + [LEVELS["A"]["ROOF"], z1]:   # floor rings
        for k in range(SEG):
            a0, a1 = ring[k], ring[k + 1]; b0, b1 = outer[k], outer[k + 1]
            vs = [bm.verts.new((*a0, zl - 0.12)), bm.verts.new((*a1, zl - 0.12)), bm.verts.new((*b1, zl - 0.12)), bm.verts.new((*b0, zl - 0.12)),
                  bm.verts.new((*a0, zl)), bm.verts.new((*a1, zl)), bm.verts.new((*b1, zl)), bm.verts.new((*b0, zl))]
            for f in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
                bm.faces.new([vs[i] for i in f]).material_index = 1
    cap = [bm.verts.new((cx, cy, z1))] + [bm.verts.new((*p, z1)) for p in outer]
    for k in range(SEG): bm.faces.new([cap[0], cap[k + 1], cap[k + 2]]).material_index = 2
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(ob); bm.free()
log.append(("Ext_A_Stair_Towers", len(ob.polygons)))

for row in log: print(row)
print("exterior tris", sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in coll.objects))

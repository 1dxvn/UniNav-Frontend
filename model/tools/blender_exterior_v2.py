# Run inside Blender: polished campus exterior (Plan 4, candidate C19) in collection "Exterior_C19", from
# tools/data/exterior_v2.json (exterior_v2_prep.py). The C5 collection "Exterior" and its export are not touched.
# Exports model/candidates/c19/campus-exterior.glb (overview only; not navigable, no collisions).
# Built here:
#  - storeys 2-5 of A and B: brick shells with the floor's windows, a ceiling cap on every storey, terraces with parapets,
#    a plinth band down to 2.05 m that closes the slit above the cut first floor, large windows on the west block;
#  - roofs over every single-storey part of the first floor (dark membrane, fascia and parapet);
#  - the access pavilion: glass box, translucent gable roof on steel trusses, white UCC sign panel;
#  - the two stair towers: full glass "D" volumes from the first floor to above the roof, floor bands, concrete caps;
#  - the rooftop from its sheet: music room (glass north wall, sign, solar panels), machine room, open covered
#    circulations on posts, both courts with markings, 6 m perimeter nets with gates towards the circulations.
import bpy, bmesh, json, math, os
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

BASE = os.path.dirname(os.path.dirname(bpy.data.filepath)); TOOLS = os.path.join(BASE, "model", "tools")
V = json.load(open(os.path.join(TOOLS, "data", "exterior_v2.json"), encoding="utf-8"))
TEX = json.load(open(os.path.join(BASE, "model", "textures", "textures.json"), encoding="utf-8")); BRICK_SZ = TEX["brick.jpg"]
LEVELS = {"A": {"SEGUNDO PISO": 2.68, "TERCER PISO": 6.37, "CUARTO PISO": 9.87, "QUINTO PISO": 13.37, "ROOF": 16.87},
          "B": {"SEGUNDO PISO": 2.94, "TERCER PISO": 5.88, "CUARTO PISO": 8.82, "QUINTO PISO": 11.76, "ROOF": 14.70}}
ORDER = ["SEGUNDO PISO", "TERCER PISO", "CUARTO PISO", "QUINTO PISO"]
PLINTH = 2.05
NAME = "Exterior_C19"

scn = bpy.data.scenes["Scene"]
coll = bpy.data.collections.get(NAME)
if coll is None: coll = bpy.data.collections.new(NAME); scn.collection.children.link(coll)
for o in list(coll.objects):
    me = o.data; bpy.data.objects.remove(o, do_unlink=True)
    if me is not None and me.users == 0: bpy.data.meshes.remove(me)

# --- materials -----------------------------------------------------------------------------------------------------------
def bsdf(m): return next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
def flat(name, rgb, rough=0.7, metal=0.0, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes = True; b = bsdf(m)
    for l in list(b.inputs["Base Color"].links): m.node_tree.links.remove(l)
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    b.inputs["Alpha"].default_value = alpha
    m.diffuse_color = (*rgb, alpha)                       # viewport/Workbench colour matches the exported base colour
    if alpha < 1:
        for attr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
            try: setattr(m, attr, val)
            except (AttributeError, TypeError): pass
    return m
def net_material():
    img = bpy.data.images.get("Net_Texture")
    if img is None:
        n = 128; img = bpy.data.images.new("Net_Texture", n, n, alpha=True); px = [0.0] * (n * n * 4)
        for y in range(n):
            for x in range(n):
                on = (x % 16 in (0, 1)) or (y % 16 in (0, 1))
                i = (y * n + x) * 4; px[i:i + 4] = (0.86, 0.88, 0.86, 1.0 if on else 0.0)
        img.pixels = px
        path = os.path.join(BASE, "model", "textures", "net.png"); img.filepath_raw = path; img.file_format = "PNG"; img.save()
    m = bpy.data.materials.get("Net") or bpy.data.materials.new("Net"); m.use_nodes = True; nt = m.node_tree; b = bsdf(m)
    tex = next((n for n in nt.nodes if n.type == "TEX_IMAGE"), None) or nt.nodes.new("ShaderNodeTexImage"); tex.image = img
    nt.links.new(tex.outputs["Color"], b.inputs["Base Color"]); nt.links.new(tex.outputs["Alpha"], b.inputs["Alpha"])
    b.inputs["Roughness"].default_value = 0.8; m.diffuse_color = (0.86, 0.88, 0.86, 0.35)
    for attr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
        try: setattr(m, attr, val)
        except (AttributeError, TypeError): pass
    return m
M = {"brick": bpy.data.materials["Wall_Brick"], "frame": bpy.data.materials["Frame_Dark"], "metal_dark": bpy.data.materials["Metal_Dark"],
     "metal_light": bpy.data.materials["Metal_Light"], "solar": bpy.data.materials["Solar_Panel"],
     "glass": flat("Glass_Facade", (0.10, 0.15, 0.20), 0.06, 0.4), "band": flat("Concrete_Band", (0.72, 0.70, 0.66), 0.85),
     "roof": flat("Roof_Concrete", (0.60, 0.60, 0.58), 0.9), "roof_dark": flat("Roof_Dark", (0.20, 0.21, 0.22), 0.85),
     "turf": flat("Turf", (0.16, 0.48, 0.24), 0.95), "line": flat("Court_Line", (0.95, 0.95, 0.93), 0.6),
     "tower_glass": flat("Glass_Tower", (0.30, 0.45, 0.58), 0.05, 0.5), "translucent": flat("Roof_Translucent", (0.86, 0.89, 0.91), 0.25, 0.0, 0.55),
     "sign": flat("Sign_Panel", (0.02, 0.24, 0.31), 0.5), "sign_text": flat("Sign_Text", (0.97, 0.97, 0.95), 0.4),
     "white": flat("Sign_White", (0.95, 0.95, 0.94), 0.5), "teal": flat("Sign_Teal", (0.10, 0.62, 0.62), 0.5), "net": net_material()}
KEYS = list(M)
def new_object(name):
    me = bpy.data.meshes.new(name)
    for k in KEYS: me.materials.append(M[k])
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob); return ob, bmesh.new()
def mi(key): return KEYS.index(key)
def finish(ob, bm):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free(); me = ob.data
    used = sorted({p.material_index for p in me.polygons})
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        n = poly.normal; t = Vector((-n.y, n.x, 0)); t = t.normalized() if t.length > 1e-6 else Vector((1, 0, 0))
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = ((co.x / BRICK_SZ[0], co.y / BRICK_SZ[1]) if abs(n.z) > 0.7 else ((co.x * t.x + co.y * t.y) / BRICK_SZ[0], co.z / BRICK_SZ[1]))
    return used

# --- geometry helpers ------------------------------------------------------------------------------------------------------
def quad(bm, ps, m):
    try: bm.faces.new([bm.verts.new(p) for p in ps]).material_index = m
    except ValueError: pass
def prism(bm, ring, z0, z1, m):
    vb = [bm.verts.new((x, y, z0)) for x, y in ring]; vt = [bm.verts.new((x, y, z1)) for x, y in ring]
    for f in (list(reversed(vb)), vt):
        try: bm.faces.new(f).material_index = m
        except ValueError: pass
    for i in range(len(ring)):
        try: bm.faces.new([vb[i], vb[(i + 1) % len(ring)], vt[(i + 1) % len(ring)], vt[i]]).material_index = m
        except ValueError: pass
def box3(bm, x0, y0, z0, x1, y1, z1, m): prism(bm, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, m)
def box_on_edge(bm, a, b, t0, t1, off0, off1, z0, z1, m):
    dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; nx, ny = uy, -ux
    p0 = (a[0] + dx * t0, a[1] + dy * t0); p1 = (a[0] + dx * t1, a[1] + dy * t1)
    prism(bm, [(p0[0] + nx * off0, p0[1] + ny * off0), (p1[0] + nx * off0, p1[1] + ny * off0), (p1[0] + nx * off1, p1[1] + ny * off1), (p0[0] + nx * off1, p0[1] + ny * off1)], z0, z1, m)
def ccw(r):
    s = sum(r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1] for i in range(len(r)))
    return r if s > 0 else list(reversed(r))
def area(r): return abs(sum(r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1] for i in range(len(r)))) / 2
def slab(bm, ring, holes, z0, z1, m):
    """Flat slab; robust for concave outlines: tessellation, else an n-gon face (outer only)."""
    outer = ccw(ring); hs = [list(reversed(ccw(h))) for h in holes]
    loops = [outer] + hs
    for z, top in ((z1, True), (z0, False)):
        pts = [Vector((x, y, z)) for lp in loops for x, y in lp]; vs = [bm.verts.new(p) for p in pts]
        tris = tessellate_polygon([[Vector((x, y, z)) for x, y in lp] for lp in loops])
        got = sum(abs((pts[c] - pts[a]).cross(pts[b] - pts[a]).z) / 2 for a, b, c in tris)
        if got >= 0.97 * (area(outer) - sum(area(h) for h in hs)):
            for a, b, c in tris:
                try: bm.faces.new([vs[a], vs[b], vs[c]] if top else [vs[c], vs[b], vs[a]]).material_index = m
                except ValueError: pass
        else:
            ov = vs[:len(outer)]
            try: bm.faces.new(ov if top else list(reversed(ov))).material_index = m
            except ValueError: pass
    for lp in loops:
        for i in range(len(lp)):
            a, b = lp[i], lp[(i + 1) % len(lp)]
            quad(bm, [(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)], m)
def glass_intervals(a, b, glass):
    dx, dy = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dy * dy; L = math.sqrt(L2); out = []
    for g0, g1 in glass:
        gx, gy = g1[0] - g0[0], g1[1] - g0[1]; gl = math.hypot(gx, gy)
        if gl < 0.05 or abs(dx * gy - dy * gx) / (L * gl) > 0.18: continue
        t0 = ((g0[0] - a[0]) * dx + (g0[1] - a[1]) * dy) / L2; t1 = ((g1[0] - a[0]) * dx + (g1[1] - a[1]) * dy) / L2
        mid = ((g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2); tm = (t0 + t1) / 2
        if abs((mid[0] - a[0]) * dy - (mid[1] - a[1]) * dx) / L > 0.7 or tm < -0.02 or tm > 1.02: continue
        out.append((max(0.0, min(t0, t1)), min(1.0, max(t0, t1))))
    out.sort(); merged = []
    for s in out:
        if merged and s[0] <= merged[-1][1] + 0.4 / L: merged[-1] = (merged[-1][0], max(merged[-1][1], s[1]))
        else: merged.append(s)
    return [s for s in merged if (s[1] - s[0]) * L > 0.5]
def in_box(p, bx): return bx[0] <= p[0] <= bx[2] and bx[1] <= p[1] <= bx[3]
def wall_ring(bm, ring, glass, z0, z1, band_bottom, big_box=None, sill=0.9, head=0.45):
    ring = ccw(ring)
    for i in range(len(ring)):
        a, b = ring[i], ring[(i + 1) % len(ring)]; L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L < 0.05: continue
        if band_bottom < z0 - 0.25: box_on_edge(bm, a, b, 0, 1, 0.0, -0.30, band_bottom, z0 - 0.25, mi("brick"))   # plinth
        box_on_edge(bm, a, b, 0, 1, 0.02, -0.30, z0 - 0.25, z0, mi("band"))
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); s, h = sill, head
        if big_box and in_box(mid, big_box) and L > 2.0:
            cuts = [(min(0.6 / L, 0.3), max(1 - 0.6 / L, 0.7))]; s, h = 0.35, 0.3          # large windows (west block)
        else: cuts = glass_intervals(a, b, glass)
        t = 0.0
        for g0, g1 in cuts + [(1.0, 1.0)]:
            if g0 > t: box_on_edge(bm, a, b, t, g0, 0.0, -0.30, z0, z1, mi("brick"))
            if g1 > g0:
                box_on_edge(bm, a, b, g0, g1, 0.0, -0.30, z0, z0 + s, mi("brick"))
                box_on_edge(bm, a, b, g0, g1, 0.0, -0.30, z1 - h, z1, mi("brick"))
                box_on_edge(bm, a, b, g0, g1, -0.10, -0.16, z0 + s, z1 - h, mi("glass"))
                n = max(1, round((g1 - g0) * L / 1.3))
                for k in range(n + 1):
                    tm = g0 + (g1 - g0) * k / n; w = 0.03 / L
                    box_on_edge(bm, a, b, max(g0, tm - w), min(g1, tm + w), -0.06, -0.18, z0 + s, z1 - h, mi("frame"))
            t = max(t, g1)
def parapet_ring(bm, ring, z, height=0.9, m="brick"):
    ring = ccw(ring)
    for i in range(len(ring)):
        a, b = ring[i], ring[(i + 1) % len(ring)]
        if math.hypot(b[0] - a[0], b[1] - a[1]) < 0.05: continue
        box_on_edge(bm, a, b, 0, 1, 0.0, -0.25, z, z + height, mi(m))
        box_on_edge(bm, a, b, 0, 1, 0.03, -0.28, z + height, z + height + 0.06, mi("band"))

log = []
# --- storeys, caps and terraces ------------------------------------------------------------------------------------------------
WB = V["west_block"]
for blk in ("A", "B"):
    ob, bm = new_object(f"C19_{blk}_Storeys")
    caps_ob, cbm = new_object(f"C19_{blk}_Roofs")
    for i, fl in enumerate(ORDER):
        S = V["storeys"][fl]; z0 = LEVELS[blk][fl]; z1 = LEVELS[blk][ORDER[i + 1]] if i + 1 < len(ORDER) else LEVELS[blk]["ROOF"]
        for r in S[blk]:
            for lp in [r["outer"]] + r["holes"]:
                wall_ring(bm, lp, S["glass"], z0, z1, PLINTH if i == 0 else z0 - 0.25, WB)
            slab(cbm, r["outer"], r["holes"], z1 - 0.2, z1, mi("roof"))                         # ceiling cap
        for r in S[f"terrace_{blk}"]:
            parapet_ring(cbm, r["outer"], z1)
    log.append((ob.name, len(finish(ob, bm)))); log.append((caps_ob.name, len(finish(caps_ob, cbm))))

# --- single-storey roofs of the first floor -------------------------------------------------------------------------------------
ob, bm = new_object("C19_Floor1_Roofs")
for part in V["floor1_roofs"]:
    for r in part["rings"]:
        z = part["level"]
        slab(bm, r["outer"], r["holes"], z - 0.22, z, mi("roof_dark"))
        if part.get("kind") == "pergola": continue                                           # light roof on the existing frame
        ring = ccw(r["outer"])
        for i in range(len(ring)):
            a, b = ring[i], ring[(i + 1) % len(ring)]
            if math.hypot(b[0] - a[0], b[1] - a[1]) < 0.05: continue
            box_on_edge(bm, a, b, 0, 1, 0.0, -0.25, PLINTH, z, mi("brick"))                  # fascia over the cut walls
        parapet_ring(bm, r["outer"], z, 0.6)
log.append((ob.name, len(finish(ob, bm))))

# --- access pavilion ---------------------------------------------------------------------------------------------------------
P = V["pavilion"]; x0, y0, x1, y1 = P["box"]; ze, zr = P["eave"], P["ridge"]; xr = (x0 + x1) / 2
ob, bm = new_object("C19_Access_Pavilion")
for (a, b) in (((x0, y0), (x0, y1)), ((x0, y1), (x1, y1)), ((x1, y0), (x0, y0))):            # west, north, south faces (east adjoins)
    L = math.hypot(b[0] - a[0], b[1] - a[1]); n = max(2, round(L / 1.5))
    box_on_edge(bm, a, b, 0, 1, -0.02, -0.06, 0.05, ze, mi("glass"))
    for k in range(n + 1):
        t = k / n; w = 0.05 / L
        box_on_edge(bm, a, b, max(0, t - w), min(1, t + w), 0.02, -0.10, 0.0, ze, mi("metal_light"))
    box_on_edge(bm, a, b, 0, 1, 0.02, -0.10, 2.55, 2.65, mi("metal_light"))                  # transom
    box_on_edge(bm, a, b, 0, 1, 0.04, -0.14, ze - 0.18, ze, mi("metal_light"))              # eave beam
for (ya, yb) in ((y0, y0 - 0.0), ):
    pass
for side in (-1, 1):                                                                             # translucent gable roof
    xe = x0 if side < 0 else x1
    quad(bm, [(xe - side * -0.35, y0 - 0.35, ze - 0.12), (xe - side * -0.35, y1 + 0.35, ze - 0.12), (xr, y1 + 0.35, zr), (xr, y0 - 0.35, zr)], mi("translucent"))
for yy in (y0, y1):                                                                              # glazed gable ends
    quad(bm, [(x0, yy, ze), (x1, yy, ze), (xr, yy, zr)][:3] + [(xr, yy, zr)], mi("translucent"))
nT = max(3, round((y1 - y0) / 3.0))
for k in range(nT + 1):                                                                          # steel trusses
    y = y0 + (y1 - y0) * k / nT
    for (xa, za, xb, zb) in ((x0, ze, xr, zr), (x1, ze, xr, zr), (x0, ze, x1, ze), (xr, ze, xr, zr), ((x0 + xr) / 2, ze, xr, zr), ((x1 + xr) / 2, ze, xr, zr)):
        dx, dz = xb - xa, zb - za; L = math.hypot(dx, dz); nx, nz = -dz / L * 0.05, dx / L * 0.05
        quad(bm, [(xa - nx, y - 0.05, za - nz), (xb - nx, y - 0.05, zb - nz), (xb + nx, y - 0.05, zb + nz), (xa + nx, y - 0.05, za + nz)], mi("metal_light"))
        quad(bm, [(xa + nx, y + 0.05, za + nz), (xb + nx, y + 0.05, zb + nz), (xb - nx, y + 0.05, zb - nz), (xa - nx, y + 0.05, za - nz)], mi("metal_light"))
box3(bm, xr - 0.08, y0 - 0.35, zr - 0.16, xr + 0.08, y1 + 0.35, zr + 0.02, mi("metal_light"))      # ridge beam
box3(bm, x0 - 0.30, y0 + 0.6, 1.25, x0 - 0.05, y0 + 4.8, 3.25, mi("white"))                       # sign panel (street side)
box3(bm, x0 - 0.33, y0 + 1.1, 2.45, x0 - 0.30, y0 + 2.3, 3.0, mi("teal"))                         # simple teal mark (not the logo artwork)
log.append((ob.name, len(finish(ob, bm))))

# --- stair towers ----------------------------------------------------------------------------------------------------------------
FY = V["facade_y"]; Z0T, Z1T = 2.1, 20.65
ob, bm = new_object("C19_Stair_Towers")
bands = [LEVELS["A"][f] for f in ORDER] + [LEVELS["A"]["ROOF"], 17.12]
for t in V["towers"]:
    (cx, cy), R = t["c"], t["r"]; seg = 20
    path = [(cx - R, FY), (cx - R, cy)] + [(cx + R * math.cos(math.pi - math.pi * k / seg), cy + R * math.sin(math.pi - math.pi * k / seg)) for k in range(1, seg)] + [(cx + R, cy), (cx + R, FY)]
    for a, b in zip(path, path[1:]):
        quad(bm, [(a[0], a[1], Z0T), (b[0], b[1], Z0T), (b[0], b[1], Z1T), (a[0], a[1], Z1T)], mi("tower_glass"))
        L = math.hypot(b[0] - a[0], b[1] - a[1]); nx, ny = (b[1] - a[1]) / L, -(b[0] - a[0]) / L
        for zb in bands:                                                                          # floor bands
            prism(bm, [(a[0], a[1]), (b[0], b[1]), (b[0] + nx * 0.12, b[1] + ny * 0.12), (a[0] + nx * 0.12, a[1] + ny * 0.12)], zb - 0.22, zb + 0.02, mi("white"))
    for p in path:                                                                                 # mullions
        box3(bm, p[0] - 0.035, p[1] - 0.035, Z0T, p[0] + 0.035, p[1] + 0.035, Z1T, mi("frame"))
    capring = [(cx - R - 0.15, FY - 0.1), (cx - R - 0.15, cy)] + [(cx + (R + 0.15) * math.cos(math.pi - math.pi * k / seg), cy + (R + 0.15) * math.sin(math.pi - math.pi * k / seg)) for k in range(1, seg)] + [(cx + R + 0.15, cy), (cx + R + 0.15, FY - 0.1)]
    slab(bm, capring, [], Z1T, Z1T + 0.32, mi("band"))
log.append((ob.name, len(finish(ob, bm))))

# --- rooftop ---------------------------------------------------------------------------------------------------------------------
RT = V["rooftop"]; zf, zt = RT["floor"], RT["top"]
ob, bm = new_object("C19_Rooftop")
for room in RT["rooms"]:
    bx = room["box"]; ring = [(bx[0], bx[1]), (bx[2], bx[1]), (bx[2], bx[3]), (bx[0], bx[3])]
    glass = [[[bx[0] + 0.3, bx[3]], [bx[2] - 0.3, bx[3]]]] if room["glass_north"] else []
    wall_ring(bm, ring, glass, zf, zt, zf - 0.25, None, sill=0.15, head=0.35)
    slab(bm, ring, [], zt - 0.2, zt, mi("roof")); parapet_ring(bm, ring, zt, 0.4)
for c in RT["canopies"]:                                                                          # open covered circulations
    bx = c["box"]; slab(bm, [(bx[0], bx[1]), (bx[2], bx[1]), (bx[2], bx[3]), (bx[0], bx[3])], [], zt - 0.45, zt - 0.25, mi("band"))
    for xa, xb, ya, yb in ((bx[0], bx[2], bx[1], bx[1]), (bx[0], bx[2], bx[3], bx[3]), (bx[0], bx[0], bx[1], bx[3]), (bx[2], bx[2], bx[1], bx[3])):
        L = math.hypot(xb - xa, yb - ya); n = max(1, round(L / 4.0))
        for k in range(n + 1):
            x = xa + (xb - xa) * k / n; y = ya + (yb - ya) * k / n
            box3(bm, x - 0.1, y - 0.1, zf, x + 0.1, y + 0.1, zt - 0.45, mi("metal_dark"))
s = RT["sign"]; box3(bm, s["x"][0], s["y"], s["z"][0], s["x"][1], s["y"] + 0.2, s["z"][1], mi("sign"))
sp = RT["solar"]; bx = sp["box"]; tilt = math.radians(sp["tilt_deg"])
pw, pd = (bx[2] - bx[0]) / sp["cols"], (bx[3] - bx[1]) / sp["rows"]
for i in range(sp["cols"]):
    for j in range(sp["rows"]):
        xa, xb = bx[0] + i * pw + 0.08, bx[0] + (i + 1) * pw - 0.08; ya, yb = bx[1] + j * pd + 0.15, bx[1] + (j + 1) * pd - 0.15
        za, zb = zt + 0.45, zt + 0.45 + (yb - ya) * math.tan(tilt)                                 # rises southwards, faces north (photo)
        quad(bm, [(xa, yb, za), (xb, yb, za), (xb, ya, zb), (xa, ya, zb)], mi("solar"))
        for x in (xa + 0.1, xb - 0.1): box3(bm, x - 0.03, ya, zt, x + 0.03, ya + 0.06, zb, mi("metal_dark"))
log.append((ob.name, len(finish(ob, bm))))

ob, bm = new_object("C19_Courts")
zc = LEVELS["A"]["ROOF"] + 0.04
def strip(a, b, w=0.08, z=zc + 0.012):
    L = math.hypot(b[0] - a[0], b[1] - a[1]); nx, ny = -(b[1] - a[1]) / L * w / 2, (b[0] - a[0]) / L * w / 2
    quad(bm, [(a[0] - nx, a[1] - ny, z), (b[0] - nx, b[1] - ny, z), (b[0] + nx, b[1] + ny, z), (a[0] + nx, a[1] + ny, z)], mi("line"))
for c in RT["courts"]:
    x0c, y0c, x1c, y1c = c["box"]; ym = (y0c + y1c) / 2; xm = (x0c + x1c) / 2; dep, wid = c["area"]
    quad(bm, [(x0c - 1.0, y0c - 1.0, zc), (x1c + 1.0, y0c - 1.0, zc), (x1c + 1.0, y1c + 1.0, zc), (x0c - 1.0, y1c + 1.0, zc)], mi("turf"))
    for a, b in (((x0c, y0c), (x1c, y0c)), ((x1c, y0c), (x1c, y1c)), ((x1c, y1c), (x0c, y1c)), ((x0c, y1c), (x0c, y0c)), ((xm, y0c), (xm, y1c))): strip(a, b)
    circ = [(xm + 1.75 * math.cos(2 * math.pi * k / 32), ym + 1.75 * math.sin(2 * math.pi * k / 32)) for k in range(33)]
    for a, b in zip(circ, circ[1:]): strip(a, b)
    for xe, sgn in ((x0c, 1), (x1c, -1)):                                                        # goal areas
        pts = [(xe, ym - wid / 2), (xe + sgn * dep, ym - wid / 2), (xe + sgn * dep, ym + wid / 2), (xe, ym + wid / 2)]
        for a, b in zip(pts, pts[1:]): strip(a, b)
for f in RT["fences"]:
    zx0, zy0, zx1, zy1 = f["zone"]; g = f["gate"]; H = 6.0
    gx = zx1 if g["side"] == "east" else zx0
    sides = [((zx0, zy0), (zx1, zy0)), ((zx1, zy1), (zx0, zy1))]
    for xs in (zx0, zx1):
        if abs(xs - gx) < 1e-6: sides += [((xs, zy0), (xs, g["y"][0])), ((xs, g["y"][1]), (xs, zy1))]
        else: sides.append(((xs, zy0), (xs, zy1)))
    for a, b in sides:
        L = math.hypot(b[0] - a[0], b[1] - a[1]); n = max(1, round(L / 3.5))
        quad(bm, [(a[0], a[1], zc), (b[0], b[1], zc), (b[0], b[1], zc + H), (a[0], a[1], zc + H)], mi("net"))
        quad(bm, [(b[0], b[1], zc), (a[0], a[1], zc), (a[0], a[1], zc + H), (b[0], b[1], zc + H)], mi("net"))
        for k in range(n + 1):
            x = a[0] + (b[0] - a[0]) * k / n; y = a[1] + (b[1] - a[1]) * k / n
            box3(bm, x - 0.05, y - 0.05, zc, x + 0.05, y + 0.05, zc + H + 0.1, mi("metal_dark"))
        box_on_edge(bm, a, b, 0, 1, 0.04, -0.04, zc + H - 0.04, zc + H + 0.04, mi("metal_dark"))
log.append((ob.name, len(finish(ob, bm))))

# net UVs: 1 texture tile per metre
for o in coll.objects:
    me = o.data; uv = me.uv_layers.active; ni = KEYS.index("net")
    for poly in me.polygons:
        if poly.material_index != ni: continue
        vs = [me.vertices[me.loops[li].vertex_index].co for li in poly.loop_indices]; o0 = vs[0]
        d = (vs[1] - vs[0]); d.z = 0; d = d.normalized() if d.length > 1e-6 else Vector((1, 0, 0))
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co; uv.data[li].uv = (((co - o0).x * d.x + (co - o0).y * d.y) / 1.0, co.z / 1.0)

# sign text (white letters on the music room panel, readable from the north)
bpy.ops.object.select_all(action="DESELECT") if bpy.context.mode == "OBJECT" else None
cu = bpy.data.curves.new("C19_SignText", "FONT"); cu.body = s["text"]; cu.size = 0.42; cu.align_x = "CENTER"; cu.align_y = "CENTER"; cu.extrude = 0.01
txt = bpy.data.objects.new("C19_SignText_tmp", cu); coll.objects.link(txt)
txt.rotation_euler = (math.radians(90), 0, math.radians(180)); txt.location = ((s["x"][0] + s["x"][1]) / 2, s["y"] + 0.215, (s["z"][0] + s["z"][1]) / 2)
dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(txt.evaluated_get(dg))
me.name = "C19_Sign_Text"; mat_ob = bpy.data.objects.new("C19_Sign_Text", me); coll.objects.link(mat_ob)
mat_ob.matrix_world = txt.matrix_world.copy(); me.materials.clear(); me.materials.append(M["sign_text"])
bpy.data.objects.remove(txt, do_unlink=True); bpy.data.curves.remove(cu)

# --- export ---------------------------------------------------------------------------------------------------------------------
OUT = os.path.join(BASE, "model", "candidates", "c19"); os.makedirs(OUT, exist_ok=True)
path = os.path.join(OUT, "campus-exterior.glb")
if globals().get("EXPORT", True):
    win = bpy.context.window; prev = win.scene; win.scene = scn
    for o in scn.objects: o.select_set(False)
    for o in coll.objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, use_active_scene=True, export_yup=True,
                              export_cameras=False, export_lights=False, export_apply=True, export_image_format="AUTO")
    for o in coll.objects: o.select_set(False)
    win.scene = prev
for row in log: print(row)
print("C19 exterior tris", sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in coll.objects), "exported", os.path.getsize(path) if os.path.exists(path) else None)

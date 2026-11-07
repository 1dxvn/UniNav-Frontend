# Run inside Blender: removes from P<N>_Walls the free-standing islands that wing.json now lists as room-tag bars
# (walls_from_lines.py, "long tag bars"). A full rebuild with blender_floor.py gives the same walls, but it would also
# undo the stair cuts of blender_stair_fixes.py; this keeps every other wall face as it is.
import bpy, bmesh, json, os

BASE = os.path.dirname(os.path.dirname(bpy.data.filepath)); TOOLS = os.path.join(BASE, "model", "tools")
FLOORS = globals().get("FLOORS") or ["0", "2", "3", "4", "5"]

def inside(x, y, ring):
    hit = False
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0): hit = not hit
    return hit

report = {}
for key in FLOORS:
    W = json.load(open(os.path.join(TOOLS, "data", f"floor{key}", "wing.json"), encoding="utf-8"))
    tags = W.get("blocks_034x138", []); walls = [p["outer"] for p in W["walls"]]
    ob = bpy.data.objects[f"P{key}_Walls"]; bm = bmesh.new(); bm.from_mesh(ob.data); bm.faces.ensure_lookup_table()
    seen, drop = set(), []
    for f0 in bm.faces:
        if f0.index in seen: continue
        stack, isl = [f0], []
        seen.add(f0.index)
        while stack:
            f = stack.pop(); isl.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g.index not in seen: seen.add(g.index); stack.append(g)
        vs = {v for f in isl for v in f.verts}
        xs = [v.co.x for v in vs]; ys = [v.co.y for v in vs]
        if max(max(xs) - min(xs), max(ys) - min(ys)) > 3.2: continue
        cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
        if any(inside(cx, cy, t) for t in tags) and not any(inside(cx, cy, w) for w in walls):
            drop.append((isl, vs))
    for isl, vs in drop:
        bmesh.ops.delete(bm, geom=list(vs), context="VERTS")
    bm.to_mesh(ob.data); ob.data.update(); bm.free()
    report[key] = len(drop)
print("tag-bar islands removed per floor:", report)

# Run inside Blender: renders the six fixed overview views of Plan 4 (campus overview = exterior + first floor) so
# every polishing phase has comparable before/after captures. Temporarily shows the chosen collections, renders
# orthographic Workbench views from a temporary camera and restores all visibility and render settings.
# Globals: OUT_DIR (folder), TAG (file prefix, e.g. "before"), COLLECTIONS (default ["Exterior", "UCC_Piso1"]).
import bpy, os
from mathutils import Vector

OUT = globals()["OUT_DIR"]; TAG = globals().get("TAG", "view")
COLLS = globals().get("COLLECTIONS") or ["Exterior", "UCC_Piso1"]
CENTER = Vector((31.0, 33.0, 6.0))
VIEWS = {"sw": (-0.60, -0.70, 0.45), "se": (0.75, -0.55, 0.35), "south": (0.0, -1.0, 0.32),
         "north": (-0.12, 1.0, 0.35), "ne": (0.70, 0.70, 0.45), "top": (0.0, -0.001, 1.0)}
os.makedirs(OUT, exist_ok=True)
scn = bpy.data.scenes["Scene"]; win = bpy.context.window; prev = win.scene
r = scn.render; old = (r.engine, r.resolution_x, r.resolution_y, r.filepath, scn.camera, r.film_transparent)
saved_layers, saved_objs, written, cam, cam_data = [], [], [], None, None
try:
    win.scene = scn
    for lc in scn.view_layers[0].layer_collection.children:
        saved_layers.append((lc, lc.exclude, lc.hide_viewport, lc.collection.hide_render))
        keep = lc.collection.name in COLLS
        lc.exclude = not keep
        if keep: lc.hide_viewport = False; lc.collection.hide_render = False
    for name in COLLS:
        for o in [o for o in bpy.data.collections[name].all_objects if o is not None]:
            saved_objs.append((o, o.hide_render, o.hide_viewport)); o.hide_render = False; o.hide_viewport = False
    cam_data = bpy.data.cameras.new("TMP_views"); cam_data.type = "ORTHO"; cam_data.clip_end = 1000
    cam = bpy.data.objects.new("TMP_views", cam_data); scn.collection.objects.link(cam); scn.camera = cam
    try: r.engine = "BLENDER_WORKBENCH"
    except TypeError as e: print(e)
    sh = scn.display.shading; sh.light = "STUDIO"; sh.color_type = "TEXTURE"; sh.show_cavity = True; sh.show_shadows = True
    r.resolution_x, r.resolution_y = 1600, 1000; r.film_transparent = False
    for name, d in VIEWS.items():
        direction = Vector(d).normalized(); cam.location = CENTER + direction * 150
        cam.rotation_euler = (CENTER - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam_data.ortho_scale = 100 if name == "top" else 92
        r.filepath = os.path.join(OUT, f"{TAG}-{name}.png"); bpy.ops.render.render(write_still=True, scene=scn.name); written.append(r.filepath)
finally:
    r.engine, r.resolution_x, r.resolution_y, r.filepath, scn.camera, r.film_transparent = old
    if cam: bpy.data.objects.remove(cam, do_unlink=True)
    if cam_data: bpy.data.cameras.remove(cam_data)
    for o, hr, hv in saved_objs: o.hide_render = hr; o.hide_viewport = hv
    for lc, ex, hv, hr in saved_layers: lc.exclude = ex; lc.hide_viewport = hv; lc.collection.hide_render = hr
    win.scene = prev
print("rendered", written)

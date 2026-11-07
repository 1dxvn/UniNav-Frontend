# Run inside Blender: renders the review cameras to OUT_DIR, restoring scene settings.
# Floor captures hide the "Exterior" collection so they stay comparable; set INCLUDE_EXTERIOR = True to show it.
# EXTERIOR_SHOTS = True renders the exterior cameras (Cam_Exterior, Cam_Exterior_North) instead.
import bpy, os
OUT_DIR = globals().get("OUT_DIR")
sc = bpy.context.scene
saved = (sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.filepath, sc.render.resolution_percentage)
ext = bpy.data.collections.get("Exterior")
ext_hidden = ext.hide_render if ext else None
os.makedirs(OUT_DIR, exist_ok=True)
if globals().get("EXTERIOR_SHOTS"):
    shots = [("Cam_Exterior", "exterior-southwest"), ("Cam_Exterior_North", "exterior-north")]
    if ext: ext.hide_render = False
else:
    shots = [("Cam_General", "general"), ("Cam_Entrance", "entrance"), ("Cam_Interior", "interior"), ("Cam_Patio", "patio"), ("Cam_Interior2", "interior-2")]
    if ext: ext.hide_render = not globals().get("INCLUDE_EXTERIOR", False)
shots = [s for s in shots if s[0] in bpy.data.objects]
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1600, 1000, 100
for cam, name in shots:
    sc.camera = bpy.data.objects[cam]
    sc.render.filepath = os.path.join(OUT_DIR, f"blender-{name}.png")
    bpy.ops.render.render(write_still=True)
sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.filepath, sc.render.resolution_percentage = saved
if ext: ext.hide_render = ext_hidden
print("rendered", [s[1] for s in shots], "to", OUT_DIR)

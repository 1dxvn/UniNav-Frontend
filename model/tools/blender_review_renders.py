# Run inside Blender: renders the four review cameras (and the top camera) to OUT_DIR, restoring scene settings.
import bpy, os
OUT_DIR = globals().get("OUT_DIR")
sc = bpy.context.scene
saved = (sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.filepath, sc.render.resolution_percentage)
os.makedirs(OUT_DIR, exist_ok=True)
shots = [("Cam_General", "general"), ("Cam_Entrance", "entrance"), ("Cam_Interior", "interior"), ("Cam_Patio", "patio"), ("Cam_Interior2", "interior-2")]
shots = [s for s in shots if s[0] in bpy.data.objects]
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1600, 1000, 100
for cam, name in shots:
    sc.camera = bpy.data.objects[cam]
    sc.render.filepath = os.path.join(OUT_DIR, f"blender-{name}.png")
    bpy.ops.render.render(write_still=True)
sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.filepath, sc.render.resolution_percentage = saved
print("rendered", [s[1] for s in shots], "to", OUT_DIR)

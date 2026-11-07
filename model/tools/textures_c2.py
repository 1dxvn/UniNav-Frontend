"""Second-pass textures: floors by use and destination signs. Arg: model/textures folder.
Updates textures.json with the real-world size of each texture (metres)."""
import sys, os, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
rng = np.random.default_rng(21)
N = 512
sizes = json.load(open(os.path.join(OUT, "textures.json")))
yy, xx = np.mgrid[0:N, 0:N]

def noise(scale, amp):
    small = rng.normal(0, 1, (N // scale + 2, N // scale + 2))
    img = Image.fromarray(((small - small.min()) / (np.ptp(small) + 1e-9) * 255).astype(np.uint8)).resize((N + 2 * scale, N + 2 * scale), Image.BICUBIC)
    return (np.asarray(img, np.float32)[scale:scale + N, scale:scale + N] / 255.0 - 0.5) * amp

def save(name, arr, metres):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name), quality=88, optimize=True)
    sizes[name] = metres

# wet rooms: 30 cm white-grey ceramic, 1.2 m tile (4 x 4)
w = np.zeros((N, N, 3), np.float32); c = N / 4
for i in range(4):
    for j in range(4):
        w[int(j * c):int((j + 1) * c), int(i * c):int((i + 1) * c)] = np.array([226, 230, 232], np.float32) * rng.uniform(0.97, 1.02)
w += noise(16, 5)[..., None]
w[((yy % c) < 3) | ((xx % c) < 3)] = [176, 182, 186]
save("floor_wet.jpg", w, [1.2, 1.2])

# laboratories / clinic: speckled light grey vinyl, 2 m, no joints
v = np.zeros((N, N, 3), np.float32) + np.array([205, 210, 212], np.float32)
v += noise(32, 10)[..., None] + noise(2, 10)[..., None]
spk = rng.random((N, N)) < 0.012
v[spk] -= 45
save("floor_vinyl.jpg", v, [2.0, 2.0])

# offices: oak laminate, 2 m tile, planks 0.2 x 1.0 m staggered
wd = np.zeros((N, N, 3), np.float32)
ph, pl = N / 10, N / 2
for r in range(10):
    off = (pl / 2) * (r % 2) + rng.uniform(0, pl / 4)
    for b in range(-1, 3):
        x0 = int(b * pl + off); x1 = int((b + 1) * pl + off)
        base = np.array([176, 132, 88], np.float32) * rng.uniform(0.86, 1.08)
        cols = [x % N for x in range(x0, x1)]
        wd[int(r * ph):int((r + 1) * ph), cols] = base
grain = noise(2, 18)
wd += (grain * np.array([1.0])[None])[..., None] * np.array([1.0, 0.8, 0.6]) + noise(24, 12)[..., None]
wd[(yy % ph) < 2] = [118, 86, 58]
for r in range(10):
    off = (pl / 2) * (r % 2)
    rows = (yy >= r * ph) & (yy < (r + 1) * ph)
    wd[rows & (((xx - off) % pl) < 2)] = [118, 86, 58]
save("floor_wood.jpg", wd, [2.0, 2.0])

# destination signs: dark green panel, white text (1024 x 256 = 1.2 x 0.3 m)
def font(size):
    for f in ("C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf"):
        if os.path.exists(f): return ImageFont.truetype(f, size)
    return ImageFont.load_default()
SIGNS = {"sign_icetex.jpg": ("ICETEX", "Atención al estudiante"),
         "sign_morfologia.jpg": ("LAB. MORFOLOGÍA", "Área académica"),
         "sign_ascensores.jpg": ("ASCENSORES · BAÑOS", "Hall"),
         "sign_preclinica.jpg": ("PRECLÍNICA", "Odontología"),
         "sign_acceso.jpg": ("BLOQUE B", "Acceso principal")}
for name, (title, sub) in SIGNS.items():
    img = Image.new("RGB", (1024, 256), (16, 84, 70))
    d = ImageDraw.Draw(img)
    d.rectangle([10, 10, 1013, 245], outline=(220, 236, 228), width=4)
    f1, f2 = font(92), font(44)
    tw = d.textlength(title, font=f1)
    if tw > 960:
        f1 = font(int(92 * 960 / tw)); tw = d.textlength(title, font=f1)
    d.text(((1024 - tw) / 2, 34), title, font=f1, fill=(255, 255, 255))
    sw = d.textlength(sub, font=f2)
    d.text(((1024 - sw) / 2, 160), sub, font=f2, fill=(200, 230, 218))
    img.save(os.path.join(OUT, name), quality=90)
    sizes[name] = [1.2, 0.3]

json.dump(sizes, open(os.path.join(OUT, "textures.json"), "w"), indent=2)
print(sizes)

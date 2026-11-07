"""Procedural, tileable textures for the campus model (JPEG). Arg: output folder.
Each texture's real-world size (metres) is recorded in textures.json for UV scaling in Blender."""
import sys, os, json
import numpy as np
from PIL import Image, ImageFilter

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)
N = 512

def save(name, arr, metres):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name), quality=86, optimize=True)
    sizes[name] = metres
sizes = {}

def noise(scale, amp):
    small = rng.normal(0, 1, (N // scale + 2, N // scale + 2))
    img = Image.fromarray(((small - small.min()) / (np.ptp(small) + 1e-9) * 255).astype(np.uint8)).resize((N + 2 * scale, N + 2 * scale), Image.BICUBIC)
    a = np.asarray(img, dtype=np.float32)[scale:scale + N, scale:scale + N] / 255.0 - 0.5
    return a * amp

# --- brick: 1.0 m x 1.0 m, 4 bricks per metre, 12 courses, running bond
brick = np.zeros((N, N, 3), np.float32)
mortar = np.array([188, 178, 164], np.float32)
courses, per = 12, 4
ch, bw = N / courses, N / per
joint = max(2, int(N * 0.011))
for r in range(courses):
    y0, y1 = int(r * ch), int((r + 1) * ch)
    off = (bw / 2) if r % 2 else 0
    for b in range(-1, per + 1):
        x0 = int(b * bw + off); x1 = int((b + 1) * bw + off)
        base = np.array([172, 86, 58], np.float32) * rng.uniform(0.86, 1.10) + rng.normal(0, 6, 3)
        xs = [x % N for x in range(x0, x1)]
        brick[y0:y1, xs] = base
brick += noise(8, 18)[..., None]
yy, xx = np.mgrid[0:N, 0:N]
mask = (yy % ch) < joint
for r in range(courses):
    off = (bw / 2) if r % 2 else 0
    rows = (yy >= r * ch) & (yy < (r + 1) * ch)
    mask |= rows & (((xx - off) % bw) < joint)
brick[mask] = mortar + noise(4, 10)[mask][:, None]
save("brick.jpg", brick, [1.0, 1.0])

# --- concrete pavers: 2 m, 0.40 m squares, light grey with variation
pav = np.zeros((N, N, 3), np.float32)
cell = N / 5
for i in range(5):
    for j in range(5):
        c = np.array([176, 174, 168], np.float32) * rng.uniform(0.9, 1.06)
        pav[int(j * cell):int((j + 1) * cell), int(i * cell):int((i + 1) * cell)] = c
pav += noise(6, 14)[..., None] + rng.normal(0, 3, (N, N, 1))
pj = max(2, int(N * 0.006))
pm = ((yy % cell) < pj) | ((xx % cell) < pj)
pav[pm] = np.array([128, 126, 120], np.float32)
save("pavers.jpg", pav, [2.0, 2.0])

# --- grass: 4 m
gr = np.zeros((N, N, 3), np.float32) + np.array([86, 128, 58], np.float32)
gr += noise(16, 40)[..., None] * np.array([0.7, 1.0, 0.5]) + noise(3, 26)[..., None] * np.array([0.6, 1.0, 0.4])
save("grass.jpg", gr, [4.0, 4.0])

# --- green wall: 2 m, leafy blobs
gw = np.zeros((N, N, 3), np.float32) + np.array([42, 70, 34], np.float32)
img = Image.fromarray(gw.astype(np.uint8))
from PIL import ImageDraw
d = ImageDraw.Draw(img)
for _ in range(2600):
    x, y, r = rng.integers(0, N), rng.integers(0, N), rng.integers(4, 13)
    tone = rng.uniform(0.7, 1.45)
    col = tuple(int(v) for v in np.clip(np.array([58, 98, 44]) * tone + rng.normal(0, 8, 3), 0, 255))
    for dx in (-N, 0, N):
        for dy in (-N, 0, N):
            d.ellipse([x - r + dx, y - r + dy, x + r + dx, y + r + dy], fill=col)
gw = np.asarray(img.filter(ImageFilter.GaussianBlur(0.8)), np.float32)
save("greenwall.jpg", gw, [2.0, 2.0])

# --- interior porcelain tiles: 2.4 m, 0.60 m tiles
ti = np.zeros((N, N, 3), np.float32)
tc = N / 4
for i in range(4):
    for j in range(4):
        ti[int(j * tc):int((j + 1) * tc), int(i * tc):int((i + 1) * tc)] = np.array([226, 219, 205], np.float32) * rng.uniform(0.975, 1.02)
ti += noise(12, 6)[..., None]
tj = max(1, int(N * 0.004))
ti[((yy % tc) < tj) | ((xx % tc) < tj)] = np.array([196, 188, 174], np.float32)
save("tiles.jpg", ti, [2.4, 2.4])

# --- dry stone wall: 1.5 m, voronoi stones, dark with light joints
pts = rng.uniform(0, N, (90, 2))
allp = np.concatenate([pts + [dx, dy] for dx in (-N, 0, N) for dy in (-N, 0, N)])
tones = np.tile(rng.uniform(0.55, 1.15, len(pts)), 9)
st = np.zeros((N, N, 3), np.float32)
for r0 in range(0, N, 16):
    py, px = np.mgrid[r0:r0 + 16, 0:N]
    q = np.stack([px.ravel(), py.ravel()], 1).astype(np.float32)
    dist = ((q[:, None, :] - allp[None, :, :]) ** 2).sum(-1)
    idx = np.argsort(dist, 1)[:, :2]
    d1 = np.sqrt(np.take_along_axis(dist, idx[:, :1], 1))[:, 0]; d2 = np.sqrt(np.take_along_axis(dist, idx[:, 1:2], 1))[:, 0]
    tone = tones[idx[:, 0]]
    col = np.array([92, 88, 84], np.float32)[None, :] * tone[:, None]
    edge = (d2 - d1) < 3.0
    col[edge] = [170, 164, 152]
    st[r0:r0 + 16] = col.reshape(16, N, 3)
st += noise(4, 14)[..., None]
save("stone.jpg", st, [1.5, 1.5])

json.dump(sizes, open(os.path.join(OUT, "textures.json"), "w"), indent=2)
print(sizes)

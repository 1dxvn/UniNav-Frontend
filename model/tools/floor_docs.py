"""Writes public/models/floor-<N>/campus-reference.md for the floors built with blender_floor.py.
Args: tools_data_dir public_models_dir floor_ids (e.g. "0,3,4,5")"""
import sys, json, re, os
from shapely.geometry import Polygon

DATA, PUB, IDS = sys.argv[1], sys.argv[2], sys.argv[3].split(",")
grid = json.load(open(os.path.join(DATA, "grid_axes.json")))
refs = json.load(open(os.path.join(DATA, "floor_refs.json")))
SHEET = {"0": "PISO CERO", "2": "SEGUNDO PISO", "3": "TERCER PISO", "4": "CUARTO PISO", "5": "QUINTO PISO"}
LEVEL = {"0": (-4.13, -2.94), "2": (2.68, 2.94), "3": (6.37, 5.88), "4": (9.87, 8.82), "5": (13.37, 11.76)}   # (A, B)
f1 = json.load(open(os.path.join(DATA, "wing.json"), encoding="utf-8"))
c1 = [Polygon(c["outer"]).centroid for c in f1["columns"]]
for n in IDS:
    w = json.load(open(os.path.join(DATA, f"floor{n}", "wing.json"), encoding="utf-8"))
    cn = [Polygon(c["outer"]).centroid for c in w["columns"]]
    devs = [min(a.distance(b) for b in cn) for a in c1 if cn]
    common = [d for d in devs if d < 0.15]
    dx, dy = grid[f"PLANTA {SHEET[n]}".replace("PLANTA ", "")]["to_first_floor"] if f"PLANTA {SHEET[n]}".replace("PLANTA ", "") in grid else grid[SHEET[n]]["to_first_floor"]
    a_lvl, b_lvl = LEVEL[n]
    names = []
    for l in w["labels"]:
        t = l["text"].replace("\n", " ").strip()
        if len(t) < 4 or re.search(r"M2$|^N\s|^P-?\d|^\d|ESCALA|PLANTA", t, re.I): continue
        if t not in names: names.append(t)
    rows = "\n".join(f"| `P{n}_REF_{i + 1}_Column_{int(round(p[0]))}_{int(round(p[1]))}` | {p[0]:.2f}, {p[1]:.2f} | {p[0]:.2f}, 0, {-p[1]:.2f} | {p[2]:.3f} m |"
                     for i, p in enumerate(refs[n]))
    doc = f"""# Floor {n} model reference (first version)

`campus.glb` in this folder is the cut model of `PLANTA {SHEET[n]}`. It is a first delivery for Plan 1 H3. Codex has not integrated it, and it has no API data yet.

| Item | Value |
| --- | --- |
| Source | `PLANOS UCC 2025 - B.dwg`, sheet `PLANTA {SHEET[n]}` |
| Registration | Translation ({dx:.3f}, {dy:+.3f}) m onto the first-floor sheet, measured on the structural grid bubbles (`docs/blocks/dwg-inventory.md` §1). {len(common)} structural columns coincide with first-floor columns within {max(common):.3f} m |
| Units / frame | Metres. Same plan coordinates as the first floor: origin at the Hall Acceso threshold, plan `(x, y)` → glTF `(x, height, -y)`, plan +y is not north |
| Local elevation | 0 = this floor's slab |
| Real levels | Block A N **{a_lvl:+.2f}**, Block B N **{b_lvl:+.2f}**. The model uses one flat slab |
| Recommended runtime transform | scale 1, rotation 0, translation `[0, {3.5 + b_lvl:.2f}, 0]`, that is 3.5 (first-floor model) + Block B level. Block A is {a_lvl - b_lvl:+.2f} m from that |

## Reference points (structural columns shared with the first floor)

| Node | Plan (x, y) | glTF | Offset from the first-floor column |
| --- | --- | --- | --- |
{rows}

## Objects

- `P{n}_Floor_Slab`: closing of walls, columns and glass, -0.20 → 0. Rooms enclosed by walls and glass are added even when they are large.
- `P{n}_Walls`: solid hatches plus thin faces of the double wall lines on layer `01`; 0 → 2.80, brick outside, plaster inside.
- `P{n}_Columns`: layer `06` closed polylines.
- `P{n}_Glass`, `P{n}_Glass_Frames_Top`, `P{n}_Glass_Mullions`: `VIDRIO` lines, frames and mullions.
- `P{n}_Ramps_Stairs`: pattern hatches, flat.

Room tags drawn at the label anchors and the repeated 0.34 × 1.38 m blocks are filtered out. A few short stubs near labels may still be annotation.

## Labels on this sheet (first {min(40, len(names))})

{", ".join(names[:40])}

## Not yet in this version

Door leaves, furniture, floor zones, signs, slab holes over stairs and the stairs and elevators of this floor. The vertical core positions are the same as in `docs/blocks/vertical-connections.md`, because the floors are registered on the same grid.
"""
    os.makedirs(os.path.join(PUB, f"floor-{n}"), exist_ok=True)
    open(os.path.join(PUB, f"floor-{n}", "campus-reference.md"), "w", encoding="utf-8").write(doc)
    print("floor", n, "common columns", len(common), "labels", len(names))

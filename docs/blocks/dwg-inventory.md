# DWG inventory: blocks, floors, levels and vertical cores

Prepared by Claude for Plan 1 H1 and Plan 2 A0. Source: `PLANOS UCC 2025 - B.dwg`, converted to DXF. The title block reads "SEDE: PASTO", "FECHA: NOVIEMBRE 2018", scale 1:125 / 1:200.

Each item is marked:
- **Confirmed:** read directly from the drawing.
- **Derived:** computed from drawing data, with the method stated.
- **To confirm:** the user should confirm it.

## 1. Sheets and how they are registered

The modelspace holds one plan per floor, placed in different areas of the drawing. Every sheet repeats the structural grid: axes 1–12 with bubbles above the plan, and axes A–K with bubbles to the left.

Each sheet is registered onto the first-floor sheet by a **pure translation**, measured from those bubbles (`model/tools/grid_axes.py` → `model/tools/data/grid_axes.json`). The rows of each sheet agree within 0.001 m. **Derived.**

| Sheet title | Title (CAD) | Shift to the first-floor sheet (dx, dy) m |
| --- | --- | --- |
| PLANTA PISO CERO | 5897.8, -1633.6 | 0.02, -121.485 |
| PLANTA PRIMER PISO | 5897.8, -1785.2 | 0, 0 (reference) |
| PLANTA SEGUNDO PISO | 5897.8, -1904.3 | 0.02, +149.221 |
| PLANTA TERCER PISO | 5899.2, -2041.2 | 0.02, +286.130 |
| PLANTA CUARTO PISO | 5699.4, -1633.6 | 198.446, -121.485 |
| PLANTA QUINTO PISO | 5699.4, -1762.1 | 198.446, +6.949 |
| PLANTA AZOTEA CANCHAS SINTETICAS | 5699.4, -1904.3 | 198.446, +149.221 |
| PLANTA AZOTEA CUBIERTAS | 5699.4, -2069.5 | not registered (no grid bubbles found) |

Check: after registration, the elevator labels (`ASENSOR`) of every floor fall on the same points, plan (24.4, 55.4) and (26.8, 55.4).

All coordinates below are **first-floor plan coordinates** (metres, origin at the Hall Acceso threshold, CAD 5915, -1792), the same system as `public/models/campus-reference.md` and the API.

## 2. Blocks A and B: both are in this DWG

**Derived, to confirm.** The file name says "B", but its plans hold two blocks that meet along plan y ≈ 46–48:

| Evidence | North bar (y ≈ 47 → 68) | South body (y ≈ 12 → 47) |
| --- | --- | --- |
| Classroom suffixes | Every `…A` room: 308A–312A, 420A–424A, 501A–503A, 511A–518A | Every `…B` room: 201B–219B, 307B–318B, 401B–414B, 608B |
| Block labels | `BLOQUE A`, floor 0, plan (59.6, 45.8), on the boundary | `BLOQUE 002 PISO 1` (28.5, 43.0); `BLOQUE B PISO 2` (28.5, 46.7) |
| Levels (section 4) | Its own floor levels | Its own floor levels, every 2.94 m |
| Photos | "BLOQUE A" sign in a brick courtyard next to a cylindrical glass stair tower; the north bar has two round glass stairs | |

Reading: **Block A is the north bar** and **Block B is the south body**. The elevator and restroom hall sits at the junction.

Effect on the current model:
- The GLB labelled "Block B · First floor" already contains the **first floor of Block A** too: the north bar, with the cafeteria, the locales, the elevator and restroom hall, the north circulation, the multifunctional laboratory, classrooms 112/113 and the Preclinic.
- Assignment of the confirmed destinations:

| Destination | Block |
| --- | --- |
| ICETEX | B |
| Morphology Laboratory | B |
| Elevator and Restroom Hall | Junction, A side |
| Preclinic | A |

**To confirm by the user:** that the north bar is Block A, and that it is the "BLOQUE A" of the photos.

## 3. Floors and main spaces

The confirmed names come from the sheet labels.

| Floor (sheet) | Block A (north bar) | Block B (south body) |
| --- | --- | --- |
| Piso cero | Auditorium, critical-care unit, simulation lab, debriefing and control rooms, technical rooms, nursing | Dental clinic: postgraduate clinic, waiting room, clinical histories, consulting rooms, lockers, patio |
| Primer piso (modelled) | Cafeteria, locales 1–4, hall of elevators and restrooms, multifunctional lab, classrooms 112/113, Preclinic, Dentistry coordination | Hall Acceso, ICETEX, DARC offices, treasury, marketing, gym, games room, Morphology lab, lockers, procedures |
| Segundo piso | Multifunctional labs 1–3, molecular biology, research centre, mixed-reality lab | Classrooms 201–219B, Medicine faculty offices |
| Tercer piso | Computer labs 1–5, classrooms 308A–312A, periodicals room | Classrooms 307B–318B, Industrial Engineering, chemistry and physics labs |
| Cuarto piso | Classrooms 420A–424A, socio-legal research centre | Classrooms 401B–414B, Law faculty, administration |
| Quinto piso | Classrooms 501A–518A | Classrooms 501B–509B, "Auditorio Urcunina" (608B) |
| Azoteas | Synthetic sports courts (roof) and roofs | |

## 4. Levels

The level marks `N ±x.xx` were read on every sheet and registered as above. **Confirmed (values) / derived (attribution to a block).**

| Floor | Block A level (next to the round stairs) | Block B level (stair and landings) |
| --- | --- | --- |
| Piso cero | N -4.13 | N -2.94 (also -4.13 in the clinic area) |
| Primer piso | N -0.63 (stair landings and elevator hall) | N 0.00 (ramps at N -0.90 and +1.19) |
| Segundo | N +2.68 | N +2.94 (landing +1.70) |
| Tercero | N +6.37 | N +5.88 (landing +4.64) |
| Cuarto | N +9.87 | N +8.82 (landing +7.58) |
| Quinto | N +13.37 | N +11.76 (landing +10.52) |
| Roof / courts | N +16.87, +20.38 (sections) | |

- **Storey heights:** Block A has 3.31 / 3.69 / 3.50 / 3.50 m. Block B has a constant 2.94 m. The backend's 3.5 m per floor is therefore only an approximation, and the two blocks are offset by half-levels.
- **The flat slab in the model:** the current first-floor model uses one slab at 0.00. On the real floor, the north bar's elevator hall and stair landings are at N -0.63, so they are about 0.6 m below B. The plan resolves this with ramps and steps around plan (38–40, 33–35) and in the hall area.

## 5. Vertical cores (common to every floor)

| Core | Plan position | Notes |
| --- | --- | --- |
| Elevators 1 and 2 | (26.8, 55.4) and (24.4, 55.4) | Hall of elevators; same position on every floor. **Confirmed** |
| Round glass stair, west | ≈ (15–18, 55–58) | Block A, 20 steps (`S` and numbers 1–20). It is the cylindrical glass tower of the photos. **Confirmed / photo** |
| Round glass stair, east | ≈ (36–39, 55–58) | Block A, 20 steps. **Confirmed** |
| Block B stair | ≈ (35–40, 33–35) | Half landings (N +1.70 / +4.64 / +7.58 / +10.52). **Derived from the levels** |
| First-floor ramps | (38.7, 35.3) N -0.90 → (39.5, 33.5) N +1.19 | Ramps in the B circulation |

## 6. Other useful data

- **Door schedule.** The `CUADRO DE PUERTAS` next to each sheet lists types P-1 to P-10:
  - Widths: 0.70–1.00 m single, 2.00 m double.
  - Heights: 2.06–2.60 m.
  - Materials: aluminium and glass, timber panels, ventilated steel sheet.
  - The model's 2.10 m leaves fall inside that range.
- **Floor finishes** are labelled on the plans: porcelain tile, polished granite, vinyl, glazed ceramic. They can drive the floor materials of the next floors.
- **Sections** (around CAD 5790–5850, -2160 … -2215) give the level series in section 4. They have no full section geometry yet.

## 7. Pending, with what each item needs

| Item | Needs |
| --- | --- |
| Block identity (A = north bar) | User confirmation |
| Real elevation of the first floor of A (N -0.63) in the model and the API | A decision from Codex and the user on per-block floor elevations (Plan 1 H1, "elevaciones por piso") |
| Exterior of A and B (Plan 2 A1) | Can be built from these floor plans and levels. Facade details are approximate, from the photos |
| Second floor (Plan 1 H2) | Sheet registered. A model can be extracted with the same pipeline (`model/tools`). The vertical connection uses the elevators and the stairs above |
| Other campus blocks | No other DWG is available |

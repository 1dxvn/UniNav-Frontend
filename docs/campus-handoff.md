# Blender / frontend handoff

Status: **first-floor GLB received and integrated**. Use the backend's
`python -m scripts.run_campus --port 8001` for the real floor. `python main.py`
continues to serve the separate sample campus. See `campus-review.md` for captures.

## Shared coordinates

- API `(x, y, floor)` is in metres. Three.js / exported glTF uses
  `(x, floor * 3.5, -y)`, Y up. API +y is the plan axis / world -Z; it is not north.
- Keep the Blender model in metres, export glTF Y-up. Record **exported glTF**
  coordinates, not unconverted Blender Z-up coordinates.
- Export a cutaway, no roof over walkable rooms. Preserve doorway openings.
- First acceptance target: entrance, one corridor with a turn, three confirmed
  destinations. Every turn needs an API waypoint; edges are straight segments.
- Avatar radius 0.25 m, height 1.7 m. Keyboard movement stays within 0.62 m of
  API centre lines. Keep corridor centre lines clear at body height.

## Deliverables from Claude

Put `campus.glb`, `campus-reference.md` and `campus-top.png` in
`UniNav-Frontend/public/models/`. Keep the editable `.blend` outside the web build.
The reference Markdown must name the real floor and destinations, source scale,
origin, orientation, any estimated heights, and three noncollinear reference points
with exported glTF coordinates and matching API plan coordinates.

Codex will map those confirmed places and corridor corners through the existing
admin imports, using a separate development database if required. Do not overwrite
the sample or invent real room names. The frontend can be tested with sample data
until the handoff arrives.

## Runtime calibration file

Codex converts the reference Markdown into `public/models/campus-reference.json`.
The loader checks all reference points against the **live API** before displaying
the model. Maximum error: 0.15 m. It rejects missing, duplicate or collinear points.

```json
{
  "version": 1,
  "label": "CONFIRMED FLOOR / WING NAME",
  "floor": 0,
  "model": "campus.glb",
  "transform": { "scale": 1, "rotationYDegrees": 0, "translation": [0, 0, 0] },
  "references": [
    { "buildingName": "CONFIRMED ENTRANCE", "nodeName": "REF_1", "position": [0, 0, 0] },
    { "buildingName": "CONFIRMED CORNER", "nodeName": "REF_2", "position": [10, 0, 0] },
    { "buildingName": "CONFIRMED DESTINATION", "nodeName": "REF_3", "position": [10, 0, -5] }
  ]
}
```

These names and coordinates are examples, **not campus data**. Transformation order
is uniform scale, rotation about world Y in degrees, translation in world metres.
For a model exported at local zero on API floor 2, translation Y is 7 m unless the
model already contains the elevation. Do not apply the floor offset twice.

## Review loop

1. Build the frontend, start FastAPI, sign in and select the confirmed floor.
2. Open top view and enable reference markers. Check the three named pins against
   `campus-top.png`; confirm a known measured distance.
3. Calculate a route with a turn. Capture **Export view** before walking and give
   the PNG to Claude. Save it in `docs/verification/first-route.png`.
4. Walk it twice, including manual override, pause/resume, a second destination and
   a no-route error. Model walls also block movement at two body heights; fix the
   graph or geometry if the walk stops. Three anchors alone do not prove clearance.

Frontend changes stay in the frontend repository. Model changes stay with Claude.

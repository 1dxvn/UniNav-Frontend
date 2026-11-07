# Floor previews and vertical integration review

Codex review, 7 November 2026. Current source exports: Claude's C13 through
`a2dbda0` (corrected stairs, removed door-tag frames and drawn door leaves). The
preview metadata transcribes the three structural anchors and
recommended world elevation from each `public/models/floor-N/campus-reference.md`.
It does not create API places. The references use `alignment: structural`, not
API-room alignment. The GLB node positions are checked separately against those
documented anchors, within 0.15 m.

| Floor | Preview world elevation | Source |
| --- | --- | --- |
| 0 | 0.56 m | Floor-0 reference: 3.5 + B datum -2.94 |
| 2 | 6.44 m | Floor-2 reference: 3.5 + B datum 2.94 |
| 3 | 9.38 m | Floor-3 reference: 3.5 + B datum 5.88 |
| 4 | 12.32 m | Floor-4 reference: 3.5 + B datum 8.82 |
| 5 | 15.26 m | Floor-5 reference: 3.5 + B datum 11.76 |

Each exported cut flattens its A/B half-level; these transforms are for inspecting
the delivered model, not a replacement for physical elevations. A/B identities
remain derived. C10 repeats the first-floor A stair layout on other levels as an
explicit approximation. Stair meshes in a preview do not establish a route.

## Before enabling navigation

- Reconcile the B first-floor laboratory approach with the measured nine-step
  rise N 0.00 → +1.19 m. The existing C2 slab/data are flat. Split and type the
  route only with corresponding geometry and heights. The nearby ramp direction
  is unconfirmed; no alternative connection should be inferred.
- Check the whole body/head clearance of the first-floor candidate into floor 2,
  including flight starts, return flight, curved landing and arrival. C13's four
  directed centre-line probes between floors 1 and 2 are clear, but actual API
  journeys and manual tread support remain pending. A single downward probe at west
  return-flight point (18.05,58) does not hit the slab on floors 2–5; this is not
  a complete clearance or support test and does not prove that a hole is needed
  at that particular point. Resolve actual obstacles from full sweeps/captures.
- Confirm elevator shaft openings, floor/door alignment and the representation
  of passage between levels before adding an elevator edge.
- Add confirmed floor destinations, doorway/turn coordinates and API data. Recheck
  furniture/door clearance using that graph: C8/C9 furniture was exported before
  route data existed. The presence of a label is insufficient to infer its access.

Previews remain explicitly non-navigable and add zero collision meshes. C13 keeps
the original first-floor data binding and four destinations. Observing a preview must
preserve the avatar, active route and first-floor collision resources. Only the selected
preview is cached; leaving it releases its GPU resources.

Source hashes, extracted anchors, geometry counts and slab probes are recorded
under `docs/verification/c13/` (historical previews remain in `floor-previews/`).
No Blender sources, model geometry or Claude reference documents were edited by Codex.

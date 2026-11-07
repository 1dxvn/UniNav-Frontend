# C18 source review and model request

The source handoff is reviewed; a compatible floor-0 candidate has been
requested in `docs/blocks/floor0-candidate-request.md` and `.json`, linked from
`docs/campus-review.md` for Claude. No model, public dataset or manifest is
changed. Floor 0 remains a non-navigable C14 structural preview.

`review.json` records the committed C18 source hash, all seven level labels,
three aligned structural anchors and the existing C14/C16 sources. Independent
rays show the old preview at world 0.56 at the east-tower label and two clinic
labels, where the requested physical level is −0.63. The old preview rejects
support at that requested level. The accepted C16 floor-1 stand supports world
2.87. Old stair bounds and copied XY probes are inspection evidence, not an
accepted floor-0 centre line or graph endpoint.

The 3.50 m 0-to-1 rise comes from the endpoint labels. C18's compatible 21-riser
layout remains a proposal until the actual return flight, landing, endpoints
and support surfaces are delivered and checked. Structural references keep the
B datum world 0.56; changing their metadata cannot lower the walking geometry.
Unresolved west/south boundaries, southern rooms, B south flight, west opening,
yard steps, ramp top and elevator operation remain explicitly pending.

Reproduce from the frontend with:

```powershell
node --experimental-strip-types tools/review-floor0-handoff.ts
```

This tool reads committed references and GLBs, checks the current resource
hashes and writes only Codex's review/request files. It does not control Blender
or edit Claude's source files. The source delivery is preserved in its original
commits; the model request and integration code are separate work. Build and
browser validation for the independent route UI work are recorded in
`docs/verification/route-instructions/`. These sources do not finish a floor,
H2 or any of the three plans.

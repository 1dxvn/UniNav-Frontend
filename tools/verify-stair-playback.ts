import { readFile, writeFile } from "node:fs/promises";
import { Group, Mesh, Raycaster, Vector3 } from "three";
import { committedAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { sha256 } from "../src/scene/modelManifest.ts";

const output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/h2-stair-support";
const prefix=process.env.UNINAV_STAIR_REPORT_PREFIX ?? "vertical";
const automatic=JSON.parse(await readFile(`${output}/${prefix}-browser.json`,"utf8"));
const manual=JSON.parse(await readFile(`${output}/${prefix}-manual-browser.json`,"utf8"));
if(automatic.profile!==manual.profile)throw new Error("Automatic and manual reports use different model profiles.");
const commit=automatic.modelSourceCommit ?? "a2dbda0";
if(automatic.modelSourceCommit!==manual.modelSourceCommit || automatic.modelHash!==manual.modelHash || automatic.lowerModelHash!==manual.lowerModelHash)throw new Error("Playback model revisions differ.");
const surfaces:Mesh[]=[];
for (const s of [{path:"models/campus.glb",y:3.5,names:["Floor_Slab","Stair_A_East_1"]},
  {path:"models/floor-2/campus.glb",y:6.44,names:["P2_Floor_Slab","P2_Stair_A_East_1"]}]) {
  const bytes=await committedAsset(commit,s.path),expected=s.path.includes("floor-2") ? automatic.modelHash:automatic.lowerModelHash;
  if(expected && await sha256(bytes)!==expected)throw new Error(`Playback model hash mismatch: ${s.path}`);
  const root=new Group();root.position.y=s.y;root.add((await parseModelGeometry(bytes)).scene);root.updateMatrixWorld(true);
  for (const name of s.names) {
    const mesh=root.getObjectByName(name);if (!(mesh instanceof Mesh)) throw new Error(`Missing surface: ${name}`);surfaces.push(mesh);
  }
}
// Independent downward ray at the actual DOM position, not the runtime support
// resolver or the graph's interpolated height. DOM coordinates round to 1 mm.
const reports=[];
for (const [mode,samples] of [["automatic",automatic.samples],["manual",manual.samples]] as const) {
  let maxError=0;
  for (const sample of samples) {
    const p=new Vector3(...(typeof sample.position==="string" ? sample.position.split(",").map(Number) : sample.position) as [number,number,number]);
    const hits=new Raycaster(p.clone().add(new Vector3(0,0.01,0)),new Vector3(0,-1,0),0,0.03).intersectObjects(surfaces,false);
    const errors=hits.filter(h=>h.face && h.face.normal.clone().transformDirection(h.object.matrixWorld).y>0.65).map(h=>Math.abs(h.point.y-p.y));
    const error=Math.min(...errors);
    if (error>0.001) throw new Error(`Unsupported ${mode} browser feet: ${p.toArray()} (${error})`);
    if (!["1","2"].includes(sample.floor)) throw new Error(`Unexpected floor: ${sample.floor}`);
    maxError=Math.max(maxError,error);
  }
  reports.push({mode,samples:samples.length,maxFootErrorMetres:maxError});
}
await writeFile(`${output}/${prefix==="vertical" ? "browser-foot-support":`${prefix}-foot-support`}.json`,JSON.stringify({profile:automatic.profile ?? "legacy-stair-fixture",modelSourceCommit:commit,reports,coordinateResolutionMetres:0.001,fixtureOnly:true},null,2));
console.log(JSON.stringify(reports,null,2));

// Integrates the C19 polished campus exterior (Plan 4) into every manifest entry of kind "exterior" (base models and all
// profiles). It checks the committed bytes against the working export, changes only those entries and verifies that
// every other manifest entry stays byte-identical. The C5 file stays in public/ as history.
// Usage: node --experimental-strip-types tools/integrate-c19-exterior.ts [--integrate]
import { readFile,writeFile } from "node:fs/promises";
import { committedRepositoryAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { parseManifest,sha256 } from "../src/scene/modelManifest.ts";

// Exterior entries are served from public/ by sourceCommit (the manifest does not allow modelSource for them).
const commit="9d8ee41b12405593c0d11b5e4a56007cfd49beb2",url="models/blocks/campus-exterior-c19.glb",candidate="model/candidates/c19/campus-exterior.glb";
const bytes=await committedRepositoryAsset(commit,`public/${url}`),hash=await sha256(bytes);
if(await sha256(await committedRepositoryAsset("668c83a",candidate))!==hash || await sha256(await readFile(`public/${url}`))!==hash)throw new Error("C19 public file differs from the reviewed candidate.");
const gltf=await parseModelGeometry(bytes);const names:string[]=[];gltf.scene.traverse(o=>{if(o.name)names.push(o.name);});
for(const required of ["C19_A_Storeys","C19_B_Storeys","C19_Floor1_Roofs","C19_Access_Pavilion","C19_Stair_Towers","C19_Rooftop","C19_Courts"])
  if(!names.includes(required))throw new Error(`C19 export lacks ${required}.`);
const raw=await readFile("public/models/campus-manifest.json","utf8"),manifest=parseManifest(JSON.parse(raw)),before=JSON.parse(raw);
const entries=[...manifest.models,...(manifest.profiles ?? []).flatMap(p=>p.models)].filter(e=>e.kind==="exterior");
if(entries.length!==8)throw new Error(`Expected 8 exterior entries, found ${entries.length}.`);
for(const e of entries){
  e.model=url;delete e.modelSource;e.modelSha256=hash;e.revision="C19-exterior-polish-668c83a";e.sourceCommit=commit;
  e.sourceDocument="model/candidates/c19/README.md @668c83a; Plan 4 overview polish: caps and roofs, cafeteria windows, access pavilion, trimmed floating storeys, glass stair towers, rooftop rooms, courts and nets. Approximations documented.";
}
const strip=(m:any)=>JSON.stringify({...m,models:m.models.filter((e:any)=>e.kind!=="exterior"),profiles:(m.profiles ?? []).map((p:any)=>({...p,models:p.models.filter((e:any)=>e.kind!=="exterior")}))});
if(strip(manifest)!==strip(before))throw new Error("A non-exterior entry changed.");
parseManifest(manifest);
console.log(JSON.stringify({commit,hash,bytes:bytes.length,objects:names.filter(n=>n.startsWith("C19_")).length,entries:entries.length},null,2));
if(process.argv.includes("--integrate")){await writeFile("public/models/campus-manifest.json",JSON.stringify(manifest,null,2)+"\n");console.log("Integrated C19 in the 8 exterior entries; every other entry unchanged.");}

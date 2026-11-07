import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp,readFile,writeFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,resolve,dirname,basename } from "node:path";
import { dataFingerprint,parseManifest,type ModelProfile } from "../src/scene/modelManifest.ts";
import type { Building,CampusPath } from "../src/api/types.ts";

const backend=resolve(".."),patch=join(backend,"data/datasets/ucc-first-floor-stairs.json");
const manifest=parseManifest(JSON.parse(await readFile("public/models/campus-manifest.json","utf8")));
const two=manifest.profiles?.find(p=>p.id==="ucc-two-floors");if(!two)throw new Error("Prepare the reviewed two-floor profile first.");
const generated:ModelProfile[]=[];
for(const expanded of [false,true]){
  const directory=await mkdtemp(join(tmpdir(),"uninav-e2e-"));
  try{
    const datasets=[...(expanded ? [join(backend,"data/datasets/ucc-second-floor.json")]:[]),patch];
    const python=join(backend,"venv",process.platform==="win32" ? "Scripts/python.exe":"bin/python");
    const {stdout}=await promisify(execFile)(python,["-m","tests.serve_campus","--directory",directory,...datasets.flatMap(p=>["--dataset",p]),"--snapshot-json"],{cwd:backend,windowsHide:true,maxBuffer:16*1024*1024});
    const line=stdout.split(/\r?\n/).find(l=>l.startsWith("UNINAV_E2E_SNAPSHOT="));if(!line)throw new Error("Missing isolated API snapshot.");
    const data=JSON.parse(line.slice("UNINAV_E2E_SNAPSHOT=".length)) as {buildings:Building[];paths:CampusPath[]};
    const models=structuredClone(expanded ? two.models:manifest.models);
    for(const m of models.filter(m=>m.binding)){
      m.binding!.sha256=await dataFingerprint(m.binding!.placeNames,data.buildings,data.paths);
      m.revision+="-stair-review-b9648f5";
    }
    generated.push({id:expanded ? "ucc-two-floors-stair-review":"ucc-first-floor-stair-review",label:expanded ? "UCC · Two floors with mapped steps":"UCC · First floor with mapped steps",requiresExplicitPositions:true,models});
    console.log(`Reviewed stair classification: ${data.buildings.length-1} places / ${data.paths.length} paths.`);
  }finally{
    if(resolve(dirname(directory))!==resolve(tmpdir()) || !basename(directory).startsWith("uninav-e2e-"))throw new Error("Unexpected snapshot directory.");
    await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
}
const base=JSON.parse(await readFile(join(backend,"data/datasets/ucc-first-floor.json"),"utf8"));
const review=JSON.parse(await readFile(patch,"utf8"));
const handoff=JSON.parse(await readFile("docs/blocks/first-floor-level-review.json","utf8"));
manifest.stairCrossings=review.paths.map((p:{code:string;source_code:string;target_code:string})=>({connectionCode:p.code,
  originName:base.places.find((b:{code:string})=>b.code===p.source_code).name,destinationName:base.places.find((b:{code:string})=>b.code===p.target_code).name,
  source:handoff.source,planBounds:handoff.groups.find((g:{connectionCodes:string[]})=>g.connectionCodes.includes(p.code)).planBounds}));
manifest.profiles=[...generated,...(manifest.profiles ?? []).filter(p=>!generated.some(g=>g.id===p.id))];
parseManifest(manifest);await writeFile("public/models/campus-manifest.json",JSON.stringify(manifest,null,2)+"\n");

import { expect } from "@playwright/test";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { sha256 } from "../../src/scene/modelManifest.ts";
import type { Building,RouteResponse } from "../../src/api/types.ts";
import { test } from "./isolated-campus.ts";

const candidate=process.env.UNINAV_ROUTE_REVIEW_DIR ?? "docs/verification/c14";
const output=process.env.UNINAV_EVIDENCE_DIR ?? candidate;
const stairReview=process.env.UNINAV_STAIRS_REVIEW==="1";
const upperDataset=fileURLToPath(new URL("../../../data/datasets/ucc-second-floor.json",import.meta.url));
test.use({navigationDataset:stairReview ? [upperDataset,fileURLToPath(new URL("../../../data/datasets/ucc-first-floor-stairs.json",import.meta.url))]:upperDataset});

for(const code of ["ucc:f2:mixed-reality-entrance","ucc:f2:molecular-biology-entrance","ucc:f2:medical-research-arrival"]) {
  test(`mapped floor 2: Hall Acceso to ${code} and back through its drawn doorway`,async({page,request})=>{
    test.setTimeout(240000);await mkdir(output,{recursive:true});
    const review=JSON.parse(await readFile(`${candidate}/route-candidate-checks.json`,"utf8"));
    test.skip(review.sourceCommit===null && process.env.UNINAV_REHEARSE_WORKING_FLOOR2!=="1","The model delivery is not committed yet; opt in only for an explicitly recorded working-snapshot rehearsal.");
    expect(review.checks.every((c:{firstBlocker:string|null;unsupported:boolean})=>!c.firstBlocker && !c.unsupported)).toBe(true);
    const bytes=await(await request.get("/app/models/floor-2/campus.glb")).body();
    const modelHash=await sha256(bytes);expect(modelHash).toBe(review.sources.find((s:{path:string})=>s.path.endsWith(".glb")).sha256);
    const places=await(await request.get("/buildings")).json() as Building[];
    const target=places.find(p=>p.code===code)!,entry=places.find(p=>p.name==="Hall Acceso")!;
    const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto("/app/");await expect(page.locator("#model-status")).toContainText("3 references aligned");
    await expect(page.locator("#model-status")).toHaveAttribute("data-profile",stairReview ? "ucc-two-floors-stair-review":"ucc-two-floors");
    await page.locator("#open-login").click();await page.getByLabel("Username",{exact:true}).fill("student");await page.getByLabel("Password",{exact:true}).fill("demo1234");await page.locator("#login-submit").click();await expect(page.locator("#session-user")).toHaveText("student");
    await page.locator("#origin").selectOption(String(entry.id));
    const runs=[];
    for(const direction of ["outbound","return"]){
      const destination=direction==="outbound" ? target:entry;
      await page.locator("#search").fill(destination.display_name ?? destination.name);await page.locator("#place-list button").first().click();
      const response=page.waitForResponse(r=>r.url().endsWith("/routes/calculate"));await page.locator("#calculate").click();
      const r=await response;expect(r.status()).toBe(200);const route=await r.json() as RouteResponse;
      expect(route.waypoints?.at(-1)?.id).toBe(destination.id);expect(route.steps.some(s=>s.kind==="stairs")).toBe(true);
      expect(route.path).toContain("North circulation / east stair junction");
      const doorway=review.destinations.find((d:{code:string})=>d.code===code).doorway.id;
      expect(route.path).toContain(`${doorway} doorway centre`);
      await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");
      await page.evaluate(()=>{const p=document.getElementById("travel-status")!,w=window as unknown as {floor2Samples:{position:string;floor:string;state:string}[];floor2Observer?:MutationObserver};w.floor2Observer?.disconnect();w.floor2Samples=[];w.floor2Observer=new MutationObserver(()=>w.floor2Samples.push({position:p.dataset.position!,floor:document.querySelector<HTMLSelectElement>("#floor")!.value,state:p.dataset.state!}));w.floor2Observer.observe(p,{attributes:true,attributeFilter:["data-position"]});});
      await page.locator("#follow").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","arrived",{timeout:120000});
      const position=(await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number);
      const finalErrorMetres=Math.hypot(position[0]-destination.x,position[1]-destination.elevation_m!,position[2]+destination.y);
      expect(finalErrorMetres).toBeLessThan(0.002);expect(await page.locator("#floor").inputValue()).toBe(String(destination.floor));
      const samples=await page.evaluate(()=>(window as unknown as {floor2Samples:unknown[]}).floor2Samples);
      expect(JSON.stringify(samples)).not.toContain('"state":"blocked"');
      const labels=await page.locator(".place-label:visible").evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
      for(let a=0;a<labels.length;a++)for(let b=a+1;b<labels.length;b++)expect(labels[a].left<labels[b].right && labels[a].right>labels[b].left && labels[a].top<labels[b].bottom && labels[a].bottom>labels[b].top).toBe(false);
      runs.push({direction,route,position,finalErrorMetres,samples});
      await page.screenshot({path:`${output}/${code.split(":").at(-1)}-${direction}.png`});
    }
    expect(errors).toEqual([]);
    const manifest=await(await request.get("/app/models/campus-manifest.json")).json();
    const lowerModelHash=manifest.models.find((m:{id:string})=>m.id==="ucc-first-floor").modelSha256;
    await writeFile(`${output}/${code.split(":").at(-1)}-walks.json`,JSON.stringify({sourceCommit:review.sourceCommit,modelHash,lowerModelHash,profile:stairReview ? "ucc-two-floors-stair-review":"ucc-two-floors",scope:"temporary API dataset with shipped profile; no model/reference overrides",runs,errors},null,2));
  });
}

test("floor 2 API algorithms preserve heights and exclude the only mapped stairs",async({request})=>{
  await mkdir(output,{recursive:true});
  const login=await request.post("/auth/login",{data:{username:"student",password:"demo1234"}});expect(login.status()).toBe(200);
  const token=(await login.json()).access_token as string,headers={Authorization:`Bearer ${token}`};
  const places=await(await request.get("/buildings")).json() as Building[],entry=places.find(p=>p.name==="Hall Acceso")!;
  const results=[];
  for(const code of ["ucc:f2:mixed-reality-entrance","ucc:f2:molecular-biology-entrance","ucc:f2:medical-research-arrival"]){
    const target=places.find(p=>p.code===code)!;
    for(const reverse of [false,true]){
      const origin=reverse ? target:entry,destination=reverse ? entry:target,distances=[];
      for(const algorithm of ["a_star","dijkstra"]){
        const r=await request.post("/routes/calculate",{headers,data:{origin_id:origin.id,destination_id:destination.id,algorithm}});expect(r.status()).toBe(200);
        const route=await r.json() as RouteResponse;
        expect(route.waypoints?.at(-1)?.elevation_m).toBe(destination.elevation_m);
        expect(route.waypoints?.every(p=>Number.isFinite(p.elevation_m) && p.id && p.code)).toBe(true);
        expect(route.steps.some(s=>s.kind==="stairs")).toBe(true);
        distances.push(route.distance);results.push({code,reverse,algorithm,route});
      }
      expect(Math.abs(distances[0]-distances[1])).toBeLessThan(0.01);
    }
    const unavailable=await request.post("/routes/calculate",{headers,data:{origin_id:entry.id,destination_id:target.id,avoid:["stairs"]}});expect(unavailable.status()).toBe(404);
  }
  await writeFile(`${output}/api-algorithms.json`,JSON.stringify({results,stairsExcludedStatus:404,scope:"temporary candidate dataset"},null,2));
});

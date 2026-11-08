import { expect,type Page } from "@playwright/test";
import { mkdir,writeFile } from "node:fs/promises";
import { sha256 } from "../../src/scene/modelManifest.ts";
import type { Building,RouteResponse } from "../../src/api/types.ts";
import { test } from "./isolated-campus.ts";
// Resumed delivery regression: the four original B1 destinations and floor zero on the active six-floor contract.
const output=process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/resumed-review/walks";
test.use({campusProfile:"ucc-six-floors-c18"});
const codes=["ucc:floor1:p06","ucc:floor1:p13","ucc:floor1:p10","ucc:floor1:p14","ucc:f0:simulation-lab-entrance"];
async function pos(page:Page){return (await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number);}
async function login(page:Page){await page.locator("#open-login").click();await page.getByLabel("Username",{exact:true}).fill("student");await page.getByLabel("Password",{exact:true}).fill("demo1234");await page.locator("#login-submit").click();await expect(page.locator("#session-user")).toHaveText("student");}
async function target(page:Page,p:Building){await page.locator("#search").fill(p.display_name ?? p.name);await page.locator("#place-list button").first().click();}
async function observe(page:Page){await page.evaluate(()=>{const p=document.getElementById("travel-status")!,w=window as unknown as {reviewSamples:unknown[];reviewObserver?:MutationObserver};w.reviewObserver?.disconnect();w.reviewSamples=[];w.reviewObserver=new MutationObserver(()=>w.reviewSamples.push({position:p.dataset.position,floor:document.querySelector<HTMLSelectElement>("#floor")!.value,state:p.dataset.state}));w.reviewObserver.observe(p,{attributes:true,attributeFilter:["data-position"]});});}
async function samples(page:Page){return page.evaluate(()=>(window as unknown as {reviewSamples:unknown[]}).reviewSamples);}

for(const code of codes)test(`Six-floor resumed delivery: ${code} round trip`,async({page,request})=>{
  test.setTimeout(300000);await mkdir(output,{recursive:true});
  const manifest=await(await request.get("/app/models/campus-manifest.json")).json(),profile=manifest.profiles.find((p:{id:string})=>p.id==="ucc-six-floors-c18");
  const models=[];
  for(const m of profile.models.filter((m:{modelSource?:unknown})=>m.modelSource)){
    const bytes=await(await request.get(`/app/${m.model}`)).body(),hash=await sha256(bytes);expect(hash).toBe(m.modelSha256);models.push({url:m.model,hash,source:m.modelSource});
  }
  const places=await(await request.get("/buildings")).json() as Building[],destination=places.find(p=>p.code===code)!,entry=places.find(p=>p.code==="ucc:floor1:p01")!;
  expect(places).toHaveLength(235);const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-six-floors-c18");await expect(page.locator("#model-status")).toContainText("3 references aligned");await login(page);
  await page.locator("#origin").selectOption(String(entry.id));const runs=[];
  for(const direction of ["outbound","return"]){
    const dest=direction==="outbound" ? destination:entry;await target(page,dest);
    const response=page.waitForResponse(r=>r.url().endsWith("/routes/calculate"));await page.locator("#calculate").click();const r=await response;expect(r.status()).toBe(200);const route=await r.json() as RouteResponse;
    await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");await observe(page);await page.locator("#follow").click();
    await expect(page.locator("#travel-status")).toHaveAttribute("data-state","arrived",{timeout:140000});
    const position=await pos(page),error=Math.hypot(position[0]-dest.x,position[1]-dest.elevation_m!,position[2]+dest.y);expect(error).toBeLessThan(0.002);
    expect(await page.locator("#floor").inputValue()).toBe(String(dest.floor));const positions=await samples(page);expect(JSON.stringify(positions)).not.toContain('"state":"blocked"');
    runs.push({direction,route,position,finalErrorMetres:error,samples:positions});await page.screenshot({path:`${output}/${code.split(":").at(-1)}-${direction}.png`});
  }
  expect(errors).toEqual([]);await writeFile(`${output}/${code.split(":").at(-1)}-walks.json`,JSON.stringify({profile:profile.id,models,scope:"production six-floor scripts.run_campus launcher on an isolated database; shipped manifest without overrides",runs,errors},null,2));
});

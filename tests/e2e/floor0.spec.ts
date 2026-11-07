import { expect,type Page } from "@playwright/test";
import { mkdir,writeFile } from "node:fs/promises";
import { sha256 } from "../../src/scene/modelManifest.ts";
import type { Building,RouteResponse } from "../../src/api/types.ts";
import { test } from "./isolated-campus.ts";
// Piso cero (C18) on the production launcher with an isolated database and the shipped manifest, following floor3.spec.ts.
const output=process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/floor0";
test.use({campusProfile:"ucc-four-floors-c18"});
const codes=["ucc:f0:simulation-lab-entrance","ucc:f0:waiting-room"];
async function pos(page:Page){return (await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number);}
async function login(page:Page){await page.locator("#open-login").click();await page.getByLabel("Username",{exact:true}).fill("student");await page.getByLabel("Password",{exact:true}).fill("demo1234");await page.locator("#login-submit").click();await expect(page.locator("#session-user")).toHaveText("student");}
async function target(page:Page,p:Building){await page.locator("#search").fill(p.display_name ?? p.name);await page.locator("#place-list button").first().click();}
async function observe(page:Page){await page.evaluate(()=>{const p=document.getElementById("travel-status")!,w=window as unknown as {f0Samples:unknown[];f0Observer?:MutationObserver};w.f0Observer?.disconnect();w.f0Samples=[];w.f0Observer=new MutationObserver(()=>w.f0Samples.push({position:p.dataset.position,floor:document.querySelector<HTMLSelectElement>("#floor")!.value,state:p.dataset.state}));w.f0Observer.observe(p,{attributes:true,attributeFilter:["data-position"]});});}
async function samples(page:Page){return page.evaluate(()=>(window as unknown as {f0Samples:unknown[]}).f0Samples);}

for(const code of codes)test(`Floor 0 shipped profile: ${code} round trip`,async({page,request})=>{
  test.setTimeout(300000);await mkdir(output,{recursive:true});
  const manifest=await(await request.get("/app/models/campus-manifest.json")).json(),profile=manifest.profiles.find((p:{id:string})=>p.id==="ucc-four-floors-c18");
  const models=[];
  for(const m of profile.models.filter((m:{modelSource?:unknown})=>m.modelSource)){
    const bytes=await(await request.get(`/app/${m.model}`)).body(),hash=await sha256(bytes);expect(hash).toBe(m.modelSha256);models.push({url:m.model,hash,source:m.modelSource});
  }
  const places=await(await request.get("/buildings")).json() as Building[],destination=places.find(p=>p.code===code)!,entry=places.find(p=>p.code==="ucc:floor1:p01")!;
  expect(places).toHaveLength(150);const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-four-floors-c18");await expect(page.locator("#model-status")).toContainText("3 references aligned");await login(page);
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
  expect(errors).toEqual([]);await writeFile(`${output}/${code.split(":").at(-1)}-walks.json`,JSON.stringify({profile:profile.id,models,scope:"production four-floor scripts.run_campus launcher on an isolated database; shipped manifest without overrides",runs,errors},null,2));
});

test("all reviewed profiles serve their pinned resources",async({request})=>{
  const manifest=await(await request.get("/app/models/campus-manifest.json")).json(),results=[];
  for(const profile of [{id:"base",models:manifest.models},...manifest.profiles])for(const m of profile.models){
    if(m.state!=="ready")continue;
    if(m.reference){const bytes=await(await request.get(`/app/${m.reference}`)).body();expect(await sha256(bytes)).toBe(m.referenceSha256);}
    const ref=m.reference ? await(await request.get(`/app/${m.reference}`)).json():null,url=m.model ?? `${m.reference.slice(0,m.reference.lastIndexOf("/")+1)}${ref.model}`;
    const hash=await sha256(await(await request.get(`/app/${url}`)).body());expect(hash).toBe(m.modelSha256);results.push({profile:profile.id,id:m.id,reference:m.reference,url,hash});
  }
  expect(results).toHaveLength(56);await mkdir(output,{recursive:true});await writeFile(`${output}/assets.json`,JSON.stringify({results},null,2));
});

test("partial floor-0 metadata cannot select an older compatible profile",async({page})=>{
  await page.route("**/buildings",async r=>{const response=await r.fetch(),data=await response.json();await r.fulfill({json:data.map((p:{floor:number})=>p.floor===0 ? {...p,elevation_m:null}:p)});});
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","incompatible");await expect(page.locator("#follow")).toBeDisabled();
});

test("unreviewed floor-0 GLB fails closed and recovers on retry",async({page,request})=>{
  const manifest=await(await request.get("/app/models/campus-manifest.json")).json(),profile=manifest.profiles.find((p:{id:string})=>p.id==="ucc-four-floors-c18"),model=profile.models.find((m:{id:string})=>m.id==="ucc-floor-zero");
  const flat=await(await request.get("/app/models/floor-0/campus.glb")).body();
  await page.route(`**/${model.model}`,r=>r.fulfill({body:flat,contentType:"model/gltf-binary"}));
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile",profile.id);await expect(page.locator("#model-status")).toHaveAttribute("data-view","campus");await page.locator("#isometric").click();await page.locator("#floor").selectOption("0");
  await expect(page.locator("#model-status")).toHaveAttribute("title",/Model export changed/);await expect(page.locator("#model-status")).not.toHaveClass(/verified/);
  const before=await page.locator("#travel-status").getAttribute("data-position");await page.locator("canvas").focus();await page.keyboard.down("w");await page.waitForTimeout(100);await page.keyboard.up("w");expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(before);
  const rejected=await page.locator("#model-status").getAttribute("title");
  await page.unroute(`**/${model.model}`);await page.reload();await expect(page.locator("#model-status")).toHaveAttribute("data-view","campus");await page.locator("#isometric").click();await page.locator("#floor").selectOption("0");await expect(page.locator("#model-status")).toContainText("3 references aligned");await expect(page.locator("#model-status")).toHaveClass(/verified/);
  await mkdir(output,{recursive:true});await writeFile(`${output}/wrong-model.json`,JSON.stringify({profile:profile.id,substitution:"flat C14 floor-0 preview GLB at the C18 floor-0 URL",rejected,blockedMovementPosition:before,recovered:await page.locator("#model-status").innerText()},null,2));
});

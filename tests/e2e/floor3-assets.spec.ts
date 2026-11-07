import { expect } from "@playwright/test";
import { mkdir,writeFile } from "node:fs/promises";
import { sha256 } from "../../src/scene/modelManifest.ts";
import { test } from "./isolated-campus.ts";

test.use({campusProfile:"ucc-three-floors-c16"});
const output=process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/floor3";

test("all reviewed profiles serve their pinned resources",async({request})=>{
  const manifest=await(await request.get("/app/models/campus-manifest.json")).json(),results=[];
  for(const profile of [{id:"base",models:manifest.models},...manifest.profiles])for(const m of profile.models){
    if(m.state!=="ready")continue;
    if(m.reference){const bytes=await(await request.get(`/app/${m.reference}`)).body();expect(await sha256(bytes)).toBe(m.referenceSha256);}
    const ref=m.reference ? await(await request.get(`/app/${m.reference}`)).json():null,url=m.model ?? `${m.reference.slice(0,m.reference.lastIndexOf("/")+1)}${ref.model}`;
    const hash=await sha256(await(await request.get(`/app/${url}`)).body());expect(hash).toBe(m.modelSha256);results.push({profile:profile.id,id:m.id,reference:m.reference,url,hash});
  }
  expect(results).toHaveLength(49);await mkdir(output,{recursive:true});await writeFile(`${output}/assets.json`,JSON.stringify({results},null,2));
});

test("partial third-floor metadata cannot select an older compatible profile",async({page})=>{
  await page.route("**/buildings",async r=>{const response=await r.fetch(),data=await response.json();await r.fulfill({json:data.map((p:{floor:number})=>p.floor===3 ? {...p,elevation_m:null}:p)});});
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","incompatible");await expect(page.locator("#follow")).toBeDisabled();
});

test("unreviewed third-floor GLB fails closed and recovers on retry",async({page,request})=>{
  const manifest=await(await request.get("/app/models/campus-manifest.json")).json(),profile=manifest.profiles.find((p:{id:string})=>p.id==="ucc-three-floors-c16"),model=profile.models.find((m:{id:string})=>m.id==="ucc-third-floor");
  const second=profile.models.find((m:{floors:number[]})=>m.floors.includes(2)),wrongResponse=await request.get(`/app/${second.model}`);expect(wrongResponse.ok()).toBe(true);const wrong=await wrongResponse.body();
  await page.route(`**/${model.model}`,r=>r.fulfill({body:wrong,contentType:"model/gltf-binary"}));
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile",profile.id);await expect(page.locator("#model-status")).toHaveAttribute("data-view","campus");await page.locator("#isometric").click();await page.locator("#floor").selectOption("3");
  await expect(page.locator("#model-status")).toHaveAttribute("title",/Model export changed/);await expect(page.locator("#model-status")).not.toHaveClass(/verified/);
  const before=await page.locator("#travel-status").getAttribute("data-position");await page.locator("canvas").focus();await page.keyboard.down("w");await page.waitForTimeout(100);await page.keyboard.up("w");expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(before);
  const rejected=await page.locator("#model-status").getAttribute("title");
  await page.unroute(`**/${model.model}`);await page.reload();await expect(page.locator("#model-status")).toHaveAttribute("data-view","campus");await page.locator("#isometric").click();await page.locator("#floor").selectOption("3");await expect(page.locator("#model-status")).toContainText("3 references aligned");await expect(page.locator("#model-status")).toHaveClass(/verified/);
  await mkdir(output,{recursive:true});await writeFile(`${output}/wrong-model.json`,JSON.stringify({profile:profile.id,substitution:"floor2 GLB at floor3 URL",rejected,blockedMovementPosition:before,recovered:await page.locator("#model-status").innerText()},null,2));
});

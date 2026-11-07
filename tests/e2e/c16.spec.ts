import { expect } from "@playwright/test";
import { mkdir,writeFile } from "node:fs/promises";
import { sha256 } from "../../src/scene/modelManifest.ts";
import { test } from "./isolated-campus.ts";

test.use({campusProfile:"ucc-two-floors-c15"});
const phase=process.env.UNINAV_C16_PHASE ?? "after",output=process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/c16";
test("C16 inspection preserves actor position and keeps upper floors non-navigable",async({page,request})=>{
  test.setTimeout(120000);await mkdir(output,{recursive:true});
  const manifest=await(await request.get("/app/models/campus-manifest.json")).json(),profile=manifest.profiles.find((p:{id:string})=>p.id==="ucc-two-floors-c15");
  const reviewed=[];
  for(const m of profile.models.filter((m:{floors:number[]})=>m.floors.some(f=>f>=1 && f<=5))){
    const url=m.model ?? `models/floor-${m.floors[0]}/campus.glb`;const hash=await sha256(await(await request.get(`/app/${url}`)).body());expect(hash).toBe(m.modelSha256);
    if(phase==="after"){expect(m.modelSource.commit).toBe("002aaec");expect(url).toContain("models/c16/");}
    reviewed.push({id:m.id,url,hash,source:m.modelSource ?? {commit:m.sourceCommit,reference:m.reference}});
  }
  const places=await(await request.get("/buildings")).json() as {floor:number}[];expect(places).toHaveLength(68);expect(places.every(p=>p.floor<=2)).toBe(true);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-two-floors-c15");await page.locator("#isometric").click();
  const position=await page.locator("#travel-status").getAttribute("data-position"),origins=await page.locator("#origin option").count(),views=[];
  for(const floor of [3,4,5]){
    const id=`ucc-floor-${floor}-preview`,entry=profile.models.find((m:{id:string})=>m.id===id);expect(entry.navigable).toBe(false);expect(entry.binding).toBeUndefined();
    await page.locator("#floor").selectOption(String(floor));await expect(page.locator("#model-status")).toContainText("3 structural references aligned");await expect(page.locator("#model-status")).toHaveAttribute("data-visible-models",JSON.stringify([id]));
    const colliders=await page.locator("#model-status").getAttribute("data-colliders");await page.locator("canvas").focus();await page.keyboard.down("w");await page.waitForTimeout(150);await page.keyboard.up("w");
    expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(position);expect(await page.locator("#origin option").count()).toBe(origins);expect(await page.locator('#destination-floor option[value="3"]').count()).toBe(0);
    await page.locator("#isometric").click();await page.screenshot({path:`${output}/${phase}-floor-${floor}-3d.png`});await page.locator("#top-view").click();await page.screenshot({path:`${output}/${phase}-floor-${floor}-top.png`});
    views.push({floor,position,colliders,visible:[id],navigable:false});
  }
  await page.locator("#floor").selectOption("1");await expect(page.locator("#model-status")).toHaveAttribute("data-loaded-models",'["ucc-first-floor"]');expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(position);expect(errors).toEqual([]);
  await writeFile(`${output}/${phase}-inspection.json`,JSON.stringify({phase,profile:profile.id,reviewed,places:places.length,position,origins,views,errors},null,2));
});

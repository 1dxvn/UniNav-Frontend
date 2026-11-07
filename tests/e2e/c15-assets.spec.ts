import { expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { mkdir,writeFile } from "node:fs/promises";
import { test } from "./isolated-campus.ts";
import type { Building,RouteResponse } from "../../src/api/types.ts";

test.use(process.env.UNINAV_C15_STARTUP==="1" ? {campusProfile:"ucc-two-floors-c15"}:{navigationDataset:["ucc-first-floor-c15.json","ucc-second-floor-c15.json"].map(p=>fileURLToPath(new URL(`../../../data/datasets/${p}`,import.meta.url)))});
test("C15 refuses the flat legacy export even when its old reference anchors still align",async({page,request})=>{
  const bytes=await(await request.get("/app/models/campus.glb")).body();
  const manifest=await(await request.get("/app/models/campus-manifest.json")).json(),profile=manifest.profiles.find((p:{id:string})=>p.id==="ucc-two-floors-c15"),first=profile.models.find((m:{id:string})=>m.id==="ucc-first-floor");
  await page.route(`**/${first.model}`,r=>r.fulfill({body:bytes,contentType:"model/gltf-binary"}));
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("title",/Model export changed/);await expect(page.locator("#model-status")).not.toHaveClass(/verified/);
  const before=await page.locator("#travel-status").getAttribute("data-position");
  await page.locator("canvas").focus();await page.keyboard.down("w");await page.waitForTimeout(200);await page.keyboard.up("w");
  expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(before);await expect(page.locator("#follow")).toBeDisabled();
  const output=process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/c15";await mkdir(output,{recursive:true});await writeFile(`${output}/wrong-model.json`,JSON.stringify({modelSubstitution:"legacy flat GLB in C15 URL",status:await page.locator("#model-status").innerText(),before,after:await page.locator("#travel-status").getAttribute("data-position")},null,2));
});

test("C15 keyboard approach follows Site and slab in both directions",async({page,request})=>{
  test.setTimeout(240000);const output=process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/c15";
  const places=await(await request.get("/buildings")).json() as Building[],points=["p01","p02","p03"].map(c=>places.find(p=>p.code===`ucc:floor1:${c}`)!);
  const login=await request.post("/auth/login",{data:{username:"student",password:"demo1234"}}),token=(await login.json()).access_token as string;
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-two-floors-c15");await page.locator("#origin").selectOption(String(points[0].id));
  const position=async()=>(await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number),runs=[];
  for(const reverse of [false,true]){
    const route=reverse ? [...points].reverse():points;
    const response=await request.post("/routes/calculate",{headers:{Authorization:`Bearer ${token}`},data:{origin_id:route[0].id,destination_id:route.at(-1)!.id}});expect(response.status()).toBe(200);const api=await response.json() as RouteResponse;
    expect(api.steps.every(s=>s.kind==="outdoor")).toBe(true);
    await page.evaluate(()=>{const e=document.getElementById("travel-status")!,w=window as unknown as {outdoorSamples:unknown[];outdoorObserver?:MutationObserver};w.outdoorObserver?.disconnect();w.outdoorSamples=[];w.outdoorObserver=new MutationObserver(()=>w.outdoorSamples.push({position:e.dataset.position,floor:document.querySelector<HTMLSelectElement>("#floor")!.value,state:e.dataset.state}));w.outdoorObserver.observe(e,{attributes:true,attributeFilter:["data-position"]});});
    const arrivals=[];
    for(const [index,target] of route.slice(1).entries()){
      const start=route[index],vx=target.x-start.x,vz=-target.y+start.y,length=Math.hypot(vx,vz);let stalled=0;
      for(let guard=0;;guard++){
        const p=await position(),distance=Math.hypot(target.x-p[0],-target.y-p[2]);if(distance<.065)break;if(guard>700 || stalled>30)throw new Error(`Outdoor keyboard stalled: ${p} -> ${target.name}`);
        const progress=Math.max(0,Math.min(1,((p[0]-start.x)*vx+(p[2]+start.y)*vz)/(length*length)));
        const ahead=Math.min(1,progress+.22/length),dx=start.x+vx*ahead-p[0],dz=-start.y+vz*ahead-p[2];
        const scale=Math.max(Math.abs(dx),Math.abs(dz));await page.locator("canvas").focus();
        // Follow a nearby point on the API centre line; aiming only at the distant
        // endpoint lets frame-quantized axis pulses drift sideways into glass.
        for(const [d,positive,negative] of [[dx,"d","a"],[dz,"s","w"]] as const)if(Math.abs(d)>.018){const key=d>0 ? positive:negative;await page.keyboard.down(key);await page.waitForTimeout(Math.max(12,Math.min(28,Math.abs(d)/scale*28)));await page.keyboard.up(key);}
        const after=await position();stalled=Math.hypot(after[0]-p[0],after[2]-p[2])<.001 ? stalled+1:0;
      }
      const p=await position(),error=Math.hypot(p[0]-target.x,p[1]-target.elevation_m!,p[2]+target.y);expect(error).toBeLessThan(.07);expect(await page.locator("#floor").inputValue()).toBe("1");arrivals.push({code:target.code,position:p,error});
    }
    const samples=await page.evaluate(()=>(window as unknown as {outdoorSamples:unknown[]}).outdoorSamples);runs.push({reverse,route:api,arrivals,samples});
  }
  await mkdir(output,{recursive:true});await writeFile(`${output}/outdoor-manual.json`,JSON.stringify({profile:"ucc-two-floors-c15",runs},null,2));
});

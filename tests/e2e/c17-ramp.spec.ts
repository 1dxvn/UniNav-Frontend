import { expect,type Page } from "@playwright/test";
import { mkdir,writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dataFingerprint,sha256,type CampusManifest } from "../../src/scene/modelManifest.ts";
import type { Building,CampusPath,RouteResponse } from "../../src/api/types.ts";
import { test } from "./isolated-campus.ts";
const output=process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/c17/ramp";
const dataset=(file:string)=>fileURLToPath(new URL(`../../../data/datasets/${file}`,import.meta.url));
const fixture=fileURLToPath(new URL("../fixtures/c17-ramp.json",import.meta.url));
async function pos(page:Page){return (await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number);}
async function observe(page:Page){await page.evaluate(()=>{const p=document.getElementById("travel-status")!,w=window as unknown as {rampSamples:unknown[];rampObserver?:MutationObserver};w.rampObserver?.disconnect();w.rampSamples=[];w.rampObserver=new MutationObserver(()=>w.rampSamples.push({position:p.dataset.position,floor:document.querySelector<HTMLSelectElement>("#floor")!.value,state:p.dataset.state}));w.rampObserver.observe(p,{attributes:true,attributeFilter:["data-position"]});});}
async function samples(page:Page){return page.evaluate(()=>(window as unknown as {rampSamples:unknown[]}).rampSamples);}
for(const [id,third] of [["ucc-two-floors-c15",false],["ucc-three-floors-c16",true]] as const)test.describe(id,()=>{
  test.use({navigationDataset:[dataset("ucc-first-floor-c15.json"),dataset("ucc-second-floor-c15.json"),...(third ? [dataset("ucc-third-floor.json")]:[]),fixture]});
  test("real C17 ramp supports guided and keyboard round trips, pause and replan",async({page,request})=>{
    test.setTimeout(120000);await mkdir(output,{recursive:true});
    const places=await(await request.get("/buildings")).json() as Building[],paths=await(await request.get("/paths")).json() as CampusPath[],manifest=await(await request.get("/app/models/campus-manifest.json")).json() as CampusManifest;
    const profile=structuredClone(manifest.profiles!.find(p=>p.id===id)!);profile.id=`test-c17-${third ? "three":"two"}`;
    for(const m of profile.models.filter(m=>m.kind==="floor")){
      const names=places.filter(p=>m.floors.includes(p.floor) && p.name!=="Isolated test destination").map(p=>p.name);
      m.binding={placeNames:names,sha256:await dataFingerprint(names,places,paths)};
    }
    manifest.profiles=[profile];await page.route("**/app/models/campus-manifest.json",r=>r.fulfill({json:manifest}));
    const model=profile.models.find(m=>m.floors.includes(2))!;expect(model.modelSource?.commit).toBe("0f6a862");expect(await sha256(await(await request.get(`/app/${model.model}`)).body())).toBe(model.modelSha256);
    const points=places.filter(p=>p.code?.startsWith("test:c17-ramp:p")).sort((a,b)=>a.code!.localeCompare(b.code!)),a=points[0],b=points.at(-1)!;expect(points).toHaveLength(6);
    const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile",profile.id);await expect(page.locator("#model-status")).toHaveAttribute("data-view","campus");await page.locator("#isometric").click();
    await page.locator("#open-login").click();await page.getByLabel("Username",{exact:true}).fill("student");await page.getByLabel("Password",{exact:true}).fill("demo1234");await page.locator("#login-submit").click();await expect(page.locator("#session-user")).toHaveText("student");
    await page.locator("#origin").selectOption(String(a.id));await page.locator("#avoid-stairs").check();
    const calculate=async(dest:Building)=>{await page.locator("#search").fill(dest.name);await page.locator("#place-list button").first().click();const pending=page.waitForResponse(r=>r.url().endsWith("/routes/calculate"));await page.locator("#calculate").click();const response=await pending;expect(response.status()).toBe(200);const route=await response.json() as RouteResponse;expect(route.steps.every(s=>s.kind==="ramp")).toBe(true);await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");return route;};
    const guided=[];
    for(const dest of [b,a]){const route=await calculate(dest);await observe(page);await page.locator("#follow").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","arrived");const p=await pos(page),error=Math.hypot(p[0]-dest.x,p[1]-dest.elevation_m!,p[2]+dest.y);expect(error).toBeLessThan(.002);guided.push({route,position:p,error,samples:await samples(page)});}
    await page.locator("canvas").focus();await page.keyboard.press("Escape");await page.locator("#origin").selectOption(String(a.id));await observe(page);const manual=[];
    for(const dest of [b,a]){
      for(let guard=0;;guard++){const p=await pos(page),dz=-dest.y-p[2];if(Math.abs(dz)<.04)break;if(guard>100)throw new Error(`Keyboard ramp stalled: ${p}`);const key=dz>0 ? "s":"w";await page.locator("canvas").focus();await page.keyboard.down(key);await page.waitForTimeout(Math.max(12,Math.min(35,Math.abs(dz)/3*600)));await page.keyboard.up(key);}
      const p=await pos(page),error=Math.hypot(p[0]-dest.x,p[1]-dest.elevation_m!,p[2]+dest.y);expect(error).toBeLessThan(.05);expect(await page.locator("#floor").inputValue()).toBe("2");manual.push({position:p,error});
    }
    const manualSamples=await samples(page);await page.locator("#origin").selectOption(String(a.id));const initialRoute=await calculate(b);await observe(page);await page.locator("#follow").click();await expect.poll(async()=>(await pos(page))[1],{intervals:[10]}).toBeLessThan(6.40);await page.locator("#follow").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","paused");const paused=await pos(page);expect(paused[1]).toBeGreaterThan(6.20);expect(paused[1]).toBeLessThan(6.40);await page.waitForTimeout(150);expect(await pos(page)).toEqual(paused);
    await page.locator("canvas").focus();await page.keyboard.down("w");await page.waitForTimeout(40);await page.keyboard.up("w");await expect(page.locator("#travel-status")).toHaveAttribute("data-state","idle");const retained=await pos(page),beforeReplan=await samples(page),route=await calculate(b);expect(await pos(page)).toEqual(retained);await observe(page);await page.locator("#follow").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","arrived");
    const playback=await samples(page);expect(errors).toEqual([]);
    await writeFile(`${output}/${id}.json`,JSON.stringify({fixtureOnly:true,productionDataProfile:id,testProfile:profile.id,source:model.modelSource,hash:model.modelSha256,scope:"Actual temporary FastAPI; only test ramp data bindings are overridden, GLB and references are shipped resources. No public ramp edge, room or accessibility status is added.",guided,manual,manualSamples,initialRoute,beforeReplan,paused,retained,route,playback,finalPosition:await pos(page),errors},null,2));
    await page.screenshot({path:`${output}/${id}.png`});
  });
});

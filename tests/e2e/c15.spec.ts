import { expect,type Page } from "@playwright/test";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { sha256 } from "../../src/scene/modelManifest.ts";
import type { Building,RouteResponse } from "../../src/api/types.ts";
import { test } from "./isolated-campus.ts";

const output=process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/c15";
const datasets=["ucc-first-floor-c15.json","ucc-second-floor-c15.json"].map(p=>fileURLToPath(new URL(`../../../data/datasets/${p}`,import.meta.url)));
const launcher=process.env.UNINAV_C15_STARTUP==="1";
test.use(launcher ? {campusProfile:"ucc-two-floors-c15"}:{navigationDataset:datasets});
const codes=["ucc:floor1:p06","ucc:floor1:p13","ucc:floor1:p10","ucc:floor1:p14","ucc:f2:mixed-reality-entrance","ucc:f2:molecular-biology-entrance","ucc:f2:medical-research-arrival"];
async function pos(page:Page){return (await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number);}
async function login(page:Page){await page.locator("#open-login").click();await page.getByLabel("Username",{exact:true}).fill("student");await page.getByLabel("Password",{exact:true}).fill("demo1234");await page.locator("#login-submit").click();await expect(page.locator("#session-user")).toHaveText("student");}
async function target(page:Page,p:Building){await page.locator("#search").fill(p.display_name ?? p.name);await page.locator("#place-list button").first().click();}
async function observe(page:Page){await page.evaluate(()=>{const p=document.getElementById("travel-status")!,w=window as unknown as {c15Samples:unknown[];c15Observer?:MutationObserver};w.c15Observer?.disconnect();w.c15Samples=[];w.c15Observer=new MutationObserver(()=>w.c15Samples.push({position:p.dataset.position,floor:document.querySelector<HTMLSelectElement>("#floor")!.value,state:p.dataset.state}));w.c15Observer.observe(p,{attributes:true,attributeFilter:["data-position"]});});}
async function samples(page:Page){return page.evaluate(()=>(window as unknown as {c15Samples:unknown[]}).c15Samples);}

for(const code of codes)test(`C15 shipped profile: ${code} round trip`,async({page,request})=>{
  test.setTimeout(300000);await mkdir(output,{recursive:true});
  const manifest=await(await request.get("/app/models/campus-manifest.json")).json(),profile=manifest.profiles.find((p:{id:string})=>p.id==="ucc-two-floors-c15");
  const models=[];
  for(const m of profile.models.filter((m:{modelSource?:unknown})=>m.modelSource)){
    const bytes=await(await request.get(`/app/${m.model}`)).body(),hash=await sha256(bytes);expect(hash).toBe(m.modelSha256);models.push({url:m.model,hash,source:m.modelSource});
  }
  const places=await(await request.get("/buildings")).json() as Building[],destination=places.find(p=>p.code===code)!,entry=places.find(p=>p.code==="ucc:floor1:p01")!;
  expect(places).toHaveLength(launcher ? 68:69);const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-two-floors-c15");await expect(page.locator("#model-status")).toContainText("3 references aligned");await login(page);
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
  expect(errors).toEqual([]);await writeFile(`${output}/${code.split(":").at(-1)}-walks.json`,JSON.stringify({profile:profile.id,models,scope:launcher ? "production scripts.run_campus launcher and versioned profile on an isolated database; shipped manifest without overrides":"isolated FastAPI with two scoped C15 revisions and shipped manifest; no browser model overrides",runs,errors},null,2));
});

test("C15 selects new stair restrictions, preserves clear hall approach and fails closed on partial data",async({page,request})=>{
  const places=await(await request.get("/buildings")).json() as Building[],entry=places.find(p=>p.code==="ucc:floor1:p01")!;
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-two-floors-c15");await login(page);
  await page.locator("#avoid-stairs").check();const results=[];
  for(const code of codes){const dest=places.find(p=>p.code===code)!;await page.locator("#origin").selectOption(String(entry.id));await target(page,dest);
    const response=page.waitForResponse(r=>r.url().endsWith("/routes/calculate"));await page.locator("#calculate").click();const status=(await response).status();results.push({code,status});
    if(code.endsWith("p06")){expect(status).toBe(200);await expect(page.locator("#follow")).toBeEnabled();}
    else{expect(status).toBe(404);await expect(page.locator("#follow")).toBeDisabled();}
  }
  const last=places.find(p=>p.code==="ucc:floor1:p09")!,icetex=places.find(p=>p.code==="ucc:floor1:p06")!;
  // Internal waypoints stay hidden from destination search. Start at the reviewed
  // before-point and ask for ICETEX through the clear e08 approach instead.
  await page.locator("#origin").selectOption(String(last.id));await target(page,icetex);await page.locator("#calculate").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");
  expect(await pos(page)).toEqual([28,3.5,-47.6]);await expect(page.locator("#follow")).toBeEnabled();
  await page.route("**/buildings",async r=>{const response=await r.fetch();const data=await response.json() as Building[];await r.fulfill({json:data.map(p=>({...p,elevation_m:null}))});});
  await page.reload();await expect(page.locator("#model-status")).toHaveAttribute("data-profile","incompatible");
  await mkdir(output,{recursive:true});await writeFile(`${output}/restrictions.json`,JSON.stringify({results,clearApproachStart:[28,3.5,-47.6],clearApproachRoute:"ICETEX ready with Avoid stairs enabled",partialMetadataProfile:"incompatible"},null,2));
});

test("C15 supports keyboard hall and vertical stairs, pause/replan and repeated floor views",async({page,request})=>{
  test.setTimeout(240000);await mkdir(output,{recursive:true});
  await page.addInitScript(()=>{const buffers=new Set<WebGLBuffer>(),textures=new Set<WebGLTexture>(),counts={buffers:0,textures:0};(window as unknown as {c15Gpu:typeof counts}).c15Gpu=counts;
    const p=WebGL2RenderingContext.prototype,cb=p.createBuffer,db=p.deleteBuffer,ct=p.createTexture,dt=p.deleteTexture;
    p.createBuffer=function(){const b=cb.call(this);if(b)buffers.add(b);counts.buffers=buffers.size;return b;};p.deleteBuffer=function(b){if(b)buffers.delete(b);counts.buffers=buffers.size;db.call(this,b);};
    p.createTexture=function(){const t=ct.call(this);if(t)textures.add(t);counts.textures=textures.size;return t;};p.deleteTexture=function(t){if(t)textures.delete(t);counts.textures=textures.size;dt.call(this,t);};});
  const places=await(await request.get("/buildings")).json() as Building[];
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-two-floors-c15");await login(page);
  const hallData=JSON.parse(await readFile(datasets[0],"utf8")),upperData=JSON.parse(await readFile(datasets[1],"utf8"));
  const hall=[hallData.places.find((p:Building)=>p.code==="ucc:floor1:p09"),...hallData.places.filter((p:Building)=>p.code!.startsWith("ucc:floor1:hall-"))] as Building[];
  const stair=upperData.places.filter((p:Building)=>p.code!.startsWith("ucc:f2:east-stair-")) as Building[],manual=[];
  for(const [name,points] of [["hall",hall],["vertical",stair]] as const){
    const bottom=places.find(p=>p.code===points[0].code)!;await page.locator("#origin").selectOption(String(bottom.id));await observe(page);const arrivals=[];
    for(const direction of ["forward","reverse"]){const route=direction==="forward" ? points:[...points].reverse();
      for(const dest of route.slice(1))for(let guard=0;;guard++){
        const p=await pos(page),dx=dest.x-p[0],dz=-dest.y-p[2],distance=Math.hypot(dx,dz);if(distance<0.065)break;if(guard>100)throw new Error(`Keyboard ${name} stalled at ${dest.name}: ${p}`);
        const keys=[];if(Math.abs(dx)>0.035)keys.push(dx>0 ? "d":"a");if(Math.abs(dz)>0.035)keys.push(dz>0 ? "s":"w");
        await page.locator("canvas").focus();for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(Math.max(12,Math.min(60,distance/3*600)));for(const k of keys)await page.keyboard.up(k);
      }
      const dest=route.at(-1)!,p=await pos(page),error=Math.hypot(p[0]-dest.x,p[1]-dest.elevation_m!,p[2]+dest.y);expect(error).toBeLessThan(0.07);expect(await page.locator("#floor").inputValue()).toBe(String(dest.floor));arrivals.push({direction,position:p,error});
    }
    manual.push({name,arrivals,samples:await samples(page)});
  }
  const bottom=places.find(p=>p.code===stair[0].code)!,top=places.find(p=>p.code==="ucc:f2:molecular-biology-entrance")!;
  await page.locator("#origin").selectOption(String(bottom.id));await target(page,top);await page.locator("#calculate").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");await observe(page);
  await page.locator("#follow").click();await page.waitForTimeout(650);await page.locator("#follow").click();const paused=await pos(page);await expect(page.locator("#travel-status")).toHaveAttribute("data-state","paused");await page.waitForTimeout(200);expect(await pos(page)).toEqual(paused);
  await page.locator("canvas").focus();await page.keyboard.down("d");await page.waitForTimeout(60);await page.keyboard.up("d");await expect(page.locator("#travel-status")).toHaveAttribute("data-state","idle");
  const beforeReplan=await pos(page);await page.locator("#calculate").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");expect(await pos(page)).toEqual(beforeReplan);await page.locator("#follow").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","arrived",{timeout:45000});
  const playback=await samples(page);await page.locator("canvas").focus();await page.keyboard.press("Escape");
  const loaded=async()=>JSON.parse((await page.locator("#model-status").getAttribute("data-loaded-models"))!).sort(),counts=()=>page.evaluate(()=>({...((window as unknown as {c15Gpu:Record<string,number>}).c15Gpu)}));
  await expect.poll(loaded).toEqual(["ucc-second-floor"]);const baseline=await counts(),cycles=[];
  for(let i=0;i<2;i++){for(const f of ["0","1","3","4","5","2"]){await page.locator("#floor").selectOption(f);await expect.poll(async()=>String(await loaded())).toContain(f==="2" ? "ucc-second-floor":f==="1" ? "ucc-first-floor":`ucc-floor-${f}`);}
    await expect.poll(loaded).toEqual(["ucc-second-floor"]);await page.waitForTimeout(200);const now=await counts();cycles.push(now);expect(now.buffers).toBeLessThanOrEqual(baseline.buffers+8);expect(now.textures).toBeLessThanOrEqual(baseline.textures+2);}
  const metrics=await page.evaluate(async()=>{const gl=document.querySelector("canvas")!.getContext("webgl2")!,info=gl.getExtension("WEBGL_debug_renderer_info"),frames:number[]=[];await new Promise<void>(resolve=>{let start=0,last=0;const f=(t:number)=>{if(!start)start=t;if(last)frames.push(t-last);last=t;if(t-start<3000)requestAnimationFrame(f);else resolve();};requestAnimationFrame(f);});return {renderer:String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL:gl.RENDERER)),averageFps:1000*frames.length/frames.reduce((a,b)=>a+b,0)};});
  if(process.env.UNINAV_REQUIRE_FPS==="1"){expect(metrics.renderer).not.toMatch(/swiftshader|software|llvmpipe/i);expect(metrics.averageFps).toBeGreaterThanOrEqual(30);}
  await writeFile(`${output}/interaction.json`,JSON.stringify({manual,paused,beforeReplan,playback,finalPosition:await pos(page),baseline,cycles,metrics},null,2));await page.screenshot({path:`${output}/upper-view.png`});
});

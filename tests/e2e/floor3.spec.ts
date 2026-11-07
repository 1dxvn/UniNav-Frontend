import { expect,type Page } from "@playwright/test";
import { mkdir,writeFile } from "node:fs/promises";
import { sha256 } from "../../src/scene/modelManifest.ts";
import type { Building,RouteResponse } from "../../src/api/types.ts";
import { test } from "./isolated-campus.ts";
const output=process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/floor3";
const launcher=true;
test.use({campusProfile:"ucc-three-floors-c16"});
const codes=[1,2,3].map(n=>`ucc:f3:computer-lab-${n}-entrance`);
async function pos(page:Page){return (await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number);}
async function login(page:Page){await page.locator("#open-login").click();await page.getByLabel("Username",{exact:true}).fill("student");await page.getByLabel("Password",{exact:true}).fill("demo1234");await page.locator("#login-submit").click();await expect(page.locator("#session-user")).toHaveText("student");}
async function target(page:Page,p:Building){await page.locator("#search").fill(p.display_name ?? p.name);await page.locator("#place-list button").first().click();}
async function observe(page:Page){await page.evaluate(()=>{const p=document.getElementById("travel-status")!,w=window as unknown as {c15Samples:unknown[];c15Observer?:MutationObserver};w.c15Observer?.disconnect();w.c15Samples=[];w.c15Observer=new MutationObserver(()=>w.c15Samples.push({position:p.dataset.position,floor:document.querySelector<HTMLSelectElement>("#floor")!.value,state:p.dataset.state}));w.c15Observer.observe(p,{attributes:true,attributeFilter:["data-position"]});});}
async function samples(page:Page){return page.evaluate(()=>(window as unknown as {c15Samples:unknown[]}).c15Samples);}

for(const code of codes)test(`Floor 3 shipped profile: ${code} round trip`,async({page,request})=>{
  test.setTimeout(300000);await mkdir(output,{recursive:true});
  const manifest=await(await request.get("/app/models/campus-manifest.json")).json(),profile=manifest.profiles.find((p:{id:string})=>p.id==="ucc-three-floors-c16");
  const models=[];
  for(const m of profile.models.filter((m:{modelSource?:unknown})=>m.modelSource)){
    const bytes=await(await request.get(`/app/${m.model}`)).body(),hash=await sha256(bytes);expect(hash).toBe(m.modelSha256);models.push({url:m.model,hash,source:m.modelSource});
  }
  const places=await(await request.get("/buildings")).json() as Building[],destination=places.find(p=>p.code===code)!,entry=places.find(p=>p.code==="ucc:floor1:p01")!;
  expect(places).toHaveLength(110);const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-three-floors-c16");await expect(page.locator("#model-status")).toContainText("3 references aligned");await login(page);
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
  expect(errors).toEqual([]);await writeFile(`${output}/${code.split(":").at(-1)}-walks.json`,JSON.stringify({profile:profile.id,models,scope:launcher ? "production three-floor scripts.run_campus launcher on an isolated database; shipped manifest without overrides":"isolated FastAPI with two scoped C15 revisions and shipped manifest; no browser model overrides",runs,errors},null,2));
});

test("floor 3 keeps keyboard support, stair floor metadata, pause and replan",async({page,request})=>{
  test.setTimeout(240000);await mkdir(output,{recursive:true});
  await page.addInitScript(()=>{const buffers=new Set<WebGLBuffer>(),textures=new Set<WebGLTexture>(),counts={buffers:0,textures:0};(window as unknown as {c15Gpu:typeof counts}).c15Gpu=counts;
    const p=WebGL2RenderingContext.prototype,cb=p.createBuffer,db=p.deleteBuffer,ct=p.createTexture,dt=p.deleteTexture;
    p.createBuffer=function(){const b=cb.call(this);if(b)buffers.add(b);counts.buffers=buffers.size;return b;};p.deleteBuffer=function(b){if(b)buffers.delete(b);counts.buffers=buffers.size;db.call(this,b);};
    p.createTexture=function(){const t=ct.call(this);if(t)textures.add(t);counts.textures=textures.size;return t;};p.deleteTexture=function(t){if(t)textures.delete(t);counts.textures=textures.size;dt.call(this,t);};});
  const places=await(await request.get("/buildings")).json() as Building[],stair=places.filter(p=>p.code?.startsWith("ucc:f3:east-stair-"));expect(stair).toHaveLength(25);
  stair.sort((a,b)=>a.code!.localeCompare(b.code!));
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-three-floors-c16");await login(page);
  await page.locator("#isometric").click();await page.locator("#origin").selectOption(String(stair[0].id));await observe(page);const arrivals=[];
  for(const direction of ["forward","reverse"]){const points=direction==="forward" ? stair:[...stair].reverse();
    for(const dest of points.slice(1))for(let guard=0;;guard++){
      const p=await pos(page),dx=dest.x-p[0],dz=-dest.y-p[2],distance=Math.hypot(dx,dz);if(distance<.065)break;if(guard>100)throw new Error(`Keyboard stair stalled at ${dest.name}: ${p}`);
      const keys=[];if(Math.abs(dx)>.035)keys.push(dx>0 ? "d":"a");if(Math.abs(dz)>.035)keys.push(dz>0 ? "s":"w");
      await page.locator("canvas").focus();for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(Math.max(12,Math.min(60,distance/3*600)));for(const k of keys)await page.keyboard.up(k);
    }
    const dest=points.at(-1)!,p=await pos(page),error=Math.hypot(p[0]-dest.x,p[1]-dest.elevation_m!,p[2]+dest.y);expect(error).toBeLessThan(.07);expect(await page.locator("#floor").inputValue()).toBe(String(dest.floor));arrivals.push({direction,position:p,error});
  }
  const manual=[{name:"floor2-3 east stair",arrivals,samples:await samples(page)}];
  const dest=places.find(p=>p.code===codes[0])!;
  await page.locator("#origin").selectOption(String(stair[0].id));await target(page,dest);const initialResponse=page.waitForResponse(r=>r.url().endsWith("/routes/calculate"));await page.locator("#calculate").click();const initialRoute=await(await initialResponse).json() as RouteResponse;await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");await observe(page);
  await page.locator("#follow").click();await page.waitForTimeout(650);await page.locator("#follow").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","paused");const paused=await pos(page);await page.waitForTimeout(200);expect(await pos(page)).toEqual(paused);
  await page.locator("canvas").focus();await page.keyboard.down("d");await page.waitForTimeout(60);await page.keyboard.up("d");await expect(page.locator("#travel-status")).toHaveAttribute("data-state","idle");const beforeReplan=await pos(page);
  const beforeReplanSamples=await samples(page),r=page.waitForResponse(r=>r.url().endsWith("/routes/calculate"));await page.locator("#calculate").click();const route=await(await r).json() as RouteResponse;await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");expect(await pos(page)).toEqual(beforeReplan);await observe(page);await page.locator("#follow").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","arrived",{timeout:45000});
  const playback=await samples(page);await page.locator("canvas").focus();await page.keyboard.press("Escape");
  const loaded=async()=>JSON.parse((await page.locator("#model-status").getAttribute("data-loaded-models"))!).sort(),counts=()=>page.evaluate(()=>({...((window as unknown as {c15Gpu:Record<string,number>}).c15Gpu)}));
  await expect.poll(loaded).toEqual(["ucc-third-floor"]);const baseline=await counts(),cycles=[];
  for(let i=0;i<2;i++){
    for(const f of ["0","1","2","4","5","3"]){await page.locator("#floor").selectOption(f);await expect.poll(async()=>String(await loaded())).toContain(f==="3" ? "ucc-third-floor":f==="2" ? "ucc-second-floor":f==="1" ? "ucc-first-floor":`ucc-floor-${f}`);
      if(["4","5"].includes(f)){const before=await pos(page);await page.locator("canvas").focus();await page.keyboard.down("w");await page.waitForTimeout(80);await page.keyboard.up("w");expect(await pos(page)).toEqual(before);}
    }
    await expect.poll(loaded).toEqual(["ucc-third-floor"]);await page.waitForTimeout(200);const now=await counts();cycles.push(now);expect(now.buffers).toBeLessThanOrEqual(baseline.buffers+8);expect(now.textures).toBeLessThanOrEqual(baseline.textures+2);
  }
  const metrics=await page.evaluate(async()=>{const gl=document.querySelector("canvas")!.getContext("webgl2")!,info=gl.getExtension("WEBGL_debug_renderer_info"),frames:number[]=[];await new Promise<void>(resolve=>{let start=0,last=0;const f=(t:number)=>{if(!start)start=t;if(last)frames.push(t-last);last=t;if(t-start<3000)requestAnimationFrame(f);else resolve();};requestAnimationFrame(f);});return {renderer:String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL:gl.RENDERER)),averageFps:1000*frames.length/frames.reduce((a,b)=>a+b,0)};});
  if(process.env.UNINAV_REQUIRE_FPS==="1"){expect(metrics.renderer).not.toMatch(/swiftshader|software|llvmpipe/i);expect(metrics.averageFps).toBeGreaterThanOrEqual(30);}
  await writeFile(`${output}/interaction.json`,JSON.stringify({manual,paused,beforeReplan,initialRoute,beforeReplanSamples,route,playback,finalPosition:await pos(page),baseline,cycles,metrics},null,2));await page.screenshot({path:`${output}/upper-view.png`});
});

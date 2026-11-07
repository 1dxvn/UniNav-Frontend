import { expect } from "@playwright/test";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Building } from "../../src/api/types.ts";
import { test } from "./isolated-campus.ts";

test.use({navigationDataset:fileURLToPath(new URL("../../../data/datasets/ucc-second-floor.json",import.meta.url))});
const output=process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/h2-profiles";
async function pos(page:import("@playwright/test").Page){return (await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number);}
async function login(page:import("@playwright/test").Page){
  await page.locator("#open-login").click();await page.getByLabel("Username",{exact:true}).fill("student");await page.getByLabel("Password",{exact:true}).fill("demo1234");await page.locator("#login-submit").click();await expect(page.locator("#session-user")).toHaveText("student");
}
test("partial API metadata rejects the expanded profile and cannot move through graph fallback",async({page})=>{
  const glbs:string[]=[];page.on("request",r=>{if(r.url().endsWith(".glb"))glbs.push(r.url());});
  await page.route("**/buildings",async r=>{const response=await r.fetch();const data=await response.json() as Building[];await r.fulfill({json:data.map(p=>({...p,elevation_m:null}))});});
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","incompatible");
  await expect(page.locator("#model-status")).not.toHaveClass(/verified/);expect(glbs).toEqual([]);
  await login(page);await page.locator("#search").fill("Mixed Reality");await page.locator("#place-list button").first().click();await page.locator("#calculate").click();
  await expect(page.locator("#route-error")).toContainText("navigation is pending");
  await page.locator("#floor").selectOption("1");const before=await pos(page);
  await page.locator("canvas").focus();await page.keyboard.down("w");await page.waitForTimeout(250);await page.keyboard.up("w");
  expect(await pos(page)).toEqual(before);await expect(page.locator("#follow")).toBeDisabled();
  await mkdir(output,{recursive:true});await writeFile(`${output}/rejected-contract.json`,JSON.stringify({profile:"incompatible",before,after:await pos(page),glbRequests:glbs},null,2));
});

test("shipped two-floor profile preserves pause/replan and releases models after floor inspection",async({page,request})=>{
  test.setTimeout(120000);await mkdir(output,{recursive:true});
  await page.addInitScript(()=>{
    const buffers=new Set<WebGLBuffer>(),textures=new Set<WebGLTexture>();
    const counts={liveBuffers:0,deletedBuffers:0,liveTextures:0,deletedTextures:0};(window as unknown as {profileGpu:typeof counts}).profileGpu=counts;
    const p=WebGL2RenderingContext.prototype,cb=p.createBuffer,db=p.deleteBuffer,ct=p.createTexture,dt=p.deleteTexture;
    p.createBuffer=function(){const b=cb.call(this);if(b)buffers.add(b);counts.liveBuffers=buffers.size;return b;};
    p.deleteBuffer=function(b){if(b && buffers.delete(b))counts.deletedBuffers++;counts.liveBuffers=buffers.size;db.call(this,b);};
    p.createTexture=function(){const t=ct.call(this);if(t)textures.add(t);counts.liveTextures=textures.size;return t;};
    p.deleteTexture=function(t){if(t && textures.delete(t))counts.deletedTextures++;counts.liveTextures=textures.size;dt.call(this,t);};
  });
  const places=await(await request.get("/buildings")).json() as Building[],bottom=places.find(p=>p.code==="ucc:f2:east-stair-00")!,target=places.find(p=>p.code==="ucc:f2:molecular-biology-entrance")!;
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-two-floors");await login(page);
  await page.locator("#origin").selectOption(String(bottom.id));
  const loaded=async()=>JSON.parse((await page.locator("#model-status").getAttribute("data-loaded-models"))!).sort();
  await expect.poll(loaded).toEqual(["ucc-first-floor","ucc-second-floor"]);
  await page.locator("#search").fill(target.display_name ?? target.name);await page.locator("#place-list button").first().click();await page.locator("#calculate").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");
  await page.evaluate(()=>{const e=document.getElementById("travel-status")!,w=window as unknown as {stairSamples:unknown[]};w.stairSamples=[];new MutationObserver(()=>w.stairSamples.push({position:e.dataset.position,floor:document.querySelector<HTMLSelectElement>("#floor")!.value,state:e.dataset.state})).observe(e,{attributes:true,attributeFilter:["data-position"]});});
  await page.locator("#follow").click();await page.waitForTimeout(650);await page.locator("#follow").click();const paused=await pos(page);
  await expect(page.locator("#travel-status")).toHaveAttribute("data-state","paused");expect(await page.locator("#floor").inputValue()).toBe("1");await page.waitForTimeout(200);expect(await pos(page)).toEqual(paused);
  await page.locator("canvas").focus();await page.keyboard.down("d");await page.waitForTimeout(60);await page.keyboard.up("d");await expect(page.locator("#travel-status")).toHaveAttribute("data-state","idle");await expect.poll(loaded).toEqual(["ucc-first-floor","ucc-second-floor"]);
  await page.locator("#calculate").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");await page.locator("#follow").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","arrived",{timeout:30000});
  expect(await pos(page)).toEqual([target.x,6.44,-target.y]);
  const samples=await page.evaluate(()=>(window as unknown as {stairSamples:unknown[]}).stairSamples);
  await writeFile(`${output}/two-floor-vertical-browser.json`,JSON.stringify({profile:"ucc-two-floors",paused,finalPosition:await pos(page),samples},null,2));
  await page.locator("canvas").focus();await page.keyboard.press("Escape");await expect.poll(loaded).toEqual(["ucc-second-floor"]);
  const counts=()=>page.evaluate(()=>({...((window as unknown as {profileGpu:Record<string,number>}).profileGpu)}));
  await page.waitForTimeout(200);const baseline=await counts(),cycles=[],position=await pos(page);
  for(let i=0;i<2;i++){
    await page.locator("#floor").selectOption("1");await expect.poll(loaded).toEqual(["ucc-first-floor","ucc-second-floor"]);expect(await pos(page)).toEqual(position);
    await page.locator("#floor").selectOption("2");await expect.poll(loaded).toEqual(["ucc-second-floor"]);await page.waitForTimeout(200);const after=await counts();cycles.push(after);
    expect(after.liveBuffers).toBeLessThanOrEqual(baseline.liveBuffers+8);expect(after.liveTextures).toBeLessThanOrEqual(baseline.liveTextures+2);expect(after.deletedBuffers).toBeGreaterThan(baseline.deletedBuffers);
  }
  const metrics=await page.evaluate(async()=>{
    const gl=document.querySelector("canvas")!.getContext("webgl2")!,info=gl.getExtension("WEBGL_debug_renderer_info"),frames:number[]=[];
    await new Promise<void>(resolve=>{let start=0,previous=0;const frame=(t:number)=>{if(!start)start=t;if(previous)frames.push(t-previous);previous=t;if(t-start<3000)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});
    const sorted=[...frames].sort((a,b)=>a-b);return {renderer:String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL:gl.RENDERER)),averageFps:1000*frames.length/frames.reduce((a,b)=>a+b,0),p95FrameMs:sorted[Math.floor(sorted.length*0.95)]};
  });
  if(process.env.UNINAV_REQUIRE_FPS==="1"){expect(metrics.renderer).not.toMatch(/swiftshader|software|llvmpipe/i);expect(metrics.averageFps).toBeGreaterThanOrEqual(30);}
  await writeFile(`${output}/two-floor-resources.json`,JSON.stringify({baseline,cycles,position,metrics},null,2));await page.screenshot({path:`${output}/two-floor-view.png`});
});

test("shipped two-floor profile supports a complete keyboard stair climb and descent",async({page,request})=>{
  test.setTimeout(120000);const data=JSON.parse(await readFile(new URL("../../../data/datasets/ucc-second-floor.json",import.meta.url),"utf8"));
  const points=data.places.filter((p:{code:string})=>p.code.startsWith("ucc:f2:east-stair-")) as Building[];
  const places=await(await request.get("/buildings")).json() as Building[],bottom=places.find(p=>p.code===points[0].code)!;
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-two-floors");await page.locator("#origin").selectOption(String(bottom.id));
  const samples=[],arrivals=[];
  for(const direction of ["up","down"]){const route=direction==="up" ? points:[...points].reverse();
    for(const target of route.slice(1))for(let guard=0;;guard++){
      const p=await pos(page),dx=target.x-p[0],dz=-target.y-p[2],distance=Math.hypot(dx,dz);if(distance<0.065)break;if(guard>100)throw new Error(`Manual stair stalled at ${target.name}: ${p}`);
      const keys=[];if(Math.abs(dx)>0.035)keys.push(dx>0 ? "d":"a");if(Math.abs(dz)>0.035)keys.push(dz>0 ? "s":"w");
      await page.locator("canvas").focus();for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(Math.max(12,Math.min(60,distance/3*600)));for(const k of keys)await page.keyboard.up(k);
      samples.push({direction,position:await pos(page),floor:await page.locator("#floor").inputValue()});
    }
    const actual=await pos(page),target=route.at(-1)!,error=Math.hypot(actual[0]-target.x,actual[1]-target.elevation_m!,actual[2]+target.y);expect(error).toBeLessThan(0.07);expect(await page.locator("#floor").inputValue()).toBe(direction==="up" ? "2":"1");arrivals.push({direction,position:actual,error});
  }
  await mkdir(output,{recursive:true});await writeFile(`${output}/two-floor-vertical-manual-browser.json`,JSON.stringify({profile:"ucc-two-floors",samples,arrivals},null,2));
});

import { expect,type Page } from "@playwright/test";
import { mkdir,writeFile } from "node:fs/promises";
import { Vector3 } from "three";
import { projectOnSegment } from "../../src/scene/navigation.ts";
import type { Building,RouteResponse } from "../../src/api/types.ts";
import { test } from "./isolated-campus.ts";
const output=process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/route-instructions";
async function pos(page:Page){return (await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number);}
async function login(page:Page){await page.locator("#open-login").click();await page.getByLabel("Username",{exact:true}).fill("student");await page.getByLabel("Password",{exact:true}).fill("demo1234");await page.locator("#login-submit").click();await expect(page.locator("#session-user")).toHaveText("student");}
async function target(page:Page,p:Building){await page.locator("#search").fill(p.display_name ?? p.name);await page.locator("#place-list button").first().click();}
async function calculate(page:Page){const pending=page.waitForResponse(r=>r.url().endsWith("/routes/calculate"));await page.locator("#calculate").click();const r=await pending;expect(r.status()).toBe(200);await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");return await r.json() as RouteResponse;}
async function observe(page:Page){await page.evaluate(()=>{const p=document.getElementById("travel-status")!,w=window as unknown as {instructionSamples:unknown[];instructionObserver?:MutationObserver};w.instructionObserver?.disconnect();w.instructionSamples=[];w.instructionObserver=new MutationObserver(()=>{const i=document.querySelector<HTMLElement>('#route-steps [aria-current="step"]');w.instructionSamples.push({position:p.dataset.position,state:p.dataset.state,first:i?.dataset.firstStep,last:i?.dataset.lastStep,phase:i?.dataset.phase});});w.instructionObserver.observe(p,{attributes:true,attributeFilter:["data-position"]});});}
type Sample={position:string;state:string;first?:string;last?:string;phase?:string};
async function samples(page:Page){return page.evaluate(()=>(window as unknown as {instructionSamples:Sample[]}).instructionSamples);}
function verifyHighlight(route:RouteResponse,recorded:Sample[],connector?:number[]){
  const points=route.waypoints!.map(p=>new Vector3(p.x,p.elevation_m,-p.y));let checked=0,maxDistance=0;
  for(const s of recorded.filter(s=>s.state==="walking" || s.state==="paused")){
    expect(s.first).toBeDefined();expect(s.last).toBeDefined();const p=new Vector3(...s.position.split(",").map(Number) as [number,number,number]),first=Number(s.first),last=Number(s.last),distances=[];
    for(let i=first;i<=last;i++){
      if(i===-1){expect(connector).toBeDefined();distances.push(projectOnSegment(p,new Vector3(...connector as [number,number,number]),points[0]).distance);}
      else{expect(i).toBeGreaterThanOrEqual(0);expect(i).toBeLessThan(points.length-1);distances.push(projectOnSegment(p,points[i],points[i+1]).distance);}
    }
    const distance=Math.min(...distances);expect(distance).toBeLessThan(.251);maxDistance=Math.max(maxDistance,distance);checked++;
  }
  expect(checked).toBeGreaterThan(0);return {checked,maxDistanceFromHighlightedEdges:maxDistance};
}
test.describe("three floors",()=>{
  test.use({campusProfile:"ucc-three-floors-c16"});
  test("flight directions retain turns, highlight the actual edge and stay current while paused",async({page,request})=>{
    test.setTimeout(300000);await mkdir(output,{recursive:true});const places=await(await request.get("/buildings")).json() as Building[],entry=places.find(p=>p.code==="ucc:floor1:p01")!,lab=places.find(p=>p.code==="ucc:f3:computer-lab-1-entrance")!;
    const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-three-floors-c16");await login(page);await page.locator("#origin").selectOption(String(entry.id));const runs=[];
    for(const [index,dest] of [lab,entry].entries()){
      await target(page,dest);const route=await calculate(page),rows=page.locator("#route-steps li"),count=await rows.count();expect(count).toBeLessThan(route.steps.length/2);await expect(page.locator("#route-summary")).toContainText(`${count} directions`);
      expect((await rows.allTextContents()).join(" ")).not.toMatch(/East stair point|doorway centre/);if(!await page.locator("#route-card details").evaluate(e=>e.hasAttribute("open")))await page.locator("#route-card details summary").click();await observe(page);await page.locator("#follow").click();
      if(index===0){
        await expect(page.locator('#route-steps li.current[data-kind="stairs"][data-phase="up"]')).toHaveCount(1,{timeout:50000});await page.locator("#follow").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","paused");
        const paused=await pos(page),current=await page.locator('#route-steps [aria-current="step"]').textContent();await expect(page.locator("#travel-detail")).toContainText(current!.split(" · ")[0]);await page.waitForTimeout(200);expect(await pos(page)).toEqual(paused);expect(await page.locator('#route-steps [aria-current="step"]').textContent()).toBe(current);await page.screenshot({path:`${output}/flight-paused.png`});await page.locator("#follow").click();
      }
      await expect(page.locator("#travel-status")).toHaveAttribute("data-state","arrived",{timeout:140000});const position=await pos(page),error=Math.hypot(position[0]-dest.x,position[1]-dest.elevation_m!,position[2]+dest.y);expect(error).toBeLessThan(.002);
      const recorded=await samples(page),highlight=verifyHighlight(route,recorded);runs.push({route,instructionRows:await rows.allTextContents(),instructionCount:count,position,error,samples:recorded,highlight});
      await expect(page.locator('#route-steps [aria-current="step"]')).toHaveCount(0);await page.screenshot({path:`${output}/${index ? "return":"outbound"}.png`});
    }
    const metrics=await page.evaluate(async()=>{const gl=document.querySelector("canvas")!.getContext("webgl2")!,info=gl.getExtension("WEBGL_debug_renderer_info"),frames:number[]=[];await new Promise<void>(resolve=>{let start=0,last=0;const frame=(t:number)=>{if(!start)start=t;if(last)frames.push(t-last);last=t;if(t-start<3000)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});return {renderer:String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL:gl.RENDERER)),averageFps:1000*frames.length/frames.reduce((a,b)=>a+b,0)};});
    if(process.env.UNINAV_REQUIRE_FPS==="1"){expect(metrics.renderer).not.toMatch(/swiftshader|software|llvmpipe/i);expect(metrics.averageFps).toBeGreaterThanOrEqual(30);}
    expect(errors).toEqual([]);await writeFile(`${output}/guided.json`,JSON.stringify({profile:"ucc-three-floors-c16",runs,errors,metrics,noRouteOrModelOverrides:true},null,2));
  });
  test("manual replan shows its connector without changing actor position",async({page,request})=>{
    test.setTimeout(120000);await mkdir(output,{recursive:true});const places=await(await request.get("/buildings")).json() as Building[],start=places.find(p=>p.code==="ucc:f3:east-stair-06")!,lab=places.find(p=>p.code==="ucc:f3:computer-lab-1-entrance")!;
    await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-three-floors-c16");await login(page);await target(page,lab);await page.locator("#origin").selectOption(String(start.id));await expect(page.locator("#model-status")).toHaveAttribute("data-loaded-models",/ucc-third-floor/);
    await page.locator("canvas").focus();await page.keyboard.down("d");await page.waitForTimeout(60);await page.keyboard.up("d");const retained=await pos(page);expect(Math.abs(retained[0]-start.x)).toBeGreaterThan(.02);
    const route=await calculate(page);expect(await pos(page)).toEqual(retained);await expect(page.locator('#route-steps li[data-phase="connector"]')).toContainText("Rejoin the stairs");await page.locator("#route-card details summary").click();await observe(page);await page.locator("#follow").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","arrived",{timeout:45000});
    const recorded=await samples(page),highlight=verifyHighlight(route,recorded,retained);expect(recorded.some(s=>s.first==="-1")).toBe(true);await writeFile(`${output}/connector.json`,JSON.stringify({retained,route,samples:recorded,highlight,finalPosition:await pos(page)},null,2));
  });
  test("floor0 handoff does not enable a destination or preview movement",async({page,request})=>{
    const places=await(await request.get("/buildings")).json() as Building[];expect(places.some(p=>p.floor===0)).toBe(false);await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-view","campus");await page.locator("#isometric").click();await page.locator("#floor").selectOption("0");await expect(page.locator("#model-status")).toHaveAttribute("data-preview","true");const before=await pos(page);await page.locator("canvas").focus();await page.keyboard.down("w");await page.waitForTimeout(100);await page.keyboard.up("w");expect(await pos(page)).toEqual(before);
  });
});
test.describe("legacy flat stair data",()=>{
  test.use({campusProfile:"ucc-first-floor-stair-review"});
  test("flat mapped stairs do not become fictional landings",async({page,request})=>{
    const places=await(await request.get("/buildings")).json() as Building[],dest=places.find(p=>p.code==="ucc:floor1:p10")!;await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-first-floor-stair-review");await login(page);await target(page,dest);const route=await calculate(page);expect(route.steps.some(s=>s.kind==="stairs")).toBe(true);await expect(page.locator('#route-steps [data-phase="steps"]')).toHaveCount(1);await expect(page.locator('#route-steps [data-phase="landing"]')).toHaveCount(0);
  });
});

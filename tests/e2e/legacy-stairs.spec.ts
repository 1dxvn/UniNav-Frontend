import { test,expect,type Page } from "@playwright/test";
import { mkdir,writeFile } from "node:fs/promises";
import type { Building,CampusPath } from "../../src/api/types.ts";
const output=process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/h2-stair-awareness";
async function login(page:Page){
  await page.goto("/app/");await expect(page.locator("#model-status")).toContainText("3 references aligned");
  await page.locator("#open-login").click();await page.getByLabel("Username",{exact:true}).fill("student");await page.getByLabel("Password",{exact:true}).fill("demo1234");await page.locator("#login-submit").click();await expect(page.locator("#session-user")).toHaveText("student");
}
async function select(page:Page,id:number,name:string){await page.locator("#origin").selectOption(String(id));await page.locator("#search").fill(name);await page.locator("#place-list button").first().click();}
test.beforeEach(async({request})=>{
  const places=await(await request.get("/buildings")).json() as Building[],paths=await(await request.get("/paths")).json() as CampusPath[];
  test.skip(!places.some(p=>p.name==="Hall Acceso") || !paths.some(p=>p.source_name==="South circulation" && p.target_name==="Laboratory corridor west" && p.kind==="corridor"),"Requires the preserved legacy UCC API.");
});

test("legacy API cannot offer the six known stair-crossing directions with Avoid stairs",async({page,request})=>{
  const places=await(await request.get("/buildings")).json() as Building[],ids=new Map(places.map(p=>[p.name,p.id]));await login(page);await page.locator("#avoid-stairs").check();const results=[];
  for(const target of ["Morphology Laboratory","Elevator and Restroom Hall","Preclinic / Dentistry Coordination"]){
    for(const [origin,destination] of [["Hall Acceso",target],[target,"Hall Acceso"]]){
      await select(page,ids.get(origin)!,destination);const response=page.waitForResponse(r=>r.url().endsWith("/routes/calculate"));await page.locator("#calculate").click();
      const r=await response;expect(r.status()).toBe(200);await expect(page.locator("#route-error")).toContainText("No stair-free route is confirmed");await expect(page.locator("#follow")).toBeDisabled();
      results.push({origin,destination,legacyApiStatus:r.status(),clientRejected:true});
    }
  }
  await mkdir(output,{recursive:true});await page.screenshot({path:`${output}/legacy-stairs-rejected.png`,fullPage:true});
  await select(page,ids.get("Hall Acceso")!,"ICETEX");await page.locator("#calculate").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");
  await writeFile(`${output}/legacy-filter.json`,JSON.stringify({results,icetexStillAvailable:true},null,2));
});

test("Avoid stairs checks the current connector footprint and keeps its clear approach available",async({page,request})=>{
  const places=await(await request.get("/buildings")).json() as Building[],ids=new Map(places.map(p=>[p.name,p.id]));await login(page);
  await select(page,ids.get("Laboratory corridor west")!,"Morphology Laboratory");await page.locator("#avoid-stairs").check();await page.locator("canvas").focus();await page.keyboard.down("a");await page.waitForTimeout(900);await page.keyboard.up("a");
  const position=await page.locator("#travel-status").getAttribute("data-position"),x=Number(position!.split(",")[0]);expect(x).toBeGreaterThan(36.5);expect(x).toBeLessThan(39);
  const pending=page.waitForResponse(r=>r.url().endsWith("/routes/calculate"));await page.locator("#calculate").click();const route=await(await pending).json();
  expect(route.path[0]).toBe("Laboratory corridor west");expect(route.steps.every((s:{kind:string})=>s.kind==="corridor")).toBe(true);
  await expect(page.locator("#route-error")).toContainText("No stair-free route is confirmed");expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(position);
  await select(page,ids.get("Hall corridor south")!,"ICETEX");await page.locator("canvas").focus();await page.keyboard.down("w");await page.waitForTimeout(200);await page.keyboard.up("w");
  const clearPosition=await page.locator("#travel-status").getAttribute("data-position");await page.locator("#calculate").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");
  expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(clearPosition);
  await mkdir(output,{recursive:true});await writeFile(`${output}/connector-filter.json`,JSON.stringify({rejectedPosition:position,apiRoute:route,clearPosition,clearConnectorAccepted:true},null,2));
});

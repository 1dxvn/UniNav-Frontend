import { expect } from "@playwright/test";
import { mkdir,writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Building,RouteResponse } from "../../src/api/types.ts";
import { test } from "./isolated-campus.ts";
const output=process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/h2-stair-awareness";
test.use({navigationDataset:fileURLToPath(new URL("../../../data/datasets/ucc-first-floor-stairs.json",import.meta.url))});

for(const targetName of ["ICETEX","Morphology Laboratory","Elevator and Restroom Hall","Preclinic / Dentistry Coordination"]){
  test(`reviewed first-floor stair classification walks to ${targetName} and back`,async({page,request})=>{
    test.setTimeout(240000);const places=await(await request.get("/buildings")).json() as Building[],entry=places.find(p=>p.name==="Hall Acceso")!,target=places.find(p=>p.name===targetName)!;
    await page.goto("/app/");await expect(page.locator("#model-status")).toContainText("3 references aligned");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-first-floor-stair-review");
    await page.locator("#open-login").click();await page.getByLabel("Username",{exact:true}).fill("student");await page.getByLabel("Password",{exact:true}).fill("demo1234");await page.locator("#login-submit").click();await expect(page.locator("#session-user")).toHaveText("student");
    const runs=[];
    for(const [origin,destination] of [[entry,target],[target,entry]]){
      await page.locator("#origin").selectOption(String(origin.id));await page.locator("#search").fill(destination.display_name ?? destination.name);await page.locator("#place-list button").first().click();
      const response=page.waitForResponse(r=>r.url().endsWith("/routes/calculate"));await page.locator("#calculate").click();const route=await(await response).json() as RouteResponse;
      await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");
      await page.evaluate(()=>{const e=document.getElementById("travel-status")!,w=window as unknown as {reviewPositions:unknown[]};w.reviewPositions=[];new MutationObserver(()=>w.reviewPositions.push({position:e.dataset.position,state:e.dataset.state})).observe(e,{attributes:true,attributeFilter:["data-position"]});});
      await page.locator("#follow").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","arrived",{timeout:120000});
      const final=(await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number),error=Math.hypot(final[0]-destination.x,final[1]-3.5,final[2]+destination.y);expect(error).toBe(0);
      const samples=await page.evaluate(()=>(window as unknown as {reviewPositions:{position:string;state:string}[]}).reviewPositions);expect(samples.every(s=>s.state!=="blocked")).toBe(true);
      runs.push({origin:origin.name,destination:destination.name,route,samples,finalErrorMetres:error});
    }
    await mkdir(output,{recursive:true});const slug=targetName.split(" ")[0].toLowerCase();await page.screenshot({path:`${output}/first-${slug}-arrival.png`});
    await writeFile(`${output}/first-${slug}-review.json`,JSON.stringify({profile:"ucc-first-floor-stair-review",physicalLevelsStillFlattened:true,runs},null,2));
  });
}

import { expect } from "@playwright/test";
import { mkdir,writeFile } from "node:fs/promises";
import type { Building,CampusPath,RouteResponse } from "../../src/api/types.ts";
import { test } from "./isolated-campus.ts";

const output=process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/campus-startup";
for(const [profile,placesCount,pathCount] of [["base",19,16],["ucc-two-floors",64,59],["ucc-first-floor-stair-review",19,16],["ucc-two-floors-stair-review",64,59],["ucc-two-floors-c15",68,63],["ucc-three-floors-c16",110,102]] as const){
  test.describe(profile,()=>{
    test.use({campusProfile:profile});
    test("production launcher serves its reviewed API and model profile",async({page,request})=>{
      const buildings=await(await request.get("/buildings")).json() as Building[],paths=await(await request.get("/paths")).json() as CampusPath[];
      expect(buildings).toHaveLength(placesCount);expect(paths).toHaveLength(pathCount);
      expect(buildings.every(p=>p.code && p.floor_code && Number.isFinite(p.elevation_m))).toBe(true);
      for(const path of ["/health","/docs","/openapi.json","/app/"])expect((await request.get(path)).status()).toBe(200);
      const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile",profile);await expect(page.locator("#model-status")).toContainText("3 references aligned");
      const login=await request.post("/auth/login",{data:{username:"student",password:"demo1234"}});expect(login.status()).toBe(200);const headers={Authorization:`Bearer ${(await login.json()).access_token}`};
      const entry=buildings.find(p=>p.code==="ucc:floor1:p01")!,destinations=buildings.filter(p=>["ucc:floor1:p06","ucc:floor1:p10","ucc:floor1:p13","ucc:floor1:p14","ucc:f2:mixed-reality-entrance","ucc:f2:molecular-biology-entrance","ucc:f2:medical-research-arrival"].includes(p.code!));
      const routes=[];
      for(const dest of destinations)for(const reverse of [false,true])for(const algorithm of ["a_star","dijkstra"]){
        const origin=reverse ? dest:entry,target=reverse ? entry:dest,response=await request.post("/routes/calculate",{headers,data:{origin_id:origin.id,destination_id:target.id,algorithm}});expect(response.status()).toBe(200);
        const route=await response.json() as RouteResponse;expect(route.waypoints!.at(-1)!.elevation_m).toBe(target.elevation_m);routes.push({code:dest.code,reverse,algorithm,route});
      }
      expect(errors).toEqual([]);await mkdir(output,{recursive:true});await page.screenshot({path:`${output}/${profile}.png`});await writeFile(`${output}/${profile}-contract.json`,JSON.stringify({profile,buildings,paths,routes,errors,scope:"unmodified production scripts.run_campus --profile with an explicit temporary SQLite database"},null,2));
    });
  });
}

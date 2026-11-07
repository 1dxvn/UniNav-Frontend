import { expect, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dataFingerprint, sha256, type CampusManifest } from "../../src/scene/modelManifest.ts";
import type { Building, CampusPath, RouteResponse } from "../../src/api/types.ts";
import { test } from "./isolated-campus.ts";

test.use({ navigationDataset:fileURLToPath(new URL("../fixtures/ucc-east-stair.json",import.meta.url)) });
const output=process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/h2-stair-support";
async function position(page:Page) { return (await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number); }
test.beforeEach(async ({page,request}) => {
  const places=await (await request.get("/buildings")).json() as Building[];
  const paths=await (await request.get("/paths")).json() as CampusPath[];
  const manifest=await (await request.get("/app/models/campus-manifest.json")).json() as CampusManifest;
  const reference=await (await request.get("/app/models/floor-2/campus-reference.json")).json();
  // Test-only API anchors describe the same documented structural columns.
  // Production previews and their immutable reference files remain untouched.
  reference.alignment="api";
  const body=JSON.stringify(reference),first=manifest.models.find((m)=>m.id==="ucc-first-floor")!;
  const upper=manifest.models.find((m)=>m.id==="ucc-floor-2-preview")!;
  upper.id="ucc-floor-2-navigation-test";upper.kind="floor";delete upper.navigable;
  upper.label="UCC floor 2 · stair rehearsal";
  upper.supportNodes=["P2_Floor_Slab","P2_Stair_A_East_1","P2_Stair_A_West_1"];
  upper.referenceSha256=await sha256(new TextEncoder().encode(body));
  for (const entry of [first,upper]) {
    const names=places.filter((p)=>p.floor===entry.floors[0] && p.name!=="Isolated test destination").map((p)=>p.name);
    entry.binding={ placeNames:names,sha256:await dataFingerprint(names,places,paths) };
  }
  await page.route("**/app/models/campus-manifest.json",r=>r.fulfill({json:manifest}));
  await page.route("**/app/models/floor-2/campus-reference.json",r=>r.fulfill({body,contentType:"application/json"}));
  await mkdir(output,{recursive:true});
  await page.goto("/app/");await expect(page.locator("#model-status")).toContainText("3 references aligned");
  await page.locator("#open-login").click();await page.getByLabel("Username",{exact:true}).fill("student");
  await page.getByLabel("Password",{exact:true}).fill("demo1234");await page.locator("#login-submit").click();
  await expect(page.locator("#session-user")).toHaveText("student");
  const bottom=places.find((p)=>p.code==="test:east-stair:p0")!;
  await page.locator("#origin").selectOption(String(bottom.id));
  await expect.poll(async()=>JSON.parse((await page.locator("#model-status").getAttribute("data-loaded-models"))!).sort()).toEqual(["ucc-first-floor","ucc-floor-2-navigation-test"].sort());
});
test("real stair pair: FastAPI up/down, avoid-stairs, pause and replan after keyboard override",async ({page,request}) => {
  test.setTimeout(120000);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  const places=await (await request.get("/buildings")).json() as Building[];
  const bottom=places.find((p)=>p.code==="test:east-stair:p0")!,top=places.find((p)=>p.name==="CIRCULACION (floor 2 test)")!;
  const routes:RouteResponse[]=[];
  async function calculate(target:Building) {
    await page.locator("#search").fill(target.display_name ?? target.name);await page.locator("#place-list button").first().click();
    const response=page.waitForResponse(r=>r.url().endsWith("/routes/calculate"));await page.locator("#calculate").click();
    const r=await response;expect(r.status()).toBe(200);routes.push(await r.json());
    await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");
  }
  await page.locator("#search").fill(top.display_name ?? top.name);await page.locator("#place-list button").first().click();
  await page.locator("#avoid-stairs").check();
  const impossible=page.waitForResponse(r=>r.url().endsWith("/routes/calculate"));await page.locator("#calculate").click();expect((await impossible).status()).toBe(404);
  await page.locator("#avoid-stairs").uncheck();await calculate(top);
  expect(routes[0].steps.some(s=>s.kind==="stairs")).toBe(true);expect(routes[0].waypoints?.at(-1)?.elevation_m).toBe(6.44);
  await page.evaluate(()=>{
    const p=document.getElementById("travel-status")!;
    const w=window as unknown as {stairSamples:{position:string;floor:string;state:string}[]};w.stairSamples=[];
    new MutationObserver(()=>w.stairSamples.push({position:p.dataset.position!,floor:document.querySelector<HTMLSelectElement>("#floor")!.value,state:p.dataset.state!})).observe(p,{attributes:true,attributeFilter:["data-position"]});
  });
  await page.locator("#follow").click();await page.waitForTimeout(650);await page.locator("#follow").click();
  await expect(page.locator("#travel-status")).toHaveAttribute("data-state","paused");
  const paused=await position(page);expect(paused[1]).toBeGreaterThan(3.5);expect(await page.locator("#floor").inputValue()).toBe("1");
  await page.waitForTimeout(200);expect(await position(page)).toEqual(paused);
  await page.screenshot({path:`${output}/vertical-paused.png`});
  await page.locator("canvas").focus();await page.keyboard.down("d");await page.waitForTimeout(60);await page.keyboard.up("d");
  await expect(page.locator("#travel-status")).toHaveAttribute("data-state","idle");
  const afterOverride=await position(page);expect(Math.hypot(...afterOverride.map((n,i)=>n-paused[i]))).toBeLessThan(0.4);
  expect(await page.locator("#model-status").getAttribute("data-loaded-models")).toContain("navigation-test");
  await calculate(top);await page.locator("#follow").click();
  await expect(page.locator("#travel-status")).toHaveAttribute("data-state","arrived",{timeout:45000});
  const upper=await position(page);expect(upper).toEqual([top.x,6.44,-top.y]);expect(await page.locator("#floor").inputValue()).toBe("2");
  await page.screenshot({path:`${output}/vertical-upper-arrival.png`});
  await calculate(bottom);await page.locator("#follow").click();
  await expect(page.locator("#travel-status")).toHaveAttribute("data-state","arrived",{timeout:45000});
  const lower=await position(page);expect(lower).toEqual([bottom.x,3.5,-bottom.y]);expect(await page.locator("#floor").inputValue()).toBe("1");
  const samples=await page.evaluate(()=>(window as unknown as {stairSamples:unknown[]}).stairSamples);
  expect(JSON.stringify(samples)).not.toContain('"state":"blocked"');expect(errors).toEqual([]);
  await writeFile(`${output}/vertical-browser.json`,JSON.stringify({routes,paused,afterOverride,upper,lower,samples,errors,fixtureOnly:true},null,2));
  await page.screenshot({path:`${output}/vertical-lower-arrival.png`});
});

test("real stair pair: keyboard climbs and descends the supported treads and landing",async ({page})=>{
  test.setTimeout(120000);
  const fixture=JSON.parse(await readFile(new URL("../fixtures/ucc-east-stair.json",import.meta.url),"utf8"));
  const points=fixture.places.filter((p:{code:string})=>p.code.startsWith("test:east-stair:p")) as Building[];
  const samples=[],arrivals=[];
  for (const direction of ["up","down"]) {
    const route=direction==="up" ? points : [...points].reverse();
    for (const target of route.slice(1)) for (let guard=0;;guard++) {
      const p=await position(page),dx=target.x-p[0],dz=-target.y-p[2],distance=Math.hypot(dx,dz);
      if (distance<0.065) break;
      if (guard>100) throw new Error(`Keyboard stalled at ${target.name}: ${p}`);
      const keys=[];if (Math.abs(dx)>0.035)keys.push(dx>0 ? "d":"a");if (Math.abs(dz)>0.035)keys.push(dz>0 ? "s":"w");
      await page.locator("canvas").focus();for(const key of keys)await page.keyboard.down(key);
      await page.waitForTimeout(Math.max(12,Math.min(60,distance/3*600)));for(const key of keys)await page.keyboard.up(key);
      samples.push({direction,position:await position(page),floor:await page.locator("#floor").inputValue()});
    }
    expect(await page.locator("#floor").inputValue()).toBe(direction==="up" ? "2":"1");
    const actual=await position(page),target=route.at(-1)!;
    const finalErrorMetres=Math.hypot(actual[0]-target.x,actual[1]-target.elevation_m!,actual[2]+target.y);
    expect(finalErrorMetres).toBeLessThan(0.07);
    arrivals.push({direction,position:actual,floor:await page.locator("#floor").inputValue(),finalErrorMetres});
    await page.screenshot({path:`${output}/manual-${direction}-arrival.png`});
  }
  await writeFile(`${output}/vertical-manual-browser.json`,JSON.stringify({samples,arrivals,fixtureOnly:true},null,2));
});

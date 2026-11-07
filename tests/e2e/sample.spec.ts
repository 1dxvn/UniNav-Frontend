import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const evidence = process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification";

test("sample API: sign in, walk an unsmoothed turn twice, pause and manually override", async ({ page, request }) => {
  const health = await request.get("/health"); expect(health.ok()).toBeTruthy();
  const places = await (await request.get("/buildings")).json();
  test.skip(!places.some((place: { name: string }) => place.name === "Main Entrance"), "Requires the backend sample campus.");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const uccPreviews: string[] = [];
  page.on("request", (request) => { if (/\/models\/floor-\d\//.test(request.url())) uccPreviews.push(request.url()); });
  await page.goto("/");
  await expect(page.locator("#api-status")).toContainText("Campus online");
  await expect(page.locator("#model-status")).not.toContainText("Preview only");
  expect(uccPreviews).toEqual([]);
  await page.locator("#open-login").click();
  await page.getByLabel("Username", { exact: true }).fill("student");
  await page.getByLabel("Password", { exact: true }).fill("demo1234");
  await page.locator("#login-submit").click();
  await expect(page.locator("#session-user")).toHaveText("student");
  const entrance = places.find((place: { name: string }) => place.name === "Main Entrance");
  for (let run = 0; run < 2; run++) {
    await page.locator("#origin").selectOption(String(entrance.id));
    await page.locator("#search").fill("Restrooms F0");
    await page.locator("#place-list button").first().click();
    const response = page.waitForResponse((response) => response.url().endsWith("/routes/calculate"));
    await page.locator("#calculate").click();
    const route = await (await response).json();
    expect(route.path).toEqual(["Main Entrance", "Reception", "Restrooms F0"]);
    await expect(page.locator("#travel-status")).toHaveAttribute("data-state", "ready");
    await page.locator("#top-view").click();
    if (run === 0) {
      await mkdir(evidence, { recursive: true });
      await page.screenshot({ path: `${evidence}/sample-first-route.png`, fullPage: true });
      await writeFile(`${evidence}/sample-api-route.json`, JSON.stringify(route, null, 2));
    }
    await page.evaluate(() => {
      const target = document.getElementById("travel-status")!;
      (window as unknown as { recordedPositions: string[] }).recordedPositions = [];
      new MutationObserver(() => { (window as unknown as { recordedPositions: string[] }).recordedPositions.push(target.dataset.position ?? ""); }).observe(target, { attributes: true, attributeFilter: ["data-position"] });
    });
    await page.locator("#follow").click();
    await expect(page.locator("#travel-status")).toHaveAttribute("data-state", "walking");
    if (run === 0) {
      await page.waitForTimeout(1000);
      await page.locator("#follow").click();
      await expect(page.locator("#travel-status")).toHaveAttribute("data-state", "paused");
      const paused = await page.locator("#travel-status").getAttribute("data-position");
      await page.waitForTimeout(400);
      expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(paused);
      await page.locator("#follow").click();
    }
    await expect(page.locator("#travel-status")).toHaveAttribute("data-state", "arrived", { timeout: 30000 });
    const position = (await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number);
    expect(position).toEqual([12, 0, 12]);
    const samples = await page.evaluate(() => (window as unknown as { recordedPositions: string[] }).recordedPositions);
    for (const sample of samples) {
      const [x, , z] = sample.split(",").map(Number);
      expect(Math.min(Math.abs(z) + Math.max(0, x - 12, -x), Math.abs(x - 12) + Math.max(0, z - 12, -z))).toBeLessThan(0.02);
    }
  }
  await page.locator("#origin").selectOption(String(entrance.id));
  await page.locator("canvas").focus();
  await page.keyboard.down("w"); await page.waitForTimeout(600); await page.keyboard.up("w");
  const bounded = (await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number);
  expect(Math.abs(bounded[2])).toBeLessThanOrEqual(0.63);
  expect(errors).toEqual([]);
  expect(uccPreviews).toEqual([]);
});

test("sample API: graph-only stairs still guide across floors without UCC model resources",async({page,request})=>{
  const places=await(await request.get("/buildings")).json() as {id:number;name:string;x:number;y:number;floor:number;building_type:string|null}[];
  test.skip(!places.some(p=>p.name==="Main Entrance"),"Requires the original sample campus.");
  const entrance=places.find(p=>p.name==="Main Entrance")!,target=places.find(p=>p.floor===1 && !["waypoint","reference","stairs","elevator"].includes(p.building_type ?? ""))!;
  const models:string[]=[];page.on("request",r=>{if(r.url().endsWith(".glb"))models.push(r.url());});
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","sample");
  await page.locator("#open-login").click();await page.getByLabel("Username",{exact:true}).fill("student");await page.getByLabel("Password",{exact:true}).fill("demo1234");await page.locator("#login-submit").click();await expect(page.locator("#session-user")).toHaveText("student");
  await page.locator("#origin").selectOption(String(entrance.id));await page.locator("#search").fill(target.name);await page.locator("#place-list button").first().click();
  const response=page.waitForResponse(r=>r.url().endsWith("/routes/calculate"));await page.locator("#calculate").click();const route=await(await response).json();expect(route.steps.some((s:{kind:string})=>s.kind==="stairs")).toBe(true);
  await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");await page.locator("#follow").click();await expect(page.locator("#travel-status")).toHaveAttribute("data-state","arrived",{timeout:60000});
  const final=(await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number);expect(Math.hypot(final[0]-target.x,final[1]-target.floor*3.5,final[2]+target.y)).toBeLessThan(0.001);expect(models).toEqual([]);
  await mkdir(evidence,{recursive:true});await writeFile(`${evidence}/sample-stairs.json`,JSON.stringify({route,final,modelRequests:models},null,2));
});

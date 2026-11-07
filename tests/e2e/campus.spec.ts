import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { Building, RouteResponse } from "../../src/api/types.ts";

const evidence = "docs/verification/h0";
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
let modelHash: string;
test.beforeAll(async ({ request }) => {
  await mkdir(evidence, { recursive: true });
  const places = await (await request.get("/buildings")).json() as Building[];
  if (!places.some((place) => place.name === "Hall Acceso")) return;
  modelHash = sha256(await readFile("public/models/campus.glb"));
  const served = await request.get("/app/models/campus.glb");
  expect(served.ok()).toBe(true);
  expect(sha256(await served.body())).toBe(modelHash);
  await writeFile(`${evidence}/revision.json`, JSON.stringify({
    checkedAt: new Date().toISOString(), api: new URL(served.url()).origin,
    modelSha256: modelHash, places: places.length,
    paths: (await (await request.get("/paths")).json() as unknown[]).length,
  }, null, 2));
});
test.afterAll(async ({ request }) => {
  if (!modelHash) return;
  // A fresh export invalidates these walks, even if the filename is unchanged.
  expect(sha256(await readFile("public/models/campus.glb"))).toBe(modelHash);
  expect(sha256(await (await request.get("/app/models/campus.glb")).body())).toBe(modelHash);
});

async function signIn(page: Page): Promise<void> {
  await page.goto("/app/");
  await expect(page.locator("#model-status")).toContainText("3 references aligned");
  await page.locator("#open-login").click();
  await page.getByLabel("Username", { exact: true }).fill("student");
  await page.getByLabel("Password", { exact: true }).fill("demo1234");
  await page.locator("#login-submit").click();
  await expect(page.locator("#session-user")).toHaveText("student");
}
function segmentDistance(p: number[], a: number[], b: number[]): number {
  const d = b.map((v, i) => v - a[i]);
  const t = Math.max(0, Math.min(1, p.reduce((sum, v, i) => sum + (v - a[i]) * d[i], 0) / (d.reduce((sum, v) => sum + v*v, 0) || 1)));
  return Math.hypot(...p.map((v, i) => v - a[i] - t * d[i]));
}
for (const destination of ["ICETEX", "Morphology Laboratory", "Elevator and Restroom Hall", "Preclinic / Dentistry Coordination"]) {
  test(`real GLB and API: walk to ${destination} and back`, async ({ page, request }) => {
    test.setTimeout(180000);
    const places = await (await request.get("/buildings")).json() as Building[];
    test.skip(!places.some((place) => place.name === "Hall Acceso"), "Requires scripts.run_campus on the configured base URL.");
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await signIn(page);
    const entrance = places.find((place) => place.name === "Hall Acceso")!;
    const destinationPlace = places.find((place) => place.name === destination)!;
    let outbound: string[] = [];
    for (const direction of ["outbound", "return"]) {
      const origin = direction === "outbound" ? entrance : destinationPlace;
      const target = direction === "outbound" ? destinationPlace : entrance;
      const key = `${destinationPlace.id}-${direction}`;
      await page.locator("#origin").selectOption(String(origin.id));
      await page.locator("#search").fill(target.name);
      await page.locator("#place-list button").first().click();
      await page.locator("#avoid-stairs").check();
      const response = page.waitForResponse((response) => response.url().endsWith("/routes/calculate"));
      await page.locator("#calculate").click();
      const apiResponse = await response;
      expect(apiResponse.status()).toBe(200);
      const route = await apiResponse.json() as RouteResponse;
      if (direction === "outbound") {
        outbound = route.path;
        expect(route.path.slice(0,3)).toEqual(["Hall Acceso", "Access courtyard", "South circulation"]);
        if (destination.startsWith("Preclinic")) expect(route.path.slice(-5)).toEqual([
          "Elevator and Restroom Hall", "North circulation west", "North circulation east",
          "Preclinic storeroom", destination,
        ]);
      } else expect(route.path).toEqual([...outbound].reverse());
      expect(route.path.at(-1)).toBe(target.name);
      expect(route.steps.every((step) => step.kind !== "stairs")).toBeTruthy();
      await expect(page.locator("#travel-status")).toHaveAttribute("data-state", "ready");
      if (direction === "outbound" && (destination === "ICETEX" || destination.startsWith("Preclinic"))) {
        await page.locator("#top-view").click();
        await page.locator("#references").click();
        await page.screenshot({ path: `${evidence}/${key}-top.png`, fullPage: true });
        await page.locator("#references").click();
        await page.locator("#isometric").click();
        await page.screenshot({ path: `${evidence}/${key}-3d.png`, fullPage: true });
      }
      await page.evaluate(() => {
        const element = document.getElementById("travel-status")!;
        const state = window as unknown as { positions: string[]; travelStates: string[]; observer?: MutationObserver };
        state.observer?.disconnect(); state.positions = []; state.travelStates = [];
        state.observer = new MutationObserver(() => {
          state.positions.push(element.dataset.position ?? "");
          state.travelStates.push(element.dataset.state ?? "");
        });
        state.observer.observe(element, { attributes: true, attributeFilter: ["data-position", "data-state"] });
      });
      await page.locator("#follow").click();
      await expect(page.locator("#travel-status")).toHaveAttribute("data-state", "walking");
      if (destination === "ICETEX" && direction === "outbound") {
        await page.waitForTimeout(600);
        await page.locator("#follow").click();
        await expect(page.locator("#travel-status")).toHaveAttribute("data-state", "paused");
        const position = await page.locator("#travel-status").getAttribute("data-position");
        await page.waitForTimeout(300);
        expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(position);
        await page.locator("#follow").click();
      }
      await expect(page.locator("#travel-status")).toHaveAttribute("data-state", "arrived", { timeout: 120000 });
      const position = (await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number);
      expect(Math.hypot(position[0] - target.x, position[1] - target.floor * 3.5, position[2] + target.y)).toBeLessThan(0.02);
      const samples = await page.evaluate(() => (window as unknown as { positions: string[] }).positions);
      const states = await page.evaluate(() => (window as unknown as { travelStates: string[] }).travelStates);
      expect(states).not.toContain("blocked");
      expect(samples.length).toBeGreaterThan(5);
      const points = route.path.map((name) => places.find((place) => place.name === name)!).map((place) => [place.x,place.floor*3.5,-place.y]);
      for (const sample of samples) {
        const p = sample.split(",").map(Number);
        expect(Math.min(...points.slice(1).map((point,index) => segmentDistance(p,points[index],point)))).toBeLessThan(0.02);
      }
      const deviations = samples.map((sample) => Math.min(...points.slice(1).map((point,index) => segmentDistance(sample.split(",").map(Number),points[index],point))));
      await writeFile(`${evidence}/walk-${key}.json`, JSON.stringify({
        modelSha256: modelHash, origin: origin.name, destination: target.name, route,
        finalPosition:position, finalErrorMetres: Math.hypot(position[0]-target.x,position[1]-target.floor*3.5,position[2]+target.y),
        samples:samples.length, maxCentreLineErrorMetres: Math.max(...deviations), states: [...new Set(states)],
      }, null, 2));
      await page.screenshot({ path: `${evidence}/${key}-arrival.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}

test("mobile layout and sign-in validation remain usable", async ({ page, request }) => {
  const places = await (await request.get("/buildings")).json() as Building[];
  test.skip(!places.some((place) => place.name === "Hall Acceso"), "Requires the real campus database.");
  await page.setViewportSize({width:390,height:844});
  await page.goto("/app/");
  await expect(page.locator("#model-status")).toContainText("references aligned");
  await expect(page.locator("#floor-title")).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({path:`${evidence}/mobile.png`,fullPage:true});
  await page.locator("#open-login").click();
  await page.getByLabel("Username",{exact:true}).fill("student");
  await page.getByLabel("Password",{exact:true}).fill("wrong-pass");
  await page.locator("#login-submit").click();
  await expect(page.locator("#login-error")).toBeVisible();
  await expect(page.locator("#login-submit")).toBeEnabled();
});

test("manual control cancels guidance and replans from the current position", async ({ page, request }) => {
  const places = await (await request.get("/buildings")).json() as Building[];
  test.skip(!places.some((place) => place.name === "Hall Acceso"), "Requires the real campus database.");
  await signIn(page);
  await page.locator("#search").fill("ICETEX");
  await page.locator("#place-list button").first().click();
  await page.locator("#calculate").click();
  await expect(page.locator("#travel-status")).toHaveAttribute("data-state", "ready");
  await page.locator("canvas").focus();
  await page.keyboard.down("w"); await page.waitForTimeout(400); await page.keyboard.up("w");
  await expect(page.locator("#travel-status")).toHaveAttribute("data-state", "idle");
  await expect(page.locator("#route-card")).toBeHidden();
  const before = (await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number);
  expect(before[2]).toBeLessThan(-0.2);
  await page.locator("#calculate").click();
  await expect(page.locator("#travel-status")).toHaveAttribute("data-state", "ready");
  const after = (await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number);
  expect(after).toEqual(before);
  await page.locator("#cancel").click();
  expect((await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number)).toEqual(before);
});

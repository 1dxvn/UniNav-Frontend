import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import type { Building, RouteResponse } from "../../src/api/types.ts";

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
for (const destination of ["ICETEX", "Morphology Laboratory", "Elevator and Restroom Hall"]) {
  test(`real GLB and API: arrive through the corridor at ${destination}`, async ({ page, request }) => {
    const places = await (await request.get("/buildings")).json() as Building[];
    test.skip(!places.some((place) => place.name === "Hall Acceso"), "Requires scripts.run_campus on the configured base URL.");
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await signIn(page);
    const entrance = places.find((place) => place.name === "Hall Acceso")!;
    const target = places.find((place) => place.name === destination)!;
    const repeats = destination === "ICETEX" ? 2 : 1;
    for (let run = 0; run < repeats; run++) {
      await page.locator("#origin").selectOption(String(entrance.id));
      await page.locator("#search").fill(destination);
      await page.locator("#place-list button").first().click();
      await page.locator("#avoid-stairs").check();
      const response = page.waitForResponse((response) => response.url().endsWith("/routes/calculate"));
      await page.locator("#calculate").click();
      const apiResponse = await response;
      expect(apiResponse.status()).toBe(200);
      const route = await apiResponse.json() as RouteResponse;
      expect(route.path.slice(0,3)).toEqual(["Hall Acceso", "Access courtyard", "South circulation"]);
      expect(route.path.at(-1)).toBe(destination);
      expect(route.steps.every((step) => step.kind !== "stairs")).toBeTruthy();
      await expect(page.locator("#travel-status")).toHaveAttribute("data-state", "ready");
      if (destination === "ICETEX" && run === 0) {
        await mkdir("docs/verification", { recursive: true });
        await page.locator("#top-view").click();
        await page.locator("#references").click();
        await page.screenshot({ path: "docs/verification/first-route.png", fullPage: true });
        await writeFile("docs/verification/first-api-route.json", JSON.stringify(route, null, 2));
        await page.locator("#references").click();
        await page.locator("#isometric").click();
        await page.screenshot({ path: "docs/verification/first-route-3d.png", fullPage: true });
      }
      await page.evaluate(() => {
        const element = document.getElementById("travel-status")!;
        const state = window as unknown as { positions: string[]; observer?: MutationObserver };
        state.observer?.disconnect(); state.positions = [];
        state.observer = new MutationObserver(() => state.positions.push(element.dataset.position ?? ""));
        state.observer.observe(element, { attributes: true, attributeFilter: ["data-position"] });
      });
      await page.locator("#follow").click();
      await expect(page.locator("#travel-status")).toHaveAttribute("data-state", "walking");
      if (destination === "ICETEX" && run === 0) {
        await page.waitForTimeout(600);
        await page.locator("#follow").click();
        await expect(page.locator("#travel-status")).toHaveAttribute("data-state", "paused");
        const position = await page.locator("#travel-status").getAttribute("data-position");
        await page.waitForTimeout(300);
        expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(position);
        await page.locator("#follow").click();
      }
      await expect(page.locator("#travel-status")).toHaveAttribute("data-state", "arrived", { timeout: 45000 });
      const position = (await page.locator("#travel-status").getAttribute("data-position"))!.split(",").map(Number);
      expect(Math.hypot(position[0] - target.x, position[1] - target.floor * 3.5, position[2] + target.y)).toBeLessThan(0.02);
      const samples = await page.evaluate(() => (window as unknown as { positions: string[] }).positions);
      const points = route.path.map((name) => places.find((place) => place.name === name)!).map((place) => [place.x,place.floor*3.5,-place.y]);
      for (const sample of samples) {
        const p = sample.split(",").map(Number);
        expect(Math.min(...points.slice(1).map((point,index) => segmentDistance(p,points[index],point)))).toBeLessThan(0.02);
      }
      const errors = samples.map((sample) => Math.min(...points.slice(1).map((point,index) => segmentDistance(sample.split(",").map(Number),points[index],point))));
      await writeFile(`docs/verification/walk-${target.id}-${run+1}.json`, JSON.stringify({ destination, route:route.path, finalPosition:position, samples:samples.length, maxCentreLineErrorMetres: Math.max(...errors) }, null, 2));
      if (destination === "ICETEX" && run === 0) await page.screenshot({ path: "docs/verification/arrival.png", fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}

test("real API no-route and expired session are recoverable", async ({ page, request }) => {
  const places = await (await request.get("/buildings")).json() as Building[];
  test.skip(!places.some((place) => place.name === "Hall Acceso"), "Requires the real campus database.");
  await signIn(page);
  await page.locator("#search").fill("Preclinic");
  await page.locator("#place-list button").first().click();
  const response = page.waitForResponse((response) => response.url().endsWith("/routes/calculate"));
  await page.locator("#calculate").click();
  expect((await response).status()).toBe(404);
  await expect(page.locator("#route-error")).toContainText("There is no route");
  await expect(page.locator("#route-card")).toBeHidden();
  await page.locator("#search").fill("ICETEX"); await page.locator("#place-list button").first().click();
  await page.route("**/routes/calculate", async (route) => route.continue({ headers: { ...route.request().headers(), authorization: "Bearer expired-test-token" } }));
  await page.locator("#calculate").click();
  await expect(page.locator("#auth-dialog")).toBeVisible();
  await expect(page.locator("#session")).toBeHidden();
});

test("mobile layout and sign-in validation remain usable", async ({ page, request }) => {
  const places = await (await request.get("/buildings")).json() as Building[];
  test.skip(!places.some((place) => place.name === "Hall Acceso"), "Requires the real campus database.");
  await page.setViewportSize({width:390,height:844});
  await page.goto("/app/");
  await expect(page.locator("#model-status")).toContainText("references aligned");
  await expect(page.locator("#floor-title")).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({path:"docs/verification/mobile.png",fullPage:true});
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

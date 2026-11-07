import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.beforeEach(async ({ request }) => {
  const places = await (await request.get("/buildings")).json() as { name: string }[];
  test.skip(!places.some((place) => place.name === "Hall Acceso"),"Requires the real campus.");
});

test("observing a pending floor preserves avatar position and restores the cached first floor", async ({ page, request }) => {
  const manifest = await (await request.get("/app/models/campus-manifest.json")).json();
  manifest.models = manifest.models.filter((entry: { floors:number[] }) => !entry.floors.includes(2));
  await page.route("**/models/campus-manifest.json",(route) => route.fulfill({ status:200,json:manifest }));
  await page.goto("/app/");
  await expect(page.locator("#model-status")).toContainText("3 references aligned");
  await page.locator("#isometric").click();
  const position = await page.locator("#travel-status").getAttribute("data-position");
  let reloads = 0;
  page.on("request",(request) => { if (request.url().endsWith("/campus.glb")) reloads++; });
  await page.locator("#floor").selectOption("2");
  await expect(page.locator("#floor-title")).toHaveText("Second floor");
  await expect(page.locator("#model-status")).toHaveText("Floor model pending");
  expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(position);
  const output = process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/h1";
  await mkdir(output,{ recursive:true });
  await page.screenshot({ path:`${output}/pending-floor.png`,fullPage:true });
  await page.locator("#floor").selectOption("1");
  await expect(page.locator("#model-status")).toContainText("3 references aligned");
  expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(position);
  expect(reloads).toBe(0); // Required by the avatar, so the model stayed cached.
});

test("a changed GLB is rejected before parsing and recovers with a matching export", async ({ page, request }) => {
  const bytes = await (await request.get("/app/models/campus.glb")).body();
  bytes[bytes.length-1] ^= 1;
  await page.route("**/app/models/campus.glb",(route) => route.fulfill({ status:200,body:bytes,contentType:"model/gltf-binary" }));
  await page.goto("/app/");
  await expect(page.locator("#model-status")).toHaveText("Model unavailable · using graph preview");
  await expect(page.locator("#model-status")).toHaveAttribute("title",/Model export changed/);
  await page.unroute("**/app/models/campus.glb");
  await page.reload();
  await expect(page.locator("#model-status")).toContainText("3 references aligned");
});

test("an incompatible graph revision is rejected even when reference anchors still align", async ({ page, request }) => {
  const paths = await (await request.get("/paths")).json(); paths[0].weight += 1;
  await page.route("**/paths",(route) => route.fulfill({ status:200,json:paths }));
  await page.goto("/app/");
  await expect(page.locator("#model-status")).toHaveText("Model unavailable · using graph preview");
  await expect(page.locator("#model-status")).toHaveAttribute("title",/Model data revision differs/);
  await expect(page.locator("#references")).toBeHidden();
});

import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { sha256 } from "../../src/scene/modelManifest.ts";

// Explicit opt-in, read-only smoke against the user's already-running service.
test("running six-floor campus serves C19 without restarting or writing user data", async ({ page, request }) => {
  test.skip(process.env.UNINAV_LIVE_REVIEW !== "1", "Opt in only after inspecting the existing service.");
  const output = process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/resumed-review/live";
  const health = await (await request.get("/health")).json();
  expect(health).toEqual({ status: "ok", buildings: 235, edges: 436 });
  const buildings = await (await request.get("/buildings")).json();
  const paths = await (await request.get("/paths")).json();
  expect(buildings).toHaveLength(235); expect(paths).toHaveLength(218);
  for (const url of ["/app/", "/docs", "/openapi.json"]) expect((await request.get(url)).status()).toBe(200);
  const manifest = await (await request.get("/app/models/campus-manifest.json")).json();
  const exterior = manifest.profiles.find((p: { id: string }) => p.id === "ucc-six-floors-c18").models.find((m: { kind: string }) => m.kind === "exterior");
  const hash = await sha256(await (await request.get(`/app/${exterior.model}`)).body());
  expect(hash).toBe(exterior.modelSha256);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/app/");
  await expect(page.locator("#model-status")).toHaveAttribute("data-profile", "ucc-six-floors-c18");
  await expect(page.locator("#model-status")).toHaveAttribute("data-view", "campus");
  await expect(page.locator("canvas")).toHaveCount(1);
  const position = await page.locator("#travel-status").getAttribute("data-position");
  await page.locator("#isometric").click();
  for (const floor of [0, 2, 3, 4, 5, 1]) {
    await page.locator("#floor").selectOption(String(floor));
    await expect(page.locator("#model-status")).toContainText("3 references aligned");
    await expect(page.locator("#model-status")).toHaveClass(/verified/);
    expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(position);
  }
  await page.locator("#campus-overview").click();
  await expect(page.locator("#model-status")).toHaveAttribute("data-view", "campus");
  expect(errors).toEqual([]);
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: `${output}/live-overview.png` });
  await writeFile(`${output}/read-only-smoke.json`, JSON.stringify({ health, places: buildings.length, paths: paths.length, exterior, hash, position, inspectedFloors: [0, 2, 3, 4, 5, 1], errors,
    scope: "Existing 8001 service, unauthenticated read-only browser context. No route calculation, account action, service restart or database mutation." }, null, 2));
});

test("running sample campus remains usable without UCC models or account writes", async ({ page, request }) => {
  test.skip(process.env.UNINAV_LIVE_REVIEW !== "1", "Opt in only after inspecting the existing services.");
  const output = process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/resumed-review/live";
  const base = "http://127.0.0.1:8000";
  const health = await (await request.get(`${base}/health`)).json();
  expect(health).toEqual({ status: "ok", buildings: 21, edges: 50 });
  const models: string[] = [], errors: string[] = [];
  page.on("request", r => { if (r.url().endsWith(".glb")) models.push(r.url()); });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/app/`);
  await expect(page.locator("#api-status")).toContainText("Campus online");
  await expect(page.locator("#assistant-question")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.locator("#tool-history").click();
  await expect(page.getByRole("button", { name: "Sign in to continue" })).toBeVisible();
  expect(models.filter(url => /\/models\/(?:floor-\d|c\d|blocks)\//.test(url))).toEqual([]);
  expect(errors).toEqual([]);
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: `${output}/sample-campus.png` });
  await writeFile(`${output}/sample-read-only.json`, JSON.stringify({ health, models, errors, scope: "Existing 8000 service, no authentication or database writes." }, null, 2));
});

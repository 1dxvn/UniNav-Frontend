import { expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { committedRepositoryAsset } from "../../tools/reviewed-assets.ts";
import { sha256 } from "../../src/scene/modelManifest.ts";
import { test } from "./isolated-campus.ts";

const output = process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/resumed-review/overview";
test.use({ campusProfile: "ucc-six-floors-c18" });

async function orbit(page: Page, horizontal: number, vertical = 0) {
  await page.locator("#reset-view").click();
  await page.waitForTimeout(400);
  const box = (await page.locator("canvas").boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + box.height * horizontal, y + box.height * vertical, { steps: 24 });
  await page.mouse.up();
  await page.waitForTimeout(900);
}

test("C19 overview compares six views with C5 and preserves navigable resources", async ({ page, request }) => {
  test.setTimeout(120000);
  await mkdir(output, { recursive: true });
  const old = JSON.parse((await committedRepositoryAsset("d540b21", "public/models/campus-manifest.json")).toString("utf8"));
  const current = await (await request.get("/app/models/campus-manifest.json")).json();
  const withoutExterior = (manifest: typeof current) => ({ ...manifest,
    models: manifest.models.filter((m: { kind: string }) => m.kind !== "exterior"),
    profiles: manifest.profiles.map((p: { models: { kind: string }[] }) => ({ ...p, models: p.models.filter(m => m.kind !== "exterior") })) });
  expect(withoutExterior(current)).toEqual(withoutExterior(old));
  const c5 = old.models.find((m: { kind: string }) => m.kind === "exterior");
  const c19 = current.models.find((m: { kind: string }) => m.kind === "exterior");
  const previousBytes = await committedRepositoryAsset(c5.sourceCommit, `public/${c5.model}`);
  expect(await sha256(previousBytes)).toBe(c5.modelSha256);
  expect(await sha256(await (await request.get(`/app/${c19.model}`)).body())).toBe(c19.modelSha256);
  const results = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const before of [true, false]) {
    if (before) {
      // Comparison only: substitute the reviewed C5 exterior and its hash at the C19 URL.
      // Every indoor model, API value, transform and application setting remains shipped.
      const comparison = structuredClone(current);
      for (const model of [...comparison.models, ...comparison.profiles.flatMap((p: { models: unknown[] }) => p.models)]) {
        if (model.kind === "exterior") model.modelSha256 = c5.modelSha256;
      }
      await page.route("**/models/campus-manifest.json", route => route.fulfill({ json: comparison }));
      await page.route(`**/${c19.model}`, route => route.fulfill({ body: previousBytes, contentType: "model/gltf-binary" }));
    } else {
      await page.unroute("**/models/campus-manifest.json");
      await page.unroute(`**/${c19.model}`);
    }
    await page.goto("/app/");
    await expect(page.locator("#model-status")).toHaveAttribute("data-profile", "ucc-six-floors-c18");
    await expect(page.locator("#model-status")).toHaveAttribute("data-view", "campus");
    await expect(page.locator("#model-status")).toHaveClass(/verified/);
    await expect(page.locator("canvas")).toHaveCount(1);
    const position = await page.locator("#travel-status").getAttribute("data-position");
    const colliders = await page.locator("#model-status").getAttribute("data-colliders");
    const names = [];
    for (const [name, horizontal, vertical] of [["default", 0, 0], ["left", .25, 0], ["right", -.25, 0], ["rear", .5, 0], ["oblique", .125, -.04], ["top", 0, .17]] as const) {
      await orbit(page, horizontal, vertical);
      await page.screenshot({ path: `${output}/${before ? "c5" : "c19"}-${name}.png` });
      names.push(name);
    }
    expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(position);
    await page.locator("#isometric").click();
    await expect(page.locator("#model-status")).toHaveAttribute("data-loaded-models", '["ucc-first-floor"]');
    await expect(page.locator("#model-status")).toHaveAttribute("data-colliders", colliders!);
    results.push({ exterior: before ? c5 : c19, comparisonOverride: before, position, colliders: Number(colliders), views: names });
  }
  expect(results[0].position).toEqual(results[1].position);
  expect(results[0].colliders).toEqual(results[1].colliders);
  await page.locator("#campus-overview").click();
  await expect(page.locator("#model-status")).toHaveAttribute("data-view", "campus");
  const metrics = await page.evaluate(async () => {
    const gl = document.querySelector("canvas")!.getContext("webgl2")!;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    const frames: number[] = [];
    await new Promise<void>(resolve => {
      let start = 0, previous = 0;
      const sample = (now: number) => {
        if (!start) start = now;
        if (previous) frames.push(now - previous);
        previous = now;
        if (now - start < 3000) requestAnimationFrame(sample); else resolve();
      };
      requestAnimationFrame(sample);
    });
    return { renderer, averageFps: 1000 * frames.length / frames.reduce((a, b) => a + b, 0), frames: frames.length };
  });
  if (process.env.UNINAV_REQUIRE_FPS === "1") {
    expect(metrics.renderer).not.toMatch(/swiftshader|software|llvmpipe/i);
    expect(metrics.averageFps).toBeGreaterThanOrEqual(30);
  }
  expect(errors).toEqual([]);
  await writeFile(`${output}/comparison.json`, JSON.stringify({ baseline: "d540b21", nonExteriorUnchanged: true, results, metrics, errors,
    scope: "Six views via the same OrbitControls drag gestures. Before is a C5-only comparison override; after is the unmodified shipped C19 manifest. Six-floor production launcher with temporary DB. Exterior adds zero colliders." }, null, 2));
});

for (const failure of ["missing", "changed"] as const) test(`C19 ${failure} exterior preserves the verified floor and retries`, async ({ page, request }) => {
  const manifest = await (await request.get("/app/models/campus-manifest.json")).json();
  const exterior = manifest.models.find((m: { kind: string }) => m.kind === "exterior");
  const bytes = await (await request.get(`/app/${exterior.model}`)).body();
  bytes[bytes.length - 1] ^= 1;
  const url = `**/${exterior.model}`;
  await page.route(url, route => route.fulfill(failure === "missing" ? { status: 404, body: "Exterior missing" } : { body: bytes, contentType: "model/gltf-binary" }));
  await page.goto("/app/");
  await expect(page.locator("#model-status")).toHaveText("Exterior unavailable · floor view");
  await expect(page.locator("#model-status")).toHaveAttribute("data-visible-models", '["ucc-first-floor"]');
  if (failure === "changed") await expect(page.locator("#model-status")).toHaveAttribute("title", /exterior export changed/);
  const position = await page.locator("#travel-status").getAttribute("data-position");
  const colliders = await page.locator("#model-status").getAttribute("data-colliders");
  await page.unroute(url);
  await page.locator("#campus-overview").click();
  await expect(page.locator("#model-status")).toHaveAttribute("data-view", "campus");
  expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(position);
  expect(await page.locator("#model-status").getAttribute("data-colliders")).toBe(colliders);
  await mkdir(output, { recursive: true });
  await writeFile(`${output}/${failure}-exterior.json`, JSON.stringify({ failure, url: exterior.model, position, colliders, recovered: true }, null, 2));
});

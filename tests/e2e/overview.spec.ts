import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

test.beforeEach(async ({ request }) => {
  const places = await (await request.get("/buildings")).json() as { name:string }[];
  test.skip(!places.some((place) => place.name === "Hall Acceso"),"Requires the real campus.");
});

test("campus overview loads the reviewed exterior, preserves position and releases it for floor view", async ({ page, request }) => {
  const output = process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/c5";
  await mkdir(output,{ recursive:true });
  const errors: string[] = []; page.on("pageerror",(error) => errors.push(error.message));
  await page.goto("/app/");
  await expect(page.locator("#model-status")).toContainText("Campus overview · First floor: 3 references aligned");
  await expect(page.locator("#campus-overview")).toHaveAttribute("aria-pressed","true");
  await expect(page.locator("#floor-title")).toHaveText("Campus overview");
  await expect(page.locator("#floor")).toBeHidden();
  await expect(page.locator("#model-status")).toHaveAttribute("data-visible-models",'["ucc-first-floor","campus-exterior"]');
  const colliders = await page.locator("#model-status").getAttribute("data-colliders");
  const position = await page.locator("#travel-status").getAttribute("data-position");
  await page.screenshot({ path:`${output}/campus-overview.png`,fullPage:true });
  const metrics = await page.evaluate(async () => {
    const canvas = document.querySelector("canvas")!, gl = canvas.getContext("webgl2")!;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    const frames: number[] = [];
    await new Promise<void>((resolve) => {
      let start = 0, previous = 0;
      function sample(now: number): void {
        if (!start) start = now;
        if (previous) frames.push(now-previous);
        previous = now;
        if (now-start < 5000) requestAnimationFrame(sample); else resolve();
      }
      requestAnimationFrame(sample);
    });
    const memory = (performance as unknown as { memory?: { usedJSHeapSize:number;totalJSHeapSize:number;jsHeapSizeLimit:number } }).memory;
    const sorted = [...frames].sort((a,b) => a-b);
    return { renderer,averageFps:1000*frames.length/frames.reduce((sum,ms) => sum+ms,0),p95FrameMs:sorted[Math.floor(sorted.length*0.95)],samples:frames.length,
      resourceTimings:performance.getEntriesByType("resource").filter((entry) => entry.name.endsWith(".glb")).map((entry) => {
        const timing = entry as PerformanceResourceTiming;
        return { url:new URL(entry.name).pathname,durationMs:entry.duration,transferSize:timing.transferSize,decodedBodySize:timing.decodedBodySize };
      }),
      jsHeap:memory ? { usedBytes:memory.usedJSHeapSize,totalBytes:memory.totalJSHeapSize,limitBytes:memory.jsHeapSizeLimit } : null };
  });
  await page.locator("#zoom-in").click(); await page.locator("#zoom-in").click();
  await page.screenshot({ path:`${output}/campus-close.png`,fullPage:true });
  await page.locator("#isometric").click();
  await expect(page.locator("#model-status")).toHaveAttribute("data-loaded-models",'["ucc-first-floor"]');
  await expect(page.locator("#model-status")).toHaveAttribute("data-colliders",colliders!);
  await expect(page.locator("#floor")).toBeVisible();
  expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(position);
  await page.screenshot({ path:`${output}/floor-after-overview.png`,fullPage:true });
  const manifest = await (await request.get("/app/models/campus-manifest.json")).json();
  const exterior = manifest.models.find((entry: { kind?:string }) => entry.kind === "exterior");
  const response = await request.get(`/app/${exterior.model}`);
  expect(createHash("sha256").update(await response.body()).digest("hex")).toBe(exterior.modelSha256);
  await writeFile(`${output}/overview-metrics.json`,JSON.stringify({ checkedAt:new Date().toISOString(),exterior,colliders:Number(colliders),position,viewport:page.viewportSize(),headless:true,...metrics },null,2));
  expect(errors).toEqual([]);
  if (process.env.UNINAV_REQUIRE_FPS === "1") {
    expect(metrics.renderer).not.toMatch(/swiftshader|software|llvmpipe/i);
    expect(metrics.averageFps).toBeGreaterThanOrEqual(30);
  }
});

test("an unavailable exterior falls back to the verified floor and can be retried", async ({ page }) => {
  await page.route("**/models/blocks/campus-exterior.glb",(route) => route.fulfill({ status:404,body:"Exterior missing" }));
  await page.goto("/app/");
  await expect(page.locator("#model-status")).toHaveText("Exterior unavailable · floor view");
  await expect(page.locator("#model-status")).toHaveAttribute("data-visible-models",'["ucc-first-floor"]');
  await expect(page.locator("#floor")).toBeVisible();
  await page.unroute("**/models/blocks/campus-exterior.glb");
  await page.locator("#campus-overview").click();
  await expect(page.locator("#model-status")).toContainText("Campus overview · First floor: 3 references aligned");
});

test("a changed exterior export is rejected while the verified floor stays usable", async ({ page, request }) => {
  const bytes = await (await request.get("/app/models/blocks/campus-exterior.glb")).body();
  bytes[bytes.length-1] ^= 1;
  await page.route("**/models/blocks/campus-exterior.glb",(route) => route.fulfill({ status:200,body:bytes,contentType:"model/gltf-binary" }));
  await page.goto("/app/");
  await expect(page.locator("#model-status")).toHaveText("Exterior unavailable · floor view");
  await expect(page.locator("#model-status")).toHaveAttribute("title",/exterior export changed/);
  await expect(page.locator("#model-status")).toHaveAttribute("data-colliders","137");
  await expect(page.locator("#isometric")).toHaveAttribute("aria-pressed","true");
});

test("route planning leaves overview and disables it until guidance is cancelled", async ({ page }) => {
  await page.goto("/app/");
  await expect(page.locator("#campus-overview")).toHaveAttribute("aria-pressed","true");
  await page.locator("#open-login").click();
  await page.getByLabel("Username",{ exact:true }).fill("student");
  await page.getByLabel("Password",{ exact:true }).fill("demo1234");
  await page.locator("#login-submit").click();
  await expect(page.locator("#session-user")).toHaveText("student");
  await page.locator("#search").fill("ICETEX");
  await page.locator("#place-list button").first().click();
  await page.locator("#calculate").click();
  await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");
  await expect(page.locator("#model-status")).toHaveAttribute("data-visible-models",'["ucc-first-floor"]');
  await expect(page.locator("#campus-overview")).toBeDisabled();
  const position = await page.locator("#travel-status").getAttribute("data-position");
  await page.locator("#cancel").click();
  await page.locator("#campus-overview").click();
  await expect(page.locator("#model-status")).toHaveAttribute("data-view","campus");
  expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(position);
});

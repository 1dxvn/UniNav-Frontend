import { test, expect } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

test("campus presentation: comparable views and measured frame cadence", async ({ page, request }) => {
  const places = await (await request.get("/buildings")).json() as { name: string }[];
  test.skip(!places.some((place) => place.name === "Hall Acceso"), "Requires the real campus.");
  const output = process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/c2";
  const stage = process.env.UNINAV_VISUAL_STAGE ?? "after";
  await mkdir(output, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app/");
  await expect(page.locator("#model-status")).toContainText("3 references aligned");
  await page.locator("#labels").click();
  await page.locator("#reset-view").click();
  await page.screenshot({ path: `${output}/${stage}-general.png`, fullPage: true });
  const measure = async () => page.evaluate(async () => {
    const canvas = document.querySelector("canvas")!;
    const gl = canvas.getContext("webgl2")!;
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
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
    const ordered = [...frames].sort((a,b) => a-b);
    return { renderer, samples:frames.length, durationMs:frames.reduce((sum,ms) => sum+ms,0),
      averageFps:1000*frames.length/frames.reduce((sum,ms) => sum+ms,0), p95FrameMs:ordered[Math.floor(ordered.length*0.95)] };
  });
  const general = await measure();
  await page.locator("#top-view").click();
  await page.screenshot({ path: `${output}/${stage}-top.png`, fullPage: true });
  const top = await measure();
  // Same cursor/zoom and framing in each stage; origin and avatar never move.
  const position = await page.locator("#travel-status").getAttribute("data-position");
  await page.locator("#isometric").click();
  expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(position);
  await page.locator("#labels").click();
  await page.locator("#open-login").click();
  await page.getByLabel("Username", { exact:true }).fill("student");
  await page.getByLabel("Password", { exact:true }).fill("demo1234");
  await page.locator("#login-submit").click();
  await expect(page.locator("#session-user")).toHaveText("student");
  await page.locator("#search").fill("ICETEX");
  await page.locator("#place-list button").first().click();
  await page.locator("#calculate").click();
  await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");
  await page.locator("#follow").click();
  await expect(page.locator("#travel-status")).toHaveAttribute("data-state","walking");
  const walking = await measure();
  await page.locator("#follow").click();
  await expect(page.locator("#travel-status")).toHaveAttribute("data-state","paused");
  await page.screenshot({ path:`${output}/${stage}-walking.png`,fullPage:true });
  const bytes = await readFile("public/models/campus.glb");
  const served = await request.get("/app/models/campus.glb");
  const modelSha256 = createHash("sha256").update(bytes).digest("hex");
  expect(createHash("sha256").update(await served.body()).digest("hex")).toBe(modelSha256);
  await writeFile(`${output}/${stage}-performance.json`, JSON.stringify({
    checkedAt:new Date().toISOString(), modelSha256, rendererMode:process.env.UNINAV_RENDERER ?? "software",
    viewport:page.viewportSize(), headless:true, general, top, walking,
  },null,2));
  expect(errors).toEqual([]);
  if (process.env.UNINAV_REQUIRE_FPS === "1") {
    expect(general.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
    expect(general.averageFps).toBeGreaterThanOrEqual(30);
    expect(top.averageFps).toBeGreaterThanOrEqual(30);
    expect(walking.averageFps).toBeGreaterThanOrEqual(30);
  }
});

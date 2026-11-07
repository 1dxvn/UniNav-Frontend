import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

test.beforeEach(async ({ request }) => {
  const places = await (await request.get("/buildings")).json() as { name:string }[];
  test.skip(!places.some((place) => place.name === "Hall Acceso"),"Requires the real campus.");
});

test("five structural previews preserve the actor and release GPU buffers on each visit", async ({ page }) => {
  test.setTimeout(120000);
  const output = process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/floor-previews";
  await mkdir(output,{ recursive:true });
  await page.addInitScript(() => {
    const buffers = new Set<WebGLBuffer>(), textures = new Set<WebGLTexture>();
    const counts = { liveBuffers:0,deletedBuffers:0,liveTextures:0,deletedTextures:0 };
    (window as unknown as { gpuCounts:typeof counts }).gpuCounts=counts;
    const p = WebGL2RenderingContext.prototype;
    const createBuffer=p.createBuffer, deleteBuffer=p.deleteBuffer, createTexture=p.createTexture, deleteTexture=p.deleteTexture;
    p.createBuffer=function() { const value=createBuffer.call(this); if (value) buffers.add(value); counts.liveBuffers=buffers.size; return value; };
    p.deleteBuffer=function(value) { if (value && buffers.delete(value)) counts.deletedBuffers++; counts.liveBuffers=buffers.size; deleteBuffer.call(this,value); };
    p.createTexture=function() { const value=createTexture.call(this); if (value) textures.add(value); counts.liveTextures=textures.size; return value; };
    p.deleteTexture=function(value) { if (value && textures.delete(value)) counts.deletedTextures++; counts.liveTextures=textures.size; deleteTexture.call(this,value); };
  });
  const errors: string[]=[]; page.on("pageerror",(error) => errors.push(error.message));
  await page.goto("/app/");
  await expect(page.locator("#model-status")).toContainText("3 references aligned");
  await page.locator("#isometric").click();
  await expect(page.locator("#model-status")).toHaveAttribute("data-loaded-models",'["ucc-first-floor"]');
  const position=await page.locator("#travel-status").getAttribute("data-position");
  const originOptions=await page.locator("#origin option").count();
  const counts=() => page.evaluate(() => ({ ...(window as unknown as { gpuCounts:Record<string,number> }).gpuCounts }));
  await page.waitForTimeout(200);
  const baseline=await counts(), cycles=[], performanceSamples=[];
  for (let cycle=0;cycle<2;cycle++) {
    for (const floor of [0,2,3,4,5]) {
      const id=`ucc-floor-${floor}-preview`;
      await page.locator("#floor").selectOption(String(floor));
      await expect(page.locator("#model-status")).toHaveText("Preview only · 3 structural references aligned");
      await expect(page.locator("#travel-status")).toHaveText("Inspecting this floor");
      await expect(page.locator("#travel-detail")).toContainText("routes on this floor are pending");
      await expect(page.locator("#model-status")).toHaveAttribute("data-visible-models",JSON.stringify([id]));
      await expect(page.locator("#model-status")).toHaveAttribute("data-loaded-models",JSON.stringify(["ucc-first-floor",id]));
      await expect(page.locator("#model-status")).toHaveAttribute("data-colliders","137");
      expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(position);
      expect(await page.locator("#origin option").count()).toBe(originOptions);
      // Hidden actor stays on its real floor, even if movement keys are pressed.
      await page.locator("canvas").focus(); await page.keyboard.down("w"); await page.waitForTimeout(150); await page.keyboard.up("w");
      expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(position);
      if (cycle===0) {
        await page.locator("#isometric").click();
        await page.screenshot({ path:`${output}/floor-${floor}-3d.png`,fullPage:true });
        if (floor===5) {
          const metrics=await page.evaluate(async () => {
            const gl=document.querySelector("canvas")!.getContext("webgl2")!;
            const info=gl.getExtension("WEBGL_debug_renderer_info");
            const frames:number[]=[];
            await new Promise<void>((resolve) => {
              let start=0,previous=0;
              const frame=(now:number) => { if (!start) start=now; if (previous) frames.push(now-previous); previous=now; if (now-start<3000) requestAnimationFrame(frame); else resolve(); };
              requestAnimationFrame(frame);
            });
            const sorted=[...frames].sort((a,b) => a-b);
            return { renderer:String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)),
              averageFps:1000*frames.length/frames.reduce((sum,n) => sum+n,0),p95FrameMs:sorted[Math.floor(sorted.length*0.95)],samples:frames.length };
          });
          performanceSamples.push({ floor,view:"3d",...metrics });
          if (process.env.UNINAV_REQUIRE_FPS==="1") { expect(metrics.renderer).not.toMatch(/swiftshader|software|llvmpipe/i); expect(metrics.averageFps).toBeGreaterThanOrEqual(30); }
        }
        await page.locator("#top-view").click();
        await page.screenshot({ path:`${output}/floor-${floor}-top.png`,fullPage:true });
      }
    }
    await page.locator("#floor").selectOption("1");
    await expect(page.locator("#model-status")).toHaveAttribute("data-loaded-models",'["ucc-first-floor"]');
    await page.waitForTimeout(200);
    const after=await counts(); cycles.push(after);
    expect(after.liveBuffers).toBeLessThanOrEqual(baseline.liveBuffers+8);
    expect(after.liveTextures).toBeLessThanOrEqual(baseline.liveTextures+2);
    expect(after.deletedBuffers).toBeGreaterThan(baseline.deletedBuffers);
  }
  expect(errors).toEqual([]);
  await writeFile(`${output}/gpu-resource-cycles.json`,JSON.stringify({ baseline,cycles,position,originOptions,performanceSamples,pageErrors:errors },null,2));
});

test("inspecting a preview preserves a paused route and resume restores the actor floor", async ({ page }) => {
  await page.goto("/app/"); await expect(page.locator("#model-status")).toContainText("3 references aligned");
  await page.locator("#open-login").click();
  await page.getByLabel("Username",{ exact:true }).fill("student");
  await page.getByLabel("Password",{ exact:true }).fill("demo1234");
  await page.locator("#login-submit").click(); await expect(page.locator("#session-user")).toHaveText("student");
  await page.locator("#search").fill("ICETEX"); await page.locator("#place-list button").first().click();
  await page.locator("#calculate").click(); await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");
  await page.locator("#follow").click(); await page.waitForTimeout(400); await page.locator("#follow").click();
  await expect(page.locator("#travel-status")).toHaveAttribute("data-state","paused");
  const position=await page.locator("#travel-status").getAttribute("data-position");
  await page.locator("#floor").selectOption("2");
  await expect(page.locator("#model-status")).toHaveText("Preview only · 3 structural references aligned");
  await expect(page.locator("#travel-status")).toHaveAttribute("data-state","paused");
  expect(await page.locator("#travel-status").getAttribute("data-position")).toBe(position);
  await expect(page.locator("#route-card")).toBeVisible();
  await page.locator("#follow").click(); await expect(page.locator("#floor")).toHaveValue("1");
  await expect(page.locator("#model-status")).toHaveAttribute("data-loaded-models",'["ucc-first-floor"]');
  await expect(page.locator("#travel-status")).toHaveAttribute("data-state","arrived",{ timeout:60000 });
});

test("a changed preview is rejected and returning to the first floor recovers", async ({ page, request }) => {
  const bytes=await (await request.get("/app/models/floor-2/campus.glb")).body(); bytes[bytes.length-1]^=1;
  await page.route("**/models/floor-2/campus.glb",(route) => route.fulfill({ status:200,body:bytes,contentType:"model/gltf-binary" }));
  await page.goto("/app/"); await expect(page.locator("#model-status")).toContainText("3 references aligned");
  await page.locator("#isometric").click();
  await page.locator("#floor").selectOption("2");
  await expect(page.locator("#model-status")).toHaveText("Floor preview unavailable · choose another floor");
  await expect(page.locator("#model-status")).toHaveAttribute("title",/Model export changed/);
  await expect(page.locator("#model-status")).toHaveAttribute("data-colliders","137");
  await page.locator("#floor").selectOption("1");
  await expect(page.locator("#model-status")).toContainText("3 references aligned");
  await page.unroute("**/models/floor-2/campus.glb");
  await page.locator("#floor").selectOption("2");
  await expect(page.locator("#model-status")).toHaveText("Preview only · 3 structural references aligned");
});

test("structural anchors cannot replace a navigable floor's API alignment", async ({ page, request }) => {
  const manifest=await (await request.get("/app/models/campus-manifest.json")).json();
  const reference=await (await request.get("/app/models/campus-reference.json")).json();
  reference.alignment="structural";
  for (const point of reference.references) point.planPosition=[point.position[0],-point.position[2]];
  const bytes=Buffer.from(JSON.stringify(reference));
  manifest.models.find((entry: { id:string }) => entry.id==="ucc-first-floor").referenceSha256=createHash("sha256").update(bytes).digest("hex");
  await page.route("**/models/campus-manifest.json",(route) => route.fulfill({ status:200,json:manifest }));
  await page.route("**/models/campus-reference.json",(route) => route.fulfill({ status:200,body:bytes,contentType:"application/json" }));
  await page.goto("/app/");
  await expect(page.locator("#model-status")).toHaveText("Model unavailable · using graph preview");
  await expect(page.locator("#model-status")).toHaveAttribute("title",/Structural references are reserved/);
});

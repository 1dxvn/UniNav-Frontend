import { test, expect } from "@playwright/test";

test("missing GLB shows a clear graph preview and recovers after reload", async ({ page, request }) => {
  const places = await (await request.get("/buildings")).json() as { name: string }[];
  test.skip(!places.some((place) => place.name === "Hall Acceso"), "Requires the real campus.");
  await page.route("**/app/models/campus.glb", (route) => route.fulfill({ status:404,body:"Model missing" }));
  await page.goto("/app/");
  await expect(page.locator("#model-status")).toHaveText("Model unavailable · using graph preview");
  await expect(page.locator("#references")).toBeHidden();
  await expect(page.locator("#api-status")).toContainText("Campus online");
  await expect(page.locator("#floor-title")).toHaveText("First floor");
  await page.unroute("**/app/models/campus.glb");
  await page.reload();
  await expect(page.locator("#model-status")).toContainText("3 references aligned");
  await expect(page.locator("#references")).toBeVisible();
});

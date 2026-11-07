import { expect } from "@playwright/test";
import { test } from "./isolated-campus.ts";

test("real API: isolated test destination returns no route, then an expired session recovers", async ({ page, request }) => {
  const places = await (await request.get("/buildings")).json() as { name: string }[];
  expect(places).toHaveLength(20);
  expect(places.some((place) => place.name === "Isolated test destination")).toBe(true);
  const catalog = await (await request.get("/campus/catalog")).json();
  expect(catalog.available).toBe(true);
  expect(catalog.catalog.revision).toBe("dwg-a35f892");
  await page.goto("/app/");
  await expect(page.locator("#model-status")).toContainText("3 references aligned");
  await page.locator("#open-login").click();
  await page.getByLabel("Username", { exact: true }).fill("student");
  await page.getByLabel("Password", { exact: true }).fill("demo1234");
  await page.locator("#login-submit").click();
  await expect(page.locator("#session-user")).toHaveText("student");
  await page.locator("#search").fill("Isolated test destination");
  await page.locator("#place-list button").first().click();
  const response = page.waitForResponse((response) => response.url().endsWith("/routes/calculate"));
  await page.locator("#calculate").click();
  expect((await response).status()).toBe(404);
  await expect(page.locator("#route-error")).toContainText("There is no route");
  await expect(page.locator("#route-card")).toBeHidden();
  // Recovery uses a reachable real destination before expiring its token.
  await page.locator("#search").fill("Preclinic");
  await page.locator("#place-list button").first().click();
  await page.locator("#calculate").click();
  await expect(page.locator("#travel-status")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#route-error")).toBeHidden();
  await page.route("**/routes/calculate", async (route) => route.continue({ headers: { ...route.request().headers(), authorization: "Bearer expired-test-token" } }));
  await page.locator("#calculate").click();
  await expect(page.locator("#auth-dialog")).toBeVisible();
  await expect(page.locator("#session")).toBeHidden();
});

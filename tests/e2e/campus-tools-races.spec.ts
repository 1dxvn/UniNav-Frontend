import { expect,type Page } from "@playwright/test";
import { mkdir,writeFile } from "node:fs/promises";
import { test } from "./isolated-campus.ts";
const output=process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/resumed-review";
test.use({campusProfile:"ucc-six-floors-c18"});
async function login(page:Page){await page.locator("#open-login").click();await page.getByLabel("Username",{exact:true}).fill("student");await page.getByLabel("Password",{exact:true}).fill("demo1234");await page.locator("#login-submit").click();await expect(page.locator("#session-user")).toHaveText("student");}
for(const status of [200,500])test(`late history ${status} cannot replace the selected assistant tab`,async({page})=>{
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-six-floors-c18");await login(page);
  let release!:()=>void;const gate=new Promise<void>(r=>release=r);
  await page.route("**/users/me/stats",async r=>{const response=await r.fetch();await gate;await r.fulfill(status===200 ? {response}:{status:500,json:{detail:"Late history failure"}});});
  try{
    const requested=page.waitForRequest(r=>r.url().endsWith("/users/me/stats"));await page.locator("#tool-history").click();await requested;await page.locator("#tool-assistant").click();await expect(page.locator("#assistant-question")).toBeVisible();
    const response=page.waitForResponse(r=>r.url().endsWith("/users/me/stats"));release();await(await response).finished();await page.waitForTimeout(100);await expect(page.locator("#assistant-question")).toBeVisible();await expect(page.locator("#tool-assistant")).toHaveAttribute("aria-selected","true");
    await mkdir(output,{recursive:true});await writeFile(`${output}/late-history-${status}.json`,JSON.stringify({status,selectedTab:"assistant",lateHistoryIgnored:true},null,2));
  }finally{release();}
});
test("sign out invalidates pending private history",async({page})=>{
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-six-floors-c18");await login(page);
  let release!:()=>void;const gate=new Promise<void>(r=>release=r);
  await page.route("**/users/me/stats",async r=>{const response=await r.fetch();await gate;await r.fulfill({response});});
  try{
    const requested=page.waitForRequest(r=>r.url().endsWith("/users/me/stats"));await page.locator("#tool-history").click();await requested;await page.locator("#logout").click();await expect(page.getByRole("button",{name:"Sign in to continue"})).toBeVisible();
    const response=page.waitForResponse(r=>r.url().endsWith("/users/me/stats"));release();await(await response).finished();await page.waitForTimeout(100);await expect(page.locator("#history-stats")).toHaveCount(0);await expect(page.getByRole("button",{name:"Sign in to continue"})).toBeVisible();await expect(page.locator("#nav-back")).toBeDisabled();
    await mkdir(output,{recursive:true});await writeFile(`${output}/logout-history.json`,JSON.stringify({signedOut:true,privateHistoryNotRestored:true},null,2));
  }finally{release();}
});
test("a prior session's navigation response cannot enable signed-out controls",async({page})=>{
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-six-floors-c18");
  let release!:()=>void;const gate=new Promise<void>(r=>release=r);
  await page.route("**/navigation",async r=>{const response=await r.fetch();await gate;await r.fulfill({response,json:{current:null,can_go_back:true,can_go_forward:true}});});
  try{
    const requested=page.waitForRequest(r=>r.url().endsWith("/navigation"));await login(page);await requested;await page.locator("#logout").click();await expect(page.locator("#nav-back")).toBeDisabled();
    const response=page.waitForResponse(r=>r.url().endsWith("/navigation"));release();await(await response).finished();await page.waitForTimeout(100);await expect(page.locator("#nav-back")).toBeDisabled();await expect(page.locator("#nav-forward")).toBeDisabled();
    await mkdir(output,{recursive:true});await writeFile(`${output}/logout-navigation.json`,JSON.stringify({signedOut:true,lateNavigationIgnored:true},null,2));
  }finally{release();}
});

import { expect,type Page } from "@playwright/test";
import { mkdir,writeFile } from "node:fs/promises";
import type { Building } from "../../src/api/types.ts";
import { test } from "./isolated-campus.ts";
// Plan 1 §11 functions, Plan 3 avatar and the minimap on the production launcher (six-floor profile, isolated database).
// Uses the project's seeded demo accounts (scripts/seed.py) on the temporary database only.
const output=process.env.UNINAV_EVIDENCE_DIR ?? "docs/verification/campus-tools";
test.use({campusProfile:"ucc-six-floors-c18"});
async function login(page:Page,user:string){await page.locator("#open-login").click();await page.getByLabel("Username",{exact:true}).fill(user);await page.getByLabel("Password",{exact:true}).fill("demo1234");await page.locator("#login-submit").click();await expect(page.locator("#session-user")).toHaveText(user);}
async function walk(page:Page){await expect(page.locator("#travel-status")).toHaveAttribute("data-state","ready");await page.locator("#follow").click();await expect(page.locator("#scene")).toHaveAttribute("data-avatar","glb:Walk",{timeout:15000});await expect(page.locator("#travel-status")).toHaveAttribute("data-state","arrived",{timeout:140000});await expect(page.locator("#scene")).toHaveAttribute("data-avatar","glb:Idle",{timeout:5000});}

test("assistant, history, back/forward, queues, rankings, minimap and avatar clips",async({page,request})=>{
  test.setTimeout(420000);await mkdir(output,{recursive:true});const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  const places=await(await request.get("/buildings")).json() as Building[];expect(places).toHaveLength(235);
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-six-floors-c18");
  await expect(page.locator("#scene")).toHaveAttribute("data-avatar","glb:Idle",{timeout:20000});
  await login(page,"student");
  // assistant -> route (floor 0 waiting room) -> walk
  await page.locator("#tool-assistant").click();await page.locator("#assistant-question").fill("sala de espera piso cero");await page.locator("#assistant-ask").click();
  await expect(page.locator("#assistant-answers li").first()).toContainText("Waiting room · floor 0");
  await page.locator("#assistant-answers li").first().getByRole("button",{name:"Go ↗"}).click();
  await expect(page.locator("#route-card")).toBeVisible();await expect(page.locator("#minimap")).not.toHaveAttribute("data-route-points","0");
  const firstAvatar=await page.locator("#minimap").getAttribute("data-avatar");await walk(page);
  expect(await page.locator("#minimap").getAttribute("data-avatar")).not.toBe(firstAvatar);await expect(page.locator("#minimap")).toHaveAttribute("data-floor","0");
  await page.screenshot({path:`${output}/assistant-arrival.png`});
  // second destination by assistant, room number -> floor 5
  await page.locator("#assistant-question").fill("aula 512");await page.locator("#assistant-ask").click();
  await expect(page.locator("#assistant-answers li").first()).toContainText("512A");
  await page.locator("#assistant-answers li").first().getByRole("button",{name:"Go ↗"}).click();await walk(page);
  await expect(page.locator("#minimap")).toHaveAttribute("data-floor","5");
  // back / forward over the two recorded visits
  await expect(page.locator("#nav-back")).toBeEnabled();await page.locator("#nav-back").click();await expect(page.locator("#destination-name")).toHaveText("Waiting room · floor 0");
  await expect(page.locator("#nav-forward")).toBeEnabled();await page.locator("#nav-forward").click();await expect(page.locator("#destination-name")).toHaveText("Classroom 512A · floor 5");
  // history and statistics
  await page.locator("#tool-history").click();await expect(page.locator("#history-stats")).toContainText("Routes");
  await expect(page.locator("#history-list li")).toHaveCount(2);const history=await page.locator("#history-list").innerText();
  // queue at the destination and rankings
  await page.locator("#tool-queues").click();await expect(page.locator("#queue-status")).toContainText("0 waiting");
  await page.locator("#queue-toggle").click();await expect(page.locator("#queue-status")).toContainText("you are number 1");
  await page.locator("#queue-toggle").click();await expect(page.locator("#queue-status")).toContainText("0 waiting");
  await expect(page.locator("#ranking-list li").first()).toContainText(/\d+ visits?/);const ranking=await page.locator("#ranking-list").innerText();
  await page.screenshot({path:`${output}/queues-rankings.png`});
  expect(errors).toEqual([]);
  await writeFile(`${output}/functions.json`,JSON.stringify({profile:"ucc-six-floors-c18",history,ranking,avatarClips:["Idle","Walk"],errors},null,2));
});

test("admin edits a place, builds a guided tour and a student follows it",async({page,browser})=>{
  test.setTimeout(300000);await mkdir(output,{recursive:true});const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/app/");await expect(page.locator("#model-status")).toHaveAttribute("data-profile","ucc-six-floors-c18");await login(page,"admin");
  await expect(page.locator("#tool-admin")).toBeVisible();
  const pick=async(text:string)=>{await page.locator("#search").fill(text);await page.locator("#place-list button").first().click();};
  await pick("Clinical Simulation Lab");await page.locator("#tool-admin").click();
  await page.locator("#admin-display-name").fill("Clinical Simulation Lab · floor 0");await page.locator("#admin-save").click();await expect(page.locator(".tool-note")).toContainText("Saved");
  await page.locator("#admin-add-stop").click();await pick("Waiting room · floor 0");await page.locator("#tool-admin").click();await page.locator("#admin-add-stop").click();
  await expect(page.locator("#admin-tour-stops li")).toHaveCount(2);await page.locator("#admin-tour-name").fill("Piso cero");await page.locator("#admin-create-tour").click();
  await expect(page.locator(".tool-note")).toContainText("with 2 stops");
  // a student starts the tour and walks to its first stop
  const student=await browser.newPage();student.on("pageerror",e=>errors.push(e.message));
  await student.goto(page.url());await login(student,"student");await student.locator("#tool-tours").click();
  await student.locator("#tour-list li",{hasText:"Piso cero"}).getByRole("button",{name:"Start ↗"}).click();
  await expect(student.locator("#tour-session")).toContainText("STOP 1 OF 2");await student.locator("#tour-go").click();
  await expect(student.locator("#route-card")).toBeVisible();await walk(student);
  await student.locator("#tool-tours").click();await student.locator("#tour-session").getByRole("button",{name:"Next →"}).click();await expect(student.locator("#tour-session")).toContainText("STOP 2 OF 2");
  await student.screenshot({path:`${output}/tour.png`});await student.close();
  expect(errors).toEqual([]);
});

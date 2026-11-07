import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

// Diagnostic section from the measured lower treads and the documented repeated
// upper flight. It illustrates the collision report, not an accepted route.
const directory="docs/verification/c11";
const report=JSON.parse(await readFile(`${directory}/stair-clearance.json`,"utf8"));
const points=report.stairs[0].measuredTreadsAndLanding.slice(0,10) as number[][];
const X=(y:number) => 90+(y-55.9)*220, Y=(h:number) => 640-(h-3.2)*100;
let shapes="";
for (let i=0;i<points.length;i++) {
  const y=-points[i][2],height=points[i][1],left=X(y-0.15),width=66;
  shapes+=`<rect x="${left}" y="${Y(height)}" width="${width}" height="${Y(3.5)-Y(height)}" fill="#c4cbc7" stroke="#596c63"/>`;
  shapes+=`<rect x="${left}" y="${Y(height+2.94)}" width="${width}" height="${Y(6.44)-Y(height+2.94)}" fill="#eed7cf" stroke="#9f5a44"/>`;
}
const head=points.map((p) => `${X(-p[2])},${Y(p[1]+1.8)}`).join(" ");
for (const level of [3.5,4.5,5.5,6.44,7.5]) shapes+=`<path d="M70 ${Y(level)}H900" stroke="#dce3df"/><text x="18" y="${Y(level)+5}">${level.toFixed(2)}</text>`;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="760" viewBox="0 0 1000 760"><rect width="1000" height="760" fill="#fbfcfa"/><g font-family="Arial,sans-serif" font-size="17" fill="#193f34"><text x="55" y="45" font-size="25">C11 · lower-flight head clearance</text><text x="55" y="78">Both towers: west x=14.65 / east x=36.35 · plan +Y, not geographic north</text>${shapes}<polyline points="${head}" fill="none" stroke="#126b99" stroke-width="4"/><text x="110" y="${Y(5.7)}" fill="#126b99">Head envelope: feet +1.80 m</text><path d="M${X(59.05)} ${Y(4.9)}V${Y(6.44)}" stroke="#a23723" stroke-width="3"/><text x="790" y="${Y(5.8)}" fill="#a23723">1.54 m</text><text x="790" y="${Y(5.55)}" fill="#a23723">clearance</text><text x="110" y="${Y(7.65)}" fill="#9f5a44">Upper repeated flight: solid underside at Y=6.44</text><text x="110" y="${Y(3.35)}">Lower flight · measured GLB tread heights</text><text x="390" y="685">Plan Y (m): 55.9 → 59.2</text><text x="55" y="724" font-size="15">Sources: 9ac3795 / 099c212 · geometric inspection only · vertical navigation remains disabled</text></g></svg>`;
await writeFile(`${directory}/head-clearance-section.svg`,svg);
const browser=await chromium.launch({ executablePath:process.env.UNINAV_BROWSER ?? "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",headless:true });
try {
  const page=await browser.newPage({ viewport:{ width:1000,height:760 },deviceScaleFactor:1 });
  await page.setContent(svg); await page.screenshot({ path:`${directory}/head-clearance-section.png` });
} finally { await browser.close(); }

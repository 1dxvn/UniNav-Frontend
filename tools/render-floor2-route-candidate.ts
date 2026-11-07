import { readFile,writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Group,Mesh,Vector3 } from "three";
import { chromium } from "@playwright/test";
import { parseModelGeometry } from "./model-geometry.ts";
import { committedAsset } from "./reviewed-assets.ts";

const output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/h2-floor2-candidate";
const report=JSON.parse(await readFile(`${output}/route-candidate-checks.json`,"utf8"));
const dataset=JSON.parse(await readFile(`${output}/dataset-candidate.json`,"utf8"));
const bytes=report.sourceCommit ? await committedAsset(report.sourceCommit,"models/floor-2/campus.glb") : await readFile("public/models/floor-2/campus.glb");
if(createHash("sha256").update(bytes).digest("hex")!==report.sources.find((s:{path:string})=>s.path.endsWith(".glb")).sha256)throw new Error("Model changed after candidate preparation.");
const root=new Group();root.position.y=6.44;root.add((await parseModelGeometry(bytes)).scene);root.updateMatrixWorld(true);
const X=(x:number)=>80+(x-20)*30,Y=(y:number)=>70+(68-y)*30;
let drawing="";
for(let x=20;x<=52;x++)drawing+=`<path d="M${X(x)} 70V640" stroke="#e6ebe5"/><text x="${X(x)}" y="660">${x}</text>`;
for(let y=49;y<=68;y++)drawing+=`<path d="M80 ${Y(y)}H1040" stroke="#e6ebe5"/><text x="45" y="${Y(y)+5}">${y}</text>`;
root.traverse(object=>{
  if(!(object instanceof Mesh) || !/Walls|Columns|Glass|Doors/.test(object.name))return;
  const a=object.geometry.attributes.position,index=object.geometry.index;
  for(let i=0;i<(index?.count ?? a.count);i+=3){
    const v=[0,1,2].map(n=>new Vector3().fromBufferAttribute(a,index ? index.getX(i+n):i+n).applyMatrix4(object.matrixWorld)),hits=[];
    for(let j=0;j<3;j++){const p=v[j],q=v[(j+1)%3];if((p.y<7.64 && q.y>=7.64)||(q.y<7.64 && p.y>=7.64))hits.push(p.clone().lerp(q,(7.64-p.y)/(q.y-p.y)));}
    if(hits.length===2)drawing+=`<path d="M${X(hits[0].x)} ${Y(-hits[0].z)}L${X(hits[1].x)} ${Y(-hits[1].z)}" fill="none" stroke="${/Doors/.test(object.name) ? "#af793b":/Glass/.test(object.name) ? "#6a9ca8":"#42594d"}" stroke-width="2"/>`;
  }
});
const byCode=new Map<string,{x:number;y:number;floor:number}>(dataset.places.map((p:{code:string})=>[p.code,p]));
for(const e of dataset.paths){const a=byCode.get(e.source_code),b=byCode.get(e.target_code);if(a?.floor===2 && b?.floor===2)drawing+=`<path d="M${X(a.x)} ${Y(a.y)}L${X(b.x)} ${Y(b.y)}" fill="none" stroke="#18856b" stroke-width="3"/>`;}
for(const [i,d] of report.destinations.entries()){
  const p=byCode.get(d.code)!;drawing+=`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="6" fill="#18856b"/><text x="${X(p.x)+10}" y="${Y(p.y)+16}">${i+1}</text>`;
  for(const label of d.sourceLabels)drawing+=`<circle cx="${X(label.xy[0])}" cy="${Y(label.xy[1])}" r="3" fill="#315caf"/><text x="${X(label.xy[0])+5}" y="${Y(label.xy[1])-5}" font-size="11">${label.text}</text>`;
}
drawing+=`<circle cx="${X(25.83)}" cy="${Y(53.088)}" r="4" fill="#315caf"/><text x="${X(25.83)+5}" y="${Y(53.088)-8}">HALL ASCENSORES</text>`;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="780"><rect width="1100" height="780" fill="#fafcf9"/><g font-family="Arial" font-size="12" fill="#173d31"><text x="45" y="30" font-size="21">Floor 2 route candidate: source plan and exported architecture</text><text x="45" y="52">Plan metres; +Y is the drawing axis. Green: candidate route. Blue: literal CAD labels. Not activated.</text><svg x="0" y="65" width="1100" height="580" viewBox="0 65 1100 580">${drawing}</svg>${report.destinations.map((d:{name:string},i:number)=>`<text x="65" y="${695+i*22}">${i+1}. ${d.name}</text>`).join("")}</g></svg>`;
await writeFile(`${output}/route-plan.svg`,svg);
const browser=await chromium.launch({executablePath:process.env.UNINAV_BROWSER ?? "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",headless:true});
try{const page=await browser.newPage({viewport:{width:1100,height:780}});await page.setContent(svg);await page.screenshot({path:`${output}/route-plan.png`});}finally{await browser.close();}

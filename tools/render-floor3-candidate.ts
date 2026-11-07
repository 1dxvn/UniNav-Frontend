import { readFile,writeFile } from "node:fs/promises";
import { Group,Mesh,Vector3 } from "three";
import { chromium } from "@playwright/test";
import { committedRepositoryAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";

const output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/floor3";
const report=JSON.parse(await readFile(`${output}/geometry.json`,"utf8")),data=JSON.parse(await readFile(`${output}/dataset-candidate.json`,"utf8"));
function section(root:Group,height:number,X:(n:number)=>number,Y:(n:number)=>number){
  let svg="";root.traverse(o=>{
    if(!(o instanceof Mesh) || !/Walls|Columns|Glass|Doors/.test(o.name))return;
    const a=o.geometry.attributes.position,index=o.geometry.index;
    for(let i=0;i<(index?.count ?? a.count);i+=3){
      const points=[0,1,2].map(n=>new Vector3().fromBufferAttribute(a,index ? index.getX(i+n):i+n).applyMatrix4(o.matrixWorld)),hits=[];
      for(let j=0;j<3;j++){const p=points[j],q=points[(j+1)%3];if((p.y<height && q.y>=height)||(q.y<height && p.y>=height))hits.push(p.clone().lerp(q,(height-p.y)/(q.y-p.y)));}
      if(hits.length===2)svg+=`<path d="M${X(hits[0].x)} ${Y(-hits[0].z)}L${X(hits[1].x)} ${Y(-hits[1].z)}" stroke="${/Glass/.test(o.name) ? "#6b9da8":/Doors/.test(o.name) ? "#b77835":"#40584c"}" stroke-width="2" fill="none"/>`;
    }
  });return svg;
}
const X=(x:number)=>65+(x-33)*25,Y=(y:number)=>80+(68-y)*25;
const upper=new Group();upper.position.y=9.38;upper.add((await parseModelGeometry(await committedRepositoryAsset("002aaec","model/candidates/c16/floor-3.glb"))).scene);upper.updateMatrixWorld(true);
let drawing=section(upper,11.07,X,Y);
const byCode=new Map<string,{x:number;y:number;floor:number}>(data.places.map((p:{code:string})=>[p.code,p]));
for(const e of data.paths){const a=byCode.get(e.source_code),b=byCode.get(e.target_code);if(a?.floor===3 && b?.floor===3)drawing+=`<path d="M${X(a.x)} ${Y(a.y)}L${X(b.x)} ${Y(b.y)}" stroke="#17866b" stroke-width="3" fill="none"/>`;}
for(const [i,d] of report.destinations.entries()){
  const p=byCode.get(d.code)!;drawing+=`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="5" fill="#17866b"/><text x="${X(p.x)+8}" y="${Y(p.y)+15}">${i+1}</text>`;
  for(const l of d.sourceLabels)drawing+=`<circle cx="${X(l.xy[0])}" cy="${Y(l.xy[1])}" r="3" fill="#3467ad"/><text x="${X(l.xy[0])+4}" y="${Y(l.xy[1])-5}" font-size="9">${l.text}</text>`;
}
const lower=new Group();lower.position.y=6.44;lower.add((await parseModelGeometry(await committedRepositoryAsset("002aaec","model/candidates/c16/floor-2.glb"))).scene);lower.updateMatrixWorld(true);
const X2=(x:number)=>80+(x-34)*70,Y2=(y:number)=>660+(57-y)*70;
let inset=section(lower,7.38,X2,Y2);
inset+=`<path d="M${X2(38.7)} ${Y2(54.7)}H${X2(36.35)}V${Y2(55.9)}" stroke="#17866b" stroke-width="4" fill="none"/><circle cx="${X2(38.7)}" cy="${Y2(54.7)}" r="5" fill="#17866b"/><circle cx="${X2(36.35)}" cy="${Y2(55.9)}" r="5" fill="#17866b"/>`;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="940"><rect width="1120" height="940" fill="#fafcf9"/><g font-family="Arial" font-size="13" fill="#173d31"><text x="35" y="28" font-size="22">Floor 3 route candidate: source doors, labels and exported architecture</text><text x="35" y="52">C16 @002aaec, inventory @389cfd9. Drawing metres; +Y is not geographic north. Green: candidate paths.</text><svg x="0" y="65" width="1120" height="490" viewBox="0 65 1120 490">${drawing}</svg><text x="35" y="592" font-size="18">Floor 2: existing north corridor to the next stair foot</text><svg x="45" y="610" width="460" height="290" viewBox="45 610 460 290">${inset}</svg><text x="555" y="650">The old 1-2 arrival is not the next 2-3 stair foot.</text><text x="555" y="675">The verified lower corridor supplies their connection.</text>${report.destinations.map((d:{name:string},i:number)=>`<text x="555" y="${730+i*25}">${i+1}. ${d.name}</text>`).join("")}<text x="555" y="840">Blue: literal CAD laboratory/classroom co-labels.</text><text x="555" y="865">No development database has been changed.</text></g></svg>`;
await writeFile(`${output}/route-plan.svg`,svg);
const browser=await chromium.launch({executablePath:process.env.UNINAV_BROWSER ?? "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",headless:true});
try{const page=await browser.newPage({viewport:{width:1120,height:940}});await page.setContent(svg);await page.screenshot({path:`${output}/route-plan.png`});}finally{await browser.close();}

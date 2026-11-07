import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { Group, Mesh, Raycaster, Vector3 } from "three";
import { committedAsset } from "./reviewed-assets.ts";
import { parseModelGeometry } from "./model-geometry.ts";
import { modelColliders, modelCollision } from "../src/scene/modelCollision.ts";

const commit=process.env.UNINAV_AUDIT_COMMIT ?? "a2dbda0", output=process.env.UNINAV_VERIFY_DIR ?? "docs/verification/c13";
await mkdir(output,{ recursive:true });
async function source(path:string) {
  const { stdout }=await promisify(execFile)("git",["show",`${commit}:${path}`],{ encoding:"utf8",maxBuffer:16*1024*1024,windowsHide:true });
  return JSON.parse(stdout);
}
const wing=await source("model/tools/data/floor2/wing.json");
const extras=await source("model/tools/data/floor2/extras.json");
const bytes=await committedAsset(commit,"models/floor-2/campus.glb");
const root=new Group(); root.position.y=6.44; root.add((await parseModelGeometry(bytes)).scene); root.updateMatrixWorld(true);
const colliders=modelColliders(root), slab=root.getObjectByName("P2_Floor_Slab")!;
function polyDistance(point:number[],poly:number[][]):number {
  let inside=false,minimum=Infinity;
  for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[j],b=poly[i],dx=b[0]-a[0],dy=b[1]-a[1];
    if ((a[1]>point[1])!==(b[1]>point[1]) && point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
    const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
    minimum=Math.min(minimum,Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy));
  }
  return inside ? 0 : minimum;
}
const furniture=extras.furniture as { poly:number[][] }[];
function locallyFree(x:number,y:number):boolean {
  if (furniture.some((p) => polyDistance([x,y],p.poly)<0.35)) return false;
  const p=new Vector3(x,6.44,-y);
  const supported=new Raycaster(p.clone().add(new Vector3(0,0.05,0)),new Vector3(0,-1,0),0,0.1).intersectObject(slab,true).length>0;
  return supported && [[0.06,0],[-0.06,0],[0,0.06],[0,-0.06]].every(([dx,dz]) => !modelCollision(p,p.clone().add(new Vector3(dx,0,dz)),colliders));
}
function segment(a:number[],b:number[]) {
  const from=new Vector3(a[0],6.44,-a[1]),to=new Vector3(b[0],6.44,-b[1]);
  const count=Math.max(1,Math.ceil(from.distanceTo(to)/0.05));
  for (let i=0;i<count;i++) {
    const p=from.clone().lerp(to,i/count),q=from.clone().lerp(to,(i+1)/count);
    const blocker=modelCollision(p,q,colliders);
    if (blocker) return { clear:false,firstBlocker:blocker.name,position:p.toArray() };
  }
  return { clear:true,firstBlocker:null };
}
const names=["BIBLIOTECA 1","AULA 201","AULA 220","HALL ASCENSORES","CIRCULACION"];
const results=[];
for (const text of names) {
  const label=wing.labels.find((p:{ text:string }) => p.text===text) as { text:string;xy:number[] };
  if (!label) throw new Error(`Missing source label ${text}.`);
  const options=[];
  for (let x=-6;x<=6;x++) for (let y=-6;y<=6;y++) if (x*x+y*y<=36) options.push([x*0.25,y*0.25]);
  options.sort((a,b) => Math.hypot(...a)-Math.hypot(...b));
  const offset=options.find(([dx,dy]) => locallyFree(label.xy[0]+dx,label.xy[1]+dy));
  const candidate=offset ? [label.xy[0]+offset[0],label.xy[1]+offset[1]] : null;
  const nearbyOpenings=extras.openings.map((p:{ center:number[];width:number;kind:string }) => ({ center:p.center,width:p.width,kind:p.kind,distanceFromLabel:Math.hypot(p.center[0]-label.xy[0],p.center[1]-label.xy[1]) }))
    .sort((a:{distanceFromLabel:number},b:{distanceFromLabel:number}) => a.distanceFromLabel-b.distanceFromLabel).slice(0,3);
  results.push({ sourceLabel:label,candidate,offsetMetres:offset ? Math.hypot(...offset) : null,nearbyOpenings,
    directFromEastStair:candidate ? segment([38.7,55.9],candidate) : null,
    status:"Unaccepted candidate: room membership, actual doorway and complete route still require review." });
}
const report={ commit,modelSha256:createHash("sha256").update(bytes).digest("hex"),elevation:6.44,results,
  note:"Source labels are not walking targets. No API places or connections were created. Nearby openings are not assigned to rooms." };
await writeFile(`${output}/floor2-access-audit.json`,JSON.stringify(report,null,2));

// Draw actual model wall/door sections and source furniture footprints, plus the
// labels/candidates. This diagram is review material, not a navigation graph.
const X=(x:number) => 40+(x+10)*10,Y=(y:number) => 45+(68-y)*10;
let drawing="";
root.traverse((object) => {
  if (!(object instanceof Mesh) || !/Walls|Columns|Glass|Doors/.test(object.name)) return;
  const a=object.geometry.attributes.position,index=object.geometry.index;
  for (let i=0;i<(index?.count ?? a.count);i+=3) {
    const v=[0,1,2].map((n) => new Vector3().fromBufferAttribute(a,index ? index.getX(i+n) : i+n).applyMatrix4(object.matrixWorld));
    const hits=[];
    for (let j=0;j<3;j++) { const p=v[j],q=v[(j+1)%3]; if ((p.y<7.64 && q.y>=7.64)||(q.y<7.64 && p.y>=7.64)) hits.push(p.clone().lerp(q,(7.64-p.y)/(q.y-p.y))); }
    if (hits.length===2) drawing+=`<path d="M${X(hits[0].x)} ${Y(-hits[0].z)}L${X(hits[1].x)} ${Y(-hits[1].z)}" stroke="#52675e" fill="none"/>`;
  }
});
for (const p of furniture) drawing+=`<polygon points="${p.poly.map(([x,y]) => `${X(x)},${Y(y)}`).join(" ")}" fill="#cad1cc"/>`;
for (const [i,r] of results.entries()) {
  drawing+=`<circle cx="${X(r.sourceLabel.xy[0])}" cy="${Y(r.sourceLabel.xy[1])}" r="4" fill="#236db3"/><text x="${X(r.sourceLabel.xy[0])+7}" y="${Y(r.sourceLabel.xy[1])-7}">${i+1}</text>`;
  if (r.candidate) drawing+=`<circle cx="${X(r.candidate[0])}" cy="${Y(r.candidate[1])}" r="5" stroke="#ba622d" fill="none"/>`;
}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800"><rect width="1000" height="800" fill="#fafcf9"/><g font-family="Arial" font-size="14" fill="#173d31"><text x="45" y="25" font-size="20">Floor 2 access audit · source ${commit.slice(0,8)} · inspection only</text>${drawing}${results.map((r,i) => `<text x="45" y="${710+i*17}">${i+1}. ${r.sourceLabel.text}</text>`).join("")}<text x="410" y="727">Blue: source label · orange: nearby free candidate</text><text x="410" y="750">No room entrance or API connection accepted.</text></g></svg>`;
await writeFile(`${output}/floor2-access-audit.svg`,svg);
const browser=await chromium.launch({ executablePath:process.env.UNINAV_BROWSER ?? "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",headless:true });
try {
  const page=await browser.newPage({ viewport:{ width:1000,height:800 },deviceScaleFactor:1 });
  await page.setContent(svg); await page.screenshot({ path:`${output}/floor2-access-audit.png` });
} finally { await browser.close(); }
console.log(JSON.stringify(results.map((r) => ({ label:r.sourceLabel.text,candidate:r.candidate,direct:r.directFromEastStair })),null,2));

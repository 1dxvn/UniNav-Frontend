import type { Building,PathKind,RouteResponse } from "./api/types.ts";
import { toScenePosition } from "./scene/coordinates.ts";

export interface RouteInstruction {
  firstStep:number; lastStep:number; kind:PathKind; phase:string; text:string; distance:number;
}
const internal=new Set(["waypoint","junction","corridor","reference"]);
const named=(p:Building)=>!internal.has(p.building_type ?? "");
const label=(p:Building)=>p.display_name ?? p.name;
const rise=(a:Building,b:Building)=>toScenePosition(b).y-toScenePosition(a).y;
const sign=(n:number)=>Math.abs(n)<.005 ? 0:Math.sign(n);

// Presentation only: every instruction retains its inclusive API edge range.
// Physical positions, route order and movement waypoints are never simplified.
export function routeInstructions(route:RouteResponse,points:Building[],floorName:(floor:number)=>string,
  connector?:{distance:number;kind:PathKind;floor:number}):RouteInstruction[]{
  if(points.length!==route.steps.length+1)throw new Error("Instruction points do not match the route.");
  const raw=route.steps.map((step,i)=>{
    const a=points[i],b=points[i+1],direction=sign(rise(a,b));
    let first=i,last=i;
    if(step.kind==="stairs"){
      while(first>0 && route.steps[first-1].kind==="stairs")first--;
      while(last+1<route.steps.length && route.steps[last+1].kind==="stairs")last++;
    }
    const blockDirections=Array.from({length:last-first+1},(_,n)=>sign(rise(points[first+n],points[first+n+1])));
    const hasHeight=blockDirections.some(s=>s!==0),before=blockDirections.slice(0,i-first).some(s=>s!==0),after=blockDirections.slice(i-first+1).some(s=>s!==0);
    const phase=step.kind==="stairs" ? direction>0 ? "up":direction<0 ? "down":hasHeight ? before && after ? "landing":after ? "enter":"exit":"steps"
      :step.kind==="ramp" ? direction>0 ? "up":direction<0 ? "down":"ramp":step.kind;
    return {firstStep:i,lastStep:i,kind:step.kind,phase,distance:toScenePosition(a).distanceTo(toScenePosition(b)),a,b,
      targetFloor:points[last+1].floor,changesFloor:new Set(blockDirections.filter(s=>s!==0)).size<=1 && points.slice(first,last+2).some(p=>p.floor!==points[first].floor)};
  });
  const groups:typeof raw=[];
  for(const item of raw){
    const previous=groups.at(-1);
    let merge=!!previous && previous.kind===item.kind && previous.phase===item.phase && previous.b.id===item.a.id;
    if(merge && !["stairs","elevator","ramp"].includes(item.kind)){
      merge=previous!.a.floor===previous!.b.floor && item.a.floor===item.b.floor && previous!.b.floor===item.b.floor && !named(item.a) &&
        Math.abs(rise(item.a,item.b))<.005 && Math.abs(rise(previous!.a,previous!.b))<.005;
      // Preserve corridor turns rather than reducing them to an endpoint line.
      const p=points[previous!.lastStep],q=item.a,r=item.b,u=[q.x-p.x,q.y-p.y],v=[r.x-q.x,r.y-q.y],length=Math.hypot(...u)*Math.hypot(...v);
      if(length<.000001 || (u[0]*v[0]+u[1]*v[1])/length<Math.cos(Math.PI/4))merge=false;
    }
    if(merge){previous!.lastStep=item.lastStep;previous!.distance+=item.distance;previous!.b=item.b;}
    else groups.push({...item});
  }
  const result:RouteInstruction[]=groups.map(g=>{
    let text:string;
    if(g.kind==="stairs")text=g.phase==="landing" ? "Cruza el descanso":g.phase==="enter" ? "Entra en la escalera":g.phase==="exit" ? "Sal de la escalera":g.phase==="up" ? "Sube por la escalera":g.phase==="down" ? "Baja por la escalera":"Utiliza los escalones señalados";
    else if(g.kind==="elevator")text=`Toma el ascensor hasta ${floorName(g.b.floor)}`;
    else if(g.kind==="ramp")text=`Sigue la rampa${g.phase==="up" ? " de subida":g.phase==="down" ? " de bajada":""}`;
    else text=named(g.b) ? `${g.kind==="outdoor" ? "Camina por el exterior":"Continúa"} hasta ${label(g.b)}`:g.kind==="outdoor" ? "Sigue el sendero exterior":"Sigue el pasillo";
    if(g.kind==="stairs" && g.changesFloor && g.phase!=="landing")text+=`${g.phase==="exit" ? " en":" hacia"} ${floorName(g.targetFloor)}`;
    return {firstStep:g.firstStep,lastStep:g.lastStep,kind:g.kind,phase:g.phase,text,distance:g.distance};
  });
  if(connector && (connector.distance>.001 || connector.floor!==points[0].floor))result.unshift({firstStep:-1,lastStep:-1,kind:connector.kind,phase:"connector",distance:connector.distance,
    text:connector.kind==="stairs" ? "Vuelve a la escalera":connector.kind==="ramp" ? "Vuelve a la rampa":"Vuelve al camino señalado"});
  return result;
}

export function activeInstruction(instructions:RouteInstruction[],waypoint:number):number{
  const step=waypoint-(instructions[0]?.phase==="connector" ? 2:1);
  return instructions.findIndex(i=>step>=i.firstStep && step<=i.lastStep);
}

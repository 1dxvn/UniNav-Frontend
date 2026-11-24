import type { Building,PathKind,RouteResponse } from "./api/types.ts";
import { toScenePosition } from "./scene/coordinates.ts";

export type Turn = "straight" | "slight-left" | "slight-right" | "left" | "right" | "back";
export interface RouteInstruction {
  firstStep:number; lastStep:number; kind:PathKind; phase:string; text:string; distance:number;
  // Guidance added on top of `text`: the turn taken to start this instruction, a named place next to that
  // turn, floors changed and the full sentence shown and read aloud (`cue`).
  turn?:Turn; landmark?:string; floors?:number; cue:string;
}
const internal=new Set(["waypoint","junction","corridor","reference"]);
const named=(p:Building)=>!internal.has(p.building_type ?? "");
const label=(p:Building)=>p.display_name ?? p.name;
const rise=(a:Building,b:Building)=>toScenePosition(b).y-toScenePosition(a).y;
const sign=(n:number)=>Math.abs(n)<.005 ? 0:Math.sign(n);

// Presentation only: every instruction retains its inclusive API edge range.
// Physical positions, route order and movement waypoints are never simplified.
export function routeInstructions(route:RouteResponse,points:Building[],floorName:(floor:number)=>string,
  connector?:{distance:number;kind:PathKind;floor:number},landmarks:Building[]=[]):RouteInstruction[]{
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
    else if(g.kind==="elevator"){
      const number=g.a.code?.match(/^ucc:elev-a([12]):/)?.[1];
      text=`Toma el ascensor${number ? " "+number : ""} hasta ${floorName(g.b.floor)}`;
    }
    else if(g.kind==="ramp")text=`Sigue la rampa${g.phase==="up" ? " de subida":g.phase==="down" ? " de bajada":""}`;
    else text=named(g.b) ? `${g.kind==="outdoor" ? "Camina por el exterior":"Continúa"} hasta ${label(g.b)}`:g.kind==="outdoor" ? "Sigue el sendero exterior":"Sigue el pasillo";
    if(g.kind==="stairs" && g.changesFloor && g.phase!=="landing")text+=`${g.phase==="exit" ? " en":" hacia"} ${floorName(g.targetFloor)}`;
    return {firstStep:g.firstStep,lastStep:g.lastStep,kind:g.kind,phase:g.phase,text,distance:g.distance,cue:text};
  });
  const destinationId=points.at(-1)?.id;
  result.forEach((step,index)=>{
    const g=groups[index],vertical=["stairs","elevator"].includes(step.kind);
    if(index>0 && !vertical && !["stairs","elevator"].includes(groups[index-1].kind)){
      const turn=turnAt(points,groups[index-1].lastStep+1,step.firstStep);
      if(turn)step.turn=turn;
    }
    const at=points[step.firstStep];
    if(index>0 && at && step.turn && step.turn!=="straight"){
      const landmark=nearestLandmark(at,landmarks,new Set([destinationId,g.b.id,at.id]));
      if(landmark)step.landmark=label(landmark);
    }
    const floors=Math.abs(points[step.lastStep+1].floor-points[step.firstStep].floor);
    if(vertical && floors>0)step.floors=floors;
    let cue=step.text;
    if(step.turn && step.turn!=="straight")cue=`${TURN_TEXT[step.turn]}${step.landmark ? ` junto a ${step.landmark}`:""} y ${cue.charAt(0).toLowerCase()}${cue.slice(1)}`;
    if(step.floors && step.floors>1)cue+=` (${step.floors} pisos)`;
    if(index===result.length-1 && !vertical)cue+=". Llegas a tu destino";
    if(step.distance>=1 && step.kind!=="elevator")cue+=` · ${Math.round(step.distance)} m`;
    step.cue=cue;
  });
  if(connector && (connector.distance>.001 || connector.floor!==points[0].floor)){
    const text=connector.kind==="stairs" ? "Vuelve a la escalera":connector.kind==="ramp" ? "Vuelve a la rampa":"Vuelve al camino señalado";
    result.unshift({firstStep:-1,lastStep:-1,kind:connector.kind,phase:"connector",distance:connector.distance,text,cue:text});
  }
  return result;
}

const TURN_TEXT:Record<Turn,string>={straight:"Sigue recto","slight-left":"Gira levemente a la izquierda","slight-right":"Gira levemente a la derecha",
  left:"Gira a la izquierda",right:"Gira a la derecha",back:"Da la vuelta"};

// Heading change at the start of an instruction, from about 2 m before to about 2 m after the turn point, in plan
// metres. Plan → scene keeps orientation (x, y) → (x, −z) with y up, so left and right are the walker's own.
function turnAt(points:Building[],turnIndex:number,firstStep:number):Turn|undefined{
  const at=points[turnIndex];if(!at)return;
  const reach=(step:number)=>{
    for(let i=turnIndex+step;i>=0 && i<points.length && points[i].floor===at.floor;i+=step){
      const d=Math.hypot(points[i].x-at.x,points[i].y-at.y);if(d>=2)return points[i];
    }
    const last=points[Math.min(points.length-1,Math.max(0,turnIndex+step))];
    return last && last.floor===at.floor && Math.hypot(last.x-at.x,last.y-at.y)>.3 ? last:undefined;
  };
  const before=reach(-1),after=reach(1);
  if(!before || !after || firstStep<0)return;
  const u=[at.x-before.x,at.y-before.y],v=[after.x-at.x,after.y-at.y];
  const angle=Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1])*180/Math.PI;
  const size=Math.abs(angle);
  if(size<25)return "straight";
  if(size>150)return "back";
  return angle>0 ? (size<60 ? "slight-left":"left"):(size<60 ? "slight-right":"right");
}

function nearestLandmark(at:Building,landmarks:Building[],exclude:Set<number|undefined>):Building|undefined{
  let best:Building|undefined,bestDistance=8;
  for(const place of landmarks){
    if(place.floor!==at.floor || exclude.has(place.id) || !named(place) || ["stairs","elevator"].includes(place.building_type ?? ""))continue;
    const d=Math.hypot(place.x-at.x,place.y-at.y);
    if(d<bestDistance){best=place;bestDistance=d;}
  }
  return best;
}

export function activeInstruction(instructions:RouteInstruction[],waypoint:number):number{
  const step=waypoint-(instructions[0]?.phase==="connector" ? 2:1);
  return instructions.findIndex(i=>step>=i.firstStep && step<=i.lastStep);
}

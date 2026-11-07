import type { RouteResponse } from "../api/types.ts";
import type { StairCrossing } from "./modelManifest.ts";
import type { WalkStart } from "./navigation.ts";
import { FOOT_SUPPORT_RADIUS } from "./walkSupport.ts";

function connectorCrossesBounds(start:WalkStart,bounds:NonNullable<StairCrossing["planBounds"]>):boolean {
  const [a,b]=start.connector,from=[a.x,-a.z],to=[b.x,-b.z];let first=0,last=1;
  for(let axis=0;axis<2;axis++){
    const low=bounds[axis]-FOOT_SUPPORT_RADIUS,high=bounds[axis+2]+FOOT_SUPPORT_RADIUS,d=to[axis]-from[axis];
    if(Math.abs(d)<1e-12){if(from[axis]<low || from[axis]>high)return false;continue;}
    const x=(low-from[axis])/d,y=(high-from[axis])/d;first=Math.max(first,Math.min(x,y));last=Math.min(last,Math.max(x,y));
    if(first>last)return false;
  }
  return true;
}

// Whole connections may cross a short flight even while an older API calls them
// corridors. Match actual adjacent hops, never all routes into a named area.
export function routeUsesStairs(route:RouteResponse,crossings:StairCrossing[]=[],start?:WalkStart):boolean {
  const crossed=(a:string,b:string,kind:string)=>kind==="stairs" || crossings.some(c=>
    (a===c.originName && b===c.destinationName) || (a===c.destinationName && b===c.originName));
  if(route.steps.some(s=>crossed(s.origin_name,s.destination_name,s.kind)))return true;
  if(!start?.path || start.connector[0].distanceTo(start.connector[1])<=0.001)return false;
  const {source_name:a,target_name:b,kind}=start.path;
  const known=crossings.filter(c=>(a===c.originName && b===c.destinationName) || (a===c.destinationName && b===c.originName));
  return known.length ? known.some(c=>!c.planBounds || connectorCrossesBounds(start,c.planBounds)):kind==="stairs";
}

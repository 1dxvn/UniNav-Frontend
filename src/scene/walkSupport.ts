import { Box3, Mesh, Object3D, Raycaster, Vector3 } from "three";
import type { ModelCollider } from "./modelCollision.ts";

export const MAX_STEP_HEIGHT = 0.20;
export const FOOT_SUPPORT_RADIUS = 0.12;

// Only explicitly reviewed floor/stair nodes can support feet. Furniture and
// presentation geometry remain obstacles, never automatic walking surfaces.
export function supportColliders(root: Object3D, names: string[]): ModelCollider[] {
  root.updateMatrixWorld(true);
  const meshes = new Set<Mesh>();
  for (const name of names) {
    const node = root.getObjectByName(name);
    if (!node) throw new Error(`Walking surface node is missing: ${name}.`);
    let found = false;
    node.traverse((object) => { if (object instanceof Mesh) { found=true; meshes.add(object); } });
    if (!found) throw new Error(`Walking surface has no geometry: ${name}.`);
  }
  return [...meshes].map((mesh) => ({ mesh,bounds:new Box3().setFromObject(mesh) }));
}

// A short substep cannot climb a wall, fall through a stair well, or acquire the
// floor above. The expected graph elevation also constrains which surface wins.
export function supportedStep(from: Vector3, expected: Vector3, surfaces: ModelCollider[], maxStepHeight = MAX_STEP_HEIGHT, stairGait = false): Vector3 | undefined {
  function height(x: number,z: number): number | undefined {
    const top=Math.max(from.y,expected.y)+maxStepHeight+0.005;
    const bottom=Math.min(from.y,expected.y)-maxStepHeight-0.005;
    const candidates=surfaces.filter(({ bounds }) => x>=bounds.min.x && x<=bounds.max.x && z>=bounds.min.z && z<=bounds.max.z && bounds.min.y<=top && bounds.max.y>=bottom);
    const hits=new Raycaster(new Vector3(x,top,z),new Vector3(0,-1,0),0,top-bottom).intersectObjects(candidates.map((c) => c.mesh),false);
    return hits.find((hit) => hit.face && hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y>0.65 &&
      Math.abs(hit.point.y-from.y)<=maxStepHeight+0.001 && Math.abs(hit.point.y-expected.y)<=maxStepHeight+0.001)?.point.y;
  }
  let y=height(expected.x,expected.z);
  // CAD risers can meet the landing with a narrow construction joint. A shoe
  // can bridge <= 4 cm when most of its perimeter is still on reviewed treads.
  // The default mode, including the unfinished upper floors, stays strict.
  if(stairGait) {
    if(y===undefined) {
      const near=[[.04,0],[-.04,0],[0,.04],[0,-.04]].map(([dx,dz])=>height(expected.x+dx,expected.z+dz)).filter((h):h is number=>h!==undefined);
      y=near.sort((a,b)=>Math.abs(a-expected.y)-Math.abs(b-expected.y))[0];
    }
    if(y===undefined)return;
    let supported=0;
    for(let i=0;i<8;i++) {
      const angle=i*Math.PI/4,side=height(expected.x+FOOT_SUPPORT_RADIUS*Math.cos(angle),expected.z+FOOT_SUPPORT_RADIUS*Math.sin(angle));
      if(side!==undefined && Math.abs(side-y)<=maxStepHeight+.001)supported++;
    }
    return supported>=6 ? new Vector3(expected.x,y,expected.z):undefined;
  }
  if (y===undefined) return;
  // A small foot footprint must have support too; a centre ray alone can stand
  // on an edge over a hole. Adjacent treads may differ by one allowed riser.
  for (const [dx,dz] of [[-FOOT_SUPPORT_RADIUS,0],[FOOT_SUPPORT_RADIUS,0],[0,-FOOT_SUPPORT_RADIUS],[0,FOOT_SUPPORT_RADIUS]]) {
    const side=height(expected.x+dx,expected.z+dz);
    if (side===undefined || Math.abs(side-y)>maxStepHeight+0.001) return;
  }
  return new Vector3(expected.x,y,expected.z);
}

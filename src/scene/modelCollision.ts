import { Box3, Mesh, Object3D, Raycaster, Vector3 } from "three";

export interface ModelCollider { mesh: Mesh; bounds: Box3 }
// Head 1.74 m + walking bob 0.035 m: use 1.80 m before accepting overhead
// clearance. Torso-only rays can pass under a solid stair underside.
export const BODY_RAY_HEIGHTS = [0.45,1.2,1.8] as const;
export const BODY_RADIUS = .22;

// Models remain static after their documented world transform is applied.
// Rebuild this cache whenever a model or its transform is replaced.
export function modelColliders(root: Object3D): ModelCollider[] {
  root.updateMatrixWorld(true);
  const result: ModelCollider[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh) { bodyIndexes.delete(object);result.push({ mesh:object, bounds:new Box3().setFromObject(object) }); }
  });
  return result;
}

interface BodyVertex { x:number;y:number;z:number }
interface BodyTriangle { vertices:BodyVertex[];minY:number;maxY:number }
const bodyIndexes=new WeakMap<Mesh,{triangles:BodyTriangle[];bins:Map<string,number[]>}>();
const BODY_BOTTOM=.29, BODY_TOP=1.8, BIN_SIZE=2;

function bodyIndex(mesh:Mesh) {
  let cached=bodyIndexes.get(mesh);if(cached)return cached;
  const position=mesh.geometry.getAttribute('position'),index=mesh.geometry.index;
  const triangles:BodyTriangle[]=[],bins=new Map<string,number[]>();
  const point=new Vector3();
  for(let i=0;i<(index?.count ?? position.count);i+=3) {
    const vertices=[0,1,2].map(k=>{ point.fromBufferAttribute(position,index ? index.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld);
      return {x:point.x,y:point.y,z:point.z}; });
    const id=triangles.length;
    triangles.push({vertices,minY:Math.min(...vertices.map(v=>v.y)),maxY:Math.max(...vertices.map(v=>v.y))});
    for(let x=Math.floor(Math.min(...vertices.map(v=>v.x))/BIN_SIZE);x<=Math.floor(Math.max(...vertices.map(v=>v.x))/BIN_SIZE);x++)
      for(let z=Math.floor(Math.min(...vertices.map(v=>v.z))/BIN_SIZE);z<=Math.floor(Math.max(...vertices.map(v=>v.z))/BIN_SIZE);z++) {
        const key=`${x},${z}`,list=bins.get(key) ?? [];list.push(id);bins.set(key,list);
      }
  }
  cached={triangles,bins};bodyIndexes.set(mesh,cached);return cached;
}

function pointSegmentSquared(p:BodyVertex,a:BodyVertex,b:BodyVertex) {
  const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
  const t=den ? Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/den)):0;
  return (p.x-a.x-t*dx)**2+(p.z-a.z-t*dz)**2;
}
function cross(a:BodyVertex,b:BodyVertex,c:BodyVertex) {return (b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);}
function segmentDistanceSquared(a:BodyVertex,b:BodyVertex,c:BodyVertex,d:BodyVertex) {
  const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
  if(abC*abD<0 && cdA*cdB<0)return 0;
  return Math.min(pointSegmentSquared(a,c,d),pointSegmentSquared(b,c,d),pointSegmentSquared(c,a,b),pointSegmentSquared(d,a,b));
}

// P0/P1 use a swept circular footprint, rather than a ray extending 25 cm
// beyond each turn. Clip actual triangles to the body's height band, then
// measure their distance to the full movement segment. Hidden geometry and
// back faces remain obstacles. Spatial bins keep short animation steps cheap.
export function modelBodyCollision(from:Vector3,to:Vector3,colliders:ModelCollider[],bodyBottom=BODY_BOTTOM):Object3D|undefined {
  const dx=to.x-from.x,dz=to.z-from.z,horizontal=dx*dx+dz*dz;
  if(Math.abs(to.y-from.y)>.035 && horizontal>.01) {
    const count=Math.ceil(from.distanceTo(to)/.08);
    for(let i=0;i<count;i++) {
      const hit=modelBodyCollision(from.clone().lerp(to,i/count),from.clone().lerp(to,(i+1)/count),colliders,bodyBottom);
      if(hit)return hit;
    }
    return;
  }
  // Short height changes use the union of the two body height bands. This is
  // conservative at risers, with no tilted cap extrapolated beyond a landing.
  const top=BODY_TOP+Math.abs(to.y-from.y),base=Math.min(from.y,to.y);
  const volume=new Box3(new Vector3(Math.min(from.x,to.x)-BODY_RADIUS,Math.min(from.y,to.y)+bodyBottom,Math.min(from.z,to.z)-BODY_RADIUS),
    new Vector3(Math.max(from.x,to.x)+BODY_RADIUS,Math.max(from.y,to.y)+BODY_TOP,Math.max(from.z,to.z)+BODY_RADIUS));
  const a:BodyVertex={x:from.x,y:from.y,z:from.z},b:BodyVertex={x:to.x,y:to.y,z:to.z};
  const height=(v:BodyVertex)=>v.y-base;
  for(const collider of colliders) {
    if(!collider.bounds.intersectsBox(volume))continue;
    const index=bodyIndex(collider.mesh),ids=new Set<number>();
    for(let x=Math.floor(volume.min.x/BIN_SIZE);x<=Math.floor(volume.max.x/BIN_SIZE);x++)
      for(let z=Math.floor(volume.min.z/BIN_SIZE);z<=Math.floor(volume.max.z/BIN_SIZE);z++)
        for(const id of index.bins.get(`${x},${z}`) ?? [])ids.add(id);
    for(const id of ids) {
      const tri=index.triangles[id];if(tri.maxY<volume.min.y || tri.minY>volume.max.y)continue;
      let polygon=tri.vertices;
      const hs=polygon.map(height);if(Math.max(...hs)<bodyBottom || Math.min(...hs)>top)continue;
      for(const [limit,sign] of [[bodyBottom,1],[top,-1]]) {
        const clipped:BodyVertex[]=[];
        for(let i=0;i<polygon.length;i++) {
          const p=polygon[i],q=polygon[(i+1)%polygon.length],hp=height(p)-limit,hq=height(q)-limit;
          if(hp*sign>=-1e-9)clipped.push(p);
          if((hp>0 && hq<0)||(hp<0 && hq>0)) {const t=hp/(hp-hq);clipped.push({x:p.x+t*(q.x-p.x),y:p.y+t*(q.y-p.y),z:p.z+t*(q.z-p.z)});}
        }
        polygon=clipped;if(!polygon.length)break;
      }
      if(!polygon.length)continue;
      let area=0,positive=false,negative=false;
      for(let i=0;i<polygon.length;i++) {
        const p=polygon[i],q=polygon[(i+1)%polygon.length];
        if(segmentDistanceSquared(a,b,p,q)<=BODY_RADIUS**2+1e-10)return collider.mesh;
        area+=p.x*q.z-p.z*q.x;
        const side=cross(p,q,a);positive ||= side>1e-9;negative ||= side< -1e-9;
      }
      if(Math.abs(area)>1e-9 && !(positive && negative))return collider.mesh;
    }
  }
}

export function modelCollision(from: Vector3, to: Vector3, colliders: ModelCollider[]): Object3D | undefined {
  const direction = to.clone().sub(from);
  const distance = direction.length();
  if (distance < 0.0001) return;
  direction.normalize();
  // Conservative swept body bounds include all nine rays and their lookahead.
  // No mesh is excluded by its name or appearance (including hidden objects).
  const volume = new Box3().setFromPoints([from,to]).expandByScalar(0.5);
  volume.max.y += BODY_RAY_HEIGHTS.at(-1)!;
  const candidates = colliders.filter(({ bounds }) => bounds.intersectsBox(volume)).map(({ mesh }) => mesh);
  for (const height of BODY_RAY_HEIGHTS) for (const offset of [-0.22,0,0.22]) {
    const start = from.clone().add(new Vector3(-direction.z*offset,height,direction.x*offset));
    const hit = new Raycaster(start,direction,0,distance+0.25).intersectObjects(candidates,false)[0];
    if (hit) return hit.object;
  }
}

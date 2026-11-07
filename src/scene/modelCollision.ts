import { Box3, Mesh, Object3D, Raycaster, Vector3 } from "three";

export interface ModelCollider { mesh: Mesh; bounds: Box3 }

// Models remain static after their documented world transform is applied.
// Rebuild this cache whenever a model or its transform is replaced.
export function modelColliders(root: Object3D): ModelCollider[] {
  root.updateMatrixWorld(true);
  const result: ModelCollider[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh) result.push({ mesh:object, bounds:new Box3().setFromObject(object) });
  });
  return result;
}

export function modelCollision(from: Vector3, to: Vector3, colliders: ModelCollider[]): Object3D | undefined {
  const direction = to.clone().sub(from);
  const distance = direction.length();
  if (distance < 0.0001) return;
  direction.normalize();
  // Conservative swept body bounds include all six rays and their lookahead.
  // No mesh is excluded by its name or appearance (including hidden objects).
  const volume = new Box3().setFromPoints([from,to]).expandByScalar(0.5);
  volume.max.y += 1.2;
  const candidates = colliders.filter(({ bounds }) => bounds.intersectsBox(volume)).map(({ mesh }) => mesh);
  for (const height of [0.45,1.2]) for (const offset of [-0.22,0,0.22]) {
    const start = from.clone().add(new Vector3(-direction.z*offset,height,direction.x*offset));
    const hit = new Raycaster(start,direction,0,distance+0.25).intersectObjects(candidates,false)[0];
    if (hit) return hit.object;
  }
}

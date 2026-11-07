import { Mesh, Object3D } from "three";

export function prepareModelPresentation(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = !/^(Site|Floor_Slab|Ramps_Stairs|Glass|Deco_Grass)/.test(object.name);
    object.receiveShadow = true;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material.transparent && material.opacity < 1) material.depthWrite = false;
    }
  });
}

export function setModelTopView(root: Object3D, top: boolean): void {
  root.traverse((object) => {
    if (/^Canopy_/.test(object.name)) object.visible = !top;
  });
}

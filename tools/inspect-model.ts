import { readFile } from "node:fs/promises";
import { Box3, Vector3 } from "three";
import { parseModelGeometry } from "./model-geometry.ts";

const bytes = await readFile(new URL("../public/models/campus.glb", import.meta.url));
const gltf = await parseModelGeometry(bytes);
gltf.scene.updateMatrixWorld(true);
gltf.scene.traverse((object) => {
  if (object.type === "Mesh" || object.name.startsWith("REF_") || object.name.startsWith("DEST_")) {
    const bounds = new Box3().setFromObject(object);
    console.log(JSON.stringify({ name: object.name, type: object.type, position: object.getWorldPosition(new Vector3()).toArray(), min: bounds.min.toArray(), max: bounds.max.toArray() }));
  }
});

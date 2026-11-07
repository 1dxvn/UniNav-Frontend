import { Texture } from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

// Node geometry tools do not render images. Preserve geometry, transforms and
// material sidedness while bypassing the browser-only embedded image decoder.
// The application still loads and renders every original texture in the GLB.
export function parseModelGeometry(bytes: Uint8Array): Promise<GLTF> {
  const loader = new GLTFLoader();
  loader.register(() => ({
    name: "uninav_geometry_inspection",
    loadTexture: async () => new Texture(),
  }));
  return loader.parseAsync(Uint8Array.from(bytes).buffer, "");
}

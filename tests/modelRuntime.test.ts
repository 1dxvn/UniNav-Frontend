import test from "node:test";
import assert from "node:assert/strict";
import { BoxGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, Raycaster, Texture, Vector3 } from "three";
import { modelColliders, modelCollision } from "../src/scene/modelCollision.ts";
import { disposeGroup } from "../src/scene/dispose.ts";
import { prepareModelPresentation, setModelTopView } from "../src/scene/modelPresentation.ts";

test("static bounds preserve body-ray collisions across rotations, heights and both directions", () => {
  const root = new Group();
  root.position.y = 3.5;
  for (const [x,y,z,angle] of [[1,1,0,0],[-1,0.6,1,0.7],[0,1.2,-2,-0.4],[2,4,2,0]]) {
    const mesh = new Mesh(new BoxGeometry(0.1,0.7,1.5),new MeshStandardMaterial({ side:DoubleSide }));
    mesh.position.set(x,y,z); mesh.rotation.y = angle; root.add(mesh);
  }
  // Hidden decorative geometry still obstructs a ray at body height.
  root.children[0].visible = false;
  const colliders = modelColliders(root);
  const meshes = colliders.map(({ mesh }) => mesh);
  function original(from: Vector3, to: Vector3): boolean {
    const d = to.clone().sub(from), distance = d.length();
    if (distance < 0.0001) return false;
    d.normalize();
    return [0.45,1.2,1.8].some((height) => [-0.22,0,0.22].some((offset) =>
      new Raycaster(from.clone().add(new Vector3(-d.z*offset,height,d.x*offset)),d,0,distance+0.25).intersectObjects(meshes,false).length > 0));
  }
  let collisions = 0, clear = 0;
  for (let i = 0; i < 150; i++) {
    const from = new Vector3((i%7)-3,3.5+(i%3)*0.3,(i%11)*0.6-3);
    const to = from.clone().add(new Vector3(Math.sin(i)*0.4,Math.cos(i)*0.1,Math.cos(i*1.7)*0.4));
    for (const [a,b] of [[from,to],[to,from]]) {
      const expected = original(a,b);
      assert.equal(!!modelCollision(a,b,colliders),expected);
      if (expected) collisions++; else clear++;
    }
  }
  assert.ok(collisions > 5 && clear > 5);
  assert.equal(modelCollision(new Vector3(),new Vector3(),colliders),undefined);
  disposeGroup(root);
});

test("head clearance blocks a beam above the torso even when the mesh is hidden", () => {
  const beam=new Mesh(new BoxGeometry(0.2,0.12,2),new MeshStandardMaterial({ side:DoubleSide }));
  beam.position.set(0.7,1.75,0); beam.visible=false;
  const root=new Group(); root.add(beam);
  assert.equal(modelCollision(new Vector3(),new Vector3(1,0,0),modelColliders(root)),beam);
  beam.position.y=2.1;
  assert.equal(modelCollision(new Vector3(),new Vector3(1,0,0),modelColliders(root)),undefined);
  disposeGroup(root);
});

test("disposing a model releases shared geometry, materials and textures once", () => {
  const root = new Group(), texture = new Texture(), geometry = new BoxGeometry();
  const a = new MeshStandardMaterial({ map:texture }), b = new MeshStandardMaterial({ map:texture });
  root.add(new Mesh(geometry,[a,b]),new Mesh(geometry,a));
  const counts = { geometry:0, a:0, b:0, texture:0 };
  geometry.addEventListener("dispose",() => counts.geometry++);
  a.addEventListener("dispose",() => counts.a++);
  b.addEventListener("dispose",() => counts.b++);
  texture.addEventListener("dispose",() => counts.texture++);
  disposeGroup(root);
  assert.deepEqual(counts,{ geometry:1,a:1,b:1,texture:1 });
  assert.equal(root.children.length,0);
});

test("cutaway hides overhead canopies and restores them without changing obstacles", () => {
  const root = new Group();
  const canopy = new Mesh(new BoxGeometry(),new MeshStandardMaterial({ transparent:true,opacity:0.16 }));
  canopy.name = "Canopy_Access_Roof";
  const wall = new Mesh(new BoxGeometry(),new MeshStandardMaterial()); wall.name = "Walls_Interior";
  root.add(canopy,wall);
  prepareModelPresentation(root);
  assert.equal(canopy.material.depthWrite,false);
  assert.equal(wall.material.depthWrite,true);
  setModelTopView(root,true);
  assert.equal(canopy.visible,false);
  assert.equal(wall.visible,true);
  assert.equal(modelColliders(root).length,2);
  setModelTopView(root,false);
  assert.equal(canopy.visible,true);
  disposeGroup(root);
});

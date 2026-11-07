import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dataFingerprint, parseManifest, requiredModels } from "../src/scene/modelManifest.ts";
import { ModelStore } from "../src/scene/modelStore.ts";
import { toScenePosition } from "../src/scene/coordinates.ts";
import type { Building, CampusPath } from "../src/api/types.ts";

const manifest = parseManifest(JSON.parse(await readFile(new URL("../public/models/campus-manifest.json",import.meta.url),"utf8")));
const floorModel = manifest.models.find((entry) => entry.id === "ucc-first-floor")!;
const place = (id: number,name: string,x: number): Building => ({ id,name,x,y:0,floor:1,faculty:null,building_type:null });
const places = [place(1,"A",0),place(2,"B",1),place(3,"C",2)];
const edge: CampusPath = { id:1,source_id:1,target_id:2,source_name:"A",target_name:"B",weight:1,kind:"corridor",bidirectional:true };

test("catalogue elevations remain evidence, not implicit movement coordinates", () => {
  assert.equal(manifest.catalog.blocks.find((b) => b.id === "B")!.floors[2].datum_elevation_m,2.94);
  assert.equal(toScenePosition(places[0]).y,3.5);
  assert.equal(toScenePosition({ ...places[0],elevation_m:2.87 }).y,2.87);
  const bad = structuredClone(manifest); bad.catalog.blocks[0].floors[0].id = bad.catalog.blocks[1].floors[0].id;
  assert.throws(() => parseManifest(bad),/duplicate catalogue floor/);
});

test("data bindings ignore row IDs/order and isolated extras, but reject changed geometry and topology", async () => {
  const names = ["A","B","C"], digest = await dataFingerprint(names,places,[edge]);
  assert.equal(await dataFingerprint([...names].reverse(),[...places].reverse(),[edge]),digest);
  assert.equal(await dataFingerprint(names,[...places,place(4,"Isolated",9)],[edge]),digest);
  assert.equal(await dataFingerprint(names,places.map((p) => ({ ...p,id:p.id+20 })),[{ ...edge,source_id:21,target_id:22 }]),digest);
  assert.notEqual(await dataFingerprint(names,places.map((p) => ({ ...p,x:p.x+0.2 })),[edge]),digest);
  assert.notEqual(await dataFingerprint(names,places,[{ ...edge,bidirectional:false }]),digest);
  assert.notEqual(await dataFingerprint(names,places,[{ ...edge,kind:"stairs" }]),digest);
  await assert.rejects(dataFingerprint(names,places.slice(1),[edge]),/needs one API place/);
});

test("manifest rejects unsafe paths, missing review hashes and duplicate model IDs", () => {
  const unsafe = structuredClone(manifest); unsafe.models.find((entry) => entry.id === floorModel.id)!.reference = "models/../secret.json";
  assert.throws(() => parseManifest(unsafe),/references, hashes/);
  const unhashed = structuredClone(manifest); delete unhashed.models.find((entry) => entry.id === floorModel.id)!.modelSha256;
  assert.throws(() => parseManifest(unhashed),/references, hashes/);
  assert.throws(() => parseManifest({ ...manifest,models:[...manifest.models,floorModel] }),/duplicate model/);
  const ready = floorModel;
  const expanded = { ...manifest,models:[ready,{ ...ready,id:"second",floors:[2] },{ ...ready,id:"third",floors:[3] }] };
  assert.deepEqual(requiredModels(expanded,2,1,[]).map((m) => m.id),[ready.id,"second"]);
  assert.equal(requiredModels(expanded,2,1,[3]).length,3);
});

test("exterior resources are required only by overview and cannot declare navigation bindings", () => {
  const exterior = manifest.models.find((entry) => entry.kind === "exterior")!;
  assert.ok(exterior);
  assert.equal(requiredModels(manifest,1,1,[]).some((entry) => entry.id === exterior.id),false);
  assert.equal(requiredModels(manifest,1,1,[],true).some((entry) => entry.id === exterior.id),true);
  assert.throws(() => parseManifest({ ...manifest,models:[{ ...exterior,floors:[1] }] }),/non-navigable/);
  assert.throws(() => parseManifest({ ...manifest,models:[{ ...exterior,binding:floorModel.binding }] }),/non-navigable/);
  assert.throws(() => parseManifest({ ...manifest,models:[{ ...exterior,transform:{ ...exterior.transform,scale:0 } }] }),/non-navigable/);
});

test("model store reuses resources needed by the avatar and route and releases unused floors", async () => {
  const loaded: string[] = [], released: string[] = [];
  const store = new ModelStore(async (id) => { loaded.push(id); return id; },(id) => released.push(id));
  await store.sync(["view","avatar","route"]);
  await store.sync(["avatar","route"]);
  assert.deepEqual(loaded,["view","avatar","route"]);
  assert.deepEqual(released,["view"]);
  assert.deepEqual(store.values(),["avatar","route"]);
  store.dispose();
  assert.deepEqual(released,["view","avatar","route"]);
});

test("late model responses cannot revive released floors or a disposed store", async () => {
  let finish!: (value: string) => void;
  const released: string[] = [];
  const store = new ModelStore(() => new Promise<string>((resolve) => { finish = resolve; }),(id) => released.push(id));
  const old = store.sync(["old"]);
  await store.sync([]);
  finish("old");
  assert.equal((await old).current,false);
  assert.deepEqual(store.values(),[]);
  assert.deepEqual(released,["old"]);
  const late = store.sync(["late"]);
  store.dispose(); finish("late"); await late;
  assert.deepEqual(released,["old","late"]);
});

test("concurrent requests share a load and failed resources can be retried", async () => {
  let calls = 0, finish!: (value: string) => void;
  const store = new ModelStore(() => { calls++; return new Promise<string>((resolve) => { finish = resolve; }); },() => undefined);
  const a = store.sync(["same"]), b = store.sync(["same"]); finish("same");
  await Promise.all([a,b]); assert.equal(calls,1);
  let attempts = 0;
  const retry = new ModelStore(async () => { if (++attempts === 1) throw new Error("missing"); return "ok"; },() => undefined);
  assert.equal((await retry.sync(["id"])).errors.length,1);
  assert.equal((await retry.sync(["id"])).errors.length,0);
  assert.deepEqual(retry.values(),["ok"]);
  store.dispose(); retry.dispose();
});

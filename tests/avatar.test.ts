import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { AnimationClip } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { AVATAR, avatarAnimation } from "../src/scene/avatarAsset.ts";
import { sha256 } from "../src/scene/modelManifest.ts";

test("avatar walks while moving and returns to idle after a short grace period", () => {
  assert.equal(avatarAnimation(10, null), "Idle");
  assert.equal(avatarAnimation(10, 10), "Walk");
  assert.equal(avatarAnimation(10.1, 10), "Walk");
  assert.equal(avatarAnimation(10.2, 10), "Idle");
});

test("pinned avatar matches the reviewed export and carries Idle and Walk clips", async () => {
  const bytes = await readFile(`public/${AVATAR.url}`);
  assert.equal(await sha256(bytes), AVATAR.sha256);
  const n = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + n).toString("utf8"));
  assert.deepEqual(json.animations.map((a: { name: string }) => a.name).sort(), ["Idle", "Walk"]);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, "");
  const walk = AnimationClip.findByName(gltf.animations, "Walk"), idle = AnimationClip.findByName(gltf.animations, "Idle");
  assert.ok(walk && idle && walk.duration > 0.9 && walk.duration < 1.1 && idle.duration > 1.9 && idle.duration < 2.1);
});

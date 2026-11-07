import { build } from "vite";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import { parseManifest } from "../src/scene/modelManifest.ts";
import { parseReference } from "../src/scene/modelReference.ts";
import { reviewedAsset } from "./reviewed-assets.ts";

const manifestBytes = await readFile("public/models/campus-manifest.json");
const manifest = parseManifest(JSON.parse(manifestBytes.toString("utf8")));
// Stage reviewed exports without changing Claude's sources or live public files.
// Resolve and verify all assets before Vite replaces the last working dist.
const assets = new Map<string,Uint8Array>([["models/campus-manifest.json",manifestBytes]]);
for (const entry of manifest.models.filter((entry) => entry.state === "ready")) {
  const referenceBytes = await reviewedAsset(entry,entry.reference!,entry.referenceSha256!);
  const reference = parseReference(JSON.parse(referenceBytes.toString("utf8")));
  const path = posix.join(posix.dirname(entry.reference!),reference.model);
  assets.set(entry.reference!,referenceBytes);
  assets.set(path,await reviewedAsset(entry,path,entry.modelSha256!));
}
const directory = await mkdtemp(join(tmpdir(),"uninav-reviewed-build-"));
try {
  for (const [path,bytes] of assets) {
    const target = join(directory,path);
    await mkdir(dirname(target),{ recursive:true }); await writeFile(target,bytes);
  }
  await build({ publicDir:directory });
} finally { await rm(directory,{ recursive:true,force:true,maxRetries:5,retryDelay:200 }); }

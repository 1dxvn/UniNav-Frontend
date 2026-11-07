import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { sha256, type ModelEntry } from "../src/scene/modelManifest.ts";

export async function committedAsset(commit: string, path: string): Promise<Buffer> {
  const { stdout } = await promisify(execFile)("git",["show",`${commit}:public/${path}`],{ encoding:"buffer",maxBuffer:32*1024*1024,windowsHide:true });
  return stdout;
}
export async function reviewedAsset(entry: ModelEntry, path: string, expectedHash: string): Promise<Buffer> {
  const working = await readFile(`public/${path}`).catch(() => null);
  if (working && await sha256(working) === expectedHash) return working;
  const committed = await committedAsset(entry.sourceCommit!,path);
  if (await sha256(committed) !== expectedHash) throw new Error(`Reviewed asset ${path} does not match manifest commit ${entry.sourceCommit}.`);
  console.log(`Using reviewed ${path} from ${entry.sourceCommit}; the working export is pending integration.`);
  return committed;
}

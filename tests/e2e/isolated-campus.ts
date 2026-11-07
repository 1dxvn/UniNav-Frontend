import { test as base, expect } from "@playwright/test";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve,dirname,basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { promisify } from "node:util";

// Each caller owns a real API and database; development services stay untouched.
export const test = base.extend<{ navigationDataset:string | string[] | undefined; campusProfile:string | undefined }>({
  navigationDataset:[undefined,{ option:true }],
  campusProfile:[undefined,{ option:true }],
  baseURL: async ({ playwright,navigationDataset,campusProfile }, use) => {
    const backend = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
    const python = process.env.UNINAV_TEST_PYTHON ?? join(backend, "venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
    const datasets=navigationDataset ? (Array.isArray(navigationDataset) ? navigationDataset:[navigationDataset]):[];
    if(campusProfile && datasets.length)throw new Error("Choose a reviewed startup profile or individual fixture datasets.");
    const directory = await mkdtemp(join(tmpdir(), "uninav-e2e-"));
    const args=campusProfile ? ["-m","scripts.run_campus","--database",join(directory,"campus-test.db"),"--port","0","--profile",campusProfile]:["-m", "tests.serve_campus", "--directory", directory,...datasets.flatMap(path=>["--dataset",path])];
    const child = spawn(python,args, { cwd: backend, windowsHide: true });
    const lines = createInterface({ input: child.stdout });
    let log = "";
    child.stderr.on("data", (data: Buffer) => { log = (log + data.toString()).slice(-4000); });
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const url = await new Promise<string>((resolveURL, reject) => {
        deadline = setTimeout(() => reject(new Error(`Temporary campus did not start: ${log}`)), 30000);
        child.once("error", reject);
        child.once("exit", (code) => reject(new Error(`Temporary campus exited (${code}): ${log}`)));
        lines.on("line", (line: string) => {
          if (line.startsWith("UNINAV_E2E_URL=")) resolveURL(JSON.parse(line.slice("UNINAV_E2E_URL=".length)) as string);
          if (line.startsWith("UNINAV_CAMPUS_READY=")) resolveURL((JSON.parse(line.slice("UNINAV_CAMPUS_READY=".length)) as {url:string}).url);
        });
      });
      clearTimeout(deadline);
      const api = await playwright.request.newContext({ baseURL: url });
      try {
        await expect.poll(async () => {
          try { return (await api.get("/health", { timeout: 1000 })).ok(); } catch { return false; }
        }, { timeout: 15000 }).toBe(true);
        await use(url);
      } finally { await api.dispose(); }
    } finally {
      clearTimeout(deadline);
      lines.close();
      if (child.exitCode === null && child.pid) {
        if (process.platform === "win32") {
          // Kill only this fixture's process tree, including the venv launcher.
          await promisify(execFile)("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }).catch(() => undefined);
        } else {
          const exited = once(child, "exit");
          child.kill("SIGTERM");
          await exited;
        }
      }
      if(resolve(dirname(directory))!==resolve(tmpdir()) || !basename(directory).startsWith("uninav-e2e-"))throw new Error("Unexpected campus fixture cleanup path.");
      await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  },
});

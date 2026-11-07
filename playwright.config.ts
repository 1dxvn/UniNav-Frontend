import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const brave = "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe";

export default defineConfig({
  testDir: "./tests/e2e", timeout: 90000, workers: 1,
  use: {
    baseURL: process.env.UNINAV_TEST_URL ?? "http://127.0.0.1:8000",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: process.env.UNINAV_BROWSER ?? (existsSync(brave) ? brave : undefined),
      args: process.env.UNINAV_RENDERER === "hardware" ? [] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
    screenshot: "only-on-failure", trace: "retain-on-failure",
  },
});

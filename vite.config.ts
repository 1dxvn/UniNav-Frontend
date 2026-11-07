import { defineConfig } from "vite";

// The backend serves the build under /app/, so assets must resolve from that base.
// In development, API calls go to the same origin and Vite forwards them to FastAPI.
const backendUrl = process.env.UNINAV_BACKEND_URL ?? "http://127.0.0.1:8000";
const apiPrefixes = [
  "/auth", "/users", "/buildings", "/floors", "/paths", "/graph", "/routes",
  "/navigation", "/queues", "/rankings", "/tours", "/campus", "/health",
];

export default defineConfig({
  base: "/app/",
  // three.js alone is ~500 kB minified; keep a single bundle for now.
  build: { chunkSizeWarningLimit: 700 },
  server: {
    proxy: Object.fromEntries(apiPrefixes.map((prefix) => [prefix, backendUrl])),
  },
});

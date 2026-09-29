/**
 * Vite builds the React page into frontend/dist: a folder of static files that
 * any static host (such as Vercel) can serve. The traffic model is added at
 * /sim by the simulationFiles plugin.
 *
 *   npm run dev      live-reloading development server
 *   npm run build    build frontend/dist
 *   npm run preview  serve the built site locally, with the production headers
 */

import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { SECURITY_HEADERS } from "./vite/securityHeaders.ts";
import { simulationFiles } from "./vite/simulationFiles.ts";

const runtimeFolder = path.resolve(import.meta.dirname, "..", "simulation", "runtime");
const port = Number(process.env.PORT) || 3000;

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), simulationFiles(runtimeFolder)],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 400,
  },
  server: {
    port: port,
  },
  preview: {
    port: port,
    strictPort: true,
    headers: SECURITY_HEADERS,
  },
});

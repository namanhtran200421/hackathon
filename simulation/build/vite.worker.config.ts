/**
 * Bundles src/worker.ts into runtime/worker.js: one classic script the browser
 * starts as a background worker. It loads the engine files next to it with
 * importScripts, so it must not be an ES module.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const packageFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig({
  root: packageFolder,
  build: {
    outDir: "runtime",
    emptyOutDir: false,
    target: "es2022",
    minify: true,
    lib: {
      entry: path.join(packageFolder, "src", "worker.ts"),
      formats: ["iife"],
      name: "TrafficWorker",
      fileName: function () {
        return "worker.js";
      },
    },
  },
});

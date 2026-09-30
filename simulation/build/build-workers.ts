/**
 * Bundles the two background workers into runtime/:
 *
 *   src/worker.ts      → runtime/worker.js        (the live simulator)
 *   src/batchWorker.ts → runtime/batch-worker.js  (the planner's background tests)
 *
 * Each becomes one classic script the browser starts as a worker. They load
 * the engine files next to them with importScripts, so they must not be ES
 * modules. Run with `npm run build -w @traffic-lab/simulation`.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const packageFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const WORKERS = [
  { entry: "worker.ts", output: "worker.js", name: "TrafficWorker" },
  { entry: "batchWorker.ts", output: "batch-worker.js", name: "TrafficBatchWorker" },
];

for (const worker of WORKERS) {
  await build({
    root: packageFolder,
    configFile: false,
    logLevel: "warn",
    build: {
      outDir: "runtime",
      emptyOutDir: false,
      target: "es2022",
      minify: true,
      lib: {
        entry: path.join(packageFolder, "src", worker.entry),
        formats: ["iife"],
        name: worker.name,
        fileName: function () {
          return worker.output;
        },
      },
    },
  });
  console.log("Built runtime/" + worker.output);
}

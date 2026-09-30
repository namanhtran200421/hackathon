/**
 * A small Vite plugin that makes the traffic model available at /sim.
 *
 * The model files (the NetLogo Web engine, the compiled model and the
 * background workers) live in simulation/runtime. While developing, this serves
 * them straight from there; when building, it copies them into dist/sim so
 * the finished site is one folder of static files.
 */

import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const CONTENT_TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

export function simulationFiles(runtimeFolder: string): Plugin {
  let outputFolder = "";

  return {
    name: "traffic-lab-simulation-files",

    configResolved: function (config) {
      outputFolder = path.resolve(config.root, config.build.outDir);
    },

    // While developing: answer /sim/... requests from the runtime folder.
    configureServer: function (server) {
      server.middlewares.use("/sim", function (request, response, next) {
        const name = decodeURIComponent((request.url || "").split("?")[0]).replace(/^\/+/, "");
        const file = path.join(runtimeFolder, name);
        // Only plain files directly inside the runtime folder.
        const inside = path.dirname(file) === runtimeFolder;
        if (!inside || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          next();
          return;
        }
        response.setHeader("Content-Type", CONTENT_TYPES[path.extname(file)] || "application/octet-stream");
        response.setHeader("Cache-Control", "no-cache");
        fs.createReadStream(file).pipe(response);
      });
    },

    // When building: copy the runtime folder into dist/sim.
    closeBundle: function () {
      ["worker.js", "batch-worker.js"].forEach(function (name) {
        if (!fs.existsSync(path.join(runtimeFolder, name))) {
          throw new Error(
            "simulation/runtime/" + name + " is missing. Run `npm run build` from the project folder.",
          );
        }
      });
      fs.cpSync(runtimeFolder, path.join(outputFolder, "sim"), { recursive: true });
    },
  };
}

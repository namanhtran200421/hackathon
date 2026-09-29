/**
 * Server settings, read once at start-up from the command line and environment.
 */

import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/** The repository root (this file sits in apps/server/src or apps/server/dist). */
const rootFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export interface ServerConfig {
  /** Serve the page through Vite with live reloading, instead of the built files. */
  developmentMode: boolean;
  port: number;
  /** The web app's source folder, used by Vite in development mode. */
  webFolder: string;
  /** The built web page (apps/web/dist). */
  builtWebFolder: string;
  /** The simulation engine, model and worker, served at /sim. */
  simulationFolder: string;
}

/** The folder the simulation package serves to browsers. */
function simulationRuntimeFolder(): string {
  const packageFile = require.resolve("@traffic-lab/simulation/package.json");
  return path.join(path.dirname(packageFile), "runtime");
}

export function readConfig(argv: readonly string[], environment: NodeJS.ProcessEnv): ServerConfig {
  const port = Number(environment.PORT) || 3000;
  return {
    developmentMode: argv.includes("--dev"),
    port: port,
    webFolder: path.join(rootFolder, "apps", "web"),
    builtWebFolder: path.join(rootFolder, "apps", "web", "dist"),
    simulationFolder: simulationRuntimeFolder(),
  };
}

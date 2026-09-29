/**
 * Run the traffic model inside Node.
 *
 * The tests and the build script use this to run the same engine, compiled
 * model and controls the browser runs, each model in its own sandbox.
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createTrafficSim, type TrafficSim } from "./createTrafficSim";
import { installNobody, type ModelConfig, type ModelScope } from "./modelScope";

/** The folder the browser loads the model from (served at /sim). */
export const RUNTIME_FOLDER = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "runtime");

const ENGINE_FILES = ["tortoise-engine.js", "model.js", "reporters.js"];

// Compiling the engine is slow, so do it once and reuse it for every model.
let compiledScripts: vm.Script[] | null = null;

function engineScripts(): vm.Script[] {
  if (compiledScripts === null) {
    compiledScripts = ENGINE_FILES.map(function (name) {
      const source = fs.readFileSync(path.join(RUNTIME_FOLDER, name), "utf8");
      return new vm.Script(source, { filename: name });
    });
  }
  return compiledScripts;
}

export interface NodeTrafficSim extends TrafficSim {
  /** Lines the model printed. */
  output: string[];
  /** Messages the model showed, such as why Save baseline was refused. */
  notices: string[];
}

/** Create a fresh, independent traffic model. */
export function loadTrafficSim(): NodeTrafficSim {
  const output: string[] = [];
  const notices: string[] = [];

  function remember(message: unknown): boolean {
    notices.push(String(message));
    return true;
  }

  const modelConfig: ModelConfig = {
    output: {
      write: function (text) {
        output.push(String(text));
      },
      clear: function () {
        output.length = 0;
      },
    },
    print: { write: function () {} },
    dialog: {
      notify: remember,
      confirm: remember,
      yesOrNo: function () {
        return true;
      },
      input: function () {
        return "";
      },
    },
  };

  const sandbox = vm.createContext({
    TextEncoder: TextEncoder,
    TextDecoder: TextDecoder,
    crypto: webcrypto,
    console: { log: function () {}, warn: function () {}, error: function () {} },
    modelConfig: modelConfig,
  });
  sandbox.self = sandbox;
  sandbox.window = sandbox;
  installNobody(sandbox);

  engineScripts().forEach(function (script) {
    script.runInContext(sandbox);
  });

  const simulation = createTrafficSim(sandbox as unknown as ModelScope);
  return Object.assign(simulation, { output: output, notices: notices });
}

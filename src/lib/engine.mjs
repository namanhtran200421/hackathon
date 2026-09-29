// Node loader for the browser simulation bundle in public/sim/.
// Tests and the build script run exactly the scripts the Web Worker runs.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
const folder = path.join(process.cwd(), "public", "sim");
const files = ["tortoise-engine.js", "sim-core.js", "model.js", "reporters.js"];
let scripts;
export function loadTrafficSim({ onOutput, onNotice } = {}) {
  scripts ??= files.map(
    (name) =>
      new vm.Script(fs.readFileSync(path.join(folder, name), "utf8"), {
        filename: name,
      }),
  );
  const output = [];
  const notices = [];
  const context = vm.createContext({
    TextEncoder,
    TextDecoder,
    crypto: webcrypto,
    console: { log() {}, warn() {}, error() {} },
    modelConfig: {
      output: {
        write(text) {
          output.push(String(text));
          onOutput?.(String(text));
        },
        clear() {
          output.length = 0;
        },
      },
      print: { write() {} },
      dialog: {
        notify(message) {
          notices.push(String(message));
          onNotice?.(String(message));
        },
        confirm(message) {
          notices.push(String(message));
          onNotice?.(String(message));
          return true;
        },
        yesOrNo: () => true,
        input: () => "",
      },
    },
  });
  context.self = context;
  context.window = context;
  for (const script of scripts) script.runInContext(context);
  const sim = context.createTrafficSim();
  return Object.assign(sim, { output, notices });
}

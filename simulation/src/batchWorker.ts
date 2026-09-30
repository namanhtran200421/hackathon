/**
 * A background worker that runs whole scenarios for the works planner.
 *
 * Unlike the live simulator's worker, it draws nothing: it runs each scenario
 * it is given as fast as it can and sends back the final numbers. The planner
 * starts several of these at once, one per spare processor core.
 *
 * `npm run build -w @traffic-lab/simulation` bundles this file into
 * runtime/batch-worker.js.
 */

import { createTrafficSim, type TrafficSim } from "./createTrafficSim";
import type { ModelScope } from "./modelScope";
import type { BatchReply, BatchRequest } from "./protocol";
import { runScenario } from "./scenario";
import { ENGINE_FILES, errorText, prepareWorker } from "./workerSetup";

declare const self: DedicatedWorkerGlobalScope;

function post(message: BatchReply): void {
  self.postMessage(message);
}

// The planner has no use for what the model prints.
prepareWorker({
  print: function () {},
  clearOutput: function () {},
  notify: function () {},
});

let simulation: TrafficSim | null = null;

try {
  importScripts(...ENGINE_FILES);
  simulation = createTrafficSim(self as unknown as ModelScope);
  post({ type: "ready" });
} catch (error) {
  post({ type: "error", id: null, message: errorText(error) });
}

self.onmessage = function (event: MessageEvent<BatchRequest>) {
  const request = event.data;
  if (request.type !== "run" || simulation === null) {
    return;
  }
  const id = request.id;
  try {
    const started = performance.now();
    const result = runScenario(simulation, request.scenario, function (done, total) {
      post({ type: "progress", id: id, done: done, total: total });
    });
    post({ type: "result", id: id, result: result, seconds: (performance.now() - started) / 1000 });
  } catch (error) {
    post({ type: "error", id: id, message: errorText(error) });
  }
};

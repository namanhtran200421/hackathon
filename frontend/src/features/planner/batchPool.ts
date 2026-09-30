/**
 * Runs many background simulations at once, one per spare processor core.
 *
 * Each worker (/sim/batch-worker.js) loads the traffic model once and then
 * runs one scenario after another. The pool hands out the next scenario as
 * soon as a worker is free, and reports progress and results as they come.
 */

import type { BatchReply, BatchRequest, Scenario, ScenarioResult } from "@traffic-lab/simulation";

export interface BatchHandlers {
  /** A scenario finished. `index` is its place in the list given to runBatch. */
  onResult(index: number, result: ScenarioResult, seconds: number): void;
  /** A scenario has run `done` of its `total` simulated seconds. */
  onProgress(index: number, done: number, total: number): void;
  /** Every scenario has finished. */
  onFinished(): void;
  /** Something went wrong; the batch has stopped. */
  onError(message: string): void;
}

export interface Batch {
  /** Stop every worker straight away. */
  cancel(): void;
}

/** How many workers to use: leave a core for the page and one for the live simulator. */
export function workerCount(): number {
  let cores = 4;
  if (typeof navigator !== "undefined" && navigator.hardwareConcurrency > 0) {
    cores = navigator.hardwareConcurrency;
  }
  return Math.max(1, Math.min(6, cores - 2));
}

export function runBatch(scenarios: Scenario[], handlers: BatchHandlers): Batch {
  const workers: Worker[] = [];
  let next = 0;
  let finished = 0;
  let stopped = false;

  function stopAll(): void {
    stopped = true;
    workers.forEach(function (worker) {
      worker.terminate();
    });
  }

  function fail(message: string): void {
    if (stopped) {
      return;
    }
    stopAll();
    handlers.onError(message);
  }

  /** Give a free worker the next scenario, if any are left. */
  function giveWork(worker: Worker): void {
    if (stopped || next >= scenarios.length) {
      return;
    }
    const request: BatchRequest = { type: "run", id: next, scenario: scenarios[next] };
    next = next + 1;
    worker.postMessage(request);
  }

  if (scenarios.length === 0) {
    setTimeout(function () {
      if (!stopped) {
        handlers.onFinished();
      }
    }, 0);
    return { cancel: stopAll };
  }

  const size = Math.min(workerCount(), scenarios.length);
  for (let i = 0; i < size; i++) {
    const worker = new Worker("/sim/batch-worker.js");
    workers.push(worker);

    worker.onmessage = function (event: MessageEvent<BatchReply>) {
      if (stopped) {
        return;
      }
      const reply = event.data;
      if (reply.type === "ready") {
        giveWork(worker);
      } else if (reply.type === "progress") {
        handlers.onProgress(reply.id, reply.done, reply.total);
      } else if (reply.type === "result") {
        finished = finished + 1;
        handlers.onResult(reply.id, reply.result, reply.seconds);
        if (finished === scenarios.length) {
          stopAll();
          handlers.onFinished();
          return;
        }
        giveWork(worker);
      } else if (reply.type === "error") {
        fail(reply.message);
      }
    };

    worker.onerror = function (event) {
      event.preventDefault();
      fail("A background simulation could not start. " + (event.message || ""));
    };
  }

  return { cancel: stopAll };
}

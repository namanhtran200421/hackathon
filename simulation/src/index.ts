/**
 * @traffic-lab/simulation — what the web page needs to know about the model.
 *
 * The model itself runs in background workers (runtime/worker.js and
 * runtime/batch-worker.js, built from src/worker.ts and src/batchWorker.ts). This
 * entry point only exports the settings, data types and message formats, so
 * importing it never loads the engine.
 */

export * from "./settings";
export * from "./types";
export * from "./packing";
export * from "./protocol";
export type { Scenario, ScenarioClosure, ScenarioResult } from "./scenario";

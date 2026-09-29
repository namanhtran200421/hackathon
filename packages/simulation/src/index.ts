/**
 * @traffic-lab/simulation — what the web page and server share about the model.
 *
 * The model itself runs in runtime/worker.js (built from src/worker.ts). This
 * entry point only exports the settings, data types and message formats, so
 * importing it never loads the engine.
 */

export * from "./settings";
export * from "./types";
export * from "./packing";
export * from "./protocol";

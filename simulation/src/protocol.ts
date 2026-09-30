/**
 * The messages the web page and the background workers send each other: the
 * live simulator's worker, and the planner's batch workers.
 */

import type { Scenario, ScenarioResult } from "./scenario";
import type { SettingName, Settings, ViewMode } from "./settings";
import type { Metrics, ModelBaseline, World } from "./types";

/** Desktop buttons the page may press. Setup and Go have their own messages. */
export type ButtonName =
  "setup" | "go" | "close-selection" | "reopen-selection" | "reopen-all" | "save-baseline" | "clear-baseline";

/** Messages from the page to the worker. */
export type PageMessage =
  | { type: "init"; speed: number; settings: Partial<Settings> }
  | { type: "set"; name: SettingName; value: Settings[SettingName] }
  | { type: "select"; street: string; block: number }
  | { type: "setup" }
  | { type: "run"; run: boolean }
  | { type: "step" }
  | { type: "command"; name: ButtonName }
  | { type: "click"; x: number; y: number }
  | { type: "speed"; speed: number }
  | { type: "export-baseline" }
  | { type: "restore-baseline"; saved: ModelBaseline }
  | { type: "csv" };

/** Why the model started or stopped running. */
export type RunReason = "finished" | "paused" | "setup" | "error";

/** Messages from the worker to the page. */
export type WorkerMessage =
  | { type: "status"; phase: "loading" | "building"; message: string }
  | { type: "ready"; settings: Settings }
  | { type: "world"; world: World }
  | {
      type: "frame";
      running: boolean;
      metrics: Metrics;
      /** Every car, packed as described in packing.ts. */
      cars: Float32Array;
      /** Every road's look, sent when it changes. */
      styles?: Float32Array;
      stylesView?: ViewMode;
    }
  | { type: "running"; running: boolean; reason: RunReason | null }
  | { type: "output"; lines: string[] }
  | { type: "output-clear" }
  | { type: "notice"; message: string }
  | { type: "baseline"; saved: ModelBaseline | null }
  | { type: "csv"; text: string; ticks: number }
  | { type: "error"; message: string; fatal: boolean };

/** Messages from the page to a planner batch worker. */
export type BatchRequest = { type: "run"; id: number; scenario: Scenario };

/** Messages from a planner batch worker to the page. */
export type BatchReply =
  | { type: "ready" }
  | { type: "progress"; id: number; done: number; total: number }
  | { type: "result"; id: number; result: ScenarioResult; seconds: number }
  /** id is null when the engine itself failed to load. */
  | { type: "error"; id: number | null; message: string };

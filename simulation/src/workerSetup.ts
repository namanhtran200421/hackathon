/**
 * Getting a background worker ready to load the NetLogo Web engine.
 *
 * Both workers (the live simulator and the planner's background tests) need
 * the same preparation, so it lives here.
 */

import { installNobody, type ModelConfig } from "./modelScope";

declare const self: DedicatedWorkerGlobalScope & { window?: unknown; modelConfig?: ModelConfig };

/** Where the model's printed text and pop-up messages should go. */
export interface ModelMessages {
  print(text: string): void;
  clearOutput(): void;
  notify(message: string): void;
}

/** The engine files, loaded in this order from the worker's own folder. */
export const ENGINE_FILES = ["tortoise-engine.js", "model.js", "reporters.js"];

/** Prepare the worker's global scope. Call once, before loading the engine. */
export function prepareWorker(messages: ModelMessages): void {
  // The NetLogo Web engine was written for web pages and expects `window`.
  self.window = self;

  // NetLogo Web warns that `display` is not implemented every time a road
  // closes. The page redraws the map by itself, so hide just that warning.
  const originalWarn = console.warn.bind(console);
  console.warn = function (...details: unknown[]) {
    if (String(details[0]).includes("has not yet been implemented")) {
      return;
    }
    originalWarn(...details);
  };

  // How the model prints and shows pop-up messages (for example when Save
  // baseline is refused).
  self.modelConfig = {
    output: {
      write: function (text) {
        messages.print(String(text));
      },
      clear: function () {
        messages.clearOutput();
      },
    },
    print: {
      write: function (text) {
        messages.print(String(text));
      },
    },
    dialog: {
      notify: function (message) {
        messages.notify(String(message));
      },
      confirm: function (message) {
        messages.notify(String(message));
        return true;
      },
      yesOrNo: function () {
        return true;
      },
      input: function () {
        return "";
      },
    },
  };

  installNobody(self);
}

/** The text of an error, whatever was thrown. */
export function errorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

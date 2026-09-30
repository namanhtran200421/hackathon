/**
 * Results of background tests, remembered by scenario.
 *
 * The same scenario always gives the same result (the seed is fixed), so a
 * test never needs to run twice. Changing only the limits or the priority
 * re-ranks the plans instantly, and tests of normal traffic are shared
 * between different streets. Results are also kept in this browser, so they
 * survive a reload.
 *
 * Bump STORAGE_KEY's version when the traffic model changes, so old results
 * are not reused.
 */

import type { ScenarioResult } from "@traffic-lab/simulation";

const STORAGE_KEY = "melbourne-traffic-lab:planner-results:v1";
const MOST_KEPT = 3000;

let results: Map<string, ScenarioResult> | null = null;

function isResult(value: unknown): value is ScenarioResult {
  const result = value as ScenarioResult;
  return (
    typeof value === "object" &&
    value !== null &&
    Number.isFinite(result.vehicleHours) &&
    Number.isFinite(result.measured) &&
    Number.isFinite(result.waiting) &&
    Number.isFinite(result.stranded)
  );
}

/** Load what this browser remembers, once. Bad or missing data starts empty. */
function stored(): Map<string, ScenarioResult> {
  if (results) {
    return results;
  }
  const loaded = new Map<string, ScenarioResult>();
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    if (text) {
      const entries = JSON.parse(text) as unknown;
      if (Array.isArray(entries)) {
        entries.forEach(function (entry) {
          if (Array.isArray(entry) && typeof entry[0] === "string" && isResult(entry[1])) {
            loaded.set(entry[0], entry[1]);
          }
        });
      }
    }
  } catch {
    // Storage can be blocked (for example in private windows); just start empty.
  }
  results = loaded;
  return loaded;
}

export function cachedResult(key: string): ScenarioResult | undefined {
  return stored().get(key);
}

export function rememberResult(key: string, result: ScenarioResult): void {
  const all = stored();
  all.delete(key);
  all.set(key, result);
  // Keep the newest results only.
  while (all.size > MOST_KEPT) {
    const oldest = all.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    all.delete(oldest);
  }
}

/** Write the remembered results to this browser's storage. */
export function saveResults(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(stored().entries())));
  } catch {
    // Full or blocked storage only means results are not kept after a reload.
  }
}

/** Forget every remembered result. */
export function forgetResults(): void {
  results = new Map();
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}

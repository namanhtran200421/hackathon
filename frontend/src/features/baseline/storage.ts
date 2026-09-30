/**
 * Keeps the baseline in this browser, so it survives a page reload.
 */

import type { BaselineRecording } from "../simulation/types";

// Version 2 uses the real traffic data and a new road map; baselines saved
// by version 1 cannot be compared with it, so they are left behind.
const STORAGE_KEY = "melbourne-traffic-lab:baseline:v2";

/** Read the saved baseline, or null if there is none. */
export function loadBaseline(): BaselineRecording | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) {
      return null;
    }
    const baseline = JSON.parse(text) as BaselineRecording;
    if (baseline && baseline.metrics && Array.isArray(baseline.history)) {
      return baseline;
    }
    return null;
  } catch {
    return null;
  }
}

/** Save the baseline, or remove it when given null. */
export function storeBaseline(baseline: BaselineRecording | null): void {
  try {
    if (!baseline) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(baseline));
    } catch {
      // Too big to store: keep the comparison but drop the chart history.
      const smaller = Object.assign({}, baseline, { history: [] });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(smaller));
    }
  } catch {
    // Storage is blocked (for example a private window). The baseline then
    // lasts until the page is closed.
  }
}

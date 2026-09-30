/**
 * Matching direct checks to plans, and judging whether a check agrees with
 * the estimate.
 */

import { average, type SeedCurve } from "./delayCurve";
import { busiestHour } from "./plans";
import type { DayProfiles, DirectCheck, Plan } from "./types";

export type CheckVerdict = "close" | "higher" | "lower";

/** The direct check of a plan's busiest hour, if it was done. */
export function checkFor(
  plan: Plan,
  checks: DirectCheck[],
  curves: SeedCurve[],
  profiles: DayProfiles,
): DirectCheck | null {
  const hour = busiestHour(plan, curves, profiles);
  const found = checks.find(function (check) {
    return check.dayType === plan.dayType && check.hour === hour;
  });
  return found || null;
}

/**
 * Close when the measured average is within 1 car-hour per hour or 30% of
 * the estimate, whichever is more forgiving; short tests are noisy.
 */
export function verdict(check: DirectCheck): CheckVerdict {
  const measured = average(check.measured);
  const allowed = Math.max(1, 0.3 * check.estimate);
  if (Math.abs(measured - check.estimate) <= allowed) {
    return "close";
  }
  if (measured > check.estimate) {
    return "higher";
  }
  return "lower";
}

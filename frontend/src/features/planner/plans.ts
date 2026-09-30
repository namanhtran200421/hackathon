/**
 * Finding the best plan: the optimisation.
 *
 * A plan is a kind of day (weekday or weekend), the hour the road closes, and
 * how many shifts the work is split into. For every plan the limits allow,
 * the planner adds up the extra delay over every quarter hour the road is
 * closed, once for each repeat, and ranks the plans by their average.
 *
 * The priority decides how much finishing in fewer shifts is worth:
 *   - least disruption: only the delay counts (setting up for each extra
 *     shift already adds closed time, so tiny shifts are not free);
 *   - balanced: each extra shift counts as much as one hour of the works at
 *     average traffic;
 *   - fewest shifts: the fewest shifts wins, then the least delay.
 */

import { average, ratesByDay, type SeedCurve } from "./delayCurve";
import type { AllowedTimes, DayProfiles, DayType, Plan, WorksRequest } from "./types";

const QUARTERS_PER_DAY = 96;

/** The most shifts the planner will suggest. */
export const MOST_SHIFTS = 30;

/** Night works run from 7 pm to 7 am; daytime works from 7 am to 7 pm. */
export const NIGHT_STARTS = 19;
export const DAY_STARTS = 7;

/** The kinds of day the user allows. */
export function allowedDayTypes(request: WorksRequest): DayType[] {
  if (request.days === "weekdays") {
    return ["weekday"];
  }
  if (request.days === "weekends") {
    return ["weekend"];
  }
  return ["weekday", "weekend"];
}

/** Whether a closure from `start` lasting `hours` keeps to the allowed times. */
export function fitsTimes(start: number, hours: number, times: AllowedTimes): boolean {
  if (hours > 24) {
    return false;
  }
  if (times === "night") {
    const hoursIntoNight = (start - NIGHT_STARTS + 24) % 24;
    return hoursIntoNight + hours <= 12;
  }
  if (times === "day") {
    return start >= DAY_STARTS && start + hours <= NIGHT_STARTS;
  }
  return true;
}

/** Round up to the next quarter hour. */
function toQuarterHours(hours: number): number {
  return Math.ceil(hours * 4 - 1e-9) / 4;
}

/** Extra car-hours for one shift, using one repeat's quarter-hour rates. */
export function shiftDelay(rates: number[], start: number, closedHours: number): number {
  const first = start * 4;
  const quarters = Math.round(closedHours * 4);
  let total = 0;
  for (let i = 0; i < quarters; i++) {
    total = total + rates[(first + i) % QUARTERS_PER_DAY] * 0.25;
  }
  return total;
}

/** The ways to split the work into shifts: from the fewest the crew allows, upwards. */
export function shiftOptions(request: WorksRequest): number[] {
  const fewest = Math.max(1, Math.ceil(request.workHours / request.longestShift - 1e-9));
  // Each shift should have at least an hour of work.
  const most = Math.min(MOST_SHIFTS, Math.max(fewest, Math.floor(request.workHours)));
  const options: number[] = [];
  for (let shifts = fewest; shifts <= most; shifts++) {
    options.push(shifts);
  }
  return options;
}

/** Build one plan's numbers from every repeat's quarter-hour rates. */
export function makePlan(
  seedRates: number[][],
  dayType: DayType,
  start: number,
  shifts: number,
  request: WorksRequest,
  shiftCost: number,
): Plan {
  const workPerShift = request.workHours / shifts;
  const closedPerShift = toQuarterHours(workPerShift + request.setupHours);
  const samples = seedRates.map(function (rates) {
    return shifts * shiftDelay(rates, start, closedPerShift);
  });
  const typical = average(samples);
  return {
    dayType: dayType,
    start: start,
    shifts: shifts,
    workPerShift: workPerShift,
    closedPerShift: closedPerShift,
    samples: samples,
    typical: typical,
    low: Math.min(...samples),
    high: Math.max(...samples),
    score: typical + shifts * shiftCost,
  };
}

/**
 * How much one extra shift counts against a plan, in car-hours, for the
 * user's priority. See the note at the top of this file.
 */
export function costPerShift(request: WorksRequest, curves: SeedCurve[], profiles: DayProfiles): number {
  if (request.priority === "least-disruption") {
    return 0;
  }
  const hourly: number[] = [];
  allowedDayTypes(request).forEach(function (dayType) {
    ratesByDay(curves, profiles, dayType).forEach(function (rates) {
      hourly.push(average(rates));
    });
  });
  const oneAverageHour = average(hourly);
  if (request.priority === "balanced") {
    return oneAverageHour;
  }
  // Fewest shifts: one shift outweighs any possible difference in delay.
  return 1e6 + oneAverageHour;
}

/** Every plan the limits allow, best first. Empty if nothing fits. */
export function rankPlans(request: WorksRequest, curves: SeedCurve[], profiles: DayProfiles): Plan[] {
  if (curves.length === 0) {
    return [];
  }
  const shiftCost = costPerShift(request, curves, profiles);
  const plans: Plan[] = [];
  allowedDayTypes(request).forEach(function (dayType) {
    const seedRates = ratesByDay(curves, profiles, dayType);
    shiftOptions(request).forEach(function (shifts) {
      const closedHours = toQuarterHours(request.workHours / shifts + request.setupHours);
      for (let start = 0; start < 24; start++) {
        if (fitsTimes(start, closedHours, request.times)) {
          plans.push(makePlan(seedRates, dayType, start, shifts, request, shiftCost));
        }
      }
    });
  });
  return plans.sort(function (a, b) {
    if (a.score !== b.score) {
      return a.score - b.score;
    }
    // Equal scores: prefer fewer shifts, then weekdays, then the earlier start.
    if (a.shifts !== b.shifts) {
      return a.shifts - b.shifts;
    }
    if (a.dayType !== b.dayType) {
      if (a.dayType === "weekday") {
        return -1;
      }
      return 1;
    }
    return a.start - b.start;
  });
}

/** Hours between two clock hours, going the short way round the clock. */
function hoursApart(a: number, b: number): number {
  const gap = Math.abs(a - b) % 24;
  return Math.min(gap, 24 - gap);
}

/** Whether two plans are different enough to offer both. */
export function clearlyDifferent(a: Plan, b: Plan): boolean {
  return a.dayType !== b.dayType || a.shifts !== b.shifts || hoursApart(a.start, b.start) >= 2;
}

/** How big the effect of the recommended plan is, compared with the worst time of day. */
export type Impact = "low" | "some" | "high";

export interface PlanOutcome {
  best: Plan;
  /** Up to three other good plans, each clearly different from the ones before. */
  others: Plan[];
  /** The same shifts, closing at 9 am on weekdays, for comparison. */
  daytime: Plan;
  /** The worst start the limits allow, with the same shifts and kind of day. */
  worst: Plan;
  /** The best plan does not clearly beat the next one. */
  nearTie: boolean;
  impact: Impact;
  /** How many repeats the numbers come from. */
  repeats: number;
  /** What each shift counts as, in car-hours, for the chosen priority (see costPerShift). */
  shiftCost: number;
}

/** Summarise the ranking for the report. Null when no plan fits the limits. */
export function summarise(
  request: WorksRequest,
  curves: SeedCurve[],
  profiles: DayProfiles,
): PlanOutcome | null {
  const ranked = rankPlans(request, curves, profiles);
  if (ranked.length === 0) {
    return null;
  }
  const best = ranked[0];

  const others: Plan[] = [];
  for (let i = 1; i < ranked.length && others.length < 3; i++) {
    const candidate = ranked[i];
    const shown = [best].concat(others);
    const different = shown.every(function (plan) {
      return clearlyDifferent(plan, candidate);
    });
    if (different) {
      others.push(candidate);
    }
  }

  const shiftCost = costPerShift(request, curves, profiles);
  const weekdayRates = ratesByDay(curves, profiles, "weekday");
  const daytime = makePlan(weekdayRates, "weekday", 9, best.shifts, request, shiftCost);

  let worst = best;
  ranked.forEach(function (plan) {
    if (plan.dayType === best.dayType && plan.shifts === best.shifts && plan.typical > worst.typical) {
      worst = plan;
    }
  });

  // A near tie: the next plan is within 10%, or wins in at least a quarter of the repeats.
  let nearTie = false;
  const runnerUp = others[0];
  if (runnerUp) {
    let bestWins = 0;
    best.samples.forEach(function (sample, index) {
      const bestScore = sample + best.shifts * shiftCost;
      const otherScore = runnerUp.samples[index] + runnerUp.shifts * shiftCost;
      if (bestScore < otherScore) {
        bestWins = bestWins + 1;
      }
    });
    const closeOnAverage = runnerUp.score - best.score <= 0.1 * Math.max(best.score, 1e-9);
    const oftenBeaten = best.samples.length >= 3 && bestWins < 0.75 * best.samples.length;
    nearTie = closeOnAverage || oftenBeaten;
  }

  return {
    best: best,
    others: others,
    daytime: daytime,
    worst: worst,
    nearTie: nearTie,
    impact: impactOf(best, curves, profiles),
    repeats: curves.length,
    shiftCost: shiftCost,
  };
}

/**
 * Low, some or high impact: the plan's average extra delay per closed hour,
 * compared with the busiest quarter hour on the same kind of day.
 */
export function impactOf(plan: Plan, curves: SeedCurve[], profiles: DayProfiles): Impact {
  const seedRates = ratesByDay(curves, profiles, plan.dayType);
  let busiest = 0;
  for (let quarter = 0; quarter < QUARTERS_PER_DAY; quarter++) {
    const typical = average(
      seedRates.map(function (rates) {
        return rates[quarter];
      }),
    );
    busiest = Math.max(busiest, typical);
  }
  const closedHours = plan.shifts * plan.closedPerShift;
  if (busiest <= 0 || closedHours <= 0) {
    return "low";
  }
  const share = plan.typical / closedHours / busiest;
  if (share < 0.35) {
    return "low";
  }
  if (share < 0.65) {
    return "some";
  }
  return "high";
}

/** The busiest whole hour while a plan's road is closed, to re-test directly. */
export function busiestHour(plan: Plan, curves: SeedCurve[], profiles: DayProfiles): number {
  const seedRates = ratesByDay(curves, profiles, plan.dayType);
  let bestHour = plan.start;
  let bestRate = -1;
  const hours = Math.ceil(plan.closedPerShift);
  for (let offset = 0; offset < hours; offset++) {
    const hour = (plan.start + offset) % 24;
    // The direct test measures the first quarter of the hour (after warming up).
    const rate = average(
      seedRates.map(function (rates) {
        return rates[hour * 4];
      }),
    );
    if (rate > bestRate) {
      bestRate = rate;
      bestHour = hour;
    }
  }
  return bestHour;
}

/** The curve's estimate for the first quarter of an hour, averaged over the repeats. */
export function estimateAt(
  hour: number,
  dayType: DayType,
  curves: SeedCurve[],
  profiles: DayProfiles,
): number {
  return average(
    ratesByDay(curves, profiles, dayType).map(function (rates) {
      return rates[hour * 4];
    }),
  );
}

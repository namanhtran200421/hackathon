/**
 * How much extra delay the works cause at each level of traffic.
 *
 * The planner does not simulate every hour of the day. How much a closure
 * hurts depends mostly on how many cars are arriving, so it tests the works at
 * a few traffic levels (from quiet to the busiest time) and draws a curve
 * through them. Each quarter hour of the day is then read off that curve,
 * using how busy that quarter hour is in the public detector data.
 *
 * Every repeat (random seed) gets its own curve, so the spread between
 * repeats shows how sure the answer is.
 */

import type { ScenarioResult } from "@traffic-lab/simulation";
import type { DayProfiles, DayType } from "./types";

/** Traffic levels tested, as a share of the busiest time. */
export const TRAFFIC_LEVELS = [0.15, 0.4, 0.7, 1];

/** One repeat's extra car-hours per hour at each of TRAFFIC_LEVELS. */
export interface SeedCurve {
  seed: number;
  extra: number[];
}

/**
 * Extra car-hours per hour caused by the works: the time cars spent in the
 * city with the works, minus the same traffic with every road open. Both runs
 * use the same seed, so the same cars arrive at the same moments and only the
 * works differ. Never counted as less than zero: small savings are noise.
 */
export function extraPerHour(open: ScenarioResult, works: ScenarioResult): number {
  if (!(works.measured > 0)) {
    return 0;
  }
  const extra = ((works.vehicleHours - open.vehicleHours) * 3600) / works.measured;
  return Math.max(0, extra);
}

/**
 * Read the curve at any traffic level, joining the tested points with
 * straight lines. With no traffic there is no delay, so the curve starts at 0.
 */
export function rateAt(curve: SeedCurve, level: number): number {
  let previousLevel = 0;
  let previousRate = 0;
  for (let i = 0; i < TRAFFIC_LEVELS.length; i++) {
    const nextLevel = TRAFFIC_LEVELS[i];
    const nextRate = curve.extra[i];
    if (level <= nextLevel || i === TRAFFIC_LEVELS.length - 1) {
      const share = (level - previousLevel) / (nextLevel - previousLevel);
      return Math.max(0, previousRate + share * (nextRate - previousRate));
    }
    previousLevel = nextLevel;
    previousRate = nextRate;
  }
  return 0;
}

/** Extra car-hours per hour for each of the 96 quarter hours of a day. */
export function quarterRates(curve: SeedCurve, profile: number[]): number[] {
  return profile.map(function (level) {
    return rateAt(curve, level);
  });
}

/** The quarter-hour rates of every repeat, for one kind of day. */
export function ratesByDay(curves: SeedCurve[], profiles: DayProfiles, dayType: DayType): number[][] {
  return curves.map(function (curve) {
    return quarterRates(curve, profiles[dayType]);
  });
}

/** Average, lowest and highest over the repeats, for each quarter hour. */
export interface QuarterBand {
  quarter: number;
  typical: number;
  low: number;
  high: number;
}

export function quarterBands(rates: number[][]): QuarterBand[] {
  if (rates.length === 0) {
    return [];
  }
  return rates[0].map(function (_first, quarter) {
    const values = rates.map(function (seedRates) {
      return seedRates[quarter];
    });
    return {
      quarter: quarter,
      typical: average(values),
      low: Math.min(...values),
      high: Math.max(...values),
    };
  });
}

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  let total = 0;
  values.forEach(function (value) {
    total = total + value;
  });
  return total / values.length;
}

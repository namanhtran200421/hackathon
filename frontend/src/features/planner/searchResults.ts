/**
 * Turning finished background tests into the planner's numbers: one delay
 * curve per repeat, the direct checks, and facts for "What could go wrong".
 */

import type { ScenarioResult } from "@traffic-lab/simulation";
import { average, extraPerHour, rateAt, TRAFFIC_LEVELS, type SeedCurve } from "./delayCurve";
import type { Job } from "./jobs";
import { estimateAt } from "./plans";
import type { DayProfiles, DayType, DirectCheck, Plan } from "./types";

type Results = (ScenarioResult | null)[];

/** Both halves of a test: normal traffic and the works, same seed. */
interface Pair {
  open: ScenarioResult | null;
  works: ScenarioResult | null;
}

/** Group results into open/works pairs, by a key made from each job. */
function pairsBy(jobs: Job[], results: Results, keyOf: (job: Job) => string): Map<string, Pair> {
  const pairs = new Map<string, Pair>();
  jobs.forEach(function (job, index) {
    const key = keyOf(job);
    let pair = pairs.get(key);
    if (!pair) {
      pair = { open: null, works: null };
      pairs.set(key, pair);
    }
    if (job.arm === "open") {
      pair.open = results[index];
    } else {
      pair.works = results[index];
    }
  });
  return pairs;
}

function levelKey(job: Job): string {
  return job.seed + ":" + job.level;
}

/** A curve for every repeat whose tests at all traffic levels have finished. */
export function curvesFrom(jobs: Job[], results: Results): SeedCurve[] {
  const pairs = pairsBy(jobs, results, levelKey);
  const seeds: number[] = [];
  jobs.forEach(function (job) {
    if (!seeds.includes(job.seed)) {
      seeds.push(job.seed);
    }
  });
  const curves: SeedCurve[] = [];
  seeds.forEach(function (seed) {
    const extra: number[] = [];
    for (let level = 0; level < TRAFFIC_LEVELS.length; level++) {
      const pair = pairs.get(seed + ":" + level);
      if (!pair || !pair.open || !pair.works) {
        return;
      }
      extra.push(extraPerHour(pair.open, pair.works));
    }
    curves.push({ seed: seed, extra: extra });
  });
  return curves;
}

/** The direct checks whose tests have all finished. */
export function checksFrom(
  jobs: Job[],
  results: Results,
  curves: SeedCurve[],
  profiles: DayProfiles,
): DirectCheck[] {
  const groups = new Map<string, { dayType: DayType; hour: number; measured: number[]; complete: boolean }>();
  const pairs = pairsBy(jobs, results, function (job) {
    return job.dayType + ":" + job.hour + ":" + job.seed;
  });
  jobs.forEach(function (job) {
    if (job.arm !== "works" || job.dayType === undefined || job.hour === undefined) {
      return;
    }
    const key = job.dayType + ":" + job.hour;
    let group = groups.get(key);
    if (!group) {
      group = { dayType: job.dayType, hour: job.hour, measured: [], complete: true };
      groups.set(key, group);
    }
    const pair = pairs.get(key + ":" + job.seed);
    if (!pair || !pair.open || !pair.works) {
      group.complete = false;
      return;
    }
    group.measured.push(extraPerHour(pair.open, pair.works));
  });
  const checks: DirectCheck[] = [];
  groups.forEach(function (group) {
    if (!group.complete) {
      return;
    }
    checks.push({
      dayType: group.dayType,
      hour: group.hour,
      estimate: estimateAt(group.hour, group.dayType, curves, profiles),
      measured: group.measured,
    });
  });
  return checks;
}

/** Facts about the works themselves, from the traffic-level tests. */
export interface WorksFacts {
  /** Road directions the works close completely, and narrow by a lane. */
  closedDirections: number;
  narrowedDirections: number;
  /** For each traffic level: extra cars queued at the edge of the city, on average. */
  extraQueued: number[];
  /** For each traffic level: extra trips that could not reach their destination, per 10 minutes. */
  extraStranded: number[];
}

export function worksFacts(jobs: Job[], results: Results): WorksFacts | null {
  const pairs = pairsBy(jobs, results, levelKey);
  let closed = -1;
  let narrowed = 0;
  const queued: number[][] = TRAFFIC_LEVELS.map(function () {
    return [];
  });
  const stranded: number[][] = TRAFFIC_LEVELS.map(function () {
    return [];
  });
  pairs.forEach(function (pair, key) {
    if (!pair.open || !pair.works) {
      return;
    }
    const level = Number(key.split(":")[1]);
    closed = pair.works.closedDirections;
    narrowed = pair.works.narrowedDirections;
    queued[level].push(pair.works.waiting - pair.open.waiting);
    stranded[level].push(pair.works.stranded - pair.open.stranded);
  });
  if (closed < 0) {
    return null;
  }
  return {
    closedDirections: closed,
    narrowedDirections: narrowed,
    extraQueued: queued.map(average),
    extraStranded: stranded.map(average),
  };
}

/** The busiest traffic level a plan's road is closed through, as a share of the busiest time. */
export function busiestLevel(plan: Plan, profiles: DayProfiles): number {
  const profile = profiles[plan.dayType];
  const quarters = Math.round(plan.closedPerShift * 4);
  let busiest = 0;
  for (let i = 0; i < quarters; i++) {
    busiest = Math.max(busiest, profile[(plan.start * 4 + i) % 96]);
  }
  return busiest;
}

/** The tested level closest to a share of the busiest time. */
export function nearestLevel(level: number): number {
  let nearest = 0;
  TRAFFIC_LEVELS.forEach(function (tested, index) {
    if (Math.abs(tested - level) < Math.abs(TRAFFIC_LEVELS[nearest] - level)) {
      nearest = index;
    }
  });
  return nearest;
}

/**
 * Extra car-hours if every shift ran one hour late, closing the road through
 * the hour after the plan ends. One number per repeat.
 */
export function overrunCost(plan: Plan, curves: SeedCurve[], profiles: DayProfiles): number[] {
  const profile = profiles[plan.dayType];
  const firstLate = plan.start * 4 + Math.round(plan.closedPerShift * 4);
  return curves.map(function (curve) {
    let total = 0;
    for (let i = 0; i < 4; i++) {
      total = total + rateAt(curve, profile[(firstLate + i) % 96]) * 0.25;
    }
    return total * plan.shifts;
  });
}

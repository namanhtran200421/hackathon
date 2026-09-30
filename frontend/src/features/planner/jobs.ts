/**
 * The background tests a search needs.
 *
 * Every test is a pair of short simulations with the same random seed: one
 * with the works and one with every road open. The seed fixes when each car
 * arrives, so the two runs see the same cars and the difference between them
 * is caused by the works alone ("common random numbers").
 *
 * Each simulation warms up for 5 minutes (the city starts empty) and then
 * counts for 10 minutes.
 */

import type { Scenario, Settings } from "@traffic-lab/simulation";
import { TRAFFIC_LEVELS } from "./delayCurve";
import type { DayType, Thoroughness, WorksRequest } from "./types";

export const WARM_UP_SECONDS = 300;
export const COUNT_SECONDS = 600;

/** Simulator settings the planner copies: the city, drivers and signals. */
export const COPIED_SETTINGS = [
  "network-source",
  "demand-veh-per-hour",
  "through-traffic-%",
  "informed-drivers-%",
  "speed-limit-kmh",
  "cycle-length",
  "ew-green-share",
  "signal-coordination",
  "hook-turns?",
  "reroute-interval",
  "route-noise",
  "use-observed-signals?",
] as const;

/** How many repeats (random seeds) each kind of search uses. */
export const REPEATS: Record<Thoroughness, { levels: number; checks: number; plansChecked: number }> = {
  quick: { levels: 3, checks: 3, plansChecked: 1 },
  thorough: { levels: 8, checks: 5, plansChecked: 3 },
};

export function seedsFor(count: number): number[] {
  const seeds: number[] = [];
  for (let seed = 1; seed <= count; seed++) {
    seeds.push(seed);
  }
  return seeds;
}

/** The simulator settings the planner uses, with its own counting times. */
export function plannerSettings(simulator: Settings): Partial<Settings> {
  const settings: Record<string, unknown> = {};
  COPIED_SETTINGS.forEach(function (name) {
    settings[name] = simulator[name];
  });
  settings["fixed-seed?"] = true;
  settings["warm-up-s"] = WARM_UP_SECONDS;
  settings["measure-s"] = COUNT_SECONDS;
  return settings as Partial<Settings>;
}

/** One background simulation and where its result belongs. */
export interface Job {
  scenario: Scenario;
  /** "open" is every road open; "works" has the closure. */
  arm: "open" | "works";
  seed: number;
  /** For traffic-level tests: which of TRAFFIC_LEVELS. */
  level?: number;
  /** For direct checks: the kind of day and hour tested. */
  dayType?: DayType;
  hour?: number;
}

function withWorks(request: WorksRequest, settings: Partial<Settings>, works: boolean): Scenario {
  if (!works) {
    return { settings: settings, closure: null };
  }
  return {
    settings: settings,
    closure: { street: request.street, section: request.section, type: request.closureType },
  };
}

/**
 * The traffic-level tests, one repeat at a time, so that stopping early
 * leaves whole repeats to work with.
 */
export function levelJobs(request: WorksRequest, base: Partial<Settings>, seeds: number[]): Job[] {
  const jobs: Job[] = [];
  const peak = Number(base["demand-veh-per-hour"]);
  seeds.forEach(function (seed) {
    TRAFFIC_LEVELS.forEach(function (level, index) {
      const settings: Partial<Settings> = Object.assign({}, base, {
        "demand-profile": "Flat (synthetic)",
        "profile-start-hour": 0,
        "demand-veh-per-hour": Math.round(peak * level),
        seed: seed,
      });
      jobs.push({ scenario: withWorks(request, settings, false), arm: "open", seed: seed, level: index });
      jobs.push({ scenario: withWorks(request, settings, true), arm: "works", seed: seed, level: index });
    });
  });
  return jobs;
}

/** Direct checks: the works at a real time of day, using the detector data's traffic pattern. */
export function checkJobs(
  request: WorksRequest,
  base: Partial<Settings>,
  seeds: number[],
  checks: { dayType: DayType; hour: number }[],
): Job[] {
  const jobs: Job[] = [];
  checks.forEach(function (check) {
    let profile: Settings["demand-profile"] = "SCATS weekday";
    if (check.dayType === "weekend") {
      profile = "SCATS weekend";
    }
    seeds.forEach(function (seed) {
      const settings: Partial<Settings> = Object.assign({}, base, {
        "demand-profile": profile,
        "profile-start-hour": check.hour,
        seed: seed,
      });
      const where = { seed: seed, dayType: check.dayType, hour: check.hour };
      jobs.push(
        Object.assign({ scenario: withWorks(request, settings, false), arm: "open" as const }, where),
      );
      jobs.push(
        Object.assign({ scenario: withWorks(request, settings, true), arm: "works" as const }, where),
      );
    });
  });
  return jobs;
}

/** A text that is the same for the same scenario, whatever order its settings were set in. */
export function scenarioKey(scenario: Scenario): string {
  const names = Object.keys(scenario.settings).sort();
  const settings = names.map(function (name) {
    return [name, (scenario.settings as Record<string, unknown>)[name]];
  });
  return JSON.stringify([settings, scenario.closure]);
}

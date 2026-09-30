/**
 * Tests for the works planner's sums: the delay curve, the limits, the
 * ranking of plans, and turning test results into curves.
 *
 * Run with:  npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { ScenarioResult } from "@traffic-lab/simulation";
import { viewFromHash } from "../src/app/useView";
import { rateAt, TRAFFIC_LEVELS, type SeedCurve } from "../src/features/planner/delayCurve";
import { levelJobs, plannerSettings, scenarioKey, seedsFor } from "../src/features/planner/jobs";
import { fitsTimes, rankPlans, shiftDelay, shiftOptions, summarise } from "../src/features/planner/plans";
import { curvesFrom } from "../src/features/planner/searchResults";
import type { DayProfiles, WorksRequest } from "../src/features/planner/types";
import { closedWindow, timeOfDay } from "../src/features/planner/wording";
import { DEFAULT_SETTINGS } from "@traffic-lab/simulation";

const REQUEST: WorksRequest = {
  street: "Collins St",
  section: 0,
  closureType: "Both directions",
  workHours: 6,
  longestShift: 8,
  setupHours: 1,
  days: "either",
  times: "any",
  priority: "least-disruption",
  thoroughness: "quick",
};

/** Busy from 7 am to 7 pm on weekdays, quiet otherwise; weekends half as busy. */
function profiles(): DayProfiles {
  const weekday: number[] = [];
  const weekend: number[] = [];
  for (let quarter = 0; quarter < 96; quarter++) {
    const hour = quarter / 4;
    let share = 0.1;
    if (hour >= 7 && hour < 19) {
      share = 1;
    }
    weekday.push(share);
    weekend.push(share / 2);
  }
  return { weekday: weekday, weekend: weekend };
}

/** Delay grows with traffic: 10 car-hours per hour at the busiest time. */
function curve(seed: number, scale: number): SeedCurve {
  return {
    seed: seed,
    extra: TRAFFIC_LEVELS.map(function (level) {
      return 10 * level * scale;
    }),
  };
}

function result(vehicleHours: number): ScenarioResult {
  return {
    vehicleHours: vehicleHours,
    measured: 600,
    completed: 100,
    meanTrip: 7,
    waiting: 0,
    stranded: 0,
    cars: 100,
    closedDirections: 4,
    narrowedDirections: 0,
  };
}

test("the delay curve starts at zero and joins the tested levels with straight lines", function () {
  const tested: SeedCurve = { seed: 1, extra: [3, 8, 14, 20] };
  assert.equal(rateAt(tested, 0), 0);
  assert.equal(rateAt(tested, 0.15), 3);
  assert.equal(rateAt(tested, 1), 20);
  assert.ok(Math.abs(rateAt(tested, 0.55) - 11) < 1e-9);
  assert.ok(Math.abs(rateAt(tested, 0.075) - 1.5) < 1e-9);
});

test("closures must fit inside the allowed times", function () {
  assert.equal(fitsTimes(22, 7, "night"), true);
  assert.equal(fitsTimes(20, 12, "night"), false);
  assert.equal(fitsTimes(19, 12, "night"), true);
  assert.equal(fitsTimes(3, 5, "night"), false);
  assert.equal(fitsTimes(7, 12, "day"), true);
  assert.equal(fitsTimes(8, 12, "day"), false);
  assert.equal(fitsTimes(23, 24, "any"), true);
  assert.equal(fitsTimes(0, 25, "any"), false);
});

test("a shift's delay adds up quarter hours and runs past midnight", function () {
  const rates: number[] = [];
  for (let quarter = 0; quarter < 96; quarter++) {
    rates.push(quarter);
  }
  // 11 pm to 1 am: quarters 92 to 95, then 0 to 3.
  assert.equal(shiftDelay(rates, 23, 2), (92 + 93 + 94 + 95 + 0 + 1 + 2 + 3) * 0.25);
});

test("shift options run from the fewest the crew allows to one hour of work each", function () {
  assert.deepEqual(shiftOptions(REQUEST), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(shiftOptions(Object.assign({}, REQUEST, { workHours: 20 }))[0], 3);
  assert.deepEqual(shiftOptions(Object.assign({}, REQUEST, { workHours: 1.5, longestShift: 2 })), [1]);
});

test("the quietest time wins, and the fewest-shifts priority uses the longest shifts", function () {
  const curves = [curve(1, 1), curve(2, 1.2), curve(3, 0.8)];
  const day = profiles();

  const quiet = rankPlans(REQUEST, curves, day);
  assert.equal(quiet[0].dayType, "weekend");
  const weekdaysOnly = rankPlans(Object.assign({}, REQUEST, { days: "weekdays" }), curves, day);
  const best = weekdaysOnly[0];
  assert.equal(best.dayType, "weekday");
  // Closed 7 hours (6 of work, 1 setting up) in one shift: fits between 7 pm and 7 am.
  assert.equal(best.shifts, 1);
  assert.equal(best.closedPerShift, 7);
  // The whole closure falls in the quiet hours between 7 pm and 7 am.
  assert.equal(fitsTimes(best.start, best.closedPerShift, "night"), true);
  assert.equal(best.samples.length, 3);
  assert.ok(best.low <= best.typical && best.typical <= best.high);

  const longJob = Object.assign({}, REQUEST, { workHours: 30, longestShift: 10, priority: "fewest-shifts" });
  assert.equal(rankPlans(longJob as WorksRequest, curves, day)[0].shifts, 3);
});

test("no plan fits when a shift is longer than the allowed times", function () {
  const tooLong = Object.assign({}, REQUEST, {
    workHours: 12,
    longestShift: 12,
    setupHours: 2,
    times: "day",
  });
  const plans = rankPlans(tooLong as WorksRequest, [curve(1, 1)], profiles());
  assert.equal(
    plans.every(function (plan) {
      return plan.shifts > 1;
    }),
    true,
  );
  const impossible = Object.assign({}, tooLong, { longestShift: 12, workHours: 1, setupHours: 12 });
  assert.equal(summarise(impossible as WorksRequest, [curve(1, 1)], profiles()), null);
});

test("the summary compares with a 9 am weekday closure and spots near ties", function () {
  const curves = [curve(1, 1), curve(2, 1), curve(3, 1)];
  const outcome = summarise(REQUEST, curves, profiles());
  assert.ok(outcome);
  assert.equal(outcome.daytime.start, 9);
  assert.equal(outcome.daytime.dayType, "weekday");
  assert.ok(outcome.daytime.typical > outcome.best.typical);
  assert.equal(outcome.impact, "low");
  // Flat quiet nights make many starts equally good.
  assert.equal(outcome.nearTie, true);
  assert.ok(outcome.others.length > 0);
});

test("only repeats with every traffic level finished become curves", function () {
  const settings = plannerSettings(DEFAULT_SETTINGS);
  const jobs = levelJobs(REQUEST, settings, seedsFor(2));
  assert.equal(jobs.length, 2 * TRAFFIC_LEVELS.length * 2);
  const results = jobs.map(function (job) {
    if (job.seed === 2 && job.level === 3) {
      return null;
    }
    if (job.arm === "works") {
      return result(10 + (job.level || 0));
    }
    return result(10);
  });
  const curves = curvesFrom(jobs, results);
  assert.equal(curves.length, 1);
  assert.equal(curves[0].seed, 1);
  // One extra car-hour in 10 minutes is 6 an hour.
  assert.deepEqual(curves[0].extra, [0, 6, 12, 18]);
});

test("the planner copies the simulator's city but uses its own timings and flat traffic", function () {
  const settings = plannerSettings(Object.assign({}, DEFAULT_SETTINGS, { "demand-veh-per-hour": 4000 }));
  assert.equal(settings["warm-up-s"], 300);
  assert.equal(settings["measure-s"], 600);
  const jobs = levelJobs(REQUEST, settings, [1]);
  assert.equal(jobs[jobs.length - 1].scenario.settings["demand-veh-per-hour"], 4000);
  assert.equal(jobs[0].scenario.settings["demand-veh-per-hour"], 600);
  assert.equal(jobs[0].scenario.closure, null);
  assert.equal(jobs[1].scenario.closure?.street, "Collins St");
});

test("scenario keys ignore the order settings were given in", function () {
  const a = { settings: { seed: 1, "measure-s": 600 }, closure: null };
  const b = { settings: { "measure-s": 600, seed: 1 }, closure: null };
  assert.equal(scenarioKey(a), scenarioKey(b));
  assert.notEqual(scenarioKey(a), scenarioKey({ settings: { seed: 2, "measure-s": 600 }, closure: null }));
});

test("times of day and pages read naturally", function () {
  assert.equal(timeOfDay(0), "midnight");
  assert.equal(timeOfDay(12), "noon");
  assert.equal(timeOfDay(21.5), "9:30 pm");
  assert.equal(timeOfDay(24 + 5), "5 am");
  const plan = rankPlans(REQUEST, [curve(1, 1)], profiles())[0];
  assert.match(closedWindow(plan), /^\d+(:\d\d)? (am|pm)|midnight to /);
  assert.equal(viewFromHash("#report"), "report");
  assert.equal(viewFromHash("#report-results"), "report");
  assert.equal(viewFromHash("#workbench"), "simulator");
  assert.equal(viewFromHash(""), "simulator");
});

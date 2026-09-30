/**
 * Tests for unattended scenario runs, which the works planner relies on.
 *
 * Run with:  npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTrafficSim } from "../src/loadInNode";
import { runScenario, type Scenario } from "../src/scenario";

// Short runs keep the tests quick.
const SHORT = { "warm-up-s": 60, "measure-s": 120, "demand-veh-per-hour": 3000 };

const OPEN: Scenario = { settings: Object.assign({ seed: 7 }, SHORT), closure: null };
const WORKS: Scenario = {
  settings: Object.assign({ seed: 7 }, SHORT),
  closure: { street: "Collins St", section: 0, type: "Both directions" },
};

test("a model reused for many scenarios gives the same numbers as a fresh one", function () {
  const reused = loadTrafficSim();
  // Leave the reused model in an odd state first: other settings, a
  // different map and a closed street.
  reused.set("network-source", "Schematic Hoddle grid");
  reused.set("demand-veh-per-hour", 500);
  reused.setup();
  reused.select("Bourke St", 0);
  reused.command("close-selection");

  const first = runScenario(reused, WORKS);
  const second = runScenario(reused, OPEN);
  const again = runScenario(reused, WORKS);

  assert.deepEqual(first, again);
  assert.deepEqual(first, runScenario(loadTrafficSim(), WORKS));
  assert.deepEqual(second, runScenario(loadTrafficSim(), OPEN));
});

test("scenarios report the works and count the full measuring time", function () {
  const sim = loadTrafficSim();
  let lastProgress = 0;
  const works = runScenario(sim, WORKS, function (done, total) {
    assert.equal(total, 180);
    lastProgress = done;
  });
  const open = runScenario(sim, OPEN);

  assert.equal(lastProgress, 180);
  assert.equal(works.measured, 120);
  assert.ok(works.closedDirections > 0);
  assert.equal(open.closedDirections, 0);
  assert.ok(works.vehicleHours > 0 && open.vehicleHours > 0);
  // Street traffic: nothing gets through the closed street, but it does with every road open.
  assert.equal(works.streets["Collins St"], 0);
  assert.ok(open.streets["Collins St"] > 0);
  assert.ok(Object.keys(works.streets).length > 10);
});

test("scenarios reject unknown settings and very long runs", function () {
  const sim = loadTrafficSim();
  assert.throws(function () {
    runScenario(sim, { settings: { ["no-such-setting" as "seed"]: 1 }, closure: null });
  }, /Unknown setting/);
  assert.throws(function () {
    runScenario(sim, { settings: { "measure-s": 5 * 3600 }, closure: null });
  }, /at most 4 hours/);
});

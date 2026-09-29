/** Checks observed profiles against their provenance and the running model. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadTrafficSim } from "../src/loadInNode";

const data = JSON.parse(fs.readFileSync(new URL("../runtime/observed-data.json", import.meta.url), "utf8"));

test("observed demand uses the published bin and an assumed peak scale", function () {
  const sim = loadTrafficSim();
  sim.set("demand-profile", "SCATS weekday");
  sim.set("profile-start-hour", 8);
  sim.set("demand-veh-per-hour", 2500);
  sim.set("use-observed-signals?", true);
  sim.setup();
  assert.equal(sim.metrics().demandFactor, data.factors.weekday[32]);
  assert.equal(sim.metrics().effectiveArrivalsPerHour, 2500 * data.factors.weekday[32]);
  assert.equal(sim.metrics().observedSignalCount, data.matchedNodes);
  assert.equal(sim.metrics().observedDataVersion, data.version);
  sim.set("profile-start-hour", 2);
  assert.equal(sim.metrics().demandFactor, data.factors.weekday[32]);
  sim.setup();
  assert.equal(sim.metrics().demandFactor, data.factors.weekday[8]);
});

test("profiles are complete, bounded and shared-normalised", function () {
  const all: number[] = [];
  for (const profile of Object.values(data.factors) as number[][]) {
    assert.equal(profile.length, 96);
    for (const factor of profile) {
      assert.ok(Number.isFinite(factor) && factor >= 0 && factor <= 1);
      all.push(factor);
    }
  }
  assert.equal(Math.max(...all), 1);
  assert.ok(data.cohortDetectors > 0);
});

test("weekend profile advances by quarter hour and zero demand creates no cars", function () {
  const sim = loadTrafficSim();
  sim.set("network-source", "Schematic Hoddle grid");
  sim.set("demand-profile", "SCATS weekend");
  sim.set("profile-start-hour", 23);
  sim.set("demand-veh-per-hour", 0);
  sim.set("measure-s", 3600);
  sim.set("use-observed-signals?", true);
  sim.setup();
  assert.equal(sim.metrics().observedSignalCount, 0);
  assert.equal(sim.metrics().demandFactor, data.factors.weekend[92]);
  for (let second = 0; second < 3600; second++) sim.tick();
  assert.equal(sim.metrics().demandFactor, data.factors.weekend[0]);
  assert.equal(sim.metrics().generated, 0);
});

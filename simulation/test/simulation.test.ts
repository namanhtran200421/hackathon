/**
 * Tests for the traffic model's controls.
 *
 * These run the same engine, compiled model and controls the browser runs
 * (see src/loadInNode.ts) and check they behave like the desktop NetLogo model.
 *
 * Run with:  npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTrafficSim, type NodeTrafficSim } from "../src/loadInNode";
import { DEFAULT_SETTINGS, FOREVER, type SettingName, type Settings } from "../src/settings";

interface RoadState {
  section: number;
  closed: boolean;
  lanesOpen: number;
}

/** Copy a value out of the model's sandbox so it can be compared normally. */
function plain(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

/** A model with some settings changed, after pressing Setup. */
function started(settings?: Partial<Settings>): NodeTrafficSim {
  const simulation = loadTrafficSim();
  const changes = settings || {};
  Object.entries(changes).forEach(function (entry) {
    simulation.set(entry[0] as SettingName, entry[1]);
  });
  simulation.setup();
  return simulation;
}

/** Run for a number of simulated seconds. False if the model stopped itself. */
function run(simulation: NodeTrafficSim, seconds: number): boolean {
  for (let second = 0; second < seconds; second++) {
    if (!simulation.tick()) {
      return false;
    }
  }
  return true;
}

/** The drivable roads of one street, with whether each is closed. */
function roadsOf(simulation: NodeTrafficSim, street: string): RoadState[] {
  const styles = simulation.styles();
  const size = simulation.STYLE_FIELDS;
  const world = simulation.world();
  assert.ok(world);
  return world.roads
    .filter(function (road) {
      return road.street === street && road.kind !== "gate" && road.kind !== "access";
    })
    .map(function (road) {
      return {
        section: road.section,
        closed: styles[road.index * size + 2] === 1,
        lanesOpen: styles[road.index * size + 3],
      };
    });
}

function isClosed(road: RoadState): boolean {
  return road.closed;
}

function isOpen(road: RoadState): boolean {
  return !road.closed;
}

test("web controls start from the desktop model's defaults", function () {
  const simulation = loadTrafficSim();
  assert.deepEqual(plain(simulation.settings()), DEFAULT_SETTINGS);
});

test("only known settings and buttons are accepted", function () {
  const simulation = started({ "network-source": "Schematic Hoddle grid" });
  assert.throws(function () {
    simulation.set("clear-all", 1);
  });
  assert.throws(function () {
    simulation.set("view-mode", "heatmap");
  });
  assert.throws(function () {
    simulation.set("hook-turns?", "yes");
  });
  assert.throws(function () {
    simulation.command("ask cars [die]");
  });
  assert.throws(function () {
    simulation.select("Not A Real St", 0);
  });

  simulation.set("demand-veh-per-hour", 99999);
  assert.equal(simulation.settings()["demand-veh-per-hour"], 12000);
  simulation.set("reroute-interval", 12.4);
  assert.equal(simulation.settings()["reroute-interval"], 12);
});

test("watching the model at any frame rate never changes its results", function () {
  const watched = started();
  for (let second = 0; second < 150; second++) {
    watched.tick();
    watched.metrics();
    watched.cars();
    if (second % 5 === 0) {
      watched.styles();
    }
  }
  const quiet = started();
  run(quiet, 150);

  assert.deepEqual(plain(watched.metrics()), plain(quiet.metrics()));
  assert.deepEqual(Array.from(watched.cars()), Array.from(quiet.cars()));
});

test("real map runs reproducibly, conserves vehicles and closes streets", function () {
  const simulation = started();
  const again = started();
  run(simulation, 200);
  run(again, 200);
  assert.deepEqual(plain(simulation.metrics()), plain(again.metrics()));
  assert.equal(simulation.conserved(), true);

  const metrics = simulation.metrics();
  assert.equal(metrics.ticks, 200);
  assert.ok(metrics.completed > 0);
  assert.ok(metrics.cars > 0);
  assert.equal(simulation.cars().length, metrics.cars * simulation.CAR_FIELDS);

  simulation.select("Collins St", 0);
  simulation.set("closure-type", "Both directions");
  simulation.command("close-selection");
  assert.ok(roadsOf(simulation, "Collins St").every(isClosed));
  assert.match(simulation.metrics().closureDesc, /^\d+ closed directions/);

  run(simulation, 30);
  assert.equal(simulation.conserved(), true);

  simulation.command("reopen-all");
  assert.ok(roadsOf(simulation, "Collins St").every(isOpen));
  assert.equal(simulation.metrics().closureDesc, "0 closed directions; 0 reduced lanes");
});

test("baseline uses the model's guards and is kept across Setup until cleared", function () {
  const simulation = started({ "network-source": "Schematic Hoddle grid" });

  // Too early: the warm-up plus one counted minute has not passed yet.
  run(simulation, 90);
  simulation.command("save-baseline");
  assert.match(String(simulation.notices.at(-1)), /warm-up/);
  assert.equal(simulation.metrics().hasBaseline, false);

  run(simulation, 60);
  simulation.command("save-baseline");
  const saved = simulation.metrics();
  assert.equal(saved.hasBaseline, true);
  assert.equal(saved.baselineMatches, true);
  assert.equal(saved.baseline?.completed, saved.completed);

  // A baseline must be recorded with every road open.
  simulation.select("Collins St", 0);
  simulation.command("close-selection");
  simulation.command("save-baseline");
  assert.match(String(simulation.notices.at(-1)), /Reopen all roads/);

  simulation.setup();
  assert.equal(simulation.metrics().hasBaseline, true);

  // Saved once, then reused: new settings keep the baseline but are flagged.
  simulation.set("demand-veh-per-hour", 3000);
  simulation.setup();
  const reused = simulation.metrics();
  assert.equal(reused.hasBaseline, true);
  assert.equal(reused.baselineMatches, false);
  assert.equal(reused.baseline?.completed, saved.completed);

  simulation.command("clear-baseline");
  assert.equal(simulation.metrics().hasBaseline, false);
  simulation.setup();
  assert.equal(simulation.metrics().hasBaseline, false);
});

test("a stored baseline restores into a fresh model, as after a reload", function () {
  const first = started({ "network-source": "Schematic Hoddle grid" });
  run(first, 150);
  first.command("save-baseline");
  const stored = first.exportBaseline();
  assert.ok(stored);
  assert.ok(stored.pairs.length > 0);

  function baselineFlows(simulation: NodeTrafficSim): number[] {
    const styles = simulation.styles();
    const world = simulation.world();
    assert.ok(world);
    return Array.from(world.roads, function (road) {
      return styles[road.index * simulation.STYLE_FIELDS + 5];
    });
  }

  const fresh = started({ "network-source": "Schematic Hoddle grid" });
  assert.equal(fresh.metrics().hasBaseline, false);
  fresh.restoreBaseline(stored);
  assert.equal(fresh.metrics().hasBaseline, true);
  assert.equal(fresh.metrics().baselineMatches, true);
  assert.deepEqual(baselineFlows(fresh), baselineFlows(first));
  fresh.setup();
  assert.deepEqual(baselineFlows(fresh), baselineFlows(first));

  // Restoring must not change how the traffic itself runs.
  const untouched = started({ "network-source": "Schematic Hoddle grid" });
  run(untouched, 60);
  run(fresh, 60);
  assert.equal(fresh.metrics().ticks, 60);
  assert.deepEqual(Array.from(fresh.cars()), Array.from(untouched.cars()));

  // Damaged stored data is ignored.
  fresh.restoreBaseline({ pairs: "bad", signature: 1 });
  assert.equal(fresh.metrics().hasBaseline, true);
});

test("the run stops at the end of the counting time unless it keeps running", function () {
  const simulation = started({
    "network-source": "Schematic Hoddle grid",
    "warm-up-s": 0,
    "measure-s": 60,
  });
  assert.equal(run(simulation, 61), false);
  assert.equal(simulation.metrics().ticks, 60);
  assert.equal(simulation.metrics().finished, true);
  assert.ok(
    simulation.output.some(function (line) {
      return line.startsWith("Run finished");
    }),
  );

  simulation.set("measure-s", FOREVER);
  assert.equal(run(simulation, 120), true);
  assert.equal(simulation.metrics().ticks, 180);
  assert.equal(simulation.metrics().measuring, true);
});

test("clicking a road toggles it with the desktop click handler", function () {
  const simulation = started({ "network-source": "Schematic Hoddle grid" });
  const world = simulation.world();
  assert.ok(world);
  const road = world.roads.find(function (candidate) {
    return candidate.street === "Bourke St" && candidate.section === 2;
  });
  assert.ok(road);
  const start = road.geometry[0];
  const end = road.geometry[1];
  const x = (start[0] + end[0]) / 2;
  const y = (start[1] + end[1]) / 2;

  simulation.set("close-whole-street?", false);
  simulation.click(x, y);
  let bourke = roadsOf(simulation, "Bourke St");
  const sectionTwo = bourke.filter(function (piece) {
    return piece.section === 2;
  });
  const otherSections = bourke.filter(function (piece) {
    return piece.section !== 2;
  });
  assert.ok(sectionTwo.every(isClosed));
  assert.ok(otherSections.every(isOpen));
  assert.equal(simulation.metrics().selectionLabel, "Bourke St / section 2");

  simulation.click(x, y);
  bourke = roadsOf(simulation, "Bourke St");
  assert.ok(bourke.every(isOpen));
});

test("directional and lane closures, scheduled closures and empty demand", function () {
  const simulation = started({ "network-source": "Schematic Hoddle grid" });
  simulation.select("Collins St", 0);
  simulation.set("closure-type", "East / north direction");
  simulation.command("close-selection");
  const collins = roadsOf(simulation, "Collins St");
  assert.ok(collins.some(isClosed));
  assert.ok(collins.some(isOpen));

  simulation.command("reopen-selection");
  simulation.select("Lonsdale St", 0);
  simulation.set("closure-type", "One lane each direction");
  simulation.command("close-selection");
  assert.ok(
    roadsOf(simulation, "Lonsdale St").every(function (road) {
      return !road.closed && road.lanesOpen === 1;
    }),
  );

  const scheduled = started({
    "network-source": "Schematic Hoddle grid",
    "scheduled-closure?": true,
    "closure-start-min": 1,
  });
  run(scheduled, 59);
  assert.ok(roadsOf(scheduled, "Collins St").every(isOpen));
  run(scheduled, 2);
  assert.ok(roadsOf(scheduled, "Collins St").every(isClosed));

  const empty = started({ "demand-veh-per-hour": 0 });
  run(empty, 30);
  assert.equal(empty.metrics().generated, 0);
  assert.equal(empty.cars().length, 0);
});

test("CSV export has the desktop columns and one row per drivable road", function () {
  const simulation = started({ "network-source": "Schematic Hoddle grid" });
  run(simulation, 120);
  const lines = simulation.csv().trim().split("\n");
  assert.equal(
    lines[0],
    "street,direction,block,from,to,lanes,lanes_open,closed,veh_per_hour,baseline_veh_per_hour,change_veh_per_hour,mean_travel_time_s",
  );
  const world = simulation.world();
  assert.ok(world);
  const drivable = world.roads.filter(function (road) {
    return road.carsAllowed && road.kind !== "access";
  });
  assert.equal(lines.length - 1, drivable.length);
  assert.match(lines[1], /^"[^"]+",(EB|WB|NB|SB),\d+,"[^"]+","[^"]+",\d+,\d+,(true|false),/);
});

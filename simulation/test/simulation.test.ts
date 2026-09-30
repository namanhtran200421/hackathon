/**
 * Tests for the traffic model's controls.
 *
 * These run the same engine, compiled model and controls the browser runs
 * (see src/loadInNode.ts) and check they behave like the desktop NetLogo model.
 * Most tests start at 3 am, when the real traffic is light, so they run quickly.
 *
 * Run with:  npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTrafficSim, type NodeTrafficSim } from "../src/loadInNode";
import { DEFAULT_SETTINGS, FOREVER, type SettingName, type Settings } from "../src/settings";
import type { RoadInfo } from "../src/types";

interface RoadState {
  section: number;
  lanes: number;
  closed: boolean;
  lanesOpen: number;
}

/** Light night-time traffic and a one-minute warm-up. */
const QUIET: Partial<Settings> = { "start-time": "03:00", "warm-up-s": 60 };

/** Copy a value out of the model's sandbox so it can be compared normally. */
function plain(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

/** A model with some settings changed, after pressing Setup. */
function started(settings?: Partial<Settings>): NodeTrafficSim {
  const simulation = loadTrafficSim();
  const changes = Object.assign({}, QUIET, settings || {});
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
        lanes: road.lanes,
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

/** A road's length along its shape, in patches. */
function lengthOf(road: RoadInfo): number {
  let total = 0;
  for (let index = 1; index < road.geometry.length; index++) {
    const a = road.geometry[index - 1];
    const b = road.geometry[index];
    total = total + Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return total;
}

/** The middle of a road's longest straight piece, well away from other streets. */
function middleOf(road: RoadInfo): [number, number] {
  let best: [number, number] = road.geometry[0];
  let longest = -1;
  for (let index = 1; index < road.geometry.length; index++) {
    const a = road.geometry[index - 1];
    const b = road.geometry[index];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length > longest) {
      longest = length;
      best = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }
  }
  return best;
}

test("web controls start from the desktop model's defaults", function () {
  const simulation = loadTrafficSim();
  assert.deepEqual(plain(simulation.settings()), DEFAULT_SETTINGS);
});

test("only known settings and buttons are accepted", function () {
  const simulation = started();
  assert.throws(function () {
    simulation.set("clear-all", 1);
  });
  assert.throws(function () {
    simulation.set("view-mode", "heatmap");
  });
  assert.throws(function () {
    simulation.set("day-type", "Holiday");
  });
  assert.throws(function () {
    simulation.set("start-time", "08:10");
  });
  assert.throws(function () {
    simulation.set("adaptive-signals?", "yes");
  });
  assert.throws(function () {
    simulation.command("ask cars [die]");
  });
  assert.throws(function () {
    simulation.select("Not A Real St", 0);
  });

  simulation.set("warm-up-s", 99999);
  assert.equal(simulation.settings()["warm-up-s"], 900);
  simulation.set("reroute-interval", 12.4);
  assert.equal(simulation.settings()["reroute-interval"], 12);
  simulation.set("start-time", "17:45");
  assert.equal(simulation.settings()["start-time"], "17:45");
});

test("watching the model at any frame rate never changes its results", function () {
  const watched = started();
  for (let second = 0; second < 150; second++) {
    watched.tick();
    watched.metrics();
    watched.cars();
    if (second % 5 === 0) {
      watched.styles();
      watched.siteVolumes();
    }
  }
  const quiet = started();
  run(quiet, 150);

  assert.deepEqual(plain(watched.metrics()), plain(quiet.metrics()));
  assert.deepEqual(Array.from(watched.cars()), Array.from(quiet.cars()));
});

test("the real map runs reproducibly, conserves vehicles and closes streets", function () {
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
  const simulation = started();

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

  // Saved once, then reused: a new time keeps the baseline but is flagged.
  simulation.set("start-time", "03:15");
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
  const first = started();
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

  const fresh = started();
  assert.equal(fresh.metrics().hasBaseline, false);
  fresh.restoreBaseline(stored);
  assert.equal(fresh.metrics().hasBaseline, true);
  assert.equal(fresh.metrics().baselineMatches, true);
  assert.deepEqual(baselineFlows(fresh), baselineFlows(first));
  fresh.setup();
  assert.deepEqual(baselineFlows(fresh), baselineFlows(first));

  // Restoring must not change how the traffic itself runs.
  const untouched = started();
  run(untouched, 60);
  run(fresh, 60);
  assert.equal(fresh.metrics().ticks, 60);
  assert.deepEqual(Array.from(fresh.cars()), Array.from(untouched.cars()));

  // Damaged stored data is ignored.
  fresh.restoreBaseline({ pairs: "bad", signature: 1 });
  assert.equal(fresh.metrics().hasBaseline, true);
});

test("the run stops at the end of the counting time unless it keeps running", function () {
  const simulation = started({ "warm-up-s": 0, "measure-s": 60 });
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
  const simulation = started();
  const world = simulation.world();
  assert.ok(world);
  // The longest piece of Bourke St, clicked in the middle, is far from any other street.
  const bourke = world.roads.filter(function (road) {
    return road.street === "Bourke St" && road.carsAllowed && road.kind === "main";
  });
  const road = bourke.reduce(function (longest, candidate) {
    if (lengthOf(candidate) > lengthOf(longest)) {
      return candidate;
    }
    return longest;
  });
  const point = middleOf(road);

  simulation.set("close-whole-street?", false);
  simulation.click(point[0], point[1]);
  let pieces = roadsOf(simulation, "Bourke St");
  const chosen = pieces.filter(function (piece) {
    return piece.section === road.section;
  });
  const others = pieces.filter(function (piece) {
    return piece.section !== road.section;
  });
  assert.ok(chosen.every(isClosed));
  assert.ok(others.every(isOpen));
  assert.equal(simulation.metrics().selectionLabel, "Bourke St / section " + road.section);

  simulation.click(point[0], point[1]);
  pieces = roadsOf(simulation, "Bourke St");
  assert.ok(pieces.every(isOpen));
});

test("directional and lane closures, and scheduled closures", function () {
  const simulation = started();
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
      return road.lanesOpen === road.lanes - 1 && road.closed === (road.lanes === 1);
    }),
  );

  const scheduled = started({ "scheduled-closure?": true, "closure-start-min": 1 });
  run(scheduled, 59);
  assert.ok(roadsOf(scheduled, "Collins St").every(isOpen));
  run(scheduled, 2);
  assert.ok(roadsOf(scheduled, "Collins St").every(isClosed));
});

test("CSV export has the desktop columns and one row per drivable road", function () {
  const simulation = started();
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

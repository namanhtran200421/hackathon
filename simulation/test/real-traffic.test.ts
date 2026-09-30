/**
 * Checks that the model runs on the real traffic data: trips follow the SCATS
 * counts for the chosen day and time, the data files agree with each other,
 * and the model reports how it compares with the counts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { loadTrafficSim, type NodeTrafficSim } from "../src/loadInNode";
import type { SettingName, Settings } from "../src/settings";

const DATA_FOLDER = new URL("../netlogo/data/observed/", import.meta.url);
const summary = JSON.parse(fs.readFileSync(new URL("summary.json", DATA_FOLDER), "utf8"));
const demandText = fs.readFileSync(new URL("demand.txt", DATA_FOLDER), "utf8");
const demandLines = demandText.split("\n");

/** One line of demand.txt that holds only numbers and lists, as JSON. */
function numbers(line: number): unknown {
  return JSON.parse(demandLines[line].trim().replace(/\s+/g, ","));
}

const trips = {
  Weekday: numbers(6) as [number, number][][][],
  Weekend: numbers(7) as [number, number][][][],
};
const scales = {
  Weekday: numbers(8) as number[],
  Weekend: numbers(9) as number[],
};

/** Trips per hour the data asks for at a time of day, in seconds after midnight. */
function tripsAt(day: "Weekday" | "Weekend", seconds: number): number {
  let total = 0;
  trips[day][Math.floor(seconds / 3600)].forEach(function (place) {
    place.forEach(function (pair) {
      total = total + pair[1];
    });
  });
  return total * scales[day][Math.floor(seconds / 900)];
}

function started(settings: Partial<Settings>): NodeTrafficSim {
  const simulation = loadTrafficSim();
  Object.entries(settings).forEach(function (entry) {
    simulation.set(entry[0] as SettingName, entry[1]);
  });
  simulation.setup();
  return simulation;
}

test("the clock starts one warm-up before the start time and trips follow the data", function () {
  const weekday = started({ "day-type": "Weekday", "start-time": "08:00" });
  assert.equal(weekday.metrics().clock, 8 * 3600 - 600);
  assert.equal(weekday.metrics().dayType, "Weekday");
  assert.ok(Math.abs(weekday.metrics().tripsPerHour - tripsAt("Weekday", 8 * 3600 - 600)) < 1e-6);

  const weekend = started({ "day-type": "Weekend", "start-time": "08:00" });
  assert.ok(Math.abs(weekend.metrics().tripsPerHour - tripsAt("Weekend", 8 * 3600 - 600)) < 1e-6);
  assert.ok(weekend.metrics().tripsPerHour < weekday.metrics().tripsPerHour);

  // The clock wraps past midnight.
  const midnight = started({ "start-time": "00:00" });
  assert.equal(midnight.metrics().clock, 24 * 3600 - 600);
});

test("trips move to the next hour's pattern as the clock passes it", function () {
  const simulation = started({ "start-time": "03:00", "warm-up-s": 60 });
  assert.equal(simulation.metrics().clock, 3 * 3600 - 60);
  assert.ok(Math.abs(simulation.metrics().tripsPerHour - tripsAt("Weekday", 3 * 3600 - 60)) < 1e-6);
  for (let second = 0; second < 60; second++) {
    simulation.tick();
  }
  assert.equal(simulation.metrics().clock, 3 * 3600);
  assert.ok(Math.abs(simulation.metrics().tripsPerHour - tripsAt("Weekday", 3 * 3600)) < 1e-6);
  assert.ok(simulation.metrics().generated > 0);
  assert.equal(simulation.conserved(), true);
});

test("trips start and end at the real roads into the map and the public car parks", function () {
  const simulation = started({ "start-time": "03:00" });
  const world = simulation.world();
  assert.ok(world);
  const entries = world.nodes.filter(function (node) {
    return node.kind === "gate";
  });
  const carParks = world.nodes.filter(function (node) {
    return node.kind === "carpark";
  });
  assert.equal(entries.length, summary.entryPoints);
  assert.equal(carParks.length, summary.carParks);
  assert.equal(world.nodes.length, entries.length + carParks.length);
  assert.ok(world.streets.includes("King St"));
  assert.ok(world.streets.includes("Wurundjeri Way"));
});

test("the model compares its traffic with the SCATS counts for the same time", function () {
  const simulation = started({ "start-time": "03:00", "warm-up-s": 0 });
  const world = simulation.world();
  assert.ok(world);
  assert.equal(world.sites.length, summary.countedSites);
  assert.equal(simulation.metrics().scats.sites, summary.countedSites);

  for (let second = 0; second < 120; second++) {
    simulation.tick();
  }
  const scats = simulation.metrics().scats;
  // Counting ran inside 03:00 to 03:15, so the counts are that quarter-hour's.
  assert.equal(scats.counted, summary.dailyTotals.weekday[12]);
  assert.ok(scats.modelled > 0);
  assert.ok(scats.withinGeh5 >= 0 && scats.withinGeh5 <= scats.sites);

  const volumes = simulation.siteVolumes();
  assert.equal(volumes.length, world.sites.length);
  const modelled = volumes.reduce(function (total, site) {
    return total + site.modelled;
  }, 0);
  assert.ok(Math.abs(modelled - scats.modelled) < 1e-6);
});

test("the data files agree with each other and cover every quarter-hour", function () {
  const hash = crypto.createHash("sha256").update(demandText).digest("hex");
  assert.equal(summary.demandSha256, hash);
  const runtime = fs.readFileSync(new URL("../runtime/observed-data.json", import.meta.url), "utf8");
  assert.equal(runtime, fs.readFileSync(new URL("summary.json", DATA_FOLDER), "utf8"));

  (["Weekday", "Weekend"] as const).forEach(function (day) {
    assert.equal(trips[day].length, 24);
    assert.equal(scales[day].length, 96);
    trips[day].forEach(function (hour) {
      assert.equal(hour.length, summary.entryPoints + summary.carParks);
      hour.forEach(function (place) {
        place.forEach(function (pair) {
          assert.ok(Number.isInteger(pair[0]) && pair[0] >= 0 && pair[0] < summary.tripEndGroups);
          assert.ok(Number.isInteger(pair[1]) && pair[1] > 0);
        });
      });
    });
  });
  ["weekday", "weekend"].forEach(function (group) {
    assert.equal(summary.fit[group].length, 96);
    assert.equal(summary.dailyTotals[group].length, 96);
  });
  assert.ok(summary.countedSites > 0 && summary.countedSites <= summary.matchedSignalSites);
});

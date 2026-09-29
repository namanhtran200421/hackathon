import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTrafficSim } from "../src/lib/engine.mjs";
import { DEFAULTS, FOREVER } from "../src/lib/controls.mjs";

const plain = (value) => JSON.parse(JSON.stringify(value));
function started(settings = {}) {
  const sim = loadTrafficSim();
  for (const [name, value] of Object.entries(settings)) sim.set(name, value);
  sim.setup();
  return sim;
}
function run(sim, seconds) {
  for (let i = 0; i < seconds; i++) if (!sim.tick()) return false;
  return true;
}
function roadsOf(sim, street) {
  const styles = sim.styles();
  return sim
    .world()
    .roads.filter(
      (r) => r.street === street && r.kind !== "gate" && r.kind !== "access",
    )
    .map((r) => ({
      section: r.section,
      closed: styles[r.index * sim.STYLE_FIELDS + 2] === 1,
      lanesOpen: styles[r.index * sim.STYLE_FIELDS + 3],
    }));
}

test("web controls start from the desktop model's defaults", () => {
  const sim = loadTrafficSim();
  assert.deepEqual(plain(sim.settings()), DEFAULTS);
});

test("only known settings and buttons are accepted", () => {
  const sim = started({ "network-source": "Schematic Hoddle grid" });
  assert.throws(() => sim.set("clear-all", 1));
  assert.throws(() => sim.set("view-mode", "heatmap"));
  assert.throws(() => sim.set("hook-turns?", "yes"));
  assert.throws(() => sim.command("ask cars [die]"));
  assert.throws(() => sim.select("Not A Real St", 0));
  sim.set("demand-veh-per-hour", 99999);
  assert.equal(sim.settings()["demand-veh-per-hour"], 12000);
  sim.set("reroute-interval", 12.4);
  assert.equal(sim.settings()["reroute-interval"], 12);
});

test("watching the model at any frame rate never changes its results", () => {
  const watched = started();
  for (let i = 0; i < 150; i++) {
    watched.tick();
    watched.metrics();
    watched.cars();
    if (i % 5 === 0) watched.styles();
  }
  const quiet = started();
  run(quiet, 150);
  assert.deepEqual(plain(watched.metrics()), plain(quiet.metrics()));
  assert.deepEqual([...watched.cars()], [...quiet.cars()]);
});

test("real map runs reproducibly, conserves vehicles and closes streets", () => {
  const sim = started();
  const again = started();
  run(sim, 200);
  run(again, 200);
  assert.deepEqual(plain(sim.metrics()), plain(again.metrics()));
  assert.equal(sim.conserved(), true);
  const m = sim.metrics();
  assert.equal(m.ticks, 200);
  assert.ok(m.completed > 0 && m.cars > 0);
  assert.equal(sim.cars().length, m.cars * sim.CAR_FIELDS);

  sim.select("Collins St", 0);
  sim.set("closure-type", "Both directions");
  sim.command("close-selection");
  assert.ok(roadsOf(sim, "Collins St").every((r) => r.closed));
  assert.match(sim.metrics().closureDesc, /^\d+ closed directions/);
  run(sim, 30);
  assert.equal(sim.conserved(), true);
  sim.command("reopen-all");
  assert.ok(roadsOf(sim, "Collins St").every((r) => !r.closed));
  assert.equal(
    sim.metrics().closureDesc,
    "0 closed directions; 0 reduced lanes",
  );
});

test("baseline uses the model's own guards and survives a matching Setup", () => {
  const sim = started({ "network-source": "Schematic Hoddle grid" });
  run(sim, 90);
  sim.command("save-baseline");
  assert.match(sim.notices.at(-1), /warm-up/);
  assert.equal(sim.metrics().hasBaseline, false);
  run(sim, 60);
  sim.command("save-baseline");
  const saved = sim.metrics();
  assert.equal(saved.hasBaseline, true);
  assert.equal(saved.baselineMatches, true);
  assert.equal(saved.baseline.completed, saved.completed);

  sim.select("Collins St", 0);
  sim.command("close-selection");
  sim.command("save-baseline");
  assert.match(sim.notices.at(-1), /Reopen all roads/);

  sim.setup();
  assert.equal(sim.metrics().hasBaseline, true);
  sim.set("demand-veh-per-hour", 3000);
  assert.equal(sim.metrics().baselineMatches, false);
  sim.setup();
  assert.equal(sim.metrics().hasBaseline, false);
});

test("the run stops at the end of the window unless it runs forever", () => {
  const sim = started({
    "network-source": "Schematic Hoddle grid",
    "warm-up-s": 0,
    "measure-s": 60,
  });
  assert.equal(run(sim, 61), false);
  assert.equal(sim.metrics().ticks, 60);
  assert.equal(sim.metrics().finished, true);
  assert.ok(sim.output.some((line) => line.startsWith("Run finished")));
  sim.set("measure-s", FOREVER);
  assert.equal(run(sim, 120), true);
  assert.equal(sim.metrics().ticks, 180);
  assert.equal(sim.metrics().measuring, true);
});

test("Click roads toggles the clicked road with the desktop handler", () => {
  const sim = started({ "network-source": "Schematic Hoddle grid" });
  const road = sim
    .world()
    .roads.find((r) => r.street === "Bourke St" && r.section === 2);
  const [a, b] = road.geometry;
  const x = (a[0] + b[0]) / 2,
    y = (a[1] + b[1]) / 2;
  sim.set("close-whole-street?", false);
  sim.click(x, y);
  let bourke = roadsOf(sim, "Bourke St");
  assert.ok(bourke.filter((r) => r.section === 2).every((r) => r.closed));
  assert.ok(bourke.filter((r) => r.section !== 2).every((r) => !r.closed));
  assert.equal(sim.metrics().selectionLabel, "Bourke St / section 2");
  sim.click(x, y);
  bourke = roadsOf(sim, "Bourke St");
  assert.ok(bourke.every((r) => !r.closed));
});

test("directional and lane closures, scheduled closures and empty demand", () => {
  const sim = started({ "network-source": "Schematic Hoddle grid" });
  sim.select("Collins St", 0);
  sim.set("closure-type", "East / north direction");
  sim.command("close-selection");
  const collins = roadsOf(sim, "Collins St");
  assert.ok(collins.some((r) => r.closed) && collins.some((r) => !r.closed));
  sim.command("reopen-selection");
  sim.select("Lonsdale St", 0);
  sim.set("closure-type", "One lane each direction");
  sim.command("close-selection");
  assert.ok(
    roadsOf(sim, "Lonsdale St").every((r) => !r.closed && r.lanesOpen === 1),
  );

  const scheduled = started({
    "network-source": "Schematic Hoddle grid",
    "scheduled-closure?": true,
    "closure-start-min": 1,
  });
  run(scheduled, 59);
  assert.ok(roadsOf(scheduled, "Collins St").every((r) => !r.closed));
  run(scheduled, 2);
  assert.ok(roadsOf(scheduled, "Collins St").every((r) => r.closed));

  const empty = started({ "demand-veh-per-hour": 0 });
  run(empty, 30);
  assert.equal(empty.metrics().generated, 0);
  assert.equal(empty.cars().length, 0);
});

test("CSV export has the desktop columns and one row per drivable link", () => {
  const sim = started({ "network-source": "Schematic Hoddle grid" });
  run(sim, 120);
  const lines = sim.csv().trim().split("\n");
  assert.equal(
    lines[0],
    "street,direction,block,from,to,lanes,lanes_open,closed,veh_per_hour,baseline_veh_per_hour,change_veh_per_hour,mean_travel_time_s",
  );
  const drivable = sim
    .world()
    .roads.filter((r) => r.carsAllowed && r.kind !== "access");
  assert.equal(lines.length - 1, drivable.length);
  assert.match(
    lines[1],
    /^"[^"]+",(EB|WB|NB|SB),\d+,"[^"]+","[^"]+",\d+,\d+,(true|false),/,
  );
});

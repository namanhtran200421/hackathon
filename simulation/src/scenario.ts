/**
 * Run one complete, unattended simulation: a "scenario".
 *
 * The works planner tests many scenarios in the background (the same works at
 * different traffic levels and with different random seeds). Each one starts
 * from the starting settings, applies the scenario's own settings, builds the
 * road map, optionally closes a street, and runs to the end of the counting
 * time. Only the final numbers come back; nothing is drawn.
 */

import type { TrafficSim } from "./createTrafficSim";
import { isDrivable, STYLE } from "./packing";
import { checkSetting, DEFAULT_SETTINGS, type ClosureType, type Settings } from "./settings";

/** A street closure to apply straight after Setup. */
export interface ScenarioClosure {
  street: string;
  /** 0 means the whole street. */
  section: number;
  type: ClosureType;
}

export interface Scenario {
  /** Settings that differ from the starting values. */
  settings: Partial<Settings>;
  /** The works, or null for normal traffic with every road open. */
  closure: ScenarioClosure | null;
}

/** The numbers a finished scenario reports. */
export interface ScenarioResult {
  /** Time every car spent in the city (and queued at its edge) while counting, in car-hours. */
  vehicleHours: number;
  /** Seconds counted. */
  measured: number;
  /** Trips finished while counting. */
  completed: number;
  /** Average trip time, in minutes. */
  meanTrip: number;
  /** Cars queued at the edge of the city at the end, unable to get in. */
  waiting: number;
  /** Trips given up because there was no way to the destination. */
  stranded: number;
  /** Cars on the road at the end. */
  cars: number;
  /** Road directions closed and narrowed by the works. */
  closedDirections: number;
  narrowedDirections: number;
  /**
   * Cars per hour through an average block of each street, both directions
   * together, while counting: the same measure as the results table and the
   * CSV download. Rounded to whole cars.
   */
  streets: Record<string, number>;
}

/** Cars per hour through an average block of every drivable street. */
function streetFlows(sim: TrafficSim, measured: number): Record<string, number> {
  const world = sim.world();
  const styles = sim.styles();
  const flows: Record<string, number> = {};
  if (!world || styles.length !== world.roads.length * STYLE.fields) {
    return flows;
  }
  const hours = Math.max(1 / 3600, measured / 3600);
  const totals = new Map<string, { counted: number; sections: Set<number> }>();
  world.roads.forEach(function (road) {
    if (!isDrivable(road)) {
      return;
    }
    let street = totals.get(road.street);
    if (!street) {
      street = { counted: 0, sections: new Set() };
      totals.set(road.street, street);
    }
    street.counted = street.counted + styles[road.index * STYLE.fields + STYLE.winCount];
    street.sections.add(road.section);
  });
  totals.forEach(function (street, name) {
    flows[name] = Math.round(street.counted / Math.max(1, street.sections.size) / hours);
  });
  return flows;
}

/** Settings a scenario may never change: they only affect how the map looks. */
const IGNORED: readonly string[] = ["view-mode"];

/** Read "12 closed directions; 3 reduced lanes". */
function closureCounts(text: string): { closed: number; narrowed: number } {
  const counts = /^(\d+) closed directions; (\d+) reduced lanes$/.exec(text);
  if (!counts) {
    return { closed: 0, narrowed: 0 };
  }
  return { closed: Number(counts[1]), narrowed: Number(counts[2]) };
}

/**
 * Run a scenario to the end. `onProgress` hears how many simulated seconds are
 * done out of the total, about every 30 seconds.
 *
 * The same model can run many scenarios one after another: every setting is
 * reset first, and Setup rebuilds the map, so each run starts fresh.
 */
export function runScenario(
  sim: TrafficSim,
  scenario: Scenario,
  onProgress?: (done: number, total: number) => void,
): ScenarioResult {
  const settings: Settings = Object.assign({}, DEFAULT_SETTINGS);
  Object.entries(scenario.settings).forEach(function (entry) {
    if (IGNORED.includes(entry[0])) {
      return;
    }
    (settings as unknown as Record<string, unknown>)[entry[0]] = checkSetting(entry[0], entry[1]);
  });
  // The works are applied straight after Setup below, never on a timer.
  settings["scheduled-closure?"] = false;
  if (scenario.closure) {
    settings["closure-type"] = scenario.closure.type;
  }
  if (settings["measure-s"] > 4 * 3600) {
    throw new Error("A background test can count for at most 4 hours.");
  }
  Object.entries(settings).forEach(function (entry) {
    sim.set(entry[0], entry[1]);
  });

  sim.setup();
  if (scenario.closure) {
    sim.select(scenario.closure.street, scenario.closure.section);
    sim.command("close-selection");
  }

  const total = settings["warm-up-s"] + settings["measure-s"];
  while (sim.tick()) {
    const done = sim.ticks();
    if (onProgress && done % 30 === 0) {
      onProgress(done, total);
    }
  }

  const metrics = sim.metrics();
  const counts = closureCounts(metrics.closureDesc);
  return {
    vehicleHours: metrics.vehicleHours,
    measured: metrics.measured,
    completed: metrics.completed,
    meanTrip: metrics.meanTrip,
    waiting: metrics.waiting,
    stranded: metrics.stranded,
    cars: metrics.cars,
    closedDirections: counts.closed,
    narrowedDirections: counts.narrowed,
    streets: streetFlows(sim, metrics.measured),
  };
}

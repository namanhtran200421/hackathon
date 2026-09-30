/**
 * The controls for a loaded traffic model.
 *
 * This is the only way the rest of the app touches the model. It offers the
 * desktop interface's sliders, switches and choosers (`set`), its buttons
 * (`command`, `tick`, `click`) and read-only views (`metrics`, `cars`,
 * `styles`, `describeWorld`). Every input is checked, so nothing can send the
 * model arbitrary NetLogo code.
 *
 * The traffic rules themselves all live in the compiled model.
 */

import type { ModelScope, ReporterName } from "./modelScope";
import type { ButtonName } from "./protocol";
import { CAR_FIELDS, STYLE } from "./packing";
import { checkSetting, DEFAULT_SETTINGS, FOREVER, type Settings } from "./settings";
import type {
  BaselineSummary,
  CountSite,
  MapLabel,
  MapNode,
  Metrics,
  ModelBaseline,
  RoadInfo,
  ScatsComparison,
  SiteVolume,
  World,
} from "./types";

const CSV_HEADER =
  "street,direction,block,from,to,lanes,lanes_open,closed,veh_per_hour,baseline_veh_per_hour,change_veh_per_hour,mean_travel_time_s";

const BUTTONS: readonly ButtonName[] = [
  "setup",
  "go",
  "close-selection",
  "reopen-selection",
  "reopen-all",
  "save-baseline",
  "clear-baseline",
];

/** A number, or a fallback when the model gave something else. */
function numberOr(value: unknown, fallback: number): number {
  if (typeof value === "number") {
    return value;
  }
  return fallback;
}

/** 1 for true, 0 for false, for packing into number arrays. */
function flag(value: unknown): number {
  if (value) {
    return 1;
  }
  return 0;
}

/** The model's (list sites within-geh-5 modelled counted), or zeros before counting. */
function toScatsComparison(value: unknown): ScatsComparison {
  if (!Array.isArray(value) || value.length !== 4) {
    return { sites: 0, withinGeh5: 0, modelled: 0, counted: 0 };
  }
  return {
    sites: numberOr(value[0], 0),
    withinGeh5: numberOr(value[1], 0),
    modelled: numberOr(value[2], 0),
    counted: numberOr(value[3], 0),
  };
}

function toBaselineSummary(summary: unknown): BaselineSummary | null {
  if (!Array.isArray(summary) || summary.length !== 5) {
    return null;
  }
  return {
    completed: summary[0],
    meanTrip: summary[1],
    waiting: summary[2],
    stranded: summary[3],
    measured: summary[4],
  };
}

export type TrafficSim = ReturnType<typeof createTrafficSim>;

/** Create the controls for the model loaded in `scope`. */
export function createTrafficSim(scope: ModelScope) {
  const reporters = scope.TRAFFIC_REPORTERS;
  const procedures = scope.ProcedurePrims;
  const observer = scope.world.observer;
  let world: World | null = null;

  // Reading runs on a copy of the random number generator, so looking at the
  // model (at any speed or frame rate) never changes its results. This is the
  // same idea as NetLogo's with-local-randomness.
  function read<Result>(reporter: () => Result): Result {
    return scope.workspace.rng.withClone(reporter);
  }

  function ask(name: ReporterName): unknown[] {
    return read(reporters[name]) as unknown[];
  }

  function ticks(): number {
    return scope.world.ticker.tickCount();
  }

  /** Current value of every slider, switch and chooser. */
  function settings(): Settings {
    const values: Record<string, unknown> = {};
    Object.keys(DEFAULT_SETTINGS).forEach(function (name) {
      values[name] = observer.getGlobal(name);
    });
    return values as unknown as Settings;
  }

  /** The numbers the page shows. */
  function metrics(): Metrics {
    const m = ask("metrics");
    return {
      ticks: m[0] as number,
      cars: m[1] as number,
      generated: m[2] as number,
      completedTotal: m[3] as number,
      stranded: m[4] as number,
      waiting: m[5] as number,
      meanTrip: m[6] as number,
      meanDelay: m[7] as number,
      measured: m[8] as number,
      completed: m[9] as number,
      vehicleHours: m[10] as number,
      finished: m[11] === true,
      closureDesc: String(m[12]),
      selectionLabel: String(m[13]),
      measuring: m[14] === true,
      hasBaseline: m[15] === true,
      baselineMatches: m[16] === true,
      baseline: toBaselineSummary(m[17]),
      selectedStreet: String(m[18]),
      selectedBlock: Number(m[19]) || 0,
      warmUp: m[20] as number,
      measure: m[21] as number,
      clock: m[22] as number,
      tripsPerHour: m[23] as number,
      scats: toScatsComparison(m[24]),
      dataVersion: String(m[25]),
      dayType: String(m[26]),
    };
  }

  /** Every car as five numbers: id, x, y, heading, NetLogo colour. */
  function cars(): Float32Array {
    const list = ask("cars") as unknown[][];
    const packed = new Float32Array(list.length * CAR_FIELDS);
    for (let car = 0; car < list.length; car++) {
      for (let field = 0; field < CAR_FIELDS; field++) {
        packed[car * CAR_FIELDS + field] = numberOr(list[car][field], 0);
      }
    }
    return packed;
  }

  /** How every road looks right now, packed as described in packing.ts. */
  function styles(): Float32Array {
    const list = ask("styles") as unknown[][];
    const packed = new Float32Array(list.length * STYLE.fields);
    for (let index = 0; index < list.length; index++) {
      const road = list[index];
      const at = index * STYLE.fields;
      packed[at + STYLE.color] = numberOr(road[0], 5);
      packed[at + STYLE.thickness] = numberOr(road[1], 0);
      packed[at + STYLE.closed] = flag(road[2]);
      packed[at + STYLE.lanesOpen] = numberOr(road[3], 0);
      packed[at + STYLE.winCount] = numberOr(road[4], 0);
      packed[at + STYLE.baseCount] = numberOr(road[5], 0);
      packed[at + STYLE.travelTime] = numberOr(road[6], 0);
      packed[at + STYLE.pairClosed] = flag(road[7]);
      packed[at + STYLE.pairReduced] = flag(road[8]);
    }
    return packed;
  }

  /** The road layout, entry points, car parks, labels, counted sites and street list. Changes only on Setup. */
  function describeWorld(): World {
    const roads = (ask("roads") as unknown[][]).map(function (road, index): RoadInfo {
      const points = road[4] as number[][];
      return {
        index: index,
        from: road[0] as number,
        to: road[1] as number,
        street: String(road[2]),
        section: road[3] as number,
        geometry: points.map(function (point): [number, number] {
          return [point[0], point[1]];
        }),
        lanes: road[5] as number,
        kind: String(road[6]),
        direction: String(road[7]),
        carsAllowed: road[8] === true,
      };
    });

    const nodes = (ask("nodes") as unknown[][]).map(function (node): MapNode {
      return { x: node[0] as number, y: node[1] as number, kind: String(node[2]), label: String(node[3]) };
    });

    const labels = (ask("labels") as unknown[][])
      .map(function (label): MapLabel {
        return { x: label[0] as number, y: label[1] as number, text: String(label[2]) };
      })
      .filter(function (label) {
        return label.text !== "" && !label.text.startsWith("©");
      });

    const sites = (ask("sites") as unknown[][]).map(function (site): CountSite {
      return { id: site[0] as number, name: String(site[1]), x: site[2] as number, y: site[3] as number };
    });

    // The same list the desktop Choose street dialog offers.
    const names = new Set<string>();
    roads.forEach(function (road) {
      if (road.kind !== "gate" && road.kind !== "access" && road.carsAllowed) {
        names.add(road.street);
      }
    });

    const bounds = ask("bounds") as number[];
    world = {
      roads: roads,
      nodes: nodes,
      labels: labels,
      sites: sites,
      streets: Array.from(names).sort(),
      bounds: { minX: bounds[0], maxX: bounds[1], minY: bounds[2], maxY: bounds[3] },
    };
    return world;
  }

  /** The Setup button: build the road map and start a new run. */
  function setup(): World {
    procedures.callCommand("setup");
    return describeWorld();
  }

  return {
    FOREVER: FOREVER,
    CAR_FIELDS: CAR_FIELDS,
    STYLE_FIELDS: STYLE.fields,
    settings: settings,
    metrics: metrics,
    cars: cars,
    styles: styles,
    ticks: ticks,
    describeWorld: describeWorld,
    setup: setup,

    world: function (): World | null {
      return world;
    },

    /** Move a slider, flip a switch or pick a chooser option. */
    set: function (name: string, value: unknown): void {
      observer.setGlobal(name, checkSetting(name, value));
    },

    /** Choose street and Choose section. Section 0 means the whole street. */
    select: function (street: unknown, block: unknown): void {
      if (typeof street !== "string" || street.length > 100) {
        throw new Error("Choose a street from the list.");
      }
      if (world && !world.streets.includes(street)) {
        throw new Error(street + " is not a drivable street on this map.");
      }
      const section = Math.max(0, Math.min(2000, Math.round(Number(block))));
      if (!Number.isFinite(section)) {
        throw new Error("Choose a section.");
      }
      observer.setGlobal("selected-street", street);
      observer.setGlobal("selected-block", section);
    },

    /** Press one of the desktop buttons by its NetLogo name. */
    command: function (name: unknown): void {
      if (!BUTTONS.includes(name as ButtonName)) {
        throw new Error("Unknown button: " + String(name));
      }
      if (name === "setup") {
        setup();
        return;
      }
      procedures.callCommand(name as ButtonName);
    },

    /**
     * Move the model on by one second. Returns false when the model stops by
     * itself at the end of the counting time, like the desktop Go button.
     */
    tick: function (): boolean {
      const before = ticks();
      procedures.callCommand("go");
      return ticks() > before;
    },

    /** Click roads: the model's own click handler picks and toggles the road. */
    click: function (x: number, y: number): void {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return;
      }
      procedures.callCommand("handle-map-pointer", true, true, x, y);
      procedures.callCommand("handle-map-pointer", false, true, x, y);
    },

    /** Recolour the roads now, for example after changing the map view. */
    refreshColors: function (): void {
      read(function () {
        return procedures.callCommand("update-link-colors");
      });
    },

    /** Vehicles per hour entering each counted site, in the order of world.sites. */
    siteVolumes: function (): SiteVolume[] {
      const parts = ask("siteVolumes") as number[][];
      return parts[0].map(function (modelled, index): SiteVolume {
        return { modelled: modelled, counted: parts[1][index] };
      });
    },

    /** The road results as a CSV file, in the desktop export's format. */
    csv: function (): string {
      const rows = ask("csv").map(String);
      return [CSV_HEADER].concat(rows).join("\n") + "\n";
    },

    /** The saved baseline, so the browser can keep it after a reload. */
    exportBaseline: function (): ModelBaseline | null {
      const parts = ask("baseline");
      if (!Array.isArray(parts[2])) {
        return null;
      }
      return JSON.parse(JSON.stringify({ pairs: parts[0], summary: parts[1], signature: parts[2] }));
    },

    /** Put a stored baseline back into the model. Bad data is ignored. */
    restoreBaseline: function (saved: unknown): void {
      const stored = saved as Partial<ModelBaseline> | null;
      if (!stored || !Array.isArray(stored.pairs) || !Array.isArray(stored.signature)) {
        return;
      }
      const pairs = stored.pairs
        .filter(function (pair) {
          return Array.isArray(pair) && typeof pair[0] === "string" && Number.isFinite(pair[1]);
        })
        .slice(0, 20000);
      let summary: number[] = [];
      if (Array.isArray(stored.summary)) {
        summary = stored.summary.filter(Number.isFinite).slice(0, 5);
      }
      const signature = stored.signature
        .filter(function (value) {
          return ["string", "number", "boolean"].includes(typeof value);
        })
        .slice(0, 32);
      read(function () {
        return procedures.callCommand("restore-baseline", pairs, summary, signature);
      });
    },

    /** True when every car is accounted for. Used by the tests. */
    conserved: function (): boolean {
      return read(reporters.conservation) === true;
    },
  };
}

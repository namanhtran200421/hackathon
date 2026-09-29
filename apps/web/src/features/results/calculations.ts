/**
 * Calculations for "Run results": the summary table, the comparison with the
 * baseline, and the per-street table.
 */

import { STYLE, isDrivable, type BaselineSummary, type Metrics, type World } from "@traffic-lab/simulation";
import { clock, oneDp, twoDp, whole } from "../../lib/format";
import { sampleFrom } from "../simulation/useTrafficSim";
import type { Sample } from "../simulation/types";

/**
 * A run's figures at simulated second `time`: its final figures if it ended
 * by then, otherwise the last recorded point before `time`.
 */
export function figuresAt(history: Sample[], finalMetrics: Metrics, time: number): Sample {
  if (finalMetrics.ticks <= time) {
    return sampleFrom(finalMetrics);
  }
  let best: Sample | null = null;
  history.forEach(function (sample) {
    if (sample.t <= time && (best === null || sample.t > best.t)) {
      best = sample;
    }
  });
  return best || sampleFrom(finalMetrics);
}

function tripsPerHour(completed: number, measured: number): number {
  return completed / Math.max(1 / 3600, measured / 3600);
}

function minutes(value: number): string {
  return twoDp(value) + " min";
}

export interface SummaryRow {
  label: string;
  run: number | null;
  base: number | null;
  format: (value: number) => string;
  /** Whether a higher number is good (true), bad (false) or neither (null). */
  higherIsBetter: boolean | null;
}

/**
 * The rows of the summary table.
 *
 * `run` and `base` come from figuresAt(). When the full baseline recording is
 * missing, `fallback` holds the five numbers the model keeps.
 */
export function summaryRows(
  run: Sample,
  base: Sample | null,
  fallback: BaselineSummary | null,
): SummaryRow[] {
  function fromBase(key: keyof Sample): number | null {
    if (base) {
      return base[key];
    }
    return null;
  }

  function fromEither(key: keyof Sample & keyof BaselineSummary): number | null {
    if (base) {
      return base[key];
    }
    if (fallback) {
      return fallback[key];
    }
    return null;
  }

  let baseThroughput: number | null = null;
  if (base) {
    baseThroughput = tripsPerHour(base.completed, base.measured);
  } else if (fallback) {
    baseThroughput = tripsPerHour(fallback.completed, fallback.measured);
  }

  let baseTripTime: number | null = null;
  if (base) {
    baseTripTime = base.meanTrip;
  } else if (fallback && fallback.completed > 0) {
    baseTripTime = fallback.meanTrip;
  }

  return [
    {
      label: "Trips finished",
      run: run.completed,
      base: fromEither("completed"),
      format: whole,
      higherIsBetter: true,
    },
    {
      label: "Trips finished per hour",
      run: tripsPerHour(run.completed, run.measured),
      base: baseThroughput,
      format: whole,
      higherIsBetter: true,
    },
    {
      label: "Average trip time",
      run: run.meanTrip,
      base: baseTripTime,
      format: minutes,
      higherIsBetter: false,
    },
    {
      label: "Average delay (extra time compared with empty roads)",
      run: run.meanDelay,
      base: fromBase("meanDelay"),
      format: minutes,
      higherIsBetter: false,
    },
    {
      label: "Total hours spent driving",
      run: run.vehicleHours,
      base: fromBase("vehicleHours"),
      format: oneDp,
      higherIsBetter: false,
    },
    {
      label: "Cars waiting to enter",
      run: run.waiting,
      base: fromEither("waiting"),
      format: whole,
      higherIsBetter: false,
    },
    {
      label: "Cars with no route",
      run: run.stranded,
      base: fromEither("stranded"),
      format: whole,
      higherIsBetter: false,
    },
    { label: "Cars on the road", run: run.cars, base: fromBase("cars"), format: whole, higherIsBetter: null },
    {
      label: "Cars that arrived",
      run: run.generated,
      base: fromBase("generated"),
      format: whole,
      higherIsBetter: null,
    },
    {
      label: "Time counted",
      run: run.measured,
      base: fromEither("measured"),
      format: clock,
      higherIsBetter: null,
    },
  ];
}

export interface StreetRow {
  street: string;
  /** Cars per hour through an average block, both directions together. */
  flow: number;
  baseline: number;
  change: number;
  /** Average seconds to drive one block. */
  travel: number;
  closed: number;
  narrowed: number;
}

/** One row per street, using the model's own street-flow measure. */
export function streetRows(world: World, styles: Float32Array, measuredSeconds: number): StreetRow[] {
  if (styles.length !== world.roads.length * STYLE.fields) {
    return [];
  }
  const hours = Math.max(1 / 3600, measuredSeconds / 3600);
  const totals = new Map<
    string,
    {
      sections: Set<number>;
      counted: number;
      baseline: number;
      travel: number;
      roads: number;
      closed: number;
      narrowed: number;
    }
  >();

  world.roads.forEach(function (road) {
    if (!isDrivable(road)) {
      return;
    }
    const at = road.index * STYLE.fields;
    let street = totals.get(road.street);
    if (!street) {
      street = { sections: new Set(), counted: 0, baseline: 0, travel: 0, roads: 0, closed: 0, narrowed: 0 };
      totals.set(road.street, street);
    }
    street.sections.add(road.section);
    street.counted = street.counted + styles[at + STYLE.winCount];
    street.baseline = street.baseline + styles[at + STYLE.baseCount];
    street.travel = street.travel + styles[at + STYLE.travelTime];
    street.roads = street.roads + 1;
    if (styles[at + STYLE.closed]) {
      street.closed = street.closed + 1;
    } else if (styles[at + STYLE.lanesOpen] < road.lanes) {
      street.narrowed = street.narrowed + 1;
    }
  });

  const rows: StreetRow[] = [];
  totals.forEach(function (street, name) {
    const blocks = Math.max(1, street.sections.size);
    const flow = street.counted / blocks / hours;
    const baseline = street.baseline / blocks;
    rows.push({
      street: name,
      flow: flow,
      baseline: baseline,
      change: flow - baseline,
      travel: street.travel / Math.max(1, street.roads),
      closed: street.closed,
      narrowed: street.narrowed,
    });
  });
  return rows;
}

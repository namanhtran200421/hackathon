"use client";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, Minus } from "lucide-react";
import { Bars, LineChart, type Line } from "./Charts";
import {
  STYLE,
  type BaselineRun,
  type Metrics,
  type Sample,
  type World,
} from "@/lib/types";

const one = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 });
const two = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("en-AU", {
  style: "percent",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    r = s % 60;
  const mm = `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
  return h ? `${h}:${mm}` : mm;
}

export type Snapshot = {
  metrics: Metrics;
  history: Sample[];
  styles: Float32Array;
  world: World;
};

type Row = {
  label: string;
  run: number | null;
  base: number | null;
  format: (v: number) => string;
  /** Whether a higher value is better for the network. Null: neutral. */
  higherIsBetter: boolean | null;
};

function fromMetrics(m: Metrics): Sample {
  return {
    t: m.ticks,
    cars: m.cars,
    waiting: m.waiting,
    completed: m.completed,
    meanTrip: m.completed ? m.meanTrip : null,
    meanDelay: m.completed ? m.meanDelay : null,
    vehicleHours: m.vehicleHours,
    generated: m.generated,
    stranded: m.stranded,
    measured: m.measured,
  };
}

/** A run's figures at simulated time t: its final values, or the last sample before t. */
function valuesAt(history: Sample[], end: Metrics, t: number): Sample {
  if (end.ticks <= t) return fromMetrics(end);
  let best: Sample | null = null;
  for (const s of history) if (s.t <= t && (!best || s.t > best.t)) best = s;
  return best ?? fromMetrics(end);
}

function summaryRows(
  m: Sample,
  b: Sample | null,
  fallback: Metrics["baseline"],
): Row[] {
  const perHour = (completed: number, measured: number) =>
    completed / Math.max(1 / 3600, measured / 3600);
  const pick = <T,>(full: T | undefined, partial: T | undefined) =>
    full !== undefined ? full : (partial ?? null);
  return [
    {
      label: "Trips completed",
      run: m.completed,
      base: pick(b?.completed, fallback?.completed),
      format: (v) => whole.format(v),
      higherIsBetter: true,
    },
    {
      label: "Throughput",
      run: perHour(m.completed, m.measured),
      base: b
        ? perHour(b.completed, b.measured)
        : fallback
          ? perHour(fallback.completed, fallback.measured)
          : null,
      format: (v) => `${whole.format(v)} trips/h`,
      higherIsBetter: true,
    },
    {
      label: "Mean trip time",
      run: m.meanTrip,
      base: b ? b.meanTrip : fallback?.completed ? fallback.meanTrip : null,
      format: (v) => `${two.format(v)} min`,
      higherIsBetter: false,
    },
    {
      label: "Mean delay vs free flow",
      run: m.meanDelay,
      base: b?.meanDelay ?? null,
      format: (v) => `${two.format(v)} min`,
      higherIsBetter: false,
    },
    {
      label: "Vehicle-hours in network",
      run: m.vehicleHours,
      base: b?.vehicleHours ?? null,
      format: (v) => one.format(v),
      higherIsBetter: false,
    },
    {
      label: "Waiting at gates",
      run: m.waiting,
      base: pick(b?.waiting, fallback?.waiting),
      format: (v) => whole.format(v),
      higherIsBetter: false,
    },
    {
      label: "Stranded trips",
      run: m.stranded,
      base: pick(b?.stranded, fallback?.stranded),
      format: (v) => whole.format(v),
      higherIsBetter: false,
    },
    {
      label: "Cars on network",
      run: m.cars,
      base: b?.cars ?? null,
      format: (v) => whole.format(v),
      higherIsBetter: null,
    },
    {
      label: "Vehicles generated",
      run: m.generated,
      base: b?.generated ?? null,
      format: (v) => whole.format(v),
      higherIsBetter: null,
    },
    {
      label: "Measured time",
      run: m.measured,
      base: pick(b?.measured, fallback?.measured),
      format: clock,
      higherIsBetter: null,
    },
  ];
}

type Street = {
  street: string;
  flow: number;
  base: number;
  change: number;
  travel: number;
  closed: number;
  reduced: number;
};

/** Per-street results using the model's street-flow definition: veh/h per block, both directions. */
function streetRows(
  world: World,
  styles: Float32Array,
  measured: number,
): Street[] {
  if (styles.length !== world.roads.length * STYLE.fields) return [];
  const hours = Math.max(1 / 3600, measured / 3600);
  const byStreet = new Map<
    string,
    {
      sections: Set<number>;
      win: number;
      base: number;
      tt: number;
      n: number;
      closed: number;
      reduced: number;
    }
  >();
  for (const r of world.roads) {
    if (!r.carsAllowed || r.kind === "gate" || r.kind === "access") continue;
    const o = r.index * STYLE.fields;
    const e = byStreet.get(r.street) ?? {
      sections: new Set(),
      win: 0,
      base: 0,
      tt: 0,
      n: 0,
      closed: 0,
      reduced: 0,
    };
    e.sections.add(r.section);
    e.win += styles[o + STYLE.winCount];
    e.base += styles[o + STYLE.baseCount];
    e.tt += styles[o + STYLE.travelTime];
    e.n++;
    if (styles[o + STYLE.closed]) e.closed++;
    else if (styles[o + STYLE.lanesOpen] < r.lanes) e.reduced++;
    byStreet.set(r.street, e);
  }
  return [...byStreet.entries()].map(([street, e]) => {
    const blocks = Math.max(1, e.sections.size);
    const flow = e.win / blocks / hours;
    const base = e.base / blocks;
    return {
      street,
      flow,
      base,
      change: flow - base,
      travel: e.tt / Math.max(1, e.n),
      closed: e.closed,
      reduced: e.reduced,
    };
  });
}

function Verdict({
  change,
  higherIsBetter,
}: {
  change: number;
  higherIsBetter: boolean | null;
}) {
  if (higherIsBetter === null || Math.abs(change) < 1e-9)
    return (
      <span className="verdict neutral">
        <Minus size={13} aria-hidden="true" />{" "}
        {Math.abs(change) < 1e-9 ? "Same" : "—"}
      </span>
    );
  const better = change > 0 === higherIsBetter;
  return (
    <span className={`verdict ${better ? "better" : "worse"}`}>
      {change > 0 ? (
        <ArrowUpRight size={13} aria-hidden="true" />
      ) : (
        <ArrowDownRight size={13} aria-hidden="true" />
      )}
      {better ? "Better" : "Worse"}
    </span>
  );
}

export default function Results({
  snapshot,
  baselineRun,
  running,
}: {
  snapshot: Snapshot | null;
  baselineRun: BaselineRun | null;
  running: boolean;
}) {
  const [allStreets, setAllStreets] = useState(false);
  const m = snapshot?.metrics ?? null;
  const hasBaseline = !!m?.hasBaseline;
  // Compare both runs at the same simulated time: the shorter run's end.
  const baseEnd = hasBaseline ? (baselineRun?.metrics ?? null) : null;
  const compareAt =
    m && baseEnd ? Math.min(m.ticks, baseEnd.ticks) : (m?.ticks ?? 0);
  const runAt = m && snapshot ? valuesAt(snapshot.history, m, compareAt) : null;
  const b =
    baseEnd && baselineRun
      ? valuesAt(baselineRun.history, baseEnd, compareAt)
      : null;
  const rows = runAt
    ? summaryRows(runAt, b, hasBaseline && !b ? m!.baseline : null)
    : [];
  const streets = useMemo(
    () =>
      snapshot
        ? streetRows(snapshot.world, snapshot.styles, snapshot.metrics.measured)
        : [],
    [snapshot],
  );
  const ranked = [...streets].sort((x, y) =>
    hasBaseline ? Math.abs(y.change) - Math.abs(x.change) : y.flow - x.flow,
  );
  const shownStreets = allStreets ? ranked : ranked.slice(0, 10);
  const barRows = ranked.slice(0, 10).map((s) => ({
    label: s.street,
    value: hasBaseline ? s.change : s.flow,
    detail: hasBaseline
      ? `${whole.format(s.flow)} veh/h now · ${whole.format(s.base)} in baseline`
      : `${one.format(s.travel)} s mean link travel time`,
  }));
  const toMinutes = (h: Sample[], key: "cars" | "meanTrip") =>
    h.map((p) => ({ x: p.t / 60, y: p[key] }));
  const lines = (key: "cars" | "meanTrip"): Line[] => [
    {
      key: "run",
      label: "This run",
      points: snapshot ? toMinutes(snapshot.history, key) : [],
    },
    ...(hasBaseline && baselineRun
      ? [
          {
            key: "baseline" as const,
            label: "Baseline",
            points: toMinutes(baselineRun.history, key),
          },
        ]
      : []),
  ];

  return (
    <section
      className="results-panel panel"
      id="results"
      aria-labelledby="results-title"
    >
      <div className="results-head">
        <span className="comparison-icon">
          <BarChart3 size={21} />
        </span>
        <div>
          <h2 id="results-title">Run results</h2>
          <p>
            {!m
              ? "Results appear here when you pause or the run ends, once the warm-up is over."
              : `Measured over ${clock(m.measured)} after a ${clock(m.warmUp)} warm-up, at ${clock(m.ticks)} simulated.${running ? " The run continues; results refresh when you pause." : ""}`}
          </p>
        </div>
      </div>
      {m && (
        <div className={running ? "results-body stale" : "results-body"}>
          <h3 className="results-subhead">
            {hasBaseline ? "Baseline vs this run" : "Summary"}
          </h3>
          <div className="table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  {hasBaseline && <th scope="col">Baseline</th>}
                  <th scope="col">This run</th>
                  {hasBaseline && (
                    <>
                      <th scope="col">Change</th>
                      <th scope="col">%</th>
                      <th scope="col">Effect</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const change =
                    r.run !== null && r.base !== null ? r.run - r.base : null;
                  return (
                    <tr key={r.label}>
                      <th scope="row">{r.label}</th>
                      {hasBaseline && (
                        <td>{r.base === null ? "—" : r.format(r.base)}</td>
                      )}
                      <td>{r.run === null ? "—" : r.format(r.run)}</td>
                      {hasBaseline && (
                        <>
                          <td>
                            {change === null
                              ? "—"
                              : `${change > 0 ? "+" : change < 0 ? "−" : ""}${r.format(Math.abs(change))}`}
                          </td>
                          <td>
                            {change === null || r.base === null || r.base <= 0
                              ? "—"
                              : pct.format(change / r.base)}
                          </td>
                          <td>
                            {change === null || r.higherIsBetter === null ? (
                              ""
                            ) : (
                              <Verdict
                                change={change}
                                higherIsBetter={r.higherIsBetter}
                              />
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!hasBaseline && (
            <p className="help results-note">
              Save a baseline with all roads open to compare a closure against
              it.
            </p>
          )}
          {hasBaseline && !baselineRun && (
            <p className="help results-note">
              This baseline was saved before the page loaded its details, so
              some baseline values are unavailable.
            </p>
          )}
          {b && runAt && (
            <p className="help results-note">
              Both runs are compared at {clock(Math.min(runAt.t, b.t))}{" "}
              simulated, the end of the shorter run, so totals are fair. Street
              flows below are hourly rates over each whole run.
            </p>
          )}

          <div className="chart-grid">
            <LineChart
              title="Cars on the network"
              unit="cars"
              lines={lines("cars")}
            />
            <LineChart
              title="Mean trip time so far"
              unit="min"
              lines={lines("meanTrip")}
            />
          </div>

          <h3 className="results-subhead">
            {hasBaseline ? "Streets that changed most" : "Busiest streets"}
          </h3>
          <p className="help">
            Average flow per block in both directions, in vehicles per hour,
            over the measurement window.
          </p>
          {barRows.length > 0 && (
            <Bars
              title={
                hasBaseline
                  ? "Change in flow vs baseline (veh/h)"
                  : "Flow (veh/h)"
              }
              rows={barRows}
              diverging={hasBaseline}
              unit="veh/h"
            />
          )}
          <div className="table-wrap">
            <table className="compare-table streets-table">
              <thead>
                <tr>
                  <th scope="col">Street</th>
                  {hasBaseline && <th scope="col">Baseline veh/h</th>}
                  <th scope="col">Flow veh/h</th>
                  {hasBaseline && <th scope="col">Change</th>}
                  <th scope="col">Link travel time</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {shownStreets.map((s) => (
                  <tr key={s.street}>
                    <th scope="row">{s.street}</th>
                    {hasBaseline && <td>{whole.format(s.base)}</td>}
                    <td>{whole.format(s.flow)}</td>
                    {hasBaseline && (
                      <td>
                        {s.change > 0.5 ? "+" : s.change < -0.5 ? "−" : ""}
                        {whole.format(Math.abs(s.change))}
                        {s.base > 0
                          ? ` (${pct.format(s.change / s.base)})`
                          : ""}
                      </td>
                    )}
                    <td>{one.format(s.travel)} s</td>
                    <td>
                      {s.closed
                        ? `${s.closed} closed`
                        : s.reduced
                          ? `${s.reduced} lane-reduced`
                          : "Open"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ranked.length > 10 && (
            <button
              className="button secondary more-streets"
              onClick={() => setAllStreets((v) => !v)}
            >
              {allStreets
                ? "Show top 10 streets"
                : `Show all ${ranked.length} streets`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * "What happened in your run": the first part of the Results section.
 *
 * Shows, in plain words, what was closed and how the run compared with normal
 * traffic (the baseline): three key numbers, the streets that got busier and
 * two charts over time. Every number, including the table of all streets (the
 * same numbers as the CSV download), is one click away under "See all the
 * numbers". A button hands the run's closure to the works planner below.
 */

import { useMemo, useState } from "react";
import { ArrowDownToLine, BarChart3, CalendarClock } from "lucide-react";
import type { ClosureType } from "@traffic-lab/simulation";
import { clock, oneDp, signed, whole } from "../../lib/format";
import type { Difference } from "../baseline/differences";
import { closureToPlan } from "../planner/request";
import type { WorksClosure } from "../planner/types";
import { closedStreets, describeStreetClosure } from "../settings/closures";
import type { BaselineRecording, ResultsSnapshot, Sample } from "../simulation/types";
import Bars, { type BarRow } from "./charts/Bars";
import LineChart, { type ChartLine } from "./charts/LineChart";
import { compareRun, sameMapAsBaseline, streetRows, type SummaryRow } from "./calculations";
import StreetTable from "./StreetTable";
import SummaryTable from "./SummaryTable";

interface RunResultsProps {
  snapshot: ResultsSnapshot | null;
  baseline: BaselineRecording | null;
  running: boolean;
  differences: Difference[];
  closureType: ClosureType;
  /** Hand the closure to the works planner; null while the planner is hidden. */
  onPlan: ((closure: WorksClosure) => void) | null;
  onDownload: () => void;
}

/** The numbers shown as tiles, by their row in the full table. */
const TILES = ["Average trip time", "Total hours spent driving", "Cars waiting to enter"];

function Tile({ row }: { row: SummaryRow }) {
  let comparison = null;
  if (row.run !== null && row.base !== null) {
    const change = row.run - row.base;
    let text = signed(change, row.format) + " compared with normal traffic";
    // A change too small to show reads better in words than as "−0".
    if (row.format(Math.abs(change)) === row.format(0)) {
      text = "Same as normal traffic";
    }
    comparison = <small>{text}</small>;
  }
  let value = "—";
  if (row.run !== null) {
    value = row.format(row.run);
  }
  return (
    <div>
      <dt>{row.label}</dt>
      <dd>
        <strong>{value}</strong>
        {comparison}
      </dd>
    </div>
  );
}

function chartPoints(history: Sample[], key: "cars" | "meanTrip") {
  return history.map(function (sample) {
    return { x: sample.t / 60, y: sample[key] };
  });
}

export default function RunResults(props: RunResultsProps) {
  return (
    <section className="panel run-results" id="run-results" aria-labelledby="run-results-title">
      <div className="step-head">
        <h3 id="run-results-title">
          <BarChart3 size={20} aria-hidden="true" /> What happened in your run
        </h3>
      </div>
      {!props.snapshot && (
        <p>
          Nothing yet. Close a street on the map, press Start, and pause once the warm-up is over. What
          happened will show here.
        </p>
      )}
      {props.snapshot && <RunBody {...props} snapshot={props.snapshot} />}
    </section>
  );
}

function RunBody(props: RunResultsProps & { snapshot: ResultsSnapshot }) {
  const { snapshot, baseline, running, differences } = props;
  const [showAllStreets, setShowAllStreets] = useState(false);
  const m = snapshot.metrics;
  const streets = useMemo(
    function () {
      return streetRows(snapshot.world, snapshot.styles, snapshot.metrics.measured);
    },
    [snapshot],
  );

  const comparison = compareRun(snapshot, baseline);
  const hasBaseline = comparison.hasBaseline;
  const sameMap = sameMapAsBaseline(snapshot, baseline);
  const compareStreets = hasBaseline && sameMap;

  // What was closed, in words.
  const closed = closedStreets(snapshot.world, snapshot.styles);
  let closedText = "Every road was open.";
  if (closed.length > 0) {
    closedText =
      "Closed: " +
      closed
        .map(function (street) {
          return street.street + " (" + describeStreetClosure(street) + ")";
        })
        .join(", ") +
      ".";
  }
  let timeText = "Counted over " + clock(m.measured) + " after a " + clock(m.warmUp) + " warm-up.";
  if (running) {
    timeText = timeText + " The traffic is still moving; this shows it as it was when you last paused.";
  }

  const tiles = TILES.map(function (label) {
    return comparison.rows.find(function (row) {
      return row.label === label;
    });
  }).filter(function (row): row is SummaryRow {
    return row !== undefined;
  });

  const busier = streets
    .filter(function (street) {
      return street.closed === 0 && street.narrowed === 0 && street.change >= 5;
    })
    .sort(function (a, b) {
      return b.change - a.change;
    })
    .slice(0, 5);

  const closure = closureToPlan(
    snapshot.world,
    snapshot.styles,
    m.selectedStreet,
    m.selectedBlock,
    props.closureType,
  );
  let planLabel = "Find the best time for this closure";
  if (closed.length === 0) {
    planLabel = "Find the best time to close " + closure.street;
  }

  // Everything else, under "See all the numbers".
  const ranked = streets.slice().sort(function (a, b) {
    if (compareStreets) {
      return Math.abs(b.change) - Math.abs(a.change);
    }
    return b.flow - a.flow;
  });
  let shownStreets = ranked.slice(0, 10);
  if (showAllStreets) {
    shownStreets = ranked;
  }
  const barRows: BarRow[] = ranked.slice(0, 10).map(function (street) {
    if (compareStreets) {
      return {
        label: street.street,
        value: street.change,
        detail: whole(street.flow) + " cars/hour now · " + whole(street.baseline) + " in normal traffic",
      };
    }
    return {
      label: street.street,
      value: street.flow,
      detail: oneDp(street.travel) + " seconds to drive one block",
    };
  });

  function chartLines(key: "cars" | "meanTrip"): ChartLine[] {
    const lines: ChartLine[] = [
      { key: "run", label: "Your run", points: chartPoints(snapshot.history, key) },
    ];
    if (hasBaseline && baseline) {
      lines.push({ key: "baseline", label: "Normal traffic", points: chartPoints(baseline.history, key) });
    }
    return lines;
  }

  let bodyClass = "results-body";
  if (running) {
    bodyClass = "results-body stale";
  }
  let summaryTitle = "Your run";
  if (hasBaseline) {
    summaryTitle = "Normal traffic (baseline) compared with your run";
  }
  let streetsTitle = "Busiest streets";
  let barsTitle = "Traffic (cars per hour)";
  if (compareStreets) {
    streetsTitle = "Streets that changed most";
    barsTitle = "Change in traffic compared with normal traffic (cars per hour)";
  }
  let moreStreetsLabel = "Show all " + ranked.length + " streets";
  if (showAllStreets) {
    moreStreetsLabel = "Show the top 10 streets";
  }
  const differenceText = differences
    .map(function (difference) {
      return difference.label + " " + difference.from + " → " + difference.to;
    })
    .join("; ");

  return (
    <div className={bodyClass}>
      <p className="run-closed">{closedText}</p>
      <p className="help">{timeText}</p>

      <dl className="figure-tiles">
        {tiles.map(function (row) {
          return <Tile key={row.label} row={row} />;
        })}
      </dl>

      {!hasBaseline && (
        <p className="help results-note">
          Save a baseline (normal traffic with every road open) to see how much worse the closure made things.
        </p>
      )}
      {differences.length > 0 && (
        <p className="help results-note">
          <strong>Settings differ from the baseline:</strong> {differenceText}. These changes affect the
          results as well as any closures.
        </p>
      )}
      {hasBaseline && !sameMap && (
        <p className="help results-note">
          The baseline was recorded on a different road map, so streets are shown without a comparison.
        </p>
      )}
      {compareStreets && busier.length > 0 && (
        <p className="run-busier">
          <strong>Streets that got busier:</strong>{" "}
          {busier
            .map(function (street) {
              return street.street + " (+" + whole(street.change) + " cars an hour)";
            })
            .join(", ")}
          .
        </p>
      )}

      <div className="chart-grid">
        <LineChart title="Cars on the road" unit="cars" lines={chartLines("cars")} />
        <LineChart title="Average trip time so far" unit="min" lines={chartLines("meanTrip")} />
      </div>

      <div className="recommendation-actions">
        {props.onPlan && (
          <button
            className="button primary"
            onClick={function () {
              if (props.onPlan) {
                props.onPlan(closure);
              }
            }}
          >
            <CalendarClock size={16} /> {planLabel}
          </button>
        )}
        <button className="button secondary" onClick={props.onDownload}>
          <ArrowDownToLine size={16} /> Download CSV
        </button>
      </div>
      {props.onPlan && (
        <p className="help">
          Your run is one traffic level at one moment. It shows where the traffic goes, but not the best time
          to close the road: the planner below works that out.
        </p>
      )}

      <details className="all-numbers">
        <summary>See all the numbers</summary>
        <h4 className="results-subhead">{summaryTitle}</h4>
        <SummaryTable rows={comparison.rows} withBaseline={hasBaseline} />
        {hasBaseline && !baseline && (
          <p className="help results-note">
            This baseline was saved before its details were kept, so some of its numbers are missing.
          </p>
        )}
        {comparison.baseFigures && (
          <p className="help results-note">
            Both runs are compared at {clock(Math.min(comparison.runFigures.t, comparison.baseFigures.t))} of
            traffic, the end of the shorter run, so the totals are fair.
          </p>
        )}

        <h4 className="results-subhead">{streetsTitle}</h4>
        <p className="help">Cars per hour on a typical block of each street, both directions together.</p>
        {barRows.length > 0 && (
          <Bars title={barsTitle} rows={barRows} diverging={compareStreets} unit="cars/hour" />
        )}
        <StreetTable streets={shownStreets} compare={compareStreets} />
        {ranked.length > 10 && (
          <button
            className="button secondary more-streets"
            onClick={function () {
              setShowAllStreets(!showAllStreets);
            }}
          >
            {moreStreetsLabel}
          </button>
        )}
      </details>
    </div>
  );
}

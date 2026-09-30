/**
 * "Run results": appears when the traffic is paused or has finished.
 *
 * Shows a summary table (compared with the baseline when there is one), two
 * charts over time, the streets that changed most, and a table of every street.
 */

import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { clock, oneDp, whole } from "../../lib/format";
import type { Difference } from "../baseline/differences";
import type { BaselineRecording, ResultsSnapshot, Sample } from "../simulation/types";
import Bars, { type BarRow } from "./charts/Bars";
import LineChart, { type ChartLine } from "./charts/LineChart";
import { compareRun, sameMapAsBaseline, streetRows, type StreetRow } from "./calculations";
import StreetTable from "./StreetTable";
import SummaryTable from "./SummaryTable";

interface ResultsProps {
  snapshot: ResultsSnapshot | null;
  baseline: BaselineRecording | null;
  running: boolean;
  differences: Difference[];
}

export default function Results({ snapshot, baseline, running, differences }: ResultsProps) {
  const streets = useMemo(
    function () {
      if (!snapshot) {
        return [];
      }
      return streetRows(snapshot.world, snapshot.styles, snapshot.metrics.measured);
    },
    [snapshot],
  );

  let intro =
    "Results from the Simulator page appear here when you pause or the run ends, once the warm-up time has passed.";
  if (snapshot) {
    const m = snapshot.metrics;
    intro =
      "Counted over " +
      clock(m.measured) +
      " after a " +
      clock(m.warmUp) +
      " warm-up, at " +
      clock(m.ticks) +
      " of traffic.";
    if (running) {
      intro = intro + " The traffic is still moving; results update when you pause.";
    }
  }

  return (
    <section className="results-panel panel" id="report-results" aria-labelledby="results-title">
      <div className="results-head">
        <span className="comparison-icon">
          <BarChart3 size={21} />
        </span>
        <div>
          <h2 id="results-title">Run results</h2>
          <p>{intro}</p>
        </div>
      </div>
      {snapshot && (
        <ResultsBody
          snapshot={snapshot}
          baseline={baseline}
          running={running}
          differences={differences}
          streets={streets}
        />
      )}
    </section>
  );
}

interface ResultsBodyProps {
  snapshot: ResultsSnapshot;
  baseline: BaselineRecording | null;
  running: boolean;
  differences: Difference[];
  streets: StreetRow[];
}

function chartPoints(history: Sample[], key: "cars" | "meanTrip") {
  return history.map(function (sample) {
    return { x: sample.t / 60, y: sample[key] };
  });
}

function ResultsBody({ snapshot, baseline, running, differences, streets }: ResultsBodyProps) {
  const [showAllStreets, setShowAllStreets] = useState(false);
  const comparison = compareRun(snapshot, baseline);
  const hasBaseline = comparison.hasBaseline;
  const runFigures = comparison.runFigures;
  const baseFigures = comparison.baseFigures;
  const rows = comparison.rows;
  const sameMap = sameMapAsBaseline(snapshot, baseline);
  const compareStreets = hasBaseline && sameMap;

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
        detail: whole(street.flow) + " cars/hour now · " + whole(street.baseline) + " in the baseline",
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
      { key: "run", label: "This run", points: chartPoints(snapshot.history, key) },
    ];
    if (hasBaseline && baseline) {
      lines.push({ key: "baseline", label: "Baseline", points: chartPoints(baseline.history, key) });
    }
    return lines;
  }

  let bodyClass = "results-body";
  if (running) {
    bodyClass = "results-body stale";
  }
  let summaryTitle = "Summary";
  if (hasBaseline) {
    summaryTitle = "Baseline compared with this run";
  }
  let streetsTitle = "Busiest streets";
  let barsTitle = "Traffic (cars per hour)";
  if (compareStreets) {
    streetsTitle = "Streets that changed most";
    barsTitle = "Change in traffic compared with the baseline (cars per hour)";
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
      <h3 className="results-subhead">{summaryTitle}</h3>
      <SummaryTable rows={rows} withBaseline={hasBaseline} />

      {!hasBaseline && (
        <p className="help results-note">
          Save a baseline with every road open to compare a closure against it.
        </p>
      )}
      {hasBaseline && !baseline && (
        <p className="help results-note">
          This baseline was saved before its details were kept, so some of its numbers are missing.
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
      {baseFigures && (
        <p className="help results-note">
          Both runs are compared at {clock(Math.min(runFigures.t, baseFigures.t))} of traffic, the end of the
          shorter run, so the totals are fair. Street traffic below is an hourly rate over each whole run.
        </p>
      )}

      <div className="chart-grid">
        <LineChart title="Cars on the road" unit="cars" lines={chartLines("cars")} />
        <LineChart title="Average trip time so far" unit="min" lines={chartLines("meanTrip")} />
      </div>

      <h3 className="results-subhead">{streetsTitle}</h3>
      <p className="help">
        Average number of cars per hour through one block of the street, both directions together.
      </p>
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
    </div>
  );
}

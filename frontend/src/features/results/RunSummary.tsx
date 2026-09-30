/**
 * "What you saw in the simulator": the top of the Report page. It sums up the
 * latest simulator run (what was closed, how it compared with the baseline,
 * and the streets that changed most, the same numbers as the CSV download)
 * and hands its closure to the works planner below.
 */

import { ArrowDownToLine, ArrowRight, CalendarClock, Eye } from "lucide-react";
import type { ClosureType } from "@traffic-lab/simulation";
import { signed, whole } from "../../lib/format";
import { closureToPlan } from "../planner/request";
import type { WorksClosure } from "../planner/types";
import { closedStreets, describeStreetClosure } from "../settings/closures";
import type { BaselineRecording, ResultsSnapshot } from "../simulation/types";
import { compareRun, sameMapAsBaseline, streetRows, type SummaryRow } from "./calculations";

interface RunSummaryProps {
  snapshot: ResultsSnapshot | null;
  baseline: BaselineRecording | null;
  running: boolean;
  closureType: ClosureType;
  onPlan: (closure: WorksClosure) => void;
  onDownload: () => void;
}

/** The figures shown as tiles, by their row in the results table. */
const TILES = ["Average trip time", "Total hours spent driving", "Cars waiting to enter"];

function Tile({ row }: { row: SummaryRow }) {
  let comparison = null;
  if (row.run !== null && row.base !== null) {
    const change = row.run - row.base;
    let text = signed(change, row.format) + " compared with the baseline";
    // A change too small to show reads better in words than as "−0".
    if (row.format(Math.abs(change)) === row.format(0)) {
      text = "Same as the baseline";
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

export default function RunSummary(props: RunSummaryProps) {
  const snapshot = props.snapshot;

  if (!snapshot) {
    return (
      <section className="panel run-summary" aria-labelledby="run-summary-title">
        <div className="step-head">
          <h2 id="run-summary-title">
            <Eye size={20} aria-hidden="true" /> What you saw in the simulator
          </h2>
        </div>
        <p>
          Nothing yet. On the Simulator page, close a street, press Start and pause after the warm-up. What
          happened (the delay and the streets that got busier) will show here, and you can plan the best time
          for that closure.
        </p>
        <a className="button secondary run-summary-link" href="#workbench">
          Open the simulator <ArrowRight size={16} />
        </a>
      </section>
    );
  }

  const m = snapshot.metrics;
  const comparison = compareRun(snapshot, props.baseline);
  const withBaseline = comparison.hasBaseline && (comparison.baseFigures !== null || m.baseline !== null);
  const tiles = TILES.map(function (label) {
    return comparison.rows.find(function (row) {
      return row.label === label;
    });
  }).filter(function (row): row is SummaryRow {
    return row !== undefined;
  });

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

  const compareStreets = comparison.hasBaseline && sameMapAsBaseline(snapshot, props.baseline);
  const busier = streetRows(snapshot.world, snapshot.styles, m.measured)
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

  return (
    <section className="panel run-summary" aria-labelledby="run-summary-title">
      <div className="step-head">
        <h2 id="run-summary-title">
          <Eye size={20} aria-hidden="true" /> What you saw in the simulator
        </h2>
      </div>
      <p className="run-summary-closed">{closedText}</p>
      {props.running && (
        <p className="help">The simulation is still running; this shows it as it was when you last paused.</p>
      )}

      <dl className="recommendation-figures run-summary-figures">
        {tiles.map(function (row) {
          return <Tile key={row.label} row={row} />;
        })}
      </dl>
      {!withBaseline && (
        <p className="help">
          Save a baseline on the Simulator page to see how much worse the closure made things.
        </p>
      )}

      {compareStreets && busier.length > 0 && (
        <p className="run-summary-streets">
          <strong>Streets that got busier:</strong>{" "}
          {busier
            .map(function (street) {
              return street.street + " (+" + whole(street.change) + " cars/hour)";
            })
            .join(", ")}
          .
        </p>
      )}
      <p className="help">
        Your run is one traffic level and one traffic pattern, so it shows where the traffic goes, not the
        best time to close the road. The planner below tests every time of day, many times over.
      </p>

      <div className="recommendation-actions">
        <button
          className="button primary"
          onClick={function () {
            props.onPlan(closure);
          }}
        >
          <CalendarClock size={16} /> {planLabel}
        </button>
        <a className="button secondary" href="#report-results">
          Full tables and charts
        </a>
        <button className="button secondary" onClick={props.onDownload}>
          <ArrowDownToLine size={16} /> Download CSV
        </button>
      </div>
    </section>
  );
}

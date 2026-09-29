/**
 * "Compare with normal traffic": save, replace or clear the baseline, list any
 * settings that changed since it was saved, and download the road numbers.
 */

import { ArrowDownToLine, Route } from "lucide-react";
import type { TrafficSimulation } from "../simulation/useTrafficSim";
import { describeBaseline, type Difference } from "./differences";

interface ComparePanelProps {
  sim: TrafficSimulation;
  differences: Difference[];
  onDownload: () => void;
}

export default function ComparePanel({ sim, differences, onDownload }: ComparePanelProps) {
  const ready = sim.phase === "ready";
  let hasBaseline = false;
  if (sim.metrics) {
    hasBaseline = sim.metrics.hasBaseline;
  }

  let explanation =
    "A baseline is a recording of normal traffic with every road open. Let the traffic run past the warm-up plus one minute, then save it. You only need to do this once.";
  let saveLabel = "Save baseline";
  if (hasBaseline) {
    explanation =
      "Every later run is compared with your baseline until you replace or clear it. To test a closure, press Restart, close a street, then Start.";
    saveLabel = "Replace baseline";
  }

  let differenceWord = "settings differ";
  if (differences.length === 1) {
    differenceWord = "setting differs";
  }

  return (
    <div className="comparison panel" id="compare">
      <div className="comparison-head">
        <div className="comparison-title">
          <span className="comparison-icon">
            <Route size={21} />
          </span>
          <div>
            <h2>Compare with normal traffic</h2>
            <p>{explanation}</p>
            {hasBaseline && sim.baseline && (
              <p className="baseline-meta">Baseline: {describeBaseline(sim.baseline)}</p>
            )}
          </div>
        </div>
        <div className="comparison-actions">
          <button
            className="button secondary"
            disabled={!ready}
            onClick={function () {
              sim.command("save-baseline");
            }}
          >
            {saveLabel}
          </button>
          {hasBaseline && (
            <button
              className="button secondary"
              disabled={!ready}
              onClick={function () {
                sim.clearBaseline();
                sim.setStatus("Baseline cleared.");
              }}
            >
              Clear baseline
            </button>
          )}
          <button className="button secondary" disabled={!ready} onClick={onDownload}>
            <ArrowDownToLine size={16} /> Download CSV
          </button>
        </div>
      </div>

      {hasBaseline && differences.length > 0 && (
        <div className="baseline-diff" role="note">
          <strong>
            {differences.length} {differenceWord} from the baseline.
          </strong>{" "}
          The results reflect these changes as well as any closures.
          <ul>
            {differences.map(function (difference) {
              return (
                <li key={difference.label}>
                  {difference.label}: {difference.from} → {difference.to}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {hasBaseline && (
        <p className="help results-link">
          <a href="#results">See the full comparison under Run results.</a>
        </p>
      )}
    </div>
  );
}

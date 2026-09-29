/**
 * The status message under the log, and any error with a way to recover.
 */

import type { TrafficSimulation } from "../features/simulation/useTrafficSim";

export default function StatusLine({ sim }: { sim: TrafficSimulation }) {
  let dotClass = "status-dot";
  if (sim.running) {
    dotClass = "status-dot running";
  }
  return (
    <div className="feedback">
      <p role="status" aria-live="polite">
        <span className={dotClass} />
        {sim.status}
      </p>
      {sim.error && (
        <div role="alert" className="error">
          {sim.error}
          {sim.phase === "error" && (
            <button className="button secondary" onClick={sim.reload}>
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

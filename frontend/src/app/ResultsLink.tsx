/**
 * A short pointer from the Simulator page to the full results and the works
 * planner on the Report page.
 */

import { ArrowRight, BarChart3 } from "lucide-react";
import type { ResultsSnapshot } from "../features/simulation/types";

export default function ResultsLink({
  snapshot,
  running,
}: {
  snapshot: ResultsSnapshot | null;
  running: boolean;
}) {
  let text =
    "Tables and charts for this run appear on the Report page when you pause or the run ends, after the warm-up.";
  if (snapshot) {
    text = "Tables and charts for this run are ready on the Report page.";
    if (running) {
      text = "The Report page shows this run as it was when you last paused.";
    }
  }
  return (
    <section className="panel results-teaser" aria-labelledby="results-teaser-title">
      <span className="comparison-icon">
        <BarChart3 size={21} />
      </span>
      <div>
        <h2 id="results-teaser-title">Results and works planner</h2>
        <p>{text} The Report page also finds the least disruptive time to close a street.</p>
      </div>
      <a className="button dark" href="#report">
        Open the report <ArrowRight size={16} />
      </a>
    </section>
  );
}

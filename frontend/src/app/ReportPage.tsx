/**
 * The Report page: the works planner, then the full results of the latest
 * simulator run.
 */

import type { Difference } from "../features/baseline/differences";
import PlannerPanel from "../features/planner/PlannerPanel";
import type { Plan, WorksRequest } from "../features/planner/types";
import type { Planner } from "../features/planner/usePlanner";
import Results from "../features/results/Results";
import type { ResultsSnapshot, Selection } from "../features/simulation/types";
import type { TrafficSimulation } from "../features/simulation/useTrafficSim";

interface ReportPageProps {
  sim: TrafficSimulation;
  planner: Planner;
  selection: Selection;
  snapshot: ResultsSnapshot | null;
  differences: Difference[];
  onTryInSimulator: (plan: Plan, request: WorksRequest) => void;
}

export default function ReportPage(props: ReportPageProps) {
  const sim = props.sim;
  return (
    <main id="report" className="container report-page">
      <div className="page-intro">
        <h1 data-page-heading tabIndex={-1}>
          Plan road works with the least disruption
        </h1>
        <p>
          Tell us about the works and the planner tests them at every time of day, many times over, to find
          when and how to close the road. Below that are the full results of your latest simulator run.
        </p>
      </div>

      <PlannerPanel
        planner={props.planner}
        world={sim.world}
        settings={sim.settings}
        selection={props.selection}
        onTryInSimulator={props.onTryInSimulator}
      />

      <Results
        snapshot={props.snapshot}
        baseline={sim.baseline}
        running={sim.running}
        differences={props.differences}
      />
    </main>
  );
}

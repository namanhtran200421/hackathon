/**
 * The Report page, in the order people use it: what the simulator run showed,
 * the works planner for that closure, then the run's full results.
 */

import type { Difference } from "../features/baseline/differences";
import PlannerPanel from "../features/planner/PlannerPanel";
import { closureToPlan } from "../features/planner/request";
import type { Plan, WorksClosure, WorksRequest } from "../features/planner/types";
import type { Planner } from "../features/planner/usePlanner";
import Results from "../features/results/Results";
import RunSummary from "../features/results/RunSummary";
import type { ResultsSnapshot, Selection } from "../features/simulation/types";
import type { TrafficSimulation } from "../features/simulation/useTrafficSim";

interface ReportPageProps {
  sim: TrafficSimulation;
  planner: Planner;
  selection: Selection;
  snapshot: ResultsSnapshot | null;
  differences: Difference[];
  onTryInSimulator: (plan: Plan, request: WorksRequest) => void;
  onPlanClosure: (closure: WorksClosure) => void;
  onDownload: () => void;
}

export default function ReportPage(props: ReportPageProps) {
  const sim = props.sim;
  const startingClosure = closureToPlan(
    sim.world,
    sim.store.current.styles,
    props.selection.street,
    props.selection.section,
    sim.settings["closure-type"],
  );
  return (
    <main id="report" className="container report-page">
      <div className="page-intro">
        <h1 data-page-heading tabIndex={-1}>
          Plan road works with the least disruption
        </h1>
        <p>
          Start with what you saw in the simulator, then let the planner test the same closure at every time
          of day, many times over, to find when to close the road and where the traffic will go. The full
          results of your latest run are at the bottom.
        </p>
      </div>

      <RunSummary
        snapshot={props.snapshot}
        baseline={sim.baseline}
        running={sim.running}
        closureType={sim.settings["closure-type"]}
        onPlan={props.onPlanClosure}
        onDownload={props.onDownload}
      />

      <PlannerPanel
        planner={props.planner}
        world={sim.world}
        settings={sim.settings}
        startingClosure={startingClosure}
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

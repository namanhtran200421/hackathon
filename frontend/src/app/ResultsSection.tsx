/**
 * Results, below the simulator, in the order people use them:
 *
 *   1. What happened in your run: the closure you tried, compared with
 *      normal traffic, with every number one click away.
 *   2. Best time to do the works: the planner tests the same closure at every
 *      time of day and says when to close the road and where traffic will go.
 *      Hidden for now: see features.ts.
 */

import type { Difference } from "../features/baseline/differences";
import { FEATURES } from "./features";
import PlannerPanel from "../features/planner/PlannerPanel";
import { closureToPlan } from "../features/planner/request";
import type { Plan, WorksClosure, WorksRequest } from "../features/planner/types";
import type { Planner } from "../features/planner/usePlanner";
import RunResults from "../features/results/RunResults";
import type { ResultsSnapshot, Selection } from "../features/simulation/types";
import type { TrafficSimulation } from "../features/simulation/useTrafficSim";

interface ResultsSectionProps {
  sim: TrafficSimulation;
  planner: Planner;
  selection: Selection;
  snapshot: ResultsSnapshot | null;
  differences: Difference[];
  onTryInSimulator: (plan: Plan, request: WorksRequest) => void;
  onPlanClosure: (closure: WorksClosure) => void;
  onDownload: () => void;
}

export default function ResultsSection(props: ResultsSectionProps) {
  const sim = props.sim;
  const startingClosure = closureToPlan(
    sim.world,
    sim.store.current.styles,
    props.selection.street,
    props.selection.section,
    sim.settings["closure-type"],
  );
  let planButton: ((closure: WorksClosure) => void) | null = null;
  if (FEATURES.worksPlanner) {
    planButton = props.onPlanClosure;
  }
  return (
    <section id="results" className="container results-section" aria-labelledby="results-title">
      <div className="section-intro">
        <h2 id="results-title">Results</h2>
        {FEATURES.worksPlanner && <p>What your run showed, and the best time to do the works.</p>}
        {!FEATURES.worksPlanner && <p>What your run showed, compared with normal traffic.</p>}
      </div>

      <RunResults
        snapshot={props.snapshot}
        baseline={sim.baseline}
        running={sim.running}
        differences={props.differences}
        closureType={sim.settings["closure-type"]}
        onPlan={planButton}
        onDownload={props.onDownload}
      />

      {FEATURES.worksPlanner && (
        <>
          <div className="section-intro plan-intro" id="plan">
            <h2>Best time to do the works</h2>
            <p>
              Tell us about the works. We test the closure at every time of day, many times over, then tell
              you when to close the road and where the traffic will go.
            </p>
          </div>
          <PlannerPanel
            planner={props.planner}
            world={sim.world}
            settings={sim.settings}
            startingClosure={startingClosure}
            onTryInSimulator={props.onTryInSimulator}
          />
        </>
      )}
    </section>
  );
}

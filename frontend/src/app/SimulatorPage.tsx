/**
 * The Simulator page: settings, the live map, the figures, the baseline
 * controls, the model's log and a pointer to the full results.
 */

import ComparePanel from "../features/baseline/ComparePanel";
import type { Difference } from "../features/baseline/differences";
import Figures from "../features/figures/Figures";
import SimulationLog from "../features/log/SimulationLog";
import MapPanel from "../features/map/MapPanel";
import SettingsPanel from "../features/settings/SettingsPanel";
import type { ResultsSnapshot, Selection } from "../features/simulation/types";
import type { TrafficSimulation } from "../features/simulation/useTrafficSim";
import ResultsLink from "./ResultsLink";
import StatusLine from "./StatusLine";

interface SimulatorPageProps {
  sim: TrafficSimulation;
  selection: Selection;
  onChoose: (street: string, section: number) => void;
  clickMode: boolean;
  onSetClickMode: (on: boolean) => void;
  differences: Difference[];
  snapshot: ResultsSnapshot | null;
  onDownload: () => void;
  /** Open the works planner with the closure on the map. */
  onPlanClosure: () => void;
}

export default function SimulatorPage(props: SimulatorPageProps) {
  const sim = props.sim;
  return (
    <main id="workbench" className="container">
      <div className="workbench">
        <SettingsPanel
          sim={sim}
          selection={props.selection}
          onChoose={props.onChoose}
          clickMode={props.clickMode}
          onToggleClickMode={function () {
            props.onSetClickMode(!props.clickMode);
          }}
          onPlanClosure={props.onPlanClosure}
        />

        <section className="results" aria-label="Simulator">
          <MapPanel
            sim={sim}
            selection={props.selection}
            onChoose={props.onChoose}
            clickMode={props.clickMode}
            onStopClickMode={function () {
              props.onSetClickMode(false);
            }}
          />
          <Figures metrics={sim.metrics} />
          <ComparePanel sim={sim} differences={props.differences} onDownload={props.onDownload} />
          <SimulationLog lines={sim.log} />
          <StatusLine sim={sim} />
          <ResultsLink snapshot={props.snapshot} running={sim.running} onPlanClosure={props.onPlanClosure} />
        </section>
      </div>
    </main>
  );
}

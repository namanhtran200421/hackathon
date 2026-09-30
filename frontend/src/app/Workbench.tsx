/**
 * The simulator: settings on the left; the live map, the figures, the
 * baseline controls, the model's log and the status line on the right.
 */

import ComparePanel from "../features/baseline/ComparePanel";
import type { Difference } from "../features/baseline/differences";
import Figures from "../features/figures/Figures";
import SimulationLog from "../features/log/SimulationLog";
import MapPanel from "../features/map/MapPanel";
import SettingsPanel from "../features/settings/SettingsPanel";
import type { Selection } from "../features/simulation/types";
import type { TrafficSimulation } from "../features/simulation/useTrafficSim";
import StatusLine from "./StatusLine";

interface WorkbenchProps {
  sim: TrafficSimulation;
  selection: Selection;
  onChoose: (street: string, section: number) => void;
  clickMode: boolean;
  onSetClickMode: (on: boolean) => void;
  differences: Difference[];
  /** Hand the closure on the map to the works planner in Results. */
  onPlanClosure: (() => void) | null;
}

export default function Workbench(props: WorkbenchProps) {
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
          <ComparePanel sim={sim} differences={props.differences} />
          <SimulationLog lines={sim.log} />
          <StatusLine sim={sim} />
        </section>
      </div>
    </main>
  );
}

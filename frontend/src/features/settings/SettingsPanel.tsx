/**
 * The settings panel: the scenario, road closures, and the less common
 * settings (traffic lights, route choice and counting) in fold-out groups.
 */

import { SlidersHorizontal } from "lucide-react";
import type { NumberSettingName, SwitchSettingName } from "@traffic-lab/simulation";
import { Choice, Slider, Toggle } from "../../components/form";
import type { Selection } from "../simulation/types";
import type { TrafficSimulation } from "../simulation/useTrafficSim";
import ClosureControls from "./ClosureControls";
import { choiceOptions } from "./labels";

interface SettingsPanelProps {
  sim: TrafficSimulation;
  selection: Selection;
  onChoose: (street: string, section: number) => void;
  clickMode: boolean;
  onToggleClickMode: () => void;
  onPlanClosure: () => void;
}

export default function SettingsPanel(props: SettingsPanelProps) {
  const sim = props.sim;
  const settings = sim.settings;

  /** A slider bound to one setting. */
  function slider(name: NumberSettingName, needsRestart?: boolean) {
    return (
      <Slider
        name={name}
        value={settings[name]}
        needsRestart={needsRestart}
        onChange={function (value) {
          sim.set(name, value);
        }}
      />
    );
  }

  function setSwitch(name: SwitchSettingName) {
    return function (value: boolean) {
      sim.set(name, value);
    };
  }

  let networkHelp: string | undefined;
  if (sim.world && settings["network-source"] !== sim.world.network) {
    networkHelp = "Press Restart to load this map.";
  }

  let countingDisplay: string | undefined;
  let countingHelp: string | undefined;
  if (sim.keepRunning) {
    countingDisplay = "No time limit";
    countingHelp = "Keep running is on, so counting carries on until you pause.";
  }

  return (
    <aside className="controls panel" aria-label="Simulation settings">
      <div className="panel-heading">
        <h2>Settings</h2>
        <SlidersHorizontal size={19} />
      </div>

      <section className="group" aria-labelledby="group-scenario">
        <h3 id="group-scenario" className="group-title">
          Scenario
        </h3>
        <Choice
          id="network"
          label="Road map"
          value={settings["network-source"]}
          options={choiceOptions("network-source")}
          onChange={function (value) {
            sim.set("network-source", value);
          }}
          needsRestart
          help={networkHelp}
        />
        {slider("demand-veh-per-hour")}
        {slider("through-traffic-%")}
        {slider("informed-drivers-%")}
        <Slider
          name="seed"
          value={settings.seed}
          onChange={function (value) {
            sim.set("seed", value);
          }}
          needsRestart
          disabled={!settings["fixed-seed?"]}
        />
        <Toggle
          id="fixed-seed"
          label="Repeat the same traffic pattern"
          checked={settings["fixed-seed?"]}
          onChange={setSwitch("fixed-seed?")}
          needsRestart
          help="On: the same number gives exactly the same traffic every time. Off: a new random pattern at each Restart."
        />
      </section>

      <section className="group" aria-label="Public traffic data">
        <h3 className="group-title">Public traffic data</h3>
        <Choice
          id="demand-profile"
          label="Traffic demand profile"
          value={settings["demand-profile"]}
          options={choiceOptions("demand-profile")}
          onChange={function (value) {
            sim.set("demand-profile", value);
          }}
          needsRestart
        />
        {slider("profile-start-hour", true)}
        <Toggle
          id="observed-signals"
          label="Use matched DTP signal locations"
          checked={settings["use-observed-signals?"]}
          onChange={setSwitch("use-observed-signals?")}
          needsRestart
        />
        {sim.metrics && (
          <p className="help" aria-label="Active demand rate">
            Active arrival rate: {Math.round(sim.metrics.effectiveArrivalsPerHour).toLocaleString("en-AU")}{" "}
            cars/hour · {sim.metrics.observedSignalCount} matched signals applied.
          </p>
        )}
        <p className="help">
          SCATS profiles use August 2026 detector observations. In observed mode, Cars arriving per hour is
          the assumed peak arrival rate, scaled by the selected time of day. It is not a measured CBD entry
          count.
        </p>
        <p className="help">
          1,293 detectors at 138 sites inform the profiles. Up to 80 matched signal locations supplement
          inferred signals on the real map. Signal timings, trip destinations and route choices remain
          synthetic.
        </p>
        <p className="help">
          <a
            href="https://opendata.transport.vic.gov.au/dataset/traffic-signal-volume-data"
            target="_blank"
            rel="noreferrer"
          >
            DTP traffic volumes
          </a>{" "}
          ·{" "}
          <a href="/sim/observed-data.json" target="_blank" rel="noreferrer">
            Data provenance and profiles
          </a>
        </p>
      </section>

      <ClosureControls
        sim={sim}
        selection={props.selection}
        onChoose={props.onChoose}
        clickMode={props.clickMode}
        onToggleClickMode={props.onToggleClickMode}
        onPlanClosure={props.onPlanClosure}
      />

      <details className="group advanced">
        <summary>Traffic lights &amp; speed</summary>
        {slider("speed-limit-kmh", true)}
        {slider("cycle-length", true)}
        {slider("ew-green-share", true)}
        <Choice
          id="signal-coordination"
          label="Traffic light timing"
          value={settings["signal-coordination"]}
          options={choiceOptions("signal-coordination")}
          onChange={function (value) {
            sim.set("signal-coordination", value);
          }}
          needsRestart
          help="A green wave times the lights so east–west traffic keeps getting greens."
        />
        <Toggle
          id="hook-turns"
          label="Hook turns"
          checked={settings["hook-turns?"]}
          onChange={setSwitch("hook-turns?")}
          help="Melbourne-style right turns from the left lane. Only on the simple grid, and only an approximation."
        />
      </details>

      <details className="group advanced">
        <summary>Route choice</summary>
        {slider("reroute-interval")}
        {slider("route-noise")}
      </details>

      <details className="group advanced">
        <summary>Counting</summary>
        {slider("warm-up-s")}
        <Slider
          name="measure-s"
          value={settings["measure-s"]}
          onChange={function (value) {
            sim.set("measure-s", value);
          }}
          disabled={sim.keepRunning}
          display={countingDisplay}
          help={countingHelp}
        />
      </details>
    </aside>
  );
}

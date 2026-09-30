/**
 * The settings panel: the day and time of the real traffic, the scenario,
 * road closures, what the traffic data is and how well the model matches it,
 * and the less common settings (traffic lights, route choice and counting) in
 * fold-out groups.
 */

import { SlidersHorizontal } from "lucide-react";
import type { NumberSettingName, SwitchSettingName } from "@traffic-lab/simulation";
import { Choice, Slider, Toggle } from "../../components/form";
import type { Selection } from "../simulation/types";
import type { TrafficSimulation } from "../simulation/useTrafficSim";
import ClosureControls from "./ClosureControls";
import { choiceOptions } from "./labels";
import TrafficData from "./TrafficData";

interface SettingsPanelProps {
  sim: TrafficSimulation;
  selection: Selection;
  onChoose: (street: string, section: number) => void;
  clickMode: boolean;
  onToggleClickMode: () => void;
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

  let countingDisplay: string | undefined;
  let countingHelp: string | undefined;
  if (sim.keepRunning) {
    countingDisplay = "No time limit";
    countingHelp = "Keep running is on, so counting carries on until you pause.";
  }

  let greenShareHelp: string | undefined;
  if (settings["adaptive-signals?"]) {
    greenShareHelp = "Not used while traffic lights share green time by demand.";
  }

  return (
    <aside className="controls panel" aria-label="Simulation settings">
      <div className="panel-heading">
        <h2>Settings</h2>
        <SlidersHorizontal size={19} />
      </div>

      <section className="group" aria-labelledby="group-when">
        <h3 id="group-when" className="group-title">
          Day and time
        </h3>
        <Choice
          id="day-type"
          label="Day"
          value={settings["day-type"]}
          options={choiceOptions("day-type")}
          onChange={function (value) {
            sim.set("day-type", value);
          }}
          needsRestart
        />
        <Choice
          id="start-time"
          label="Start time"
          value={settings["start-time"]}
          options={choiceOptions("start-time")}
          onChange={function (value) {
            sim.set("start-time", value);
          }}
          needsRestart
          help="Counting starts at this time. The traffic follows the real counts as the clock moves on."
        />
      </section>

      <section className="group" aria-labelledby="group-scenario">
        <h3 id="group-scenario" className="group-title">
          Scenario
        </h3>
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

      <ClosureControls
        sim={sim}
        selection={props.selection}
        onChoose={props.onChoose}
        clickMode={props.clickMode}
        onToggleClickMode={props.onToggleClickMode}
      />

      <TrafficData metrics={sim.metrics} />

      <details className="group advanced">
        <summary>Traffic lights &amp; speed</summary>
        {slider("speed-limit-kmh", true)}
        {slider("cycle-length", true)}
        <Toggle
          id="adaptive-signals"
          label="Share green time by demand"
          checked={settings["adaptive-signals?"]}
          onChange={setSwitch("adaptive-signals?")}
          help="Like SCATS, each intersection gives more green time to the direction with more cars waiting."
        />
        <Slider
          name="ew-green-share"
          value={settings["ew-green-share"]}
          onChange={function (value) {
            sim.set("ew-green-share", value);
          }}
          needsRestart
          disabled={settings["adaptive-signals?"]}
          help={greenShareHelp}
        />
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
      </details>

      <details className="group advanced">
        <summary>Route choice</summary>
        {slider("reroute-interval")}
        {slider("route-noise")}
      </details>

      <details className="group advanced">
        <summary>Counting</summary>
        {slider("warm-up-s", true)}
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

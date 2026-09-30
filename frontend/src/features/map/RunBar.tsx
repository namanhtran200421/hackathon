/**
 * The black bar under the map: Restart, Start / Pause, Step 1 second, the
 * speed slider, Keep running and the clock.
 */

import { Footprints, Pause, Play, RotateCcw } from "lucide-react";
import type { Metrics } from "@traffic-lab/simulation";
import { Toggle } from "../../components/form";
import { clock, timeOfDay } from "../../lib/format";
import { SPEEDS, speedLabel } from "../simulation/speeds";
import type { TrafficSimulation } from "../simulation/useTrafficSim";

/** The time of day in the model, then where the run is: warming up, counting, or done. */
function phaseText(metrics: Metrics | null, keepRunning: boolean): string {
  if (!metrics) {
    return "";
  }
  const now = timeOfDay(metrics.clock) + " · ";
  if (metrics.ticks < metrics.warmUp) {
    return now + "Warm-up · " + clock(metrics.warmUp - metrics.ticks) + " left";
  }
  if (keepRunning) {
    return now + "Counting until you pause";
  }
  const end = metrics.warmUp + metrics.measure;
  if (metrics.finished || metrics.ticks >= end) {
    return now + "Counting finished";
  }
  return now + "Counting · " + clock(end - metrics.ticks) + " left";
}

function StartPauseButton({ sim, ready }: { sim: TrafficSimulation; ready: boolean }) {
  if (sim.running) {
    return (
      <button className="button primary go-button" disabled={!ready} aria-pressed={true} onClick={sim.pause}>
        <Pause size={17} fill="currentColor" /> Pause
      </button>
    );
  }
  return (
    <button className="button primary go-button" disabled={!ready} aria-pressed={false} onClick={sim.start}>
      <Play size={17} fill="currentColor" /> Start
    </button>
  );
}

export default function RunBar({ sim }: { sim: TrafficSimulation }) {
  const ready = sim.phase === "ready";
  const metrics = sim.metrics;

  let totalTime = 0;
  let elapsed = 0;
  if (metrics) {
    totalTime = metrics.warmUp + metrics.measure;
    elapsed = metrics.ticks;
  }
  let progress = 0;
  if (!sim.keepRunning && totalTime > 0) {
    progress = Math.min(1, elapsed / totalTime);
  }

  let restartClass = "button secondary setup-button";
  let restartTitle = "Rebuild the road map and start again";
  if (sim.restartNeeded) {
    restartClass = restartClass + " needed";
    restartTitle = "Some settings take effect after Restart";
  }

  let speedText = sim.speed + " seconds of traffic every real second";
  if (sim.speed === 0) {
    speedText = "As fast as possible";
  }

  return (
    <div className="run-bar">
      <div className="run-buttons">
        <button className={restartClass} disabled={!ready} onClick={sim.restart} title={restartTitle}>
          <RotateCcw size={16} /> Restart
          {sim.restartNeeded && <span className="needed-dot" aria-label="(changes waiting)" />}
        </button>
        <StartPauseButton sim={sim} ready={ready} />
        <button className="button secondary" disabled={!ready} onClick={sim.step}>
          <Footprints size={16} /> Step 1 second
        </button>
      </div>

      <div className="speed">
        <div className="label-row">
          <label htmlFor="speed">Simulation speed</label>
          <span className="value">{speedLabel(sim.speed)}</span>
        </div>
        <input
          id="speed"
          type="range"
          min={0}
          max={SPEEDS.length - 1}
          step={1}
          value={SPEEDS.indexOf(sim.speed)}
          aria-valuetext={speedText}
          onChange={function (event) {
            sim.setSpeed(SPEEDS[Number(event.target.value)]);
          }}
        />
      </div>

      <Toggle id="forever" label="Keep running" checked={sim.keepRunning} onChange={sim.setKeepRunning} />

      <div className="clock">
        <span className="time">{clock(elapsed)}</span>
        <small>{phaseText(metrics, sim.keepRunning)}</small>
        {!sim.keepRunning && (
          <div
            className="progress"
            role="progressbar"
            aria-label="Counting progress"
            aria-valuemin={0}
            aria-valuemax={totalTime}
            aria-valuenow={Math.min(totalTime, elapsed)}
          >
            <span style={{ width: progress * 100 + "%" }} />
          </div>
        )}
      </div>
    </div>
  );
}

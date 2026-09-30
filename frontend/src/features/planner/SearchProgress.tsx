/**
 * Step 2 while the search runs: what it is doing, how far along it is, and a
 * button to stop and see the best plan so far.
 */

import { LoaderCircle, Square } from "lucide-react";
import { TRAFFIC_LEVELS } from "./delayCurve";
import type { PlannerProgress } from "./usePlanner";
import { durationText } from "./wording";

interface SearchProgressProps {
  progress: PlannerProgress;
  repeats: number;
  repeatsDone: number;
  onStop: () => void;
}

export default function SearchProgress({ progress, repeats, repeatsDone, onStop }: SearchProgressProps) {
  const percent = Math.round(progress.share * 100);

  let title =
    "Testing the closure in " + TRAFFIC_LEVELS.length + " amounts of traffic, from quiet to the busiest";
  let detail =
    "Each test runs the city twice with the same cars: once with the works and once without. " +
    repeatsDone +
    " of " +
    repeats +
    " rounds of testing done.";
  if (progress.stage === "checks") {
    title = "Double-checking the best plans at their real time of day";
    detail =
      "We re-test the busiest hour of the best plans with real traffic for that time of day, to check our numbers.";
  }

  let timeLeft = "Working out the time left…";
  if (progress.secondsLeft !== null) {
    timeLeft = durationText(progress.secondsLeft) + " left";
  }
  if (progress.share >= 1) {
    timeLeft = "Finishing…";
  }

  let stopLabel = "Stop and show the best so far";
  if (repeatsDone === 0 && progress.stage === "levels") {
    stopLabel = "Stop";
  }

  return (
    <section className="panel planner-step search-progress" aria-labelledby="progress-title">
      <div className="step-head">
        <h3 id="progress-title" tabIndex={-1}>
          <span className="step-number">2</span> Finding the best plan
        </h3>
        <button className="button secondary" onClick={onStop}>
          <Square size={14} /> {stopLabel}
        </button>
      </div>
      <p className="progress-title">
        <LoaderCircle size={16} className="spin" aria-hidden="true" /> {title}
      </p>
      <div
        className="progress-bar"
        role="progressbar"
        aria-label="Search progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={percent + "%, " + timeLeft}
      >
        <span style={{ width: percent + "%" }} />
      </div>
      <p className="progress-meta">
        <span>
          {progress.testsDone} of {progress.testsTotal} simulations
        </span>
        <span>{timeLeft}</span>
      </p>
      <p className="help">{detail}</p>
    </section>
  );
}

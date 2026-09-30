/**
 * The works planner: the form on the left, and on the right the search's
 * progress and then its answer.
 */

import { useEffect } from "react";
import { CalendarClock, Dices, FlaskConical } from "lucide-react";
import type { Settings, World } from "@traffic-lab/simulation";
import { ratesByDay, quarterBands } from "./delayCurve";
import { checkFor } from "./checks";
import DayChart, { type DaySeries } from "./DayChart";
import Detours from "./Detours";
import HowSure from "./HowSure";
import OtherOptions from "./OtherOptions";
import { allowedDayTypes } from "./plans";
import Recommendation from "./Recommendation";
import Risks from "./Risks";
import SearchProgress from "./SearchProgress";
import SettingsUsed from "./SettingsUsed";
import type { Plan, WorksClosure, WorksRequest } from "./types";
import type { Planner } from "./usePlanner";
import WorksForm from "./WorksForm";
import { closedWindow, whenText } from "./wording";

interface PlannerPanelProps {
  planner: Planner;
  world: World | null;
  settings: Settings;
  /** What the form starts with: the closure on the simulator's map. */
  startingClosure: WorksClosure;
  onTryInSimulator: (plan: Plan, request: WorksRequest) => void;
}

function EmptyState() {
  return (
    <section className="panel planner-step planner-empty" aria-label="How the planner works">
      <h3>How it works</h3>
      <ol className="how-steps">
        <li>
          <CalendarClock size={22} aria-hidden="true" />
          <div>
            <strong>Describe the works</strong>
            <p>The street, how it is closed, how many hours of work, and when the crew can work.</p>
          </div>
        </li>
        <li>
          <Dices size={22} aria-hidden="true" />
          <div>
            <strong>We test them many times</strong>
            <p>
              We try the closure in quiet and busy traffic, many times over with different random traffic. It
              all runs on your computer, in the background.
            </p>
          </div>
        </li>
        <li>
          <FlaskConical size={22} aria-hidden="true" />
          <div>
            <strong>Get a recommendation</strong>
            <p>
              When to close the road, over how many shifts, how much delay to expect, where the traffic goes,
              and what could go wrong.
            </p>
          </div>
        </li>
      </ol>
    </section>
  );
}

export default function PlannerPanel({
  planner,
  world,
  settings,
  startingClosure,
  onTryInSimulator,
}: PlannerPanelProps) {
  const state = planner.state;
  const profiles = planner.profiles;
  const request = state.request;
  const running = state.phase === "running";
  const phase = state.phase;

  // When a search starts or ends, take the user (and keyboard focus) to the
  // progress or the answer, which may be out of sight above the form's button.
  useEffect(
    function () {
      let id = "";
      if (phase === "running") {
        id = "progress-title";
      } else if (phase === "done" || phase === "stopped") {
        id = "recommendation-title";
      }
      const heading = document.getElementById(id);
      if (heading) {
        heading.focus({ preventScroll: true });
        const panel = heading.closest("section") || heading;
        panel.scrollIntoView({ block: "start" });
      }
    },
    [phase],
  );

  let series: DaySeries[] = [];
  if (request && profiles && state.curves.length > 0) {
    const curves = state.curves;
    series = allowedDayTypes(request).map(function (dayType): DaySeries {
      return { dayType: dayType, bands: quarterBands(ratesByDay(curves, profiles, dayType)) };
    });
  }

  let nothingClosed = false;
  if (state.facts && state.facts.closedDirections + state.facts.narrowedDirections === 0) {
    nothingClosed = true;
  }

  const showAnswer =
    (state.phase === "done" || state.phase === "stopped") &&
    request &&
    profiles &&
    state.outcome &&
    !nothingClosed;
  const noPlanFits =
    (state.phase === "done" || state.phase === "stopped") && state.curves.length > 0 && !state.outcome;

  function changeWorks(): void {
    const field = document.getElementById("works-street");
    if (field) {
      field.scrollIntoView({ block: "center" });
      field.focus();
    }
  }

  let bestSoFar = null;
  if (running && state.outcome) {
    bestSoFar = (
      <p className="best-so-far">
        Best so far: {whenText(state.outcome.best)}, {closedWindow(state.outcome.best)}
      </p>
    );
  }

  // A short announcement for screen readers when the search starts and ends.
  let statusText = "";
  if (running) {
    statusText = "Finding the best plan.";
  } else if (state.phase === "done" && state.outcome) {
    statusText = "Search finished. Our recommendation is ready.";
  } else if (state.phase === "stopped" && state.outcome) {
    statusText = "Search stopped. Showing the best plan so far.";
  }

  // Where the traffic goes: from the direct check of the recommended plan.
  let detourCheck = null;
  if (state.outcome && profiles) {
    detourCheck = checkFor(state.outcome.best, state.checks, state.curves, profiles);
  }

  let chartPlan = null;
  if (state.outcome && !nothingClosed) {
    chartPlan = state.outcome.best;
  }

  return (
    <div className="planner">
      <WorksForm
        world={world}
        settings={settings}
        request={planner.formValues(startingClosure)}
        onChange={planner.setDraft}
        fromSimulator={planner.fromSimulator}
        ready={planner.ready}
        running={running}
        estimateSeconds={planner.estimateSeconds}
        onSubmit={planner.start}
      />

      <div className="planner-results" aria-busy={running}>
        <p className="sr-only" role="status">
          {statusText}
        </p>
        {planner.profilesError && <p className="error">{planner.profilesError}</p>}
        {state.error && <p className="error">{state.error}</p>}
        {state.phase === "idle" && <EmptyState />}
        {state.settingsUsed && state.phase !== "idle" && (
          <SettingsUsed used={state.settingsUsed} current={settings} />
        )}
        {state.phase === "failed" && (
          <button className="button secondary" onClick={planner.reset}>
            Start again
          </button>
        )}

        {running && state.progress && (
          <SearchProgress
            progress={state.progress}
            repeats={state.repeatsWanted}
            repeatsDone={state.curves.length}
            onStop={planner.stop}
          />
        )}
        {bestSoFar}

        {nothingClosed && request && (
          <p className="error">
            Nothing on {request.street} could be closed this way, so the works would have no effect. Choose
            another part of the street or another way of closing it.
          </p>
        )}
        {noPlanFits && (
          <p className="error">
            No plan fits your limits: each shift needs the road closed for longer than the allowed times. Try
            a shorter longest shift, less setting-up time, or any time of day.
          </p>
        )}

        {showAnswer && state.outcome && request && profiles && (
          <Recommendation
            request={request}
            outcome={state.outcome}
            checks={state.checks}
            curves={state.curves}
            profiles={profiles}
            stoppedEarly={state.phase === "stopped"}
            repeatsWanted={state.repeatsWanted}
            onTryInSimulator={function (plan) {
              onTryInSimulator(plan, request);
            }}
            onChangeWorks={changeWorks}
          />
        )}

        {series.length > 0 && request && !nothingClosed && (
          <section className="panel planner-step" aria-label="Best and worst times">
            <DayChart series={series} plan={chartPlan} times={request.times} />
          </section>
        )}

        {showAnswer && detourCheck && request && <Detours check={detourCheck} request={request} />}

        {showAnswer && state.outcome && request && profiles && (
          <>
            <OtherOptions outcome={state.outcome} priority={request.priority} />
            <Risks
              request={request}
              outcome={state.outcome}
              facts={state.facts}
              checks={state.checks}
              curves={state.curves}
              profiles={profiles}
            />
            <HowSure repeats={state.outcome.repeats} checks={state.checks} />
          </>
        )}
      </div>
    </div>
  );
}

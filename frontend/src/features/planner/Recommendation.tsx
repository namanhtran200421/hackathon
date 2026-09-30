/**
 * Step 3, the answer: the recommended plan in one sentence, what it costs in
 * extra time in traffic (as a range over the repeats), how much it saves
 * compared with closing the road in the daytime, and what to do next.
 */

import { CircleAlert, CircleCheck, Pencil, Play, Printer, TriangleAlert } from "lucide-react";
import { average, type SeedCurve } from "./delayCurve";
import { checkFor, verdict } from "./checks";
import type { Impact, PlanOutcome } from "./plans";
import type { DayProfiles, DirectCheck, Plan, WorksRequest } from "./types";
import {
  carHours,
  closedWindow,
  dayWord,
  hoursText,
  rangeText,
  shiftsText,
  timeOfDay,
  whenText,
} from "./wording";

interface RecommendationProps {
  request: WorksRequest;
  outcome: PlanOutcome;
  checks: DirectCheck[];
  curves: SeedCurve[];
  profiles: DayProfiles;
  stoppedEarly: boolean;
  repeatsWanted: number;
  onTryInSimulator: (plan: Plan) => void;
  onChangeWorks: () => void;
}

const IMPACT_TEXT: Record<Impact, { label: string; help: string }> = {
  low: {
    label: "Low impact",
    help: "Well under half the delay the same closure would cause at the busiest time.",
  },
  some: { label: "Some impact", help: "Between a third and two thirds of the delay at the busiest time." },
  high: {
    label: "High impact",
    help: "Close to the delay the same closure would cause at the busiest time.",
  },
};

function ImpactBadge({ impact }: { impact: Impact }) {
  let icon = <CircleCheck size={15} aria-hidden="true" />;
  if (impact === "some") {
    icon = <TriangleAlert size={15} aria-hidden="true" />;
  } else if (impact === "high") {
    icon = <CircleAlert size={15} aria-hidden="true" />;
  }
  return (
    <span className={"impact-badge " + impact} title={IMPACT_TEXT[impact].help}>
      {icon} {IMPACT_TEXT[impact].label}
    </span>
  );
}

/** "Collins St (whole street)" or "Collins St (section 3)" */
export function placeText(request: WorksRequest): string {
  if (request.section === 0) {
    return request.street + " (whole street)";
  }
  return request.street + " (section " + request.section + ")";
}

/** What the recommended plan saves compared with another plan, in words. */
function savingText(best: Plan, other: Plan, otherName: string): string | null {
  const saved = other.typical - best.typical;
  if (saved <= 0.05) {
    return null;
  }
  let share = "";
  if (other.typical > 0) {
    share = " (" + Math.round((saved / other.typical) * 100) + "% less)";
  }
  return "About " + carHours(saved) + " fewer hours of delay" + share + " than " + otherName + ".";
}

export default function Recommendation(props: RecommendationProps) {
  const { request, outcome } = props;
  const best = outcome.best;

  // Compare with a weekday 9 am closure, unless the plan already is one.
  let comparison = savingText(best, outcome.daytime, "closing at 9 am on weekdays");
  const daytimePlan = best.dayType === "weekday" && best.start >= 7 && best.start <= 11;
  if (daytimePlan || comparison === null) {
    comparison = savingText(
      best,
      outcome.worst,
      "the worst time your limits allow (" +
        dayWord(outcome.worst.dayType) +
        "s at " +
        timeOfDay(outcome.worst.start) +
        ")",
    );
  }

  const check = checkFor(best, props.checks, props.curves, props.profiles);
  let checkText: string | null = null;
  if (check) {
    const measured = average(check.measured);
    const judged = verdict(check);
    let agreement = "close to our estimate";
    if (judged === "higher") {
      agreement = "more than our estimate, so allow for extra delay";
    } else if (judged === "lower") {
      agreement = "less than our estimate";
    }
    checkText =
      "We double-checked " +
      timeOfDay(check.hour) +
      ", the busiest hour of this plan, with a separate test: " +
      carHours(measured) +
      " hours of delay for that hour, " +
      agreement +
      " of " +
      carHours(check.estimate) +
      ".";
  }

  let setupText = "";
  if (request.setupHours > 0) {
    setupText = " plus " + hoursText(request.setupHours) + " setting up and packing away";
  }

  return (
    <section className="panel planner-step recommendation" aria-labelledby="recommendation-title">
      <div className="step-head">
        <h3 id="recommendation-title" tabIndex={-1}>
          <span className="step-number">3</span> Our recommendation
        </h3>
        <ImpactBadge impact={outcome.impact} />
      </div>

      <p className="recommendation-headline">
        Close {placeText(request)} on {whenText(best)}, <strong>{closedWindow(best)}</strong>, over{" "}
        {shiftsText(best.shifts)}.
      </p>
      <p className="help">
        Each shift is {hoursText(Math.round(best.workPerShift * 100) / 100)} of work{setupText}.
      </p>

      <dl className="recommendation-figures">
        <div>
          <dt>Extra time stuck in traffic</dt>
          <dd>
            <strong>{carHours(best.typical)}</strong> hours in total
          </dd>
          <dd className="help">
            Between {rangeText(best.low, best.high).replace(" to ", " and ")} hours over {outcome.repeats}{" "}
            rounds of testing
          </dd>
        </div>
        <div>
          <dt>Road closed</dt>
          <dd>
            <strong>{hoursText(best.closedPerShift)}</strong> a shift
          </dd>
          <dd className="help">
            {shiftsText(best.shifts)}, {hoursText(best.shifts * best.closedPerShift)} in all
          </dd>
        </div>
        <div>
          <dt>Compared with other times</dt>
          <dd className="help">{comparison || "Every allowed time costs about the same."}</dd>
        </div>
      </dl>
      <p className="help car-hour-note">
        Hours of delay are for all drivers added together: 60 drivers each held up for a minute adds up to 1
        hour.
      </p>

      {outcome.nearTie && (
        <p className="planner-note">
          <strong>Close call:</strong> the next option below is about as good. Choose between them on other
          grounds, such as noise rules or crew costs.
        </p>
      )}
      {props.stoppedEarly && (
        <p className="planner-note">
          <strong>Stopped early:</strong> based on {outcome.repeats} of {props.repeatsWanted} rounds of
          testing, so the numbers are rougher.
        </p>
      )}
      {checkText && <p className="help check-note">{checkText}</p>}

      <div className="recommendation-actions">
        <button
          className="button primary"
          onClick={function () {
            props.onTryInSimulator(best);
          }}
        >
          <Play size={15} /> Show it on the map
        </button>
        <button
          className="button secondary"
          onClick={function () {
            // Print the method notes too.
            document.querySelectorAll("details.how-sure").forEach(function (details) {
              (details as HTMLDetailsElement).open = true;
            });
            window.print();
          }}
        >
          <Printer size={15} /> Print or save as PDF
        </button>
        <button className="button secondary" onClick={props.onChangeWorks}>
          <Pencil size={15} /> Change the works
        </button>
      </div>
    </section>
  );
}

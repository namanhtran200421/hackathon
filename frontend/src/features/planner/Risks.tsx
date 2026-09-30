/**
 * "What could go wrong": risks for the recommended plan, worked out from the
 * same tests: running late, queues at the edge of the city, trips that
 * cannot get through, and reasons to treat the numbers with care.
 */

import { TriangleAlert } from "lucide-react";
import { whole } from "../../lib/format";
import { average, TRAFFIC_LEVELS, type SeedCurve } from "./delayCurve";
import { checkFor, verdict } from "./checks";
import type { PlanOutcome } from "./plans";
import { busiestLevel, nearestLevel, overrunCost, type WorksFacts } from "./searchResults";
import type { DayProfiles, DirectCheck, WorksRequest } from "./types";
import { carHours, timeOfDay } from "./wording";

interface RisksProps {
  request: WorksRequest;
  outcome: PlanOutcome;
  facts: WorksFacts | null;
  checks: DirectCheck[];
  curves: SeedCurve[];
  profiles: DayProfiles;
}

export default function Risks({ request, outcome, facts, checks, curves, profiles }: RisksProps) {
  const best = outcome.best;
  const risks: string[] = [];

  const late = overrunCost(best, curves, profiles);
  const lateTypical = average(late);
  if (lateTypical > 0.05) {
    risks.push(
      "Running late: if every shift overran by an hour (past " +
        timeOfDay(best.start + best.closedPerShift) +
        "), that would add about " +
        carHours(lateTypical) +
        " hours of delay, and up to " +
        carHours(Math.max(...late)) +
        ".",
    );
  }

  if (facts) {
    const during = nearestLevel(busiestLevel(best, profiles));
    const queued = facts.extraQueued[during];
    if (queued >= 3) {
      risks.push(
        "Queues at the edge of the city: about " +
          whole(queued) +
          " more cars waiting to get in at the busiest point of the closure.",
      );
    }
    const peak = TRAFFIC_LEVELS.length - 1;
    if (facts.extraQueued[peak] >= 5 && during !== peak) {
      risks.push(
        "If the works spilled into the busiest time of day, about " +
          whole(facts.extraQueued[peak]) +
          " more cars would queue at the edge of the city.",
      );
    }
    const stranded = Math.max(...facts.extraStranded);
    if (stranded > 0.5) {
      risks.push(
        "Some trips could not reach where they were going (about " +
          whole(stranded) +
          " every 10 minutes at the busiest time tested). Check access to car parks and driveways on " +
          request.street +
          ".",
      );
    }
  }

  if (outcome.nearTie) {
    risks.push("The top two options are close, so small changes in traffic could swap them.");
  }

  const check = checkFor(best, checks, curves, profiles);
  if (check && verdict(check) === "higher") {
    risks.push(
      "The double-check at " +
        timeOfDay(check.hour) +
        " found more delay than we estimated. Treat the totals as a minimum.",
    );
  }

  if (outcome.repeats < 5) {
    risks.push(
      "These numbers come from only " +
        outcome.repeats +
        " rounds of testing. Choose Careful check for firmer numbers before you commit.",
    );
  }

  if (best.dayType === "weekend") {
    risks.push(
      "Weekend traffic varies with events such as football and concerts. Check the events calendar.",
    );
  }

  return (
    <section className="panel planner-step" aria-labelledby="risks-title">
      <h3 id="risks-title">What could go wrong</h3>
      {risks.length === 0 && <p className="help">No particular risks showed up in the tests.</p>}
      <ul className="risk-list">
        {risks.map(function (risk) {
          return (
            <li key={risk}>
              <TriangleAlert size={16} aria-hidden="true" /> <span>{risk}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

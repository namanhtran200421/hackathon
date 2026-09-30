/**
 * "Other good options": the recommended plan next to up to three clearly
 * different plans, and a daytime closure for comparison.
 */

import { signed } from "../../lib/format";
import type { PlanOutcome } from "./plans";
import type { Plan, Priority } from "./types";
import { carHours, closedWindow, rangeText, shiftsText, whenText } from "./wording";

interface Row {
  key: string;
  name: string;
  plan: Plan;
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface OtherOptionsProps {
  outcome: PlanOutcome;
  priority: Priority;
}

export default function OtherOptions({ outcome, priority }: OtherOptionsProps) {
  const rows: Row[] = [{ key: "best", name: "Recommended", plan: outcome.best }];
  outcome.others.forEach(function (plan, index) {
    rows.push({ key: "other" + index, name: "Option " + (index + 2), plan: plan });
  });
  rows.push({ key: "daytime", name: "For comparison", plan: outcome.daytime });

  // With a priority on fewer shifts, an option with more shifts can have less
  // delay and still rank lower. Say why.
  const lessDelayMoreShifts = outcome.others.some(function (plan) {
    return plan.typical < outcome.best.typical && plan.shifts > outcome.best.shifts;
  });
  let shiftNote = "";
  if (lessDelayMoreShifts && priority === "balanced") {
    shiftNote =
      " Options with less delay but more shifts rank lower because, with the Balanced priority, each extra shift counts as " +
      carHours(outcome.shiftCost) +
      " car-hours.";
  } else if (lessDelayMoreShifts && priority === "fewest-shifts") {
    shiftNote = " Options with less delay but more shifts rank lower because you chose the fewest shifts.";
  }

  return (
    <section className="panel planner-step" aria-labelledby="options-title">
      <h2 id="options-title">Other good options</h2>
      <p className="help">
        Each is clearly different from the ones above it. Extra car-hours are the total over all shifts.
        {shiftNote}
      </p>
      <div className="table-wrap">
        <table className="compare-table options-table">
          <thead>
            <tr>
              <th scope="col">Option</th>
              <th scope="col">When the road is closed</th>
              <th scope="col">Shifts</th>
              <th scope="col">Extra car-hours</th>
              <th scope="col">Range over repeats</th>
              <th scope="col">Compared with recommended</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(function (row) {
              let difference = "—";
              if (row.key !== "best") {
                difference = signed(row.plan.typical - outcome.best.typical, carHours);
              }
              let rowClass = "";
              if (row.key === "best") {
                rowClass = "recommended-row";
              }
              return (
                <tr key={row.key} className={rowClass}>
                  <th scope="row">{row.name}</th>
                  <td className="text-cell">
                    {capitalised(whenText(row.plan))}, {closedWindow(row.plan)}
                  </td>
                  <td>{shiftsText(row.plan.shifts)}</td>
                  <td>{carHours(row.plan.typical)}</td>
                  <td>{rangeText(row.plan.low, row.plan.high)}</td>
                  <td>{difference}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * "Where the traffic goes": which streets take the detour traffic during the
 * recommended closure. It uses the direct check of the plan's busiest hour:
 * the same cars with and without the works, at the real time of day, and the
 * same street measure as the simulator's results table and CSV download.
 */

import { whole } from "../../lib/format";
import Bars, { type BarRow } from "../results/charts/Bars";
import type { DirectCheck, StreetChange, WorksRequest } from "./types";
import { dayWord, timeOfDay } from "./wording";

/** Changes smaller than this (cars per hour through a block) are left out as noise. */
const NOTICEABLE = 5;
const MOST_SHOWN = 6;

function namesInWords(names: string[]): string {
  if (names.length <= 1) {
    return names.join("");
  }
  return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}

export default function Detours({ check, request }: { check: DirectCheck; request: WorksRequest }) {
  const busier = check.streets
    .filter(function (street) {
      return street.street !== request.street && street.change >= NOTICEABLE;
    })
    .slice(0, MOST_SHOWN);
  const worksStreet = check.streets.find(function (street) {
    return street.street === request.street;
  });

  const shown: StreetChange[] = busier.slice();
  if (worksStreet) {
    shown.push(worksStreet);
  }
  const rows: BarRow[] = shown.map(function (street) {
    return {
      label: street.street,
      value: street.change,
      detail: whole(street.before) + " cars/hour without the works · " + whole(street.after) + " with them",
    };
  });

  let summary =
    "No other street gets noticeably busier: every change is under " + NOTICEABLE + " cars an hour.";
  if (busier.length > 0) {
    const top = busier.slice(0, 3).map(function (street) {
      return street.street;
    });
    summary =
      "Most of the detour traffic goes to " +
      namesInWords(top) +
      ". These are the streets to watch for queues, and where detour signs and traffic control will help most.";
  }

  return (
    <section className="panel planner-step" aria-labelledby="detours-title">
      <h3 id="detours-title">Where the traffic goes</h3>
      <p className="help">
        At {timeOfDay(check.hour)} on {dayWord(check.dayType)}s, the busiest hour of the recommended closure,
        compared with no works. Cars per hour on a typical block of each street, both directions, average of{" "}
        {check.measured.length} rounds of testing.
      </p>
      <p className="detour-summary">{summary}</p>
      {rows.length > 0 && (
        <Bars
          title="Change in traffic with the works (cars per hour)"
          rows={rows}
          diverging={true}
          unit="cars/hour"
        />
      )}
      {shown.length > 0 && (
        <div className="table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th scope="col">Street</th>
                <th scope="col">Without the works</th>
                <th scope="col">With the works</th>
                <th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(function (street) {
                let change = whole(street.change);
                if (street.change > 0) {
                  change = "+" + change;
                } else if (street.change < 0) {
                  change = "−" + whole(Math.abs(street.change));
                }
                return (
                  <tr key={street.street}>
                    <th scope="row">{street.street}</th>
                    <td>{whole(street.before)}</td>
                    <td>{whole(street.after)}</td>
                    <td>{change}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

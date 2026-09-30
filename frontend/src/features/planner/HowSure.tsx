/**
 * "How sure are we?": how the numbers were worked out, the double-checks, and
 * what the model leaves out. Closed until opened.
 */

import { oneDp } from "../../lib/format";
import { average, TRAFFIC_LEVELS } from "./delayCurve";
import { verdict } from "./checks";
import { COUNT_SECONDS, WARM_UP_SECONDS } from "./jobs";
import type { DirectCheck } from "./types";
import { carHours, dayWord, rangeText, timeOfDay } from "./wording";

interface HowSureProps {
  repeats: number;
  checks: DirectCheck[];
}

const VERDICT_TEXT = {
  close: "Close to our estimate",
  higher: "More than we estimated",
  lower: "Less than we estimated",
};

export default function HowSure({ repeats, checks }: HowSureProps) {
  const levels = TRAFFIC_LEVELS.map(function (level) {
    return Math.round(level * 100) + "%";
  }).join(", ");

  return (
    <details className="panel planner-step how-sure">
      <summary>
        <h3>How sure are we?</h3>
      </summary>

      <h4>How we worked it out</h4>
      <ul>
        <li>
          We tested the closure in {TRAFFIC_LEVELS.length} amounts of traffic ({levels} of the busiest time of
          day). We did this {repeats} times, each time with different random traffic. Testing many times like
          this is called a Monte Carlo simulation. The ranges show how much the answer changes from day to
          day.
        </li>
        <li>
          Each test runs the city twice with exactly the same cars: once with the works and once with every
          road open. The difference is the delay caused by the works. Each run warms up for{" "}
          {WARM_UP_SECONDS / 60} minutes, then counts for {COUNT_SECONDS / 60} minutes.
        </li>
        <li>
          How busy the city is at each time of day comes from real traffic light counts (Department of
          Transport and Planning, August 2026), for weekdays and weekends.
        </li>
        <li>
          We then added up every plan your limits allow (each start time, kind of day and number of shifts)
          and ranked them. Finally, we re-tested the busiest hour of the best plans with real traffic for that
          time of day.
        </li>
      </ul>

      {checks.length > 0 && (
        <>
          <h4>Double-checks</h4>
          <div className="table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col">Road closed at</th>
                  <th scope="col">Our estimate (hours of delay)</th>
                  <th scope="col">Separate test</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {checks.map(function (check) {
                  return (
                    <tr key={check.dayType + check.hour}>
                      <th scope="row">
                        {timeOfDay(check.hour)} on {dayWord(check.dayType)}s
                      </th>
                      <td>{oneDp(check.estimate)}</td>
                      <td>
                        {carHours(average(check.measured))} (
                        {rangeText(Math.min(...check.measured), Math.max(...check.measured))})
                      </td>
                      <td>{VERDICT_TEXT[verdict(check)]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h4>What the model leaves out</h4>
      <ul>
        <li>It only has cars. Trams, buses, bikes and people walking are not in it.</li>
        <li>
          The number of cars at the busiest time is your setting in the simulator. The real counts only give
          the shape of the day.
        </li>
        <li>
          Queues left over from one hour are not carried into the next, so long closures near busy times may
          be worse than shown.
        </li>
        <li>
          A shift uses one kind of day throughout: a weekday night shift uses weekday traffic after midnight.
        </li>
        <li>If a closure seems to make traffic slightly better, we count it as no change.</li>
      </ul>
    </details>
  );
}

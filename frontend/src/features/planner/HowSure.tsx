/**
 * "How sure are we?": how the numbers were worked out, the direct checks, and
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
  close: "Close to the estimate",
  higher: "Higher than estimated",
  lower: "Lower than estimated",
};

export default function HowSure({ repeats, checks }: HowSureProps) {
  const levels = TRAFFIC_LEVELS.map(function (level) {
    return Math.round(level * 100) + "%";
  }).join(", ");

  return (
    <details className="panel planner-step how-sure">
      <summary>
        <h2>How sure are we?</h2>
      </summary>

      <h3>How the numbers were worked out</h3>
      <ul>
        <li>
          The works were tested at {TRAFFIC_LEVELS.length} traffic levels ({levels} of the busiest time of
          day), each repeated {repeats} times with different random traffic. Repeating like this is called a
          Monte Carlo simulation; the ranges show how much the answer changes from one day to another.
        </li>
        <li>
          Each test runs the city twice with exactly the same cars: once with the works and once with every
          road open. The difference is the extra time in traffic caused by the works. Each run warms up for{" "}
          {WARM_UP_SECONDS / 60} minutes and then counts for {COUNT_SECONDS / 60} minutes.
        </li>
        <li>
          How busy each quarter hour of the day is comes from public traffic signal counts (Department of
          Transport and Planning, August 2026), separately for weekdays and weekends. Each quarter
          hour&rsquo;s delay is read off the tested levels.
        </li>
        <li>
          Every plan your limits allow (each start hour, kind of day and number of shifts) was then added up
          and ranked. The best plans&rsquo; busiest hours were double-checked directly with that hour&rsquo;s
          real traffic pattern.
        </li>
      </ul>

      {checks.length > 0 && (
        <>
          <h3>Direct checks</h3>
          <div className="table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col">Road closed at</th>
                  <th scope="col">Estimate (car-hours per hour)</th>
                  <th scope="col">Measured directly</th>
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

      <h3>What the model leaves out</h3>
      <ul>
        <li>Only cars are simulated. Trams, buses, bikes and people walking are not.</li>
        <li>
          The number of cars at the busiest time is your simulator setting; the detector data only gives the
          shape of the day.
        </li>
        <li>
          Queues left over from one hour are not carried into the next, so long closures near busy times may
          be worse than shown.
        </li>
        <li>
          A shift uses one kind of day throughout: a weekday night shift uses weekday traffic after midnight.
        </li>
        <li>Small savings from a closure are treated as noise and counted as no change.</li>
      </ul>
    </details>
  );
}

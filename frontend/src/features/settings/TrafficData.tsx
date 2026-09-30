/**
 * "Real traffic data": where the traffic comes from, how many trips start
 * right now, and how closely the simulated traffic matches the SCATS counts
 * at the counted intersections so far.
 */

import type { Metrics } from "@traffic-lab/simulation";
import { timeOfDay, whole } from "../../lib/format";

/** The live comparison with the counts, or why it is not shown yet. */
function matchText(metrics: Metrics | null): string {
  if (!metrics) {
    return "Shown once the traffic is running.";
  }
  if (metrics.measured < 60) {
    return "Shown after the warm-up, once a minute has been counted.";
  }
  const scats = metrics.scats;
  let carried = "";
  if (scats.counted > 0) {
    const ratio = scats.modelled / scats.counted;
    const gap = whole(Math.abs(ratio - 1) * 100) + "%";
    if (gap === "0%") {
      carried = " In total, the simulated traffic through them matches the counts.";
    } else if (ratio < 1) {
      carried = " In total, the simulated traffic through them is " + gap + " below the counts.";
    } else {
      carried = " In total, the simulated traffic through them is " + gap + " above the counts.";
    }
  }
  return (
    whole(scats.withinGeh5) +
    " of " +
    whole(scats.sites) +
    " counted intersections are within the usual matching standard (GEH under 5)." +
    carried
  );
}

export default function TrafficData({ metrics }: { metrics: Metrics | null }) {
  let now = "—";
  let trips = "—";
  if (metrics) {
    now = timeOfDay(metrics.clock);
    trips = whole(metrics.tripsPerHour) + " trips an hour";
  }

  return (
    <section className="group" aria-labelledby="group-data">
      <h3 id="group-data" className="group-title">
        Real traffic data
      </h3>
      <dl className="data-figures">
        <div>
          <dt>Time in the model</dt>
          <dd aria-label="Time in the model">{now}</dd>
        </div>
        <div>
          <dt>Trips starting now</dt>
          <dd aria-label="Trips starting now">{trips}</dd>
        </div>
      </dl>
      <p className="help" aria-label="Match with the SCATS counts">
        <strong>Match with the counts:</strong> {matchText(metrics)}
      </p>
      <p className="help">
        The traffic comes from Victoria&rsquo;s SCATS traffic light counts for an average August 2026 weekday
        or weekend. Cars enter and leave where real roads cross the edge of the map and at public car parks,
        in the numbers that best reproduce the counts. Traffic lights stand where the Department of Transport
        and Planning lists them. Their timings are not published, so the model shares green time by demand.
      </p>
      <p className="help">
        <a
          href="https://opendata.transport.vic.gov.au/dataset/traffic-signal-volume-data"
          target="_blank"
          rel="noreferrer"
        >
          DTP traffic volumes
        </a>{" "}
        ·{" "}
        <a href="/sim/observed-data.json" target="_blank" rel="noreferrer">
          How the data was used
        </a>
      </p>
    </section>
  );
}

/**
 * The counted intersections: the average SCATS count for the stretch of the
 * day that was counted, beside the simulated traffic entering the same
 * intersection, and the GEH statistic traffic engineers use to compare them.
 */

import { useState } from "react";
import type { CountSite, SiteVolume } from "@traffic-lab/simulation";
import { oneDp, percent, signed, whole } from "../../lib/format";

export interface CountRow {
  name: string;
  counted: number;
  modelled: number;
  geh: number;
}

/**
 * GEH: the difference between two hourly flows, scaled by their size. Under 5
 * is the usual standard for a good match. The model reports the same figure.
 */
function geh(modelled: number, counted: number): number {
  if (modelled + counted === 0) {
    return 0;
  }
  return Math.sqrt((2 * (modelled - counted) ** 2) / (modelled + counted));
}

/** "SWANSTON/LITTLE LONSDALE" → "Swanston / Little Lonsdale". */
function siteName(name: string): string {
  return name
    .toLowerCase()
    .split("/")
    .map(function (part) {
      return part.trim().replace(/(^|[\s'-])([a-z])/g, function (match) {
        return match.toUpperCase();
      });
    })
    .join(" / ");
}

/** One row per counted intersection, busiest first. */
export function countRows(sites: CountSite[], volumes: SiteVolume[]): CountRow[] {
  const rows = sites.map(function (site, index): CountRow {
    const volume = volumes[index];
    return {
      name: siteName(site.name),
      counted: volume.counted,
      modelled: volume.modelled,
      geh: geh(volume.modelled, volume.counted),
    };
  });
  return rows.sort(function (a, b) {
    return b.counted - a.counted;
  });
}

export default function CountsTable({ rows, closures }: { rows: CountRow[]; closures: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const within = rows.filter(function (row) {
    return row.geh < 5;
  }).length;
  let shown = rows.slice(0, 10);
  let moreLabel = "Show all " + rows.length + " intersections";
  if (showAll) {
    shown = rows;
    moreLabel = "Show the 10 busiest intersections";
  }

  return (
    <>
      <p className="help">
        Vehicles per hour entering each intersection whose SCATS detectors cover every lane, simulated over
        the counting time, beside the average count for the same time of day. A GEH under 5 is the usual
        standard for a good match. <strong>{whole(within)}</strong> of {whole(rows.length)} intersections
        match.
        {closures && " Roads are closed in this run, so some intersections are expected to differ."}
      </p>
      <div className="table-wrap">
        <table className="compare-table counts-table">
          <thead>
            <tr>
              <th scope="col">Intersection</th>
              <th scope="col">Counted</th>
              <th scope="col">Simulated</th>
              <th scope="col">Difference</th>
              <th scope="col">GEH</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(function (row) {
              let difference = signed(Math.round(row.modelled - row.counted), whole);
              if (row.counted > 0) {
                difference = difference + " (" + percent(row.modelled / row.counted - 1) + ")";
              }
              let match = "Good match";
              if (row.geh >= 5) {
                match = "Not within 5";
              }
              return (
                <tr key={row.name}>
                  <th scope="row">{row.name}</th>
                  <td>{whole(row.counted)}</td>
                  <td>{whole(row.modelled)}</td>
                  <td>{difference}</td>
                  <td>
                    {oneDp(row.geh)} <small>{match}</small>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > 10 && (
        <button
          className="button secondary more-streets"
          onClick={function () {
            setShowAll(!showAll);
          }}
        >
          {moreLabel}
        </button>
      )}
    </>
  );
}

/**
 * The table of streets: traffic per hour, the baseline and change, time to
 * drive a block, and whether the street is closed.
 */

import { oneDp, percent, signed, whole } from "../../lib/format";
import type { StreetRow } from "./calculations";

function streetStatus(street: StreetRow): string {
  if (street.closed > 0) {
    return street.closed + " closed";
  }
  if (street.narrowed > 0) {
    return street.narrowed + " with a lane closed";
  }
  return "Open";
}

export default function StreetTable({ streets, compare }: { streets: StreetRow[]; compare: boolean }) {
  return (
    <div className="table-wrap">
      <table className="compare-table streets-table">
        <thead>
          <tr>
            <th scope="col">Street</th>
            {compare && <th scope="col">Baseline cars/hour</th>}
            <th scope="col">Cars/hour</th>
            {compare && <th scope="col">Change</th>}
            <th scope="col">Time per block</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {streets.map(function (street) {
            let changeText = signed(Math.round(street.change), whole);
            if (street.baseline > 0) {
              changeText = changeText + " (" + percent(street.change / street.baseline) + ")";
            }
            return (
              <tr key={street.street}>
                <th scope="row">{street.street}</th>
                {compare && <td>{whole(street.baseline)}</td>}
                <td>{whole(street.flow)}</td>
                {compare && <td>{changeText}</td>}
                <td>{oneDp(street.travel)} s</td>
                <td>{streetStatus(street)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

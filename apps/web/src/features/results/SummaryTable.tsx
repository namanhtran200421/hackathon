/**
 * The summary table: this run's numbers, and when there is a baseline, the
 * baseline's numbers, the change and whether it is better or worse.
 */

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { percent, signed } from "../../lib/format";
import type { SummaryRow } from "./calculations";

/** The Better / Worse / Same tag next to each change. */
function Effect({ change, higherIsBetter }: { change: number; higherIsBetter: boolean | null }) {
  if (higherIsBetter === null) {
    return null;
  }
  if (Math.abs(change) < 1e-9) {
    return (
      <span className="verdict neutral">
        <Minus size={13} aria-hidden="true" /> Same
      </span>
    );
  }
  const better = change > 0 === higherIsBetter;
  let arrow = <ArrowDownRight size={13} aria-hidden="true" />;
  if (change > 0) {
    arrow = <ArrowUpRight size={13} aria-hidden="true" />;
  }
  if (better) {
    return (
      <span className="verdict better">
        {arrow}
        Better
      </span>
    );
  }
  return (
    <span className="verdict worse">
      {arrow}
      Worse
    </span>
  );
}

function Row({ row, withBaseline }: { row: SummaryRow; withBaseline: boolean }) {
  let change: number | null = null;
  if (row.run !== null && row.base !== null) {
    change = row.run - row.base;
  }

  let baseText = "—";
  if (row.base !== null) {
    baseText = row.format(row.base);
  }
  let runText = "—";
  if (row.run !== null) {
    runText = row.format(row.run);
  }
  let changeText = "—";
  if (change !== null) {
    changeText = signed(change, row.format);
  }
  // A percentage of a zero or negative number would be misleading.
  let percentText = "—";
  if (change !== null && row.base !== null && row.base > 0) {
    percentText = percent(change / row.base);
  }

  return (
    <tr>
      <th scope="row">{row.label}</th>
      {withBaseline && <td>{baseText}</td>}
      <td>{runText}</td>
      {withBaseline && <td>{changeText}</td>}
      {withBaseline && <td>{percentText}</td>}
      {withBaseline && (
        <td>{change !== null && <Effect change={change} higherIsBetter={row.higherIsBetter} />}</td>
      )}
    </tr>
  );
}

export default function SummaryTable({ rows, withBaseline }: { rows: SummaryRow[]; withBaseline: boolean }) {
  return (
    <div className="table-wrap">
      <table className="compare-table">
        <thead>
          <tr>
            <th scope="col">Measure</th>
            {withBaseline && <th scope="col">Baseline</th>}
            <th scope="col">This run</th>
            {withBaseline && <th scope="col">Change</th>}
            {withBaseline && <th scope="col">%</th>}
            {withBaseline && <th scope="col">Effect</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(function (row) {
            return <Row key={row.label} row={row} withBaseline={withBaseline} />;
          })}
        </tbody>
      </table>
    </div>
  );
}

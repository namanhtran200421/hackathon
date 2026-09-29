/**
 * Horizontal bars. With `diverging`, bars go right (orange) for more traffic
 * and left (blue) for less; otherwise every bar goes right in one colour.
 */

import { useState } from "react";
import { oneDp } from "../../../lib/format";
import { CHANGE, SERIES } from "./colours";
import { useWidth } from "./useWidth";

export interface BarRow {
  label: string;
  value: number;
  /** Extra detail shown when the bar is hovered. */
  detail: string;
}

interface BarsProps {
  title: string;
  rows: BarRow[];
  diverging: boolean;
  unit: string;
}

const BAR_HEIGHT = 18;
const GAP = 10;

/** An SVG path for one bar: square at the zero line, rounded at the far end. */
function barPath(zero: number, top: number, length: number, height: number, pointsRight: boolean): string {
  const radius = Math.min(4, length / 2);
  const straight = length - radius;
  const corner = "a" + radius + "," + radius + " 0 0 ";
  if (pointsRight) {
    return [
      "M" + zero + "," + top,
      "h" + straight,
      corner + "1 " + radius + "," + radius,
      "v" + (height - 2 * radius),
      corner + "1 -" + radius + "," + radius,
      "h-" + straight + "z",
    ].join("");
  }
  return [
    "M" + zero + "," + top,
    "h-" + straight,
    corner + "0 -" + radius + "," + radius,
    "v" + (height - 2 * radius),
    corner + "0 " + radius + "," + radius,
    "h" + straight + "z",
  ].join("");
}

function shortName(name: string): string {
  if (name.length > 22) {
    return name.slice(0, 21) + "…";
  }
  return name;
}

export default function Bars({ title, rows, diverging, unit }: BarsProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);
  const labelWidth = Math.min(150, width * 0.3);
  let valueWidth = 70;
  if (width < 520) {
    valueWidth = 46;
  }
  const height = rows.length * (BAR_HEIGHT + GAP) + 8;

  let largest = 1;
  rows.forEach(function (row) {
    largest = Math.max(largest, Math.abs(row.value));
  });

  let plotWidth = width - labelWidth - valueWidth;
  let zero = labelWidth;
  let pixelsPerUnit = plotWidth / largest;
  if (diverging) {
    plotWidth = width - labelWidth - valueWidth * 2;
    zero = labelWidth + valueWidth + plotWidth / 2;
    pixelsPerUnit = plotWidth / 2 / largest;
  }

  function valueText(value: number): string {
    if (diverging && value > 0) {
      return "+" + oneDp(value);
    }
    if (value < 0) {
      return "−" + oneDp(Math.abs(value));
    }
    return oneDp(value);
  }

  let tip: BarRow | null = null;
  if (hovered !== null && rows[hovered]) {
    tip = rows[hovered];
  }

  return (
    <figure className="chart">
      <figcaption>
        <strong>{title}</strong>
        {diverging && (
          <span className="chart-legend">
            <span>
              <i className="swatch" style={{ background: CHANGE.more }} /> More traffic
            </span>
            <span>
              <i className="swatch" style={{ background: CHANGE.less }} /> Less traffic
            </span>
          </span>
        )}
      </figcaption>
      <div ref={ref} className="chart-body">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={title + ". The same numbers are in the street table."}
        >
          <line x1={zero} x2={zero} y1={0} y2={height} className="chart-zero" />
          {rows.map(function (row, index) {
            const top = index * (BAR_HEIGHT + GAP) + 4;
            const length = Math.max(2, Math.abs(row.value) * pixelsPerUnit);
            const pointsRight = row.value >= 0;

            let colour: string = SERIES.run;
            if (diverging && pointsRight) {
              colour = CHANGE.more;
            } else if (diverging) {
              colour = CHANGE.less;
            }

            let labelX = zero - length - 6;
            let anchor: "start" | "end" = "end";
            if (pointsRight) {
              labelX = zero + length + 6;
              anchor = "start";
            }

            let opacity = 1;
            if (hovered !== null && hovered !== index) {
              opacity = 0.55;
            }

            return (
              <g
                key={row.label}
                opacity={opacity}
                onPointerEnter={function () {
                  setHovered(index);
                }}
                onPointerLeave={function () {
                  setHovered(null);
                }}
              >
                <rect x={0} y={top - GAP / 2} width={width} height={BAR_HEIGHT + GAP} fill="transparent" />
                <text
                  x={labelWidth - 8}
                  y={top + BAR_HEIGHT / 2}
                  className="chart-cat"
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {shortName(row.label)}
                </text>
                <path d={barPath(zero, top, length, BAR_HEIGHT, pointsRight)} fill={colour} />
                <text
                  x={labelX}
                  y={top + BAR_HEIGHT / 2}
                  className="chart-value"
                  textAnchor={anchor}
                  dominantBaseline="middle"
                >
                  {valueText(row.value)}
                </text>
              </g>
            );
          })}
        </svg>

        {tip && hovered !== null && (
          <div
            className="chart-tip"
            style={{
              left: Math.min(zero + 10, width - 190),
              top: hovered * (BAR_HEIGHT + GAP) + BAR_HEIGHT + 10,
            }}
            aria-hidden="true"
          >
            <small>{tip.label}</small>
            <span>
              <b>
                {valueText(tip.value)} {unit}
              </b>
            </span>
            <span>{tip.detail}</span>
          </div>
        )}
      </div>
    </figure>
  );
}

/**
 * A line chart of a value over time, for this run and the baseline.
 *
 * One axis, a key, labels at the line ends, and a readout that follows the
 * mouse. Every value is also in the results table.
 */

import { useState } from "react";
import { oneDp, twoDp } from "../../../lib/format";
import { SERIES, type SeriesKey } from "./colours";
import { niceTicks } from "./ticks";
import { useWidth } from "./useWidth";

export interface ChartPoint {
  x: number;
  /** null leaves a gap in the line. */
  y: number | null;
}

export interface ChartLine {
  key: SeriesKey;
  label: string;
  points: ChartPoint[];
}

interface LineChartProps {
  title: string;
  unit: string;
  lines: ChartLine[];
  xLabel?: string;
}

const HEIGHT = 230;
const MARGIN = { top: 26, right: 78, bottom: 38, left: 46 };

/** The last point of a line that has a value. */
function lastPoint(points: ChartPoint[]): { x: number; y: number } | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const point = points[i];
    if (point.y !== null) {
      return { x: point.x, y: point.y };
    }
  }
  return null;
}

export default function LineChart({ title, unit, lines, xLabel }: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hoverX, setHoverX] = useState<number | null>(null);
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  let xMax = 1;
  let yHighest = 0;
  lines.forEach(function (line) {
    line.points.forEach(function (point) {
      xMax = Math.max(xMax, point.x);
      if (point.y !== null) {
        yHighest = Math.max(yHighest, point.y);
      }
    });
  });
  const yTicks = niceTicks(yHighest);
  const yMax = yTicks[yTicks.length - 1] || 1;
  const xTicks = niceTicks(xMax, Math.max(2, Math.floor(width / 110))).filter(function (tick) {
    return tick <= xMax + 1e-9;
  });

  function screenX(x: number): number {
    return MARGIN.left + (x / xMax) * plotWidth;
  }

  function screenY(y: number): number {
    return MARGIN.top + plotHeight - (y / yMax) * plotHeight;
  }

  function linePath(points: ChartPoint[]): string {
    let path = "";
    let penDown = false;
    points.forEach(function (point) {
      if (point.y === null) {
        penDown = false;
        return;
      }
      let command = "M";
      if (penDown) {
        command = "L";
      }
      path = path + command + screenX(point.x).toFixed(1) + "," + screenY(point.y).toFixed(1);
      penDown = true;
    });
    return path;
  }

  /** The point of a line closest to minute `x`, if one is near enough. */
  function pointNear(points: ChartPoint[], x: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    points.forEach(function (point) {
      if (point.y === null) {
        return;
      }
      if (best === null || Math.abs(point.x - x) < Math.abs(best.x - x)) {
        best = { x: point.x, y: point.y };
      }
    });
    const found = best as { x: number; y: number } | null;
    if (found && Math.abs(found.x - x) <= xMax / 40 + 0.25) {
      return found;
    }
    return null;
  }

  const lineEnds = lines.map(function (line) {
    const last = lastPoint(line.points);
    if (!last) {
      return null;
    }
    return { key: line.key, label: line.label, x: screenX(last.x), y: screenY(last.y) };
  });

  // When the two lines end close together, their labels would overlap; the key is enough.
  let labelsOverlap = false;
  const firstEnd = lineEnds[0];
  const secondEnd = lineEnds[1];
  if (lineEnds.length === 2 && firstEnd && secondEnd) {
    labelsOverlap = Math.abs(firstEnd.y - secondEnd.y) < 14;
  }

  let readout: { key: SeriesKey; label: string; point: { x: number; y: number } | null }[] | null = null;
  if (hoverX !== null) {
    const minute = hoverX;
    readout = lines.map(function (line) {
      return { key: line.key, label: line.label, point: pointNear(line.points, minute) };
    });
  }

  const names = lines
    .map(function (line) {
      return line.label;
    })
    .join(" and ");

  return (
    <figure className="chart">
      <figcaption>
        <strong>{title}</strong>
        {lines.length > 1 && (
          <span className="chart-legend">
            {lines.map(function (line) {
              return (
                <span key={line.key}>
                  <i style={{ background: SERIES[line.key] }} /> {line.label}
                </span>
              );
            })}
          </span>
        )}
      </figcaption>
      <div ref={ref} className="chart-body">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={title + ". " + names + ". The same numbers are in the results table."}
          onPointerMove={function (event) {
            const box = event.currentTarget.getBoundingClientRect();
            const minute = ((event.clientX - box.left - MARGIN.left) / plotWidth) * xMax;
            if (minute >= 0 && minute <= xMax) {
              setHoverX(minute);
            } else {
              setHoverX(null);
            }
          }}
          onPointerLeave={function () {
            setHoverX(null);
          }}
        >
          {yTicks.map(function (tick) {
            return (
              <g key={tick}>
                <line
                  x1={MARGIN.left}
                  x2={MARGIN.left + plotWidth}
                  y1={screenY(tick)}
                  y2={screenY(tick)}
                  className="chart-gridline"
                />
                <text
                  x={MARGIN.left - 8}
                  y={screenY(tick)}
                  className="chart-tick"
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {twoDp(tick)}
                </text>
              </g>
            );
          })}
          {xTicks.map(function (tick) {
            return (
              <text
                key={tick}
                x={screenX(tick)}
                y={MARGIN.top + plotHeight + 16}
                className="chart-tick"
                textAnchor="middle"
              >
                {twoDp(tick)}
              </text>
            );
          })}
          <text
            x={MARGIN.left + plotWidth / 2}
            y={HEIGHT - 4}
            className="chart-axis-label"
            textAnchor="middle"
          >
            {xLabel || "Minutes of traffic"}
          </text>
          <text x={0} y={12} className="chart-axis-label">
            {unit}
          </text>

          {lines.map(function (line) {
            return (
              <path
                key={line.key}
                d={linePath(line.points)}
                fill="none"
                stroke={SERIES[line.key]}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

          {lineEnds.map(function (end) {
            if (!end) {
              return null;
            }
            return (
              <g key={end.key}>
                <circle cx={end.x} cy={end.y} r={4} fill={SERIES[end.key]} stroke="#ffffff" strokeWidth={2} />
                {!labelsOverlap && (
                  <text x={end.x + 8} y={end.y} className="chart-end" dominantBaseline="middle">
                    {end.label}
                  </text>
                )}
              </g>
            );
          })}

          {hoverX !== null && (
            <line
              x1={screenX(hoverX)}
              x2={screenX(hoverX)}
              y1={MARGIN.top}
              y2={MARGIN.top + plotHeight}
              className="chart-crosshair"
            />
          )}
          {readout &&
            readout.map(function (row) {
              if (!row.point) {
                return null;
              }
              return (
                <circle
                  key={row.key}
                  cx={screenX(row.point.x)}
                  cy={screenY(row.point.y)}
                  r={4}
                  fill={SERIES[row.key]}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              );
            })}
        </svg>

        {readout && hoverX !== null && (
          <div
            className="chart-tip"
            style={{ left: Math.min(screenX(hoverX) + 12, width - 170), top: MARGIN.top }}
            aria-hidden="true"
          >
            <small>Minute {oneDp(hoverX)}</small>
            {readout.map(function (row) {
              let value = "—";
              if (row.point) {
                value = oneDp(row.point.y) + " " + unit;
              }
              return (
                <span key={row.key}>
                  <i style={{ background: SERIES[row.key] }} />
                  <b>{value}</b> {row.label}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </figure>
  );
}

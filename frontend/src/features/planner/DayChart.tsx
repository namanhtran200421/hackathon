/**
 * "Best and worst times": the extra delay the works would cause at each time
 * of day, as a line (the average of the repeats) inside a band (lowest to
 * highest repeat). The recommended closure is shaded yellow, and times the
 * limits rule out are greyed. Every number is also in the table below it.
 */

import { useState } from "react";
import { DAY_SERIES } from "../results/charts/colours";
import { niceTicks } from "../results/charts/ticks";
import { useWidth } from "../results/charts/useWidth";
import { oneDp } from "../../lib/format";
import type { QuarterBand } from "./delayCurve";
import { DAY_STARTS, NIGHT_STARTS } from "./plans";
import type { AllowedTimes, DayType, Plan } from "./types";
import { carHours, dayWord, rangeText, timeOfDay } from "./wording";

export interface DaySeries {
  dayType: DayType;
  bands: QuarterBand[];
}

interface DayChartProps {
  series: DaySeries[];
  /** The plan to shade, if any. */
  plan: Plan | null;
  times: AllowedTimes;
}

const HEIGHT = 260;
const MARGIN = { top: 24, right: 20, bottom: 40, left: 46 };

/** Hour ranges, [from, to), that the limits rule out. */
function ruledOut(times: AllowedTimes): [number, number][] {
  if (times === "night") {
    return [[DAY_STARTS, NIGHT_STARTS]];
  }
  if (times === "day") {
    return [
      [0, DAY_STARTS],
      [NIGHT_STARTS, 24],
    ];
  }
  return [];
}

/** A closure's hours on a 0 to 24 axis, split in two if it runs past midnight. */
function closedSpans(plan: Plan): [number, number][] {
  const end = plan.start + plan.closedPerShift;
  if (end <= 24) {
    return [[plan.start, end]];
  }
  return [
    [plan.start, 24],
    [0, end - 24],
  ];
}

function seriesName(dayType: DayType): string {
  if (dayType === "weekend") {
    return "Weekends";
  }
  return "Weekdays";
}

export default function DayChart({ series, plan, times }: DayChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hoverQuarter, setHoverQuarter] = useState<number | null>(null);
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  let highest = 0;
  series.forEach(function (line) {
    line.bands.forEach(function (band) {
      highest = Math.max(highest, band.high);
    });
  });
  const yTicks = niceTicks(highest);
  const yMax = yTicks[yTicks.length - 1] || 1;
  let hourStep = 3;
  if (width < 520) {
    hourStep = 6;
  }
  const xTicks: number[] = [];
  for (let hour = 0; hour <= 24; hour += hourStep) {
    xTicks.push(hour);
  }

  function screenX(hour: number): number {
    return MARGIN.left + (hour / 24) * plotWidth;
  }

  function screenY(value: number): number {
    return MARGIN.top + plotHeight - (value / yMax) * plotHeight;
  }

  /** Points at the start of every quarter hour, and midnight again at the end. */
  function points(bands: QuarterBand[], pick: (band: QuarterBand) => number): [number, number][] {
    const list: [number, number][] = bands.map(function (band): [number, number] {
      return [screenX(band.quarter / 4), screenY(pick(band))];
    });
    if (bands.length > 0) {
      list.push([screenX(24), screenY(pick(bands[0]))]);
    }
    return list;
  }

  function path(list: [number, number][]): string {
    return list
      .map(function (point, index) {
        let command = "L";
        if (index === 0) {
          command = "M";
        }
        return command + point[0].toFixed(1) + "," + point[1].toFixed(1);
      })
      .join("");
  }

  function bandPath(bands: QuarterBand[]): string {
    const top = points(bands, function (band) {
      return band.high;
    });
    const bottom = points(bands, function (band) {
      return band.low;
    }).reverse();
    return path(top.concat(bottom)) + "Z";
  }

  let hoverX: number | null = null;
  if (hoverQuarter !== null) {
    hoverX = screenX(hoverQuarter / 4);
  }

  let label = "Extra delay caused by the works at each time of day";
  if (plan) {
    label = label + ". The recommended closure is shaded";
  }
  label = label + ". The same numbers are in the table below.";

  return (
    <figure className="chart day-chart">
      <figcaption>
        <strong>Best and worst times to close the road</strong>
        <span className="chart-legend">
          {series.map(function (line) {
            return (
              <span key={line.dayType}>
                <i style={{ background: DAY_SERIES[line.dayType] }} /> {seriesName(line.dayType)}
              </span>
            );
          })}
          {plan && (
            <span>
              <i className="swatch recommended-swatch" /> Recommended
            </span>
          )}
        </span>
      </figcaption>
      <div ref={ref} className="chart-body">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={label}
          onPointerMove={function (event) {
            const box = event.currentTarget.getBoundingClientRect();
            const hour = ((event.clientX - box.left - MARGIN.left) / plotWidth) * 24;
            if (hour >= 0 && hour < 24) {
              setHoverQuarter(Math.floor(hour * 4));
            } else {
              setHoverQuarter(null);
            }
          }}
          onPointerLeave={function () {
            setHoverQuarter(null);
          }}
        >
          {ruledOut(times).map(function (span) {
            return (
              <g key={"out" + span[0]}>
                <rect
                  x={screenX(span[0])}
                  y={MARGIN.top}
                  width={screenX(span[1]) - screenX(span[0])}
                  height={plotHeight}
                  className="chart-ruled-out"
                />
                <text x={screenX(span[0]) + 6} y={MARGIN.top + 14} className="chart-tick">
                  Not allowed
                </text>
              </g>
            );
          })}
          {plan &&
            closedSpans(plan).map(function (span) {
              return (
                <rect
                  key={"plan" + span[0]}
                  x={screenX(span[0])}
                  y={MARGIN.top}
                  width={screenX(span[1]) - screenX(span[0])}
                  height={plotHeight}
                  className="chart-recommended"
                />
              );
            })}

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
                  {oneDp(tick)}
                </text>
              </g>
            );
          })}
          {xTicks.map(function (hour) {
            return (
              <text
                key={hour}
                x={screenX(hour)}
                y={MARGIN.top + plotHeight + 16}
                className="chart-tick"
                textAnchor="middle"
              >
                {timeOfDay(hour)}
              </text>
            );
          })}
          <text x={0} y={12} className="chart-axis-label">
            extra car-hours per hour
          </text>
          <text
            x={MARGIN.left + plotWidth / 2}
            y={HEIGHT - 4}
            className="chart-axis-label"
            textAnchor="middle"
          >
            Time the road is closed
          </text>

          {series.map(function (line) {
            return (
              <g key={line.dayType}>
                <path d={bandPath(line.bands)} fill={DAY_SERIES[line.dayType]} opacity={0.14} />
                <path
                  d={path(
                    points(line.bands, function (band) {
                      return band.typical;
                    }),
                  )}
                  fill="none"
                  stroke={DAY_SERIES[line.dayType]}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              </g>
            );
          })}

          {hoverX !== null && hoverQuarter !== null && (
            <g>
              <line
                x1={hoverX}
                x2={hoverX}
                y1={MARGIN.top}
                y2={MARGIN.top + plotHeight}
                className="chart-crosshair"
              />
              {series.map(function (line) {
                const band = line.bands[hoverQuarter];
                if (!band) {
                  return null;
                }
                return (
                  <circle
                    key={line.dayType}
                    cx={hoverX}
                    cy={screenY(band.typical)}
                    r={4}
                    fill={DAY_SERIES[line.dayType]}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                );
              })}
            </g>
          )}
        </svg>

        {hoverX !== null && hoverQuarter !== null && (
          <div
            className="chart-tip"
            style={{ left: Math.min(hoverX + 12, width - 190), top: MARGIN.top }}
            aria-hidden="true"
          >
            <small>
              Closed from {timeOfDay(hoverQuarter / 4)} to {timeOfDay(hoverQuarter / 4 + 0.25)}
            </small>
            {series.map(function (line) {
              const band = line.bands[hoverQuarter];
              if (!band) {
                return null;
              }
              return (
                <span key={line.dayType}>
                  <i style={{ background: DAY_SERIES[line.dayType] }} />
                  <b>{carHours(band.typical)}</b> {dayWord(line.dayType)} ({rangeText(band.low, band.high)})
                </span>
              );
            })}
          </div>
        )}
      </div>
      <p className="help chart-note">
        The line is the average of the repeats; the band runs from the lowest to the highest. Higher means
        more extra time stuck in traffic for every hour the road is closed.
      </p>
      <DayTable series={series} />
    </figure>
  );
}

/** The chart's numbers by hour, for anyone who cannot use the chart. */
function DayTable({ series }: { series: DaySeries[] }) {
  const hours: number[] = [];
  for (let hour = 0; hour < 24; hour++) {
    hours.push(hour);
  }

  function hourly(bands: QuarterBand[], hour: number, pick: (band: QuarterBand) => number): number {
    let total = 0;
    for (let i = 0; i < 4; i++) {
      total = total + pick(bands[hour * 4 + i]);
    }
    return total / 4;
  }

  return (
    <details className="chart-table">
      <summary>Show the numbers by hour</summary>
      <div className="table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col">Road closed</th>
              {series.map(function (line) {
                return (
                  <th key={line.dayType} scope="col">
                    {seriesName(line.dayType)}: extra car-hours per hour (range)
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {hours.map(function (hour) {
              return (
                <tr key={hour}>
                  <th scope="row">
                    {timeOfDay(hour)} to {timeOfDay(hour + 1)}
                  </th>
                  {series.map(function (line) {
                    const typical = hourly(line.bands, hour, function (band) {
                      return band.typical;
                    });
                    const low = hourly(line.bands, hour, function (band) {
                      return band.low;
                    });
                    const high = hourly(line.bands, hour, function (band) {
                      return band.high;
                    });
                    return (
                      <td key={line.dayType}>
                        {carHours(typical)} ({rangeText(low, high)})
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

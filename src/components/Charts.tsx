"use client";
import { useEffect, useRef, useState } from "react";

/** Series colours, validated with the dataviz palette checker (light surface). */
export const SERIES = { run: "#4a3aa7", baseline: "#008300" } as const;
export const CHANGE = { more: "#c25e00", less: "#1f66c2" } as const;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(260, Math.round(entry.contentRect.width))),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceTicks(max: number, count = 4) {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step)
    ticks.push(Number(v.toFixed(6)));
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

const fmt = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 });

export type Line = {
  key: keyof typeof SERIES;
  label: string;
  points: { x: number; y: number | null }[];
};

/** Line chart with one y-axis, a legend, end labels and a crosshair tooltip. */
export function LineChart({
  title,
  unit,
  lines,
  xLabel = "Simulated minutes",
}: {
  title: string;
  unit: string;
  lines: Line[];
  xLabel?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 230;
  const m = { top: 26, right: 78, bottom: 38, left: 46 };
  const all = lines.flatMap((l) => l.points);
  const xMax = Math.max(1, ...all.map((p) => p.x));
  const yTicks = niceTicks(Math.max(0, ...all.map((p) => p.y ?? 0)));
  const yMax = yTicks[yTicks.length - 1] || 1;
  const xTop = xMax;
  const xTicks = niceTicks(xMax, Math.max(2, Math.floor(width / 110))).filter(
    (t) => t <= xMax + 1e-9,
  );
  const w = width - m.left - m.right,
    h = height - m.top - m.bottom;
  const sx = (x: number) => m.left + (x / xTop) * w;
  const sy = (y: number) => m.top + h - (y / yMax) * h;
  const path = (points: Line["points"]) => {
    let d = "";
    let pen = false;
    for (const p of points) {
      if (p.y === null) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const nearest = (points: Line["points"], x: number) => {
    let best: Line["points"][number] | null = null;
    for (const p of points)
      if (p.y !== null && (!best || Math.abs(p.x - x) < Math.abs(best.x - x)))
        best = p;
    return best && Math.abs(best.x - x) <= xTop / 40 + 0.25 ? best : null;
  };
  const ends = lines.map((l) => {
    const last = [...l.points].reverse().find((p) => p.y !== null);
    return last
      ? { key: l.key, label: l.label, y: sy(last.y!), x: sx(last.x) }
      : null;
  });
  const endsCollide =
    ends.length === 2 &&
    ends[0] &&
    ends[1] &&
    Math.abs(ends[0].y - ends[1].y) < 14;
  const readout =
    hover === null
      ? null
      : lines.map((l) => ({ ...l, point: nearest(l.points, hover) }));

  return (
    <figure className="chart">
      <figcaption>
        <strong>{title}</strong>
        {lines.length > 1 && (
          <span className="chart-legend">
            {lines.map((l) => (
              <span key={l.key}>
                <i style={{ background: SERIES[l.key] }} /> {l.label}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div ref={ref} className="chart-body">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${title}. ${lines.map((l) => l.label).join(" and ")}. The same values are in the results tables.`}
          onPointerMove={(e) => {
            const box = (
              e.currentTarget as SVGSVGElement
            ).getBoundingClientRect();
            const x = ((e.clientX - box.left - m.left) / w) * xTop;
            setHover(x >= 0 && x <= xTop ? x : null);
          }}
          onPointerLeave={() => setHover(null)}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={m.left}
                x2={m.left + w}
                y1={sy(t)}
                y2={sy(t)}
                className="chart-gridline"
              />
              <text
                x={m.left - 8}
                y={sy(t)}
                className="chart-tick"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {fmt.format(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text
              key={t}
              x={sx(t)}
              y={m.top + h + 16}
              className="chart-tick"
              textAnchor="middle"
            >
              {fmt.format(t)}
            </text>
          ))}
          <text
            x={m.left + w / 2}
            y={height - 4}
            className="chart-axis-label"
            textAnchor="middle"
          >
            {xLabel}
          </text>
          <text x={0} y={12} className="chart-axis-label">
            {unit}
          </text>
          {lines.map((l) => (
            <path
              key={l.key}
              d={path(l.points)}
              fill="none"
              stroke={SERIES[l.key]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {ends.map(
            (e) =>
              e && (
                <g key={e.key}>
                  <circle
                    cx={e.x}
                    cy={e.y}
                    r={4}
                    fill={SERIES[e.key]}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                  {!endsCollide && (
                    <text
                      x={e.x + 8}
                      y={e.y}
                      className="chart-end"
                      dominantBaseline="middle"
                    >
                      {e.label}
                    </text>
                  )}
                </g>
              ),
          )}
          {hover !== null && (
            <line
              x1={sx(hover)}
              x2={sx(hover)}
              y1={m.top}
              y2={m.top + h}
              className="chart-crosshair"
            />
          )}
          {readout?.map(
            (r) =>
              r.point && (
                <circle
                  key={r.key}
                  cx={sx(r.point.x)}
                  cy={sy(r.point.y!)}
                  r={4}
                  fill={SERIES[r.key]}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              ),
          )}
        </svg>
        {readout && hover !== null && (
          <div
            className="chart-tip"
            style={{ left: Math.min(sx(hover) + 12, width - 170), top: m.top }}
            aria-hidden="true"
          >
            <small>{fmt.format(hover)} min</small>
            {readout.map((r) => (
              <span key={r.key}>
                <i style={{ background: SERIES[r.key] }} />
                <b>
                  {r.point ? `${fmt.format(r.point.y!)} ${unit}` : "—"}
                </b>{" "}
                {r.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

/** Horizontal bars from a zero line: diverging (change) or single series (flow). */
export function Bars({
  title,
  rows,
  diverging,
  unit,
}: {
  title: string;
  rows: { label: string; value: number; detail: string }[];
  diverging: boolean;
  unit: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const bar = 18,
    gap = 10,
    labelW = Math.min(150, width * 0.3),
    valueW = width < 520 ? 46 : 70;
  const height = rows.length * (bar + gap) + 8;
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  const plotW = width - labelW - valueW * (diverging ? 2 : 1);
  const zero = diverging ? labelW + valueW + plotW / 2 : labelW;
  const scale = (diverging ? plotW / 2 : plotW) / max;
  return (
    <figure className="chart">
      <figcaption>
        <strong>{title}</strong>
        {diverging && (
          <span className="chart-legend">
            <span>
              <i className="swatch" style={{ background: CHANGE.more }} /> More
              traffic
            </span>
            <span>
              <i className="swatch" style={{ background: CHANGE.less }} /> Less
              traffic
            </span>
          </span>
        )}
      </figcaption>
      <div ref={ref} className="chart-body">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${title}. The same values are in the street table.`}
        >
          <line x1={zero} x2={zero} y1={0} y2={height} className="chart-zero" />
          {rows.map((r, i) => {
            const y = i * (bar + gap) + 4;
            const len = Math.max(2, Math.abs(r.value) * scale);
            const positive = r.value >= 0;
            const x = positive ? zero : zero - len;
            const colour = diverging
              ? positive
                ? CHANGE.more
                : CHANGE.less
              : SERIES.run;
            const rad = Math.min(4, len / 2);
            // Square at the zero line, 4px rounded at the data end.
            const d = positive
              ? `M${x},${y}h${len - rad}a${rad},${rad} 0 0 1 ${rad},${rad}v${bar - 2 * rad}a${rad},${rad} 0 0 1 -${rad},${rad}h-${len - rad}z`
              : `M${x + len},${y}h-${len - rad}a${rad},${rad} 0 0 0 -${rad},${rad}v${bar - 2 * rad}a${rad},${rad} 0 0 0 ${rad},${rad}h${len - rad}z`;
            const text = `${positive && diverging ? "+" : r.value < 0 ? "−" : ""}${fmt.format(Math.abs(r.value))}`;
            return (
              <g
                key={r.label}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                opacity={hover === null || hover === i ? 1 : 0.55}
              >
                <rect
                  x={0}
                  y={y - gap / 2}
                  width={width}
                  height={bar + gap}
                  fill="transparent"
                />
                <text
                  x={labelW - 8}
                  y={y + bar / 2}
                  className="chart-cat"
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {r.label.length > 22 ? `${r.label.slice(0, 21)}…` : r.label}
                </text>
                <path d={d} fill={colour} />
                <text
                  x={positive ? x + len + 6 : x - 6}
                  y={y + bar / 2}
                  className="chart-value"
                  textAnchor={positive ? "start" : "end"}
                  dominantBaseline="middle"
                >
                  {text}
                </text>
              </g>
            );
          })}
        </svg>
        {hover !== null && rows[hover] && (
          <div
            className="chart-tip"
            style={{
              left: Math.min(zero + 10, width - 190),
              top: hover * (bar + gap) + bar + 10,
            }}
            aria-hidden="true"
          >
            <small>{rows[hover].label}</small>
            <span>
              <b>
                {rows[hover].value > 0 && diverging ? "+" : ""}
                {fmt.format(rows[hover].value)} {unit}
              </b>
            </span>
            <span>{rows[hover].detail}</span>
          </div>
        )}
      </div>
    </figure>
  );
}

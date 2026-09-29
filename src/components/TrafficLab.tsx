"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  BookOpen,
  Check,
  FlaskConical,
  Footprints,
  Map as MapIcon,
  MousePointerClick,
  Pause,
  Play,
  RotateCcw,
  Route,
  TerminalSquare,
  X,
} from "lucide-react";
import TrafficMap from "./TrafficMap";
import QuickGuide from "./QuickGuide";
import { Choice, Slider, Toggle } from "./Fields";
import { useTrafficSim } from "@/lib/useTrafficSim";
import { CHOICES, SPEEDS } from "@/lib/controls.mjs";
import { STYLE, type Metrics, type SettingName, type World } from "@/lib/types";

const number = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    r = s % 60;
  const mm = `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
  return h ? `${h}:${mm}` : mm;
}
const speedLabel = (v: number) => (v === 0 ? "Max" : `${v}×`);

type Selection = { street: string; block: number };

function closedStreets(world: World | null, styles: Float32Array | null) {
  if (!world || !styles || styles.length !== world.roads.length * STYLE.fields)
    return [];
  const streets = new Map<string, { closed: number; reduced: number }>();
  for (const r of world.roads) {
    if (!r.carsAllowed || r.kind === "gate" || r.kind === "access") continue;
    const o = r.index * STYLE.fields;
    const closed = styles[o + STYLE.closed] === 1;
    const reduced = !closed && styles[o + STYLE.lanesOpen] < r.lanes;
    if (!closed && !reduced) continue;
    const entry = streets.get(r.street) ?? { closed: 0, reduced: 0 };
    if (closed) entry.closed++;
    else entry.reduced++;
    streets.set(r.street, entry);
  }
  return [...streets.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function phaseText(m: Metrics | null, forever: boolean) {
  if (!m) return "";
  if (m.ticks < m.warmUp) return `Warm-up · ${clock(m.warmUp - m.ticks)} left`;
  if (forever) return "Measuring until you pause";
  if (m.finished || m.ticks >= m.warmUp + m.measure)
    return "Measurement window complete";
  return `Measuring · ${clock(m.warmUp + m.measure - m.ticks)} left`;
}

export default function TrafficLab() {
  const sim = useTrafficSim();
  const { settings, metrics: m, world, running, phase } = sim;
  const [guideOpen, setGuideOpen] = useState(false);
  const [clickMode, setClickMode] = useState(false);
  const [pending, setPending] = useState<Selection | null>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const ready = phase === "ready";
  const settingUp = phase === "setting-up";

  const modelSelection: Selection = m
    ? { street: m.selectedStreet, block: m.selectedBlock }
    : { street: "Collins St", block: 0 };
  const selection = pending ?? modelSelection;
  useEffect(() => {
    if (
      pending &&
      m &&
      m.selectedStreet === pending.street &&
      m.selectedBlock === pending.block
    )
      setPending(null);
  }, [m, pending]);
  useEffect(() => {
    if (sim.error) setPending(null);
  }, [sim.error]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [sim.output]);

  const choose = (street: string, block: number) => {
    setPending({ street, block });
    sim.select(street, block);
  };
  const set =
    <K extends SettingName>(name: K) =>
    (value: (typeof settings)[K]) =>
      sim.set(name, value);

  const streets = world?.streets ?? [];
  const sections = world
    ? [
        ...new Set(
          world.roads
            .filter(
              (r) =>
                r.street === selection.street &&
                r.kind !== "gate" &&
                r.kind !== "access",
            )
            .map((r) => r.section),
        ),
      ]
        .filter((n) => n > 0)
        .sort((a, b) => a - b)
    : [];
  const closures = closedStreets(world, sim.store.current?.styles ?? null);
  const view = settings["view-mode"];
  const total = m ? m.warmUp + m.measure : 0;
  const progress =
    m && !sim.forever && total > 0 ? Math.min(1, m.ticks / total) : 0;
  const statusLabel =
    phase === "loading"
      ? "Loading engine"
      : settingUp
        ? "Setting up"
        : running
          ? `Running · ${speedLabel(sim.speed)}`
          : m?.finished && !sim.forever
            ? "Window complete"
            : "Paused";
  const description = `Melbourne traffic map, ${view} view. ${m ? `${whole.format(m.cars)} cars on the network at ${clock(m.ticks)}.` : ""} ${m && m.closureDesc !== "none" ? `Closures: ${m.closureDesc}.` : "All roads open."} Use the Street list to select roads with a keyboard.`;

  const baseline = m?.baseline ?? null;
  const rows: [string, number | null, number | null, (v: number) => string][] =
    m
      ? [
          [
            "Completed trips",
            baseline?.completed ?? null,
            m.completed,
            (v) => whole.format(v),
          ],
          [
            "Mean trip time",
            baseline && baseline.completed ? baseline.meanTrip : null,
            m.completed ? m.meanTrip : null,
            (v) => `${number.format(v)} min`,
          ],
          [
            "Waiting at gates",
            baseline?.waiting ?? null,
            m.waiting,
            (v) => whole.format(v),
          ],
          [
            "Stranded",
            baseline?.stranded ?? null,
            m.stranded,
            (v) => whole.format(v),
          ],
          [
            "Measured time",
            baseline?.measured ?? null,
            m.measured,
            (v) => clock(v),
          ],
        ]
      : [];

  async function download() {
    const text = await sim.exportCsv();
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "combined-link-results.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    sim.setStatus("Road results downloaded as combined-link-results.csv.");
  }

  return (
    <>
      <a className="skip-link" href="#workbench">
        Skip to simulation
      </a>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Melbourne Traffic Lab home">
          <span className="brand-mark">
            <Route size={24} />
          </span>
          <span>
            Melbourne<span className="brand-light"> / Traffic lab</span>
          </span>
        </a>
        <div className="header-meta">
          <span className="header-note">
            <span className="status-dot" /> NetLogo model · runs in your browser
          </span>
          <button
            className="button secondary"
            onClick={() => setGuideOpen(true)}
          >
            <BookOpen size={16} /> Quick guide
          </button>
        </div>
      </header>
      <main id="workbench">
        <div className="page-heading">
          <div>
            <p className="eyebrow">MELBOURNE CBD · SCENARIO WORKBENCH</p>
            <h1>A different route through the city.</h1>
            <p>Close a street. Follow the traffic. See what changes.</p>
          </div>
        </div>
        <div className="workbench">
          <aside className="controls panel" aria-label="Model controls">
            <div className="panel-heading">
              <h2>Model controls</h2>
              <FlaskConical size={19} />
            </div>

            <section className="group" aria-labelledby="group-scenario">
              <h3 id="group-scenario" className="group-title">
                Scenario
              </h3>
              <Choice
                id="network"
                label="Road network"
                value={settings["network-source"]}
                options={CHOICES["network-source"]}
                onChange={set("network-source")}
                setupOnly
                help={
                  world && settings["network-source"] !== world.network
                    ? "Press Setup to load this network."
                    : undefined
                }
              />
              <Slider
                name="demand-veh-per-hour"
                value={settings["demand-veh-per-hour"]}
                onChange={set("demand-veh-per-hour")}
              />
              <Slider
                name="through-traffic-%"
                value={settings["through-traffic-%"]}
                onChange={set("through-traffic-%")}
              />
              <Slider
                name="informed-drivers-%"
                value={settings["informed-drivers-%"]}
                onChange={set("informed-drivers-%")}
              />
              <Slider
                name="seed"
                value={settings.seed}
                onChange={set("seed")}
                setupOnly
                disabled={!settings["fixed-seed?"]}
              />
              <Toggle
                id="fixed-seed"
                label="Fixed seed"
                checked={settings["fixed-seed?"]}
                onChange={set("fixed-seed?")}
                setupOnly
                help="On: the same seed repeats the same run. Off: each Setup draws a new seed."
              />
            </section>

            <section className="group" aria-labelledby="group-closures">
              <div className="section-heading">
                <h3 id="group-closures" className="group-title">
                  Road closures
                </h3>
                <span className="count" title="Closed or reduced streets">
                  {closures.length}
                </span>
              </div>
              <div className="field">
                <label htmlFor="street">Street</label>
                <select
                  id="street"
                  value={
                    streets.includes(selection.street) ? selection.street : ""
                  }
                  disabled={!streets.length}
                  onChange={(e) => choose(e.target.value, 0)}
                >
                  {!streets.includes(selection.street) && (
                    <option value="">Choose a street</option>
                  )}
                  {streets.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="section">Extent</label>
                <select
                  id="section"
                  value={selection.block}
                  disabled={!streets.length}
                  onChange={(e) =>
                    choose(selection.street, Number(e.target.value))
                  }
                >
                  <option value={0}>Whole street</option>
                  {sections.map((n) => (
                    <option key={n} value={n}>
                      Section {n}
                    </option>
                  ))}
                </select>
              </div>
              <Choice
                id="closure-type"
                label="Closure type"
                value={settings["closure-type"]}
                options={CHOICES["closure-type"]}
                onChange={set("closure-type")}
              />
              <button
                className="button primary full apply"
                disabled={!ready}
                onClick={() => sim.command("close-selection")}
              >
                Apply closure
              </button>
              <div className="button-pair">
                <button
                  className="button secondary"
                  disabled={!ready}
                  onClick={() => sim.command("reopen-selection")}
                >
                  Reopen selected
                </button>
                <button
                  className="button secondary"
                  disabled={!ready}
                  onClick={() => sim.command("reopen-all")}
                >
                  Reopen all
                </button>
              </div>
              <button
                className={`button secondary full click-roads ${clickMode ? "on" : ""}`}
                aria-pressed={clickMode}
                disabled={!ready}
                onClick={() => setClickMode((on) => !on)}
              >
                <MousePointerClick size={16} /> Click roads{" "}
                {clickMode ? "· on" : "· off"}
              </button>
              <Toggle
                id="close-whole"
                label="Clicks close the whole street"
                checked={settings["close-whole-street?"]}
                onChange={set("close-whole-street?")}
                help="Off: a click closes only the clicked section."
              />
              <Toggle
                id="scheduled"
                label="Scheduled closure"
                checked={settings["scheduled-closure?"]}
                onChange={set("scheduled-closure?")}
                help="Applies the selected closure automatically, once, at the time below."
              />
              <Slider
                name="closure-start-min"
                value={settings["closure-start-min"]}
                onChange={set("closure-start-min")}
                disabled={!settings["scheduled-closure?"]}
                help={null}
              />
              <dl className="monitors-inline">
                <div>
                  <dt>Selected extent</dt>
                  <dd>{m?.selectionLabel ?? "—"}</dd>
                </div>
                <div>
                  <dt>Closures</dt>
                  <dd>{m?.closureDesc ?? "—"}</dd>
                </div>
              </dl>
              <div className="closure-list">
                {closures.length ? (
                  closures.map(([street, c]) => (
                    <div className="closure-item" key={street}>
                      <span>
                        <strong>{street}</strong>
                        <small>
                          {c.closed
                            ? `${c.closed} closed direction${c.closed > 1 ? "s" : ""}`
                            : ""}
                          {c.closed && c.reduced ? " · " : ""}
                          {c.reduced ? `${c.reduced} with a lane closed` : ""}
                        </small>
                      </span>
                      <button
                        className="icon-button"
                        aria-label={`Reopen ${street}`}
                        title="Reopen this street"
                        onClick={() => {
                          choose(street, 0);
                          sim.command("reopen-selection");
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="empty-closures">
                    <Check size={15} /> All roads open
                  </p>
                )}
              </div>
            </section>

            <details className="group advanced">
              <summary>Signals & driving</summary>
              <Slider
                name="speed-limit-kmh"
                value={settings["speed-limit-kmh"]}
                onChange={set("speed-limit-kmh")}
                setupOnly
              />
              <Slider
                name="cycle-length"
                value={settings["cycle-length"]}
                onChange={set("cycle-length")}
                setupOnly
              />
              <Slider
                name="ew-green-share"
                value={settings["ew-green-share"]}
                onChange={set("ew-green-share")}
                setupOnly
              />
              <Choice
                id="signal-coordination"
                label="Signal coordination"
                value={settings["signal-coordination"]}
                options={CHOICES["signal-coordination"]}
                onChange={set("signal-coordination")}
                setupOnly
              />
              <Toggle
                id="hook-turns"
                label="Hook turns"
                checked={settings["hook-turns?"]}
                onChange={set("hook-turns?")}
                help="A heuristic for the schematic grid. No real hook-turn locations are claimed."
              />
            </details>
            <details className="group advanced">
              <summary>Routing</summary>
              <Slider
                name="reroute-interval"
                value={settings["reroute-interval"]}
                onChange={set("reroute-interval")}
              />
              <Slider
                name="route-noise"
                value={settings["route-noise"]}
                onChange={set("route-noise")}
              />
            </details>
            <details className="group advanced">
              <summary>Measurement</summary>
              <Slider
                name="warm-up-s"
                value={settings["warm-up-s"]}
                onChange={set("warm-up-s")}
              />
              <Slider
                name="measure-s"
                value={settings["measure-s"]}
                onChange={set("measure-s")}
                disabled={sim.forever}
                display={sim.forever ? "Until paused" : undefined}
                help={
                  sim.forever
                    ? "Run forever is on, so the window stays open."
                    : undefined
                }
              />
            </details>
          </aside>

          <section className="results" aria-label="Simulation">
            <div className="map-panel panel">
              <div className="map-toolbar">
                <div>
                  <span
                    className={`status-dot ${running || settingUp || phase === "loading" ? "running" : ""}`}
                  />
                  <strong>{statusLabel}</strong>
                  <span className="map-subtitle">
                    {world?.network === "Schematic Hoddle grid"
                      ? "Schematic street grid"
                      : "OpenStreetMap geometry"}
                  </span>
                </div>
                <label className="map-mode" htmlFor="view">
                  View
                  <select
                    id="view"
                    value={view}
                    onChange={(e) => sim.set("view-mode", e.target.value)}
                  >
                    {CHOICES["view-mode"].map(([v, text]) => (
                      <option key={v} value={v}>
                        {text}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="map-stage" aria-busy={!ready}>
                <TrafficMap
                  store={sim.store}
                  worldVersion={world ? sim.store.current.worldVersion : 0}
                  selection={selection}
                  viewMode={view}
                  clickMode={clickMode}
                  closeWhole={settings["close-whole-street?"]}
                  hasBaseline={!!m?.hasBaseline}
                  description={description}
                  onSelect={choose}
                  onToggle={sim.click}
                />
                {!ready && (
                  <div className={`map-loading ${world ? "over" : ""}`}>
                    <span className="spinner" />{" "}
                    {phase === "error" ? "The engine stopped." : sim.status}
                  </div>
                )}
                {clickMode && ready && (
                  <div className="click-banner">
                    <MousePointerClick size={15} /> Click a road to close it.
                    Click again to reopen.
                    <button
                      className="button secondary"
                      onClick={() => setClickMode(false)}
                    >
                      Done
                    </button>
                  </div>
                )}
                <div className="map-location">
                  <MapIcon size={15} />
                  <span>
                    Melbourne CBD <small>37.814° S · 144.964° E</small>
                  </span>
                </div>
                <div className="map-legend" aria-label="Map legend">
                  {view === "congestion" && (
                    <>
                      <span>
                        <i className="lg-road" /> Free
                      </span>
                      <span>
                        <i className="lg-light" /> Light
                      </span>
                      <span>
                        <i className="lg-busy" /> Busy
                      </span>
                      <span>
                        <i className="lg-jam" /> Jammed
                      </span>
                    </>
                  )}
                  {view === "volume" && (
                    <span>
                      Fewer <i className="lg-volume" /> More veh/h
                    </span>
                  )}
                  {view === "change vs baseline" &&
                    (m?.hasBaseline ? (
                      <>
                        <span>
                          <i className="lg-more" /> More traffic
                        </span>
                        <span>
                          <i className="lg-less" /> Less traffic
                        </span>
                        <span>
                          <i className="lg-road" /> Similar
                        </span>
                      </>
                    ) : (
                      <span>Save a baseline to see changes</span>
                    ))}
                  <span>
                    <i className="lg-closed" /> Closed
                  </span>
                  <span>
                    <i className="lg-reduced" /> Lane closed
                  </span>
                  <span className="legend-break">
                    <b className="lg-car" /> Moving
                  </span>
                  <span>
                    <b className="lg-slow" /> Slow
                  </span>
                  <span>
                    <b className="lg-stopped" /> Stopped
                  </span>
                  <span>
                    <b className="lg-dest" /> Destination
                  </span>
                </div>
                <a
                  className="attribution"
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noreferrer"
                >
                  © OpenStreetMap contributors
                </a>
              </div>
              <div className="run-bar">
                <div className="run-buttons">
                  <button
                    className={`button secondary setup-button ${sim.setupNeeded ? "needed" : ""}`}
                    disabled={!ready}
                    onClick={sim.setup}
                    title={
                      sim.setupNeeded
                        ? "Some settings take effect after Setup"
                        : "Rebuild the network and restart the run"
                    }
                  >
                    <RotateCcw size={16} /> Setup
                    {sim.setupNeeded && (
                      <span
                        className="needed-dot"
                        aria-label="(changes waiting)"
                      />
                    )}
                  </button>
                  <button
                    className="button primary go-button"
                    disabled={!ready}
                    aria-pressed={running}
                    onClick={() => sim.run(!running)}
                  >
                    {running ? (
                      <Pause size={17} fill="currentColor" />
                    ) : (
                      <Play size={17} fill="currentColor" />
                    )}
                    {running ? "Pause" : "Go"}
                  </button>
                  <button
                    className="button secondary"
                    disabled={!ready}
                    onClick={sim.step}
                  >
                    <Footprints size={16} /> Step 1 s
                  </button>
                </div>
                <div className="speed">
                  <div className="label-row">
                    <label htmlFor="speed">Simulation speed</label>
                    <span className="value">{speedLabel(sim.speed)}</span>
                  </div>
                  <input
                    id="speed"
                    type="range"
                    min={0}
                    max={SPEEDS.length - 1}
                    step={1}
                    value={SPEEDS.indexOf(sim.speed)}
                    aria-valuetext={
                      sim.speed === 0
                        ? "As fast as possible"
                        : `${sim.speed} simulated seconds per second`
                    }
                    onChange={(e) =>
                      sim.setSpeed(SPEEDS[Number(e.target.value)])
                    }
                  />
                </div>
                <Toggle
                  id="forever"
                  label="Run forever"
                  checked={sim.forever}
                  onChange={sim.setForever}
                />
                <div className="clock">
                  <span className="time">{clock(m?.ticks ?? 0)}</span>
                  <small>{phaseText(m, sim.forever)}</small>
                  {!sim.forever && (
                    <div
                      className="progress"
                      role="progressbar"
                      aria-label="Measurement progress"
                      aria-valuemin={0}
                      aria-valuemax={total}
                      aria-valuenow={Math.min(total, m?.ticks ?? 0)}
                    >
                      <span style={{ width: `${progress * 100}%` }} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="metrics">
              {(
                [
                  ["Cars", m?.cars, "On the network now"],
                  ["Waiting at gates", m?.waiting, "Queued to enter the CBD"],
                  ["Completed", m?.completed, "Trips finished while measuring"],
                  [
                    "Mean trip",
                    m?.completed ? `${number.format(m.meanTrip)} min` : "—",
                    m?.completed
                      ? "Measured trips only"
                      : "Waiting for finished trips",
                  ],
                  ["Stranded", m?.stranded, "Trips with no viable route"],
                  [
                    "Elapsed",
                    m ? clock(m.ticks) : undefined,
                    m
                      ? `${whole.format(m.ticks)} simulated seconds`
                      : "Simulated time",
                  ],
                  [
                    "Mean delay",
                    m?.completed ? `${number.format(m.meanDelay)} min` : "—",
                    "Compared with free flow",
                  ],
                  [
                    "Vehicle-hours",
                    m ? number.format(m.vehicleHours) : undefined,
                    "Time spent in the network",
                  ],
                ] as [string, number | string | undefined, string][]
              ).map(([label, value, help]) => (
                <div className="metric panel" key={label}>
                  <span>{label}</span>
                  <strong>
                    {value === undefined
                      ? "—"
                      : typeof value === "number"
                        ? whole.format(value)
                        : value}
                  </strong>
                  <small>{help}</small>
                </div>
              ))}
            </div>

            <div className="comparison panel">
              <div className="comparison-head">
                <div className="comparison-title">
                  <span className="comparison-icon">
                    <Route size={21} />
                  </span>
                  <div>
                    <h2>Compare with a baseline</h2>
                    <p>
                      {!m?.hasBaseline
                        ? "Run with all roads open past the warm-up plus one minute, then save a baseline."
                        : m.baselineMatches
                          ? "Baseline saved. Press Setup, apply a closure, then Go for the same length of time."
                          : "Settings differ from the baseline. The next Setup will clear it."}
                    </p>
                  </div>
                </div>
                <div className="comparison-actions">
                  <button
                    className="button secondary"
                    disabled={!ready}
                    onClick={() => sim.command("save-baseline")}
                  >
                    {m?.hasBaseline ? <Check size={16} /> : null} Save baseline
                  </button>
                  <button
                    className="button secondary"
                    disabled={!ready}
                    onClick={download}
                  >
                    <ArrowDownToLine size={16} /> Export CSV
                  </button>
                </div>
              </div>
              {m?.hasBaseline && (
                <div className="table-wrap">
                  <table className="compare-table">
                    <thead>
                      <tr>
                        <th scope="col">Measure</th>
                        <th scope="col">Baseline</th>
                        <th scope="col">This run</th>
                        <th scope="col">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(([label, base, now, fmt]) => {
                        const change =
                          base !== null &&
                          now !== null &&
                          label !== "Measured time"
                            ? now - base
                            : null;
                        return (
                          <tr key={label}>
                            <th scope="row">{label}</th>
                            <td>{base === null ? "—" : fmt(base)}</td>
                            <td>{now === null ? "—" : fmt(now)}</td>
                            <td
                              className={
                                change === null || Math.abs(change) < 1e-9
                                  ? ""
                                  : change > 0
                                    ? "up"
                                    : "down"
                              }
                            >
                              {change === null
                                ? "—"
                                : `${change > 0 ? "+" : change < 0 ? "−" : ""}${fmt(Math.abs(change))}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {baseline &&
                    m &&
                    m.measured > 0 &&
                    Math.abs(m.measured - baseline.measured) > 30 && (
                      <p className="help">
                        This run has measured {clock(m.measured)} and the
                        baseline {clock(baseline.measured)}. Compare runs of
                        similar length.
                      </p>
                    )}
                </div>
              )}
            </div>

            <div className="output panel">
              <div className="output-head">
                <h2>
                  <TerminalSquare size={16} /> Model output
                </h2>
              </div>
              <ol
                ref={logRef}
                className="output-log"
                aria-label="Model output"
                aria-live="off"
                tabIndex={0}
              >
                {sim.output.length ? (
                  sim.output.map((line, i) => <li key={i}>{line}</li>)
                ) : (
                  <li className="muted">No output yet.</li>
                )}
              </ol>
            </div>

            <div className="feedback">
              <p role="status" aria-live="polite">
                <span className={`status-dot ${running ? "running" : ""}`} />
                {sim.status}
              </p>
              {sim.error && (
                <div role="alert" className="error">
                  {sim.error}
                  {phase === "error" && (
                    <button className="button secondary" onClick={sim.reload}>
                      Reload engine
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
        <footer>
          <span>
            <FlaskConical size={16} /> Built for exploration
          </span>
          <p>
            Real streets. Synthetic traffic and signals. This model explores
            possible effects; it is not a calibrated traffic forecast. The
            combined NetLogo model runs in your browser on NetLogo Web
            (Tortoise), GPL-2.0: <a href="/sim/LICENSE.md">licence</a> ·{" "}
            <a
              href="https://github.com/NetLogo/Tortoise"
              target="_blank"
              rel="noreferrer"
            >
              source
            </a>
            .
          </p>
          <button className="text-link" onClick={() => setGuideOpen(true)}>
            <BookOpen size={15} /> Quick guide
          </button>
        </footer>
      </main>
      <QuickGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}

/**
 * The map card: a black bar with the status and the map view, the live map
 * with its key, and the run bar.
 */

import { Map as MapIcon, MousePointerClick } from "lucide-react";
import type { Metrics, ViewMode } from "@traffic-lab/simulation";
import { clock, whole } from "../../lib/format";
import { choiceOptions } from "../settings/labels";
import { speedLabel } from "../simulation/speeds";
import type { Selection } from "../simulation/types";
import type { TrafficSimulation } from "../simulation/useTrafficSim";
import MapLegend from "./MapLegend";
import RunBar from "./RunBar";
import TrafficMap from "./TrafficMap";

/** The short status next to the dot in the black bar. */
function statusLabel(sim: TrafficSimulation): string {
  if (sim.phase === "loading") {
    return "Loading";
  }
  if (sim.phase === "building") {
    return "Building map";
  }
  if (sim.running) {
    return "Running · " + speedLabel(sim.speed);
  }
  if (sim.metrics && sim.metrics.finished && !sim.keepRunning) {
    return "Finished";
  }
  return "Paused";
}

/** A description of the map for screen readers. */
function describeMap(view: ViewMode, metrics: Metrics | null): string {
  let text = "Traffic map of Melbourne, " + view + " view.";
  if (metrics) {
    text = text + " " + whole(metrics.cars) + " cars on the road after " + clock(metrics.ticks) + ".";
    if (metrics.closureDesc !== "none" && metrics.closureDesc !== "0 closed directions; 0 reduced lanes") {
      text = text + " Closed: " + metrics.closureDesc + ".";
    } else {
      text = text + " All roads open.";
    }
  }
  return text + " Use the Street list in Settings to choose roads with a keyboard.";
}

interface MapPanelProps {
  sim: TrafficSimulation;
  selection: Selection;
  onChoose: (street: string, section: number) => void;
  clickMode: boolean;
  onStopClickMode: () => void;
}

export default function MapPanel({ sim, selection, onChoose, clickMode, onStopClickMode }: MapPanelProps) {
  const ready = sim.phase === "ready";
  const view = sim.settings["view-mode"];
  const metrics = sim.metrics;
  let hasBaseline = false;
  if (metrics) {
    hasBaseline = metrics.hasBaseline;
  }

  let dotClass = "status-dot";
  if (sim.running || sim.phase === "loading" || sim.phase === "building") {
    dotClass = "status-dot running";
  }

  let mapName = "Real Melbourne streets";
  if (sim.world && sim.world.network === "Schematic Hoddle grid") {
    mapName = "Simple street grid";
  }

  let worldVersion = 0;
  if (sim.world) {
    worldVersion = sim.store.current.worldVersion;
  }

  let loadingText = sim.status;
  if (sim.phase === "error") {
    loadingText = "The simulator stopped.";
  }
  let loadingClass = "map-loading";
  if (sim.world) {
    loadingClass = "map-loading over";
  }

  return (
    <div className="map-panel panel">
      <div className="map-toolbar">
        <div>
          <span className={dotClass} />
          <strong>{statusLabel(sim)}</strong>
          <span className="map-subtitle">{mapName}</span>
        </div>
        <label className="map-mode" htmlFor="view">
          View
          <select
            id="view"
            value={view}
            onChange={function (event) {
              sim.set("view-mode", event.target.value as ViewMode);
            }}
          >
            {choiceOptions("view-mode").map(function (option) {
              return (
                <option key={option[0]} value={option[0]}>
                  {option[1]}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      <div className="map-stage" aria-busy={!ready}>
        <TrafficMap
          store={sim.store}
          worldVersion={worldVersion}
          selection={selection}
          viewMode={view}
          clickMode={clickMode}
          closeWholeStreet={sim.settings["close-whole-street?"]}
          hasBaseline={hasBaseline}
          description={describeMap(view, metrics)}
          onSelect={onChoose}
          onToggle={sim.click}
        />
        {!ready && (
          <div className={loadingClass}>
            <span className="spinner" /> {loadingText}
          </div>
        )}
        {clickMode && ready && (
          <div className="click-banner">
            <MousePointerClick size={15} /> Click a road to close it. Click it again to reopen it.
            <button className="button secondary" onClick={onStopClickMode}>
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
        <MapLegend view={view} hasBaseline={hasBaseline} />
        <a
          className="attribution"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors
        </a>
      </div>

      <RunBar sim={sim} />
    </div>
  );
}

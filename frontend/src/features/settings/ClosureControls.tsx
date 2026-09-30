/**
 * Road closures: choose a street and how to close it, close or reopen it,
 * close roads by clicking the map, schedule a closure, see what is closed,
 * and hand the closure to the works planner.
 */

import { CalendarClock, Check, MousePointerClick, X } from "lucide-react";
import { Choice, Slider, Toggle } from "../../components/form";
import type { Selection } from "../simulation/types";
import type { TrafficSimulation } from "../simulation/useTrafficSim";
import {
  closedStreets,
  describeClosures,
  describeSelection,
  describeStreetClosure,
  sectionsOf,
} from "./closures";
import { choiceOptions } from "./labels";

interface ClosureControlsProps {
  sim: TrafficSimulation;
  selection: Selection;
  onChoose: (street: string, section: number) => void;
  clickMode: boolean;
  onToggleClickMode: () => void;
  /** Open the works planner on the Report page with this closure. */
  onPlanClosure: () => void;
}

export default function ClosureControls({
  sim,
  selection,
  onChoose,
  clickMode,
  onToggleClickMode,
  onPlanClosure,
}: ClosureControlsProps) {
  const settings = sim.settings;
  const ready = sim.phase === "ready";
  let streets: string[] = [];
  if (sim.world) {
    streets = sim.world.streets;
  }
  const sections = sectionsOf(sim.world, selection.street);
  const closures = closedStreets(sim.world, sim.store.current.styles);

  // Keep the list's value valid if the chosen street is not on this map.
  let streetValue = "";
  const streetIsListed = streets.includes(selection.street);
  if (streetIsListed) {
    streetValue = selection.street;
  }

  let clickModeLabel = "Close roads by clicking: off";
  let clickModeClass = "button secondary full click-roads";
  if (clickMode) {
    clickModeLabel = "Close roads by clicking: on";
    clickModeClass = clickModeClass + " on";
  }

  let selectionText = "—";
  let closuresText = "—";
  if (sim.metrics) {
    selectionText = describeSelection(sim.metrics.selectionLabel);
    closuresText = describeClosures(sim.metrics.closureDesc);
  }

  return (
    <section className="group" aria-labelledby="group-closures">
      <div className="section-heading">
        <h3 id="group-closures" className="group-title">
          Road closures
        </h3>
        <span className="count" title="Streets with a closure">
          {closures.length}
        </span>
      </div>

      <div className="field">
        <label htmlFor="street">Street</label>
        <select
          id="street"
          value={streetValue}
          disabled={streets.length === 0}
          onChange={function (event) {
            onChoose(event.target.value, 0);
          }}
        >
          {!streetIsListed && <option value="">Choose a street</option>}
          {streets.map(function (street) {
            return <option key={street}>{street}</option>;
          })}
        </select>
      </div>

      <div className="field">
        <label htmlFor="section">Which part</label>
        <select
          id="section"
          value={selection.section}
          disabled={streets.length === 0}
          onChange={function (event) {
            onChoose(selection.street, Number(event.target.value));
          }}
        >
          <option value={0}>Whole street</option>
          {sections.map(function (section) {
            return (
              <option key={section} value={section}>
                Section {section}
              </option>
            );
          })}
        </select>
      </div>

      <Choice
        id="closure-type"
        label="How to close it"
        value={settings["closure-type"]}
        options={choiceOptions("closure-type")}
        onChange={function (value) {
          sim.set("closure-type", value);
        }}
      />

      <button
        className="button primary full apply"
        disabled={!ready}
        onClick={function () {
          sim.command("close-selection");
        }}
      >
        Close this street
      </button>
      <div className="button-pair">
        <button
          className="button secondary"
          disabled={!ready}
          onClick={function () {
            sim.command("reopen-selection");
          }}
        >
          Reopen this street
        </button>
        <button
          className="button secondary"
          disabled={!ready}
          onClick={function () {
            sim.command("reopen-all");
          }}
        >
          Reopen all streets
        </button>
      </div>
      <button className="button secondary full plan-closure" disabled={!ready} onClick={onPlanClosure}>
        <CalendarClock size={16} /> Find the best time for this closure
      </button>

      <button
        className={clickModeClass}
        aria-pressed={clickMode}
        disabled={!ready}
        onClick={onToggleClickMode}
      >
        <MousePointerClick size={16} /> {clickModeLabel}
      </button>
      <Toggle
        id="close-whole"
        label="A click closes the whole street"
        checked={settings["close-whole-street?"]}
        onChange={function (value) {
          sim.set("close-whole-street?", value);
        }}
        help="Off: a click closes only the part of the street you click."
      />
      <Toggle
        id="scheduled"
        label="Close it automatically later"
        checked={settings["scheduled-closure?"]}
        onChange={function (value) {
          sim.set("scheduled-closure?", value);
        }}
        help="Closes the chosen street once, at the time below, after you press Restart."
      />
      <Slider
        name="closure-start-min"
        value={settings["closure-start-min"]}
        onChange={function (value) {
          sim.set("closure-start-min", value);
        }}
        disabled={!settings["scheduled-closure?"]}
        help={null}
      />

      <dl className="monitors-inline">
        <div>
          <dt>Chosen street</dt>
          <dd>{selectionText}</dd>
        </div>
        <div>
          <dt>Closed right now</dt>
          <dd>{closuresText}</dd>
        </div>
      </dl>

      <div className="closure-list">
        {closures.length === 0 && (
          <p className="empty-closures">
            <Check size={15} /> All roads open
          </p>
        )}
        {closures.map(function (closure) {
          return (
            <div className="closure-item" key={closure.street}>
              <span>
                <strong>{closure.street}</strong>
                <small>{describeStreetClosure(closure)}</small>
              </span>
              <button
                className="icon-button"
                aria-label={"Reopen " + closure.street}
                title="Reopen this street"
                onClick={function () {
                  onChoose(closure.street, 0);
                  sim.command("reopen-selection");
                }}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

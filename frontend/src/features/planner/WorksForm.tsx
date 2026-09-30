/**
 * Step 1, "What works do you need to do?": the street, how it is closed, how
 * long the work takes, the limits, and what matters most. The simulator's
 * "Find the best time for this closure" button fills in the street.
 */

import { Search } from "lucide-react";
import type { ClosureType, Settings, World } from "@traffic-lab/simulation";
import { Choice, RangeField } from "../../components/form";
import { whole } from "../../lib/format";
import { sectionsOf } from "../settings/closures";
import { choiceOptions } from "../settings/labels";
import type { AllowedDays, AllowedTimes, Priority, Thoroughness, WorksClosure, WorksRequest } from "./types";
import { durationText, hoursText, PRIORITY_TEXT } from "./wording";

interface WorksFormProps {
  world: World | null;
  settings: Settings | null;
  request: WorksRequest;
  onChange: (request: WorksRequest) => void;
  /** The closure last filled in from the simulator's map, if any. */
  fromSimulator: WorksClosure | null;
  ready: boolean;
  running: boolean;
  estimateSeconds: (request: WorksRequest) => number | null;
  onSubmit: (request: WorksRequest) => void;
}

const TIMES: [AllowedTimes, string][] = [
  ["any", "Any time of day"],
  ["night", "Nights only (7 pm to 7 am)"],
  ["day", "Daytime only (7 am to 7 pm)"],
];

const DAYS: [AllowedDays, string][] = [
  ["either", "Weekdays or weekends"],
  ["weekdays", "Weekdays only"],
  ["weekends", "Weekends only"],
];

const PRIORITIES: Priority[] = ["least-disruption", "balanced", "fewest-shifts"];

export default function WorksForm(props: WorksFormProps) {
  const request = props.request;

  function change(changes: Partial<WorksRequest>): void {
    props.onChange(Object.assign({}, request, changes));
  }

  // Say so while the form still shows the closure sent from the simulator.
  const filledIn = props.fromSimulator;
  let fromMap = false;
  if (filledIn) {
    fromMap =
      filledIn.street === request.street &&
      filledIn.section === request.section &&
      filledIn.closureType === request.closureType;
  }

  let streets: string[] = [];
  if (props.world) {
    streets = props.world.streets;
  }
  let streetValue = "";
  if (streets.includes(request.street)) {
    streetValue = request.street;
  }
  const sections = sectionsOf(props.world, request.street);

  let settingsNote = "Loading the simulator…";
  if (props.settings) {
    let map = "simple Hoddle Grid map";
    if (props.settings["network-source"] === "Real OSM map") {
      map = "real road map";
    }
    settingsNote =
      "Tested on the " +
      map +
      ", with " +
      whole(props.settings["demand-veh-per-hour"]) +
      " cars an hour arriving at the busiest time of day. Change these on the Simulator page.";
  }

  function thoroughLabel(level: Thoroughness): string {
    let name = "Quick check";
    if (level === "thorough") {
      name = "Thorough";
    }
    const seconds = props.estimateSeconds(Object.assign({}, request, { thoroughness: level }));
    if (seconds === null) {
      return name;
    }
    if (seconds === 0) {
      return name + " (already tested)";
    }
    return name + " (" + durationText(seconds) + ")";
  }

  const canStart = props.ready && !props.running && streetValue !== "";

  return (
    <form
      id="report-plan"
      className="panel controls works-form"
      aria-labelledby="works-title"
      onSubmit={function (event) {
        event.preventDefault();
        if (canStart) {
          props.onSubmit(request);
        }
      }}
    >
      <div className="panel-heading">
        <h2 id="works-title">
          <span className="step-number">1</span> What works do you need to do?
        </h2>
      </div>

      <fieldset className="group" disabled={props.running}>
        <legend className="group-title">Where</legend>
        {fromMap && <p className="from-map">Filled in from the closure on the simulator&rsquo;s map.</p>}
        <div className="field">
          <label htmlFor="works-street">Street</label>
          <select
            id="works-street"
            value={streetValue}
            disabled={streets.length === 0}
            onChange={function (event) {
              change({ street: event.target.value, section: 0 });
            }}
          >
            {streetValue === "" && <option value="">Choose a street</option>}
            {streets.map(function (street) {
              return (
                <option key={street} value={street}>
                  {street}
                </option>
              );
            })}
          </select>
        </div>
        <div className="field">
          <label htmlFor="works-section">Which part</label>
          <select
            id="works-section"
            value={String(request.section)}
            onChange={function (event) {
              change({ section: Number(event.target.value) });
            }}
          >
            <option value="0">Whole street</option>
            {sections.map(function (section) {
              return (
                <option key={section} value={String(section)}>
                  {"Section " + section}
                </option>
              );
            })}
          </select>
        </div>
        <Choice<ClosureType>
          id="works-closure"
          label="How it is closed"
          value={request.closureType}
          options={choiceOptions("closure-type") as [ClosureType, string][]}
          onChange={function (value) {
            change({ closureType: value });
          }}
        />
      </fieldset>

      <fieldset className="group" disabled={props.running}>
        <legend className="group-title">How long</legend>
        <RangeField
          id="works-hours"
          label="Hours of work needed"
          value={request.workHours}
          min={1}
          max={48}
          step={1}
          display={hoursText(request.workHours)}
          onChange={function (value) {
            change({ workHours: value });
          }}
        />
        <RangeField
          id="works-shift"
          label="Longest shift"
          value={request.longestShift}
          min={2}
          max={12}
          step={1}
          display={hoursText(request.longestShift)}
          help="The most work the crew can do in one go."
          onChange={function (value) {
            change({ longestShift: value });
          }}
        />
        <RangeField
          id="works-setup"
          label="Setting up and packing away"
          value={request.setupHours}
          min={0}
          max={2}
          step={0.5}
          display={hoursText(request.setupHours)}
          help="Each shift, the road is closed this much longer than the work itself."
          onChange={function (value) {
            change({ setupHours: value });
          }}
        />
      </fieldset>

      <fieldset className="group" disabled={props.running}>
        <legend className="group-title">Limits</legend>
        <Choice<AllowedTimes>
          id="works-times"
          label="When can the works happen?"
          value={request.times}
          options={TIMES}
          onChange={function (value) {
            change({ times: value });
          }}
        />
        <Choice<AllowedDays>
          id="works-days"
          label="Which days?"
          value={request.days}
          options={DAYS}
          onChange={function (value) {
            change({ days: value });
          }}
        />
      </fieldset>

      <fieldset className="group" disabled={props.running}>
        <legend className="group-title">What matters most?</legend>
        <div className="option-list">
          {PRIORITIES.map(function (priority) {
            return (
              <label key={priority} className="option">
                <input
                  type="radio"
                  name="works-priority"
                  value={priority}
                  checked={request.priority === priority}
                  onChange={function () {
                    change({ priority: priority });
                  }}
                />
                <span>
                  <strong>{PRIORITY_TEXT[priority].label}</strong>
                  <small>{PRIORITY_TEXT[priority].help}</small>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="group" disabled={props.running}>
        <legend className="group-title">How thorough?</legend>
        <div className="option-list">
          <label className="option">
            <input
              type="radio"
              name="works-thoroughness"
              value="quick"
              checked={request.thoroughness === "quick"}
              onChange={function () {
                change({ thoroughness: "quick" });
              }}
            />
            <span>
              <strong>{thoroughLabel("quick")}</strong>
              <small>Each test repeated 3 times with different traffic.</small>
            </span>
          </label>
          <label className="option">
            <input
              type="radio"
              name="works-thoroughness"
              value="thorough"
              checked={request.thoroughness === "thorough"}
              onChange={function () {
                change({ thoroughness: "thorough" });
              }}
            />
            <span>
              <strong>{thoroughLabel("thorough")}</strong>
              <small>Repeated 8 times, and the top 3 plans double-checked.</small>
            </span>
          </label>
        </div>
      </fieldset>

      <button className="button primary full" type="submit" disabled={!canStart}>
        <Search size={16} /> Find the best plan
      </button>
      <p className="help form-note">{settingsNote}</p>
    </form>
  );
}

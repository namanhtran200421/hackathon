/**
 * The words people see for each setting. The ranges and starting values come
 * from the simulation package; this file only adds labels, units and short
 * explanations in everyday English.
 */

import {
  CHOICE_OPTIONS,
  NUMBER_RULES,
  START_TIMES,
  type ChoiceSettingName,
  type NumberRule,
  type NumberSettingName,
  type Settings,
} from "@traffic-lab/simulation";
import { startSeconds, timeOfDay } from "../../lib/format";

export interface SliderText {
  label: string;
  unit: string;
  help?: string;
}

export const SLIDER_TEXT: Record<NumberSettingName, SliderText> = {
  "informed-drivers-%": {
    label: "Drivers using live traffic info",
    unit: "%",
    help: "These drivers take detours around jams and closed roads.",
  },
  "speed-limit-kmh": { label: "Speed limit", unit: "km/h" },
  "cycle-length": {
    label: "Traffic light cycle",
    unit: "seconds",
    help: "How long each traffic light takes to go through all its colours.",
  },
  "ew-green-share": {
    label: "Green time for east–west streets",
    unit: "%",
    help: "Used when traffic lights do not share green time by demand.",
  },
  "warm-up-s": {
    label: "Warm-up time",
    unit: "seconds",
    help: "Time for the streets to fill up. It runs before the start time, so counting starts at the start time.",
  },
  "measure-s": { label: "Counting time", unit: "seconds" },
  seed: { label: "Traffic pattern number", unit: "" },
  "reroute-interval": { label: "How often drivers re-plan", unit: "seconds" },
  "route-noise": {
    label: "Route randomness",
    unit: "",
    help: "Higher values make drivers choose less predictable routes.",
  },
  "closure-start-min": { label: "Close it after", unit: "minutes" },
};

/** Every start time as people read it: "08:15" → "8:15 am". */
function startTimeText(): Record<string, string> {
  const text: Record<string, string> = {};
  START_TIMES.forEach(function (time) {
    text[time] = timeOfDay(startSeconds(time));
  });
  return text;
}

/** The text shown for each option of each drop-down list. */
export const CHOICE_TEXT: { [Name in ChoiceSettingName]: Record<Settings[Name], string> } = {
  "day-type": {
    Weekday: "Weekday (Monday to Friday)",
    Weekend: "Weekend (Saturday and Sunday)",
  },
  "start-time": startTimeText(),
  "signal-coordination": {
    "random offsets": "Not coordinated",
    "green wave (east-west)": "Green wave (east–west)",
  },
  "view-mode": {
    congestion: "Traffic jams",
    volume: "Traffic volume",
    "change vs baseline": "Change from baseline",
  },
  "closure-type": {
    "Both directions": "Close both directions",
    "East / north direction": "Close one direction (east or north)",
    "One lane each direction": "Close one lane each way",
  },
};

/** A slider's range and its words together. */
export function sliderInfo(name: NumberSettingName): NumberRule & SliderText {
  return Object.assign({}, NUMBER_RULES[name], SLIDER_TEXT[name]);
}

/** A drop-down list's options as [value, text people see]. */
export function choiceOptions<Name extends ChoiceSettingName>(name: Name): [Settings[Name], string][] {
  const text = CHOICE_TEXT[name] as Record<string, string>;
  return CHOICE_OPTIONS[name].map(function (value): [Settings[Name], string] {
    return [value, text[value as string]];
  });
}

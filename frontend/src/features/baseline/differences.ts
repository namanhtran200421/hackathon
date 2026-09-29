/**
 * Describes a baseline and lists the settings that changed since it was saved.
 */

import type { SettingName, Settings } from "@traffic-lab/simulation";
import { twoDp } from "../../lib/format";
import { CHOICE_TEXT, SLIDER_TEXT } from "../settings/labels";
import type { BaselineRecording } from "../simulation/types";

/** Settings that shape a run, with the names people see. */
const COMPARED: [SettingName, string][] = [
  ["demand-profile", "Traffic demand profile"],
  ["profile-start-hour", "Start hour in Melbourne"],
  ["use-observed-signals?", "Matched DTP signal locations"],
  ["network-source", "Road map"],
  ["demand-veh-per-hour", "Cars arriving per hour"],
  ["through-traffic-%", "Cars just passing through"],
  ["informed-drivers-%", "Drivers using live traffic info"],
  ["speed-limit-kmh", "Speed limit"],
  ["cycle-length", "Traffic light cycle"],
  ["ew-green-share", "Green time for east–west streets"],
  ["signal-coordination", "Traffic light timing"],
  ["hook-turns?", "Hook turns"],
  ["fixed-seed?", "Repeat the same traffic pattern"],
  ["seed", "Traffic pattern number"],
  ["route-noise", "Route randomness"],
  ["reroute-interval", "How often drivers re-plan"],
  ["warm-up-s", "Warm-up time"],
];

export interface Difference {
  label: string;
  from: string;
  to: string;
}

/** A setting's value as people should read it, such as "2,500 cars/hour" or "On". */
export function describeSetting(name: SettingName, value: unknown): string {
  if (value === undefined) {
    return "Not recorded";
  }
  if (typeof value === "boolean") {
    if (value) {
      return "On";
    }
    return "Off";
  }
  if (Object.hasOwn(CHOICE_TEXT, name)) {
    const options = CHOICE_TEXT[name as keyof typeof CHOICE_TEXT] as Record<string, string>;
    return options[String(value)] || String(value);
  }
  let text = twoDp(Number(value));
  const slider = SLIDER_TEXT[name as keyof typeof SLIDER_TEXT];
  if (slider && slider.unit) {
    text = text + " " + slider.unit;
  }
  return text;
}

function describeCountingTime(settings: Settings, keepRunning: boolean): string {
  if (keepRunning) {
    return "No time limit";
  }
  return describeSetting("measure-s", settings["measure-s"]);
}

/** Every setting that is different now from when the baseline was saved. */
export function differences(
  baseline: BaselineRecording | null,
  settings: Settings,
  keepRunning: boolean,
): Difference[] {
  if (!baseline || !baseline.settings) {
    return [];
  }
  const found: Difference[] = [];
  COMPARED.forEach(function (entry) {
    const name = entry[0];
    if (baseline.settings[name] !== settings[name]) {
      found.push({
        label: entry[1],
        from: describeSetting(name, baseline.settings[name]),
        to: describeSetting(name, settings[name]),
      });
    }
  });

  const before = describeCountingTime(baseline.settings, baseline.forever);
  const now = describeCountingTime(settings, keepRunning);
  if (before !== now) {
    found.push({ label: "Counting time", from: before, to: now });
  }
  return found;
}

/** A one-line description of when and how the baseline was recorded. */
export function describeBaseline(baseline: BaselineRecording): string {
  const when = new Date(baseline.savedAt).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const map = describeSetting("network-source", baseline.settings["network-source"]);
  const demand = describeSetting("demand-veh-per-hour", baseline.settings["demand-veh-per-hour"]);
  return when + " · " + map + " · " + demand;
}

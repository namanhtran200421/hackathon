import { CHOICES, SLIDERS } from "./controls.mjs";
import type { BaselineRun, Settings } from "./types";

/** Settings that shape a run, in the order of the model's scenario signature. */
const COMPARED: { key: keyof Settings; label: string }[] = [
  { key: "network-source", label: "Road network" },
  { key: "demand-veh-per-hour", label: "Traffic demand" },
  { key: "through-traffic-%", label: "Through traffic" },
  { key: "informed-drivers-%", label: "Drivers with live routing" },
  { key: "speed-limit-kmh", label: "Speed limit" },
  { key: "cycle-length", label: "Signal cycle length" },
  { key: "ew-green-share", label: "East–west green share" },
  { key: "signal-coordination", label: "Signal coordination" },
  { key: "hook-turns?", label: "Hook turns" },
  { key: "fixed-seed?", label: "Fixed seed" },
  { key: "seed", label: "Random seed" },
  { key: "route-noise", label: "Route noise" },
  { key: "reroute-interval", label: "Re-route interval" },
  { key: "warm-up-s", label: "Warm-up" },
];

const number = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 });

function show(key: keyof Settings, value: unknown) {
  if (typeof value === "boolean") return value ? "On" : "Off";
  const choices = (CHOICES as Record<string, string[][]>)[key];
  if (choices) return choices.find(([v]) => v === value)?.[1] ?? String(value);
  const slider = (SLIDERS as Record<string, { unit: string }>)[key];
  return `${number.format(Number(value))}${slider?.unit ? ` ${slider.unit}` : ""}`;
}

export type Difference = { label: string; from: string; to: string };

/** What differs between the baseline's settings and the current ones. */
export function differences(
  base: BaselineRun | null,
  settings: Settings,
  forever: boolean,
): Difference[] {
  if (!base?.settings) return [];
  const out: Difference[] = [];
  for (const { key, label } of COMPARED)
    if (base.settings[key] !== settings[key])
      out.push({
        label,
        from: show(key, base.settings[key]),
        to: show(key, settings[key]),
      });
  const window = (s: Settings, f: boolean) =>
    f ? "Until paused" : show("measure-s", s["measure-s"]);
  const before = window(base.settings, base.forever),
    now = window(settings, forever);
  if (before !== now)
    out.push({ label: "Measurement window", from: before, to: now });
  return out;
}

export function savedLabel(base: BaselineRun) {
  const when = new Date(base.savedAt);
  const date = when.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${show("network-source", base.settings["network-source"])} · ${show("demand-veh-per-hour", base.settings["demand-veh-per-hour"])}`;
}

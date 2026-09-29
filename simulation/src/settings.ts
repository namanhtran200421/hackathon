/**
 * Every setting on the desktop NetLogo interface: its NetLogo name, starting
 * value and allowed values.
 *
 * This is the single source of truth. The model's controls check values
 * against these rules, and the web page builds its sliders, switches and
 * lists from them. The starting values must match the model; the tests check.
 */

/** The counting time used by "Keep running": counting never stops. */
export const FOREVER = 1e9;

export type NetworkName = "Real OSM map" | "Schematic Hoddle grid";
export type SignalCoordination = "random offsets" | "green wave (east-west)";
export type ViewMode = "congestion" | "volume" | "change vs baseline";
export type ClosureType = "Both directions" | "East / north direction" | "One lane each direction";

/** The value of every setting, keyed by its NetLogo name. */
export interface Settings {
  "network-source": NetworkName;
  "demand-veh-per-hour": number;
  "through-traffic-%": number;
  "informed-drivers-%": number;
  "speed-limit-kmh": number;
  "cycle-length": number;
  "ew-green-share": number;
  "warm-up-s": number;
  "measure-s": number;
  seed: number;
  "reroute-interval": number;
  "route-noise": number;
  "fixed-seed?": boolean;
  "hook-turns?": boolean;
  "close-whole-street?": boolean;
  "signal-coordination": SignalCoordination;
  "view-mode": ViewMode;
  "closure-type": ClosureType;
  "scheduled-closure?": boolean;
  "closure-start-min": number;
}

export type SettingName = keyof Settings;

/** Names of the settings whose values are numbers (sliders). */
export type NumberSettingName = {
  [Name in SettingName]: Settings[Name] extends number ? Name : never;
}[SettingName];

/** Names of the on/off settings (switches). */
export type SwitchSettingName = {
  [Name in SettingName]: Settings[Name] extends boolean ? Name : never;
}[SettingName];

/** Names of the settings chosen from a list (choosers). */
export type ChoiceSettingName = Exclude<SettingName, NumberSettingName | SwitchSettingName>;

/** The starting value of every setting, as in the desktop model. */
export const DEFAULT_SETTINGS: Settings = {
  "network-source": "Real OSM map",
  "demand-veh-per-hour": 2500,
  "through-traffic-%": 50,
  "informed-drivers-%": 50,
  "speed-limit-kmh": 40,
  "cycle-length": 80,
  "ew-green-share": 50,
  "warm-up-s": 60,
  "measure-s": 600,
  seed: 42,
  "reroute-interval": 60,
  "route-noise": 0.1,
  "fixed-seed?": true,
  "hook-turns?": false,
  "close-whole-street?": true,
  "signal-coordination": "random offsets",
  "view-mode": "congestion",
  "closure-type": "Both directions",
  "scheduled-closure?": false,
  "closure-start-min": 2,
};

export interface NumberRule {
  /** The slider's range and step on the desktop interface. */
  min: number;
  max: number;
  step: number;
  /** Whether only whole numbers are allowed. */
  whole: boolean;
  /** A higher limit the model accepts than the slider shows, if any. */
  modelMax?: number;
}

/** The range of every slider. */
export const NUMBER_RULES: Record<NumberSettingName, NumberRule> = {
  "demand-veh-per-hour": { min: 0, max: 12000, step: 250, whole: true },
  "through-traffic-%": { min: 0, max: 100, step: 5, whole: true },
  "informed-drivers-%": { min: 0, max: 100, step: 5, whole: true },
  "speed-limit-kmh": { min: 20, max: 60, step: 5, whole: true },
  "cycle-length": { min: 40, max: 150, step: 5, whole: true },
  "ew-green-share": { min: 20, max: 80, step: 5, whole: true },
  "warm-up-s": { min: 0, max: 900, step: 30, whole: true },
  // "Keep running" sets the counting time to FOREVER.
  "measure-s": { min: 60, max: 3600, step: 60, whole: true, modelMax: FOREVER },
  seed: { min: 1, max: 100, step: 1, whole: true },
  "reroute-interval": { min: 10, max: 300, step: 10, whole: true },
  "route-noise": { min: 0, max: 0.5, step: 0.05, whole: false },
  "closure-start-min": { min: 0, max: 60, step: 1, whole: true },
};

/** The options of every chooser. */
export const CHOICE_OPTIONS: { [Name in ChoiceSettingName]: readonly Settings[Name][] } = {
  "network-source": ["Real OSM map", "Schematic Hoddle grid"],
  "signal-coordination": ["random offsets", "green wave (east-west)"],
  "view-mode": ["congestion", "volume", "change vs baseline"],
  "closure-type": ["Both directions", "East / north direction", "One lane each direction"],
};

/** The on/off switches. */
export const SWITCHES: readonly SwitchSettingName[] = [
  "fixed-seed?",
  "hook-turns?",
  "close-whole-street?",
  "scheduled-closure?",
];

/**
 * Settings the model only reads when it builds the road map (Setup). Changing
 * one of these only takes effect after a restart.
 */
export const SETUP_ONLY: readonly SettingName[] = [
  "network-source",
  "seed",
  "fixed-seed?",
  "speed-limit-kmh",
  "cycle-length",
  "ew-green-share",
  "signal-coordination",
];

export function isNumberSetting(name: string): name is NumberSettingName {
  return Object.hasOwn(NUMBER_RULES, name);
}

export function isSwitchSetting(name: string): name is SwitchSettingName {
  return (SWITCHES as readonly string[]).includes(name);
}

export function isChoiceSetting(name: string): name is ChoiceSettingName {
  return Object.hasOwn(CHOICE_OPTIONS, name);
}

/**
 * Check a value for a setting. Numbers are brought within the allowed range;
 * anything else that is not allowed throws an error.
 */
export function checkSetting(name: string, value: unknown): Settings[SettingName] {
  if (isSwitchSetting(name)) {
    if (typeof value !== "boolean") {
      throw new Error(name + " must be on or off.");
    }
    return value;
  }
  if (isChoiceSetting(name)) {
    const options = CHOICE_OPTIONS[name] as readonly unknown[];
    if (!options.includes(value)) {
      throw new Error(name + " has no option " + String(value) + ".");
    }
    return value as Settings[ChoiceSettingName];
  }
  if (isNumberSetting(name)) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new Error(name + " must be a number.");
    }
    const rule = NUMBER_RULES[name];
    const highest = rule.modelMax ?? rule.max;
    const limited = Math.min(highest, Math.max(rule.min, number));
    if (rule.whole) {
      return Math.round(limited);
    }
    return limited;
  }
  throw new Error("Unknown setting: " + name);
}

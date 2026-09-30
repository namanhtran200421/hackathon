/**
 * Types the web page uses on top of the simulation package's.
 */

import type { Metrics, ModelBaseline, Settings, SiteVolume, World } from "@traffic-lab/simulation";

/** One point for the results charts. */
export interface Sample {
  t: number;
  cars: number;
  waiting: number;
  completed: number;
  meanTrip: number | null;
  meanDelay: number | null;
  vehicleHours: number;
  generated: number;
  stranded: number;
  measured: number;
}

/** A saved baseline: the run's final numbers, its chart history and its settings. */
export interface BaselineRecording {
  metrics: Metrics;
  history: Sample[];
  settings: Settings;
  /** Whether "Keep running" was on. (Named `forever` for older saved baselines.) */
  forever: boolean;
  savedAt: number;
  /** The model's own baseline data, used to restore it after a reload. */
  saved?: ModelBaseline;
}

/** The chosen street and section (0 means the whole street). */
export interface Selection {
  street: string;
  section: number;
}

/** A still copy of a paused run, used by the results section. */
export interface ResultsSnapshot {
  metrics: Metrics;
  history: Sample[];
  styles: Float32Array;
  world: World;
  /** Traffic entering each counted intersection, in the order of world.sites. */
  sites: SiteVolume[] | null;
}

/** Where the page is in loading the simulator. */
export type SimulatorPhase = "loading" | "building" | "ready" | "error";

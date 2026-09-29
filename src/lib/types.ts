import type { DEFAULTS } from "./controls.mjs";

export type Settings = typeof DEFAULTS;
export type SettingName = keyof Settings;

export type RoadInfo = {
  index: number;
  from: number;
  to: number;
  street: string;
  section: number;
  geometry: number[][];
  lanes: number;
  kind: string;
  direction: string;
  carsAllowed: boolean;
};

export type World = {
  network: string;
  roads: RoadInfo[];
  nodes: { x: number; y: number; kind: string; label: string }[];
  /** Labels sit just above their anchor, centred unless aligned left. */
  labels: { x: number; y: number; text: string; align?: "left" | "center" }[];
  streets: string[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

export type Metrics = {
  ticks: number;
  cars: number;
  generated: number;
  completedTotal: number;
  stranded: number;
  waiting: number;
  meanTrip: number;
  meanDelay: number;
  measured: number;
  completed: number;
  vehicleHours: number;
  finished: boolean;
  closureDesc: string;
  selectionLabel: string;
  measuring: boolean;
  hasBaseline: boolean;
  baselineMatches: boolean;
  baseline: {
    completed: number;
    meanTrip: number;
    waiting: number;
    stranded: number;
    measured: number;
  } | null;
  selectedStreet: string;
  selectedBlock: number;
  warmUp: number;
  measure: number;
};

/** Per-road style fields streamed from the worker (see public/sim/sim-core.js). */
export const STYLE = {
  fields: 9,
  color: 0,
  thickness: 1,
  closed: 2,
  lanesOpen: 3,
  winCount: 4,
  baseCount: 5,
  travelTime: 6,
  pairClosed: 7,
  pairReduced: 8,
} as const;

/** Per-car fields: who, x, y, heading, NetLogo colour. */
export const CAR_FIELDS = 5;

/** Mutable state the map reads every animation frame, outside React renders. */
export type RenderStore = {
  world: World | null;
  worldVersion: number;
  styles: Float32Array | null;
  stylesView: string;
  stylesVersion: number;
  cars: Float32Array;
  from: Float32Array;
  fromIndex: Map<number, number>;
  frameAt: number;
  duration: number;
  ticks: number;
  measured: number;
  frameVersion: number;
};

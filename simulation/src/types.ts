/**
 * The shapes of the data the model hands to the web page.
 */

/** The five numbers the model keeps about a saved baseline. */
export interface BaselineSummary {
  completed: number;
  meanTrip: number;
  waiting: number;
  stranded: number;
  measured: number;
}

/** How the simulated traffic compares with the SCATS counts so far. */
export interface ScatsComparison {
  /** Intersections compared: those whose detectors cover every approach lane. */
  sites: number;
  /** How many of them are within GEH 5 of the counts. */
  withinGeh5: number;
  /** Vehicles per hour entering them in the model, added up. */
  modelled: number;
  /** Vehicles per hour entering them in the SCATS counts, added up. */
  counted: number;
}

/** The latest numbers from the model. */
export interface Metrics {
  /** The model's time of day, in seconds after midnight. */
  clock: number;
  /** Trips per hour starting now, from the SCATS-shaped data. */
  tripsPerHour: number;
  scats: ScatsComparison;
  /** Which version of the traffic data the model uses. */
  dataVersion: string;
  /** The day type the current run uses. */
  dayType: string;
  /** Seconds of traffic so far. */
  ticks: number;
  /** Cars driving in the city now. */
  cars: number;
  /** Cars that have arrived at the edge of the city in total. */
  generated: number;
  /** Trips finished in total, counted or not. */
  completedTotal: number;
  /** Cars with no possible route. */
  stranded: number;
  /** Cars queued at the edge of the city, waiting to enter. */
  waiting: number;
  /** Average trip time in minutes, over counted trips. */
  meanTrip: number;
  /** Average extra time compared with empty roads, in minutes. */
  meanDelay: number;
  /** Seconds counted so far (after the warm-up). */
  measured: number;
  /** Trips finished while counting. */
  completed: number;
  /** Hours all cars together have spent in the city. */
  vehicleHours: number;
  /** True once the counting time is over and the model has stopped. */
  finished: boolean;
  /** The model's description of the closures, such as "28 closed directions; 0 reduced lanes". */
  closureDesc: string;
  /** The model's description of the chosen street, such as "Collins St / whole street". */
  selectionLabel: string;
  measuring: boolean;
  hasBaseline: boolean;
  /** True when the current settings match the baseline's. */
  baselineMatches: boolean;
  baseline: BaselineSummary | null;
  selectedStreet: string;
  /** The chosen section; 0 means the whole street. */
  selectedBlock: number;
  warmUp: number;
  measure: number;
}

/** One direction of one road between two junctions. */
export interface RoadInfo {
  index: number;
  from: number;
  to: number;
  street: string;
  section: number;
  /** The road's shape as [x, y] points, in patches. */
  geometry: [number, number][];
  lanes: number;
  /** "main", "little", "gate" (an entry point) or "access" (a destination). */
  kind: string;
  /** "EB", "WB", "NB" or "SB". */
  direction: string;
  carsAllowed: boolean;
}

/** A road into the map ("gate") or a car park ("carpark"). */
export interface MapNode {
  x: number;
  y: number;
  kind: string;
  label: string;
}

/** A signalised intersection compared with its SCATS counts. */
export interface CountSite {
  /** The DTP site number. */
  id: number;
  /** The DTP site name, such as "SWANSTON/LONSDALE". */
  name: string;
  x: number;
  y: number;
}

/** Vehicles per hour entering one counted intersection. */
export interface SiteVolume {
  modelled: number;
  counted: number;
}

export interface MapLabel {
  x: number;
  y: number;
  text: string;
  align?: "left" | "center";
}

/** The road layout. It only changes when the model runs Setup. */
export interface World {
  roads: RoadInfo[];
  nodes: MapNode[];
  labels: MapLabel[];
  sites: CountSite[];
  /** Streets that can be closed, in alphabetical order. */
  streets: string[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

/** The model's saved baseline, in a form that can be stored and restored. */
export interface ModelBaseline {
  /** [road key, cars per hour] for every road. */
  pairs: [string, number][];
  summary: number[];
  /** The settings the baseline was recorded with. */
  signature: (string | number | boolean)[];
}

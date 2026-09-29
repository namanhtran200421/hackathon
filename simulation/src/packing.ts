/**
 * Cars and road colours change every second, so they travel from the worker
 * to the page as flat number arrays instead of objects. This file says where
 * each number sits.
 */

import type { RoadInfo } from "./types";

/** Each car is five numbers: id, x, y, heading, NetLogo colour. */
export const CAR_FIELDS = 5;

/** Each road is nine numbers. These are their positions. */
export const STYLE = {
  fields: 9,
  /** The NetLogo colour the model gave the road. */
  color: 0,
  /** Line width in patches. */
  thickness: 1,
  /** 1 when this direction is closed. */
  closed: 2,
  lanesOpen: 3,
  /** Cars that left this road while counting. */
  winCount: 4,
  /** Baseline cars per hour. */
  baseCount: 5,
  /** Smoothed time to drive the road, in seconds. */
  travelTime: 6,
  /** 1 when either direction of the road is closed. */
  pairClosed: 7,
  /** 1 when either direction has a lane closed. */
  pairReduced: 8,
} as const;

/** NetLogo colours the model gives cars. */
export const CAR_COLOUR = {
  stopped: 15,
  slow: 25,
} as const;

/** True for roads that ordinary cars drive on (not entry gates or destination access). */
export function isDrivable(road: RoadInfo): boolean {
  return road.carsAllowed && road.kind !== "gate" && road.kind !== "access";
}

/**
 * The drawing state the map reads on every screen refresh.
 *
 * Car positions change up to 60 times a second, far too often for React, so
 * they live in this plain object instead of React state.
 */

import {
  CAR_FIELDS,
  DEFAULT_SETTINGS,
  type SiteVolume,
  type ViewMode,
  type World,
} from "@traffic-lab/simulation";

export interface RenderStore {
  world: World | null;
  /** Goes up by one every time the road layout changes. */
  worldVersion: number;
  styles: Float32Array | null;
  /** The map view the road colours were made for. */
  stylesView: ViewMode;
  stylesVersion: number;
  /** Traffic entering each counted intersection, updated with the road colours. */
  sites: SiteVolume[] | null;
  /** The newest car positions. */
  cars: Float32Array;
  /** Where the cars were drawn when the newest positions arrived. */
  from: Float32Array;
  /** Car id → position of that car in `from`. */
  fromIndex: Map<number, number>;
  /** When the newest positions arrived (performance.now()). */
  frameAt: number;
  /** How long the cars take to glide to their newest positions, in ms. */
  duration: number;
  ticks: number;
  measured: number;
  frameVersion: number;
}

export function emptyStore(): RenderStore {
  return {
    world: null,
    worldVersion: 0,
    styles: null,
    stylesView: DEFAULT_SETTINGS["view-mode"],
    stylesVersion: 0,
    sites: null,
    cars: new Float32Array(0),
    from: new Float32Array(0),
    fromIndex: new Map(),
    frameAt: 0,
    duration: 0,
    ticks: 0,
    measured: 0,
    frameVersion: 0,
  };
}

/** How far the cars are through their glide, from 0 to 1. */
export function glideProgress(store: RenderStore, now: number): number {
  if (store.duration <= 0) {
    return 1;
  }
  return Math.min(1, (now - store.frameAt) / store.duration);
}

/**
 * Where each car is drawn right now, part-way between its last two positions.
 * The next glide starts from here, so cars never jump.
 */
export function carsOnScreen(store: RenderStore, now: number): Float32Array {
  const progress = glideProgress(store, now);
  if (progress >= 1 || store.from.length === 0) {
    return store.cars;
  }
  const shown = new Float32Array(store.cars);
  const from = store.from;
  for (let i = 0; i < shown.length; i += CAR_FIELDS) {
    const previous = store.fromIndex.get(shown[i]);
    if (previous === undefined) {
      continue;
    }
    shown[i + 1] = from[previous + 1] + (shown[i + 1] - from[previous + 1]) * progress;
    shown[i + 2] = from[previous + 2] + (shown[i + 2] - from[previous + 2]) * progress;
    const turn = ((shown[i + 3] - from[previous + 3] + 540) % 360) - 180;
    shown[i + 3] = from[previous + 3] + turn * progress;
  }
  return shown;
}

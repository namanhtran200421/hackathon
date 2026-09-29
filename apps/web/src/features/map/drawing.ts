/**
 * Helpers for drawing the traffic map on a canvas.
 *
 * Map positions are in model patches (1 patch = 10 metres), with y pointing up.
 * The canvas has y pointing down, so the map is flipped when it is drawn.
 */

import type { RoadInfo, ViewMode, World } from "@traffic-lab/simulation";

export interface Palette {
  road: string;
  access: string;
  restricted: string;
  light: string;
  busy: string;
  jam: string;
  more: string;
  less: string;
  closed: string;
  reduced: string;
  selected: string;
  hover: string;
  car: string;
  slow: string;
  stopped: string;
  gate: string;
  destination: string;
  label: string;
  halo: string;
  /** Seventeen shades from quiet grey to black, for the traffic volume view. */
  volume: string[];
}

export interface Extent {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Read the map colours from the CSS custom properties in styles/base.css. */
export function readPalette(element: HTMLElement): Palette {
  const css = getComputedStyle(element);

  function colour(name: string): string {
    const value = css.getPropertyValue(name).trim();
    if (value) {
      return value;
    }
    return "#888888";
  }

  function toRgb(hex: string): number[] {
    const number = parseInt(hex.replace("#", ""), 16);
    return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
  }

  const low = toRgb(colour("--vol-low"));
  const high = toRgb(colour("--vol-high"));
  const volume: string[] = [];
  for (let step = 0; step <= 16; step++) {
    const share = step / 16;
    const mixed = low.map(function (start, channel) {
      return Math.round(start + (high[channel] - start) * share);
    });
    volume.push("rgb(" + mixed.join(",") + ")");
  }

  return {
    road: colour("--road"),
    access: colour("--road-access"),
    restricted: colour("--road-restricted"),
    light: colour("--cong-light"),
    busy: colour("--cong-busy"),
    jam: colour("--cong-jam"),
    more: colour("--change-more"),
    less: colour("--change-less"),
    closed: colour("--closed"),
    reduced: colour("--reduced"),
    selected: colour("--map-selected"),
    hover: colour("--ink"),
    car: colour("--car"),
    slow: colour("--car-slow"),
    stopped: colour("--car-stopped"),
    gate: colour("--gate"),
    destination: colour("--dest"),
    label: colour("--muted"),
    halo: colour("--map-bg"),
    volume: volume,
  };
}

/**
 * The colour for one road. The model decides each road's state and gives it a
 * NetLogo colour number; this turns that number into the page's colours.
 */
export function roadColour(palette: Palette, view: ViewMode, netlogoColour: number): string {
  if (netlogoColour === 117) {
    return palette.restricted; // no cars allowed, such as Swanston St
  }
  if (netlogoColour === 6) {
    return palette.access;
  }
  if (view === "congestion") {
    if (netlogoColour === 44) {
      return palette.light;
    }
    if (netlogoColour === 25) {
      return palette.busy;
    }
    if (netlogoColour === 14) {
      return palette.jam;
    }
    return palette.road;
  }
  if (view === "volume") {
    // The model shades volume from light (few cars) to dark (many cars).
    if (netlogoColour >= 10 && netlogoColour < 20) {
      const busy = 1 - (netlogoColour - 10) / 9.9;
      return palette.volume[Math.round(busy * 16)];
    }
    return palette.road;
  }
  // Change from baseline.
  if (netlogoColour === 15) {
    return palette.more;
  }
  if (netlogoColour === 105) {
    return palette.less;
  }
  return palette.road;
}

/** The area covered by the roads and gates, so the map can fill the canvas. */
export function mapExtent(world: World): Extent {
  const extent = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };

  function include(x: number, y: number): void {
    extent.minX = Math.min(extent.minX, x);
    extent.maxX = Math.max(extent.maxX, x);
    extent.minY = Math.min(extent.minY, y);
    extent.maxY = Math.max(extent.maxY, y);
  }

  world.roads.forEach(function (road) {
    road.geometry.forEach(function (point) {
      include(point[0], point[1]);
    });
  });
  world.nodes.forEach(function (node) {
    include(node.x, node.y);
  });

  if (!Number.isFinite(extent.minX)) {
    return { minX: -120, maxX: 120, minY: -102, maxY: 102 };
  }
  return extent;
}

/** The closest point on a road to (x, y), and how far away it is. */
export function closestPointOnRoad(
  road: RoadInfo,
  x: number,
  y: number,
): { distance: number; x: number; y: number } {
  let best = { distance: Infinity, x: x, y: y };
  const points = road.geometry;
  for (let i = 0; i < points.length - 1; i++) {
    const startX = points[i][0];
    const startY = points[i][1];
    const dx = points[i + 1][0] - startX;
    const dy = points[i + 1][1] - startY;
    const lengthSquared = dx * dx + dy * dy;
    let along = 0;
    if (lengthSquared > 0) {
      along = Math.max(0, Math.min(1, ((x - startX) * dx + (y - startY) * dy) / lengthSquared));
    }
    const pointX = startX + along * dx;
    const pointY = startY + along * dy;
    const distance = Math.hypot(x - pointX, y - pointY);
    if (distance < best.distance) {
      best = { distance: distance, x: pointX, y: pointY };
    }
  }
  return best;
}

/** Road direction codes from the model, in words. */
export const DIRECTION_WORDS: Record<string, string> = {
  EB: "eastbound",
  WB: "westbound",
  NB: "northbound",
  SB: "southbound",
};

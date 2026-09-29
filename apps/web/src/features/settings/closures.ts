/**
 * Helpers for the road-closure controls.
 */

import { STYLE, isDrivable, type World } from "@traffic-lab/simulation";

export interface ClosedStreet {
  street: string;
  /** Directions closed completely. */
  closed: number;
  /** Directions with a lane closed. */
  narrowed: number;
}

/** Streets that currently have a closed direction or a closed lane, A to Z. */
export function closedStreets(world: World | null, styles: Float32Array | null): ClosedStreet[] {
  if (!world || !styles || styles.length !== world.roads.length * STYLE.fields) {
    return [];
  }
  const streets = new Map<string, ClosedStreet>();
  world.roads.forEach(function (road) {
    if (!isDrivable(road)) {
      return;
    }
    const at = road.index * STYLE.fields;
    const closed = styles[at + STYLE.closed] === 1;
    const narrowed = !closed && styles[at + STYLE.lanesOpen] < road.lanes;
    if (!closed && !narrowed) {
      return;
    }
    let entry = streets.get(road.street);
    if (!entry) {
      entry = { street: road.street, closed: 0, narrowed: 0 };
      streets.set(road.street, entry);
    }
    if (closed) {
      entry.closed = entry.closed + 1;
    } else {
      entry.narrowed = entry.narrowed + 1;
    }
  });
  return Array.from(streets.values()).sort(function (a, b) {
    return a.street.localeCompare(b.street);
  });
}

/** The parts of a street, for the "Which part" list. */
export function sectionsOf(world: World | null, street: string): number[] {
  if (!world) {
    return [];
  }
  const sections = new Set<number>();
  world.roads.forEach(function (road) {
    if (road.street === street && road.kind !== "gate" && road.kind !== "access" && road.section > 0) {
      sections.add(road.section);
    }
  });
  return Array.from(sections).sort(function (a, b) {
    return a - b;
  });
}

/** The model's description of closures, in plain words. */
export function describeClosures(text: string): string {
  if (text === "none") {
    return "Nothing closed";
  }
  const counts = /^(\d+) closed directions; (\d+) reduced lanes$/.exec(text);
  if (!counts) {
    return text;
  }
  if (counts[1] === "0" && counts[2] === "0") {
    return "Nothing closed";
  }
  return counts[1] + " road directions closed, " + counts[2] + " with a lane closed";
}

/** "Collins St / whole street" → "Collins St, whole street". */
export function describeSelection(text: string): string {
  return text.replace(" / ", ", ");
}

/** "2 directions closed · 1 with a lane closed" */
export function describeStreetClosure(street: ClosedStreet): string {
  const parts: string[] = [];
  if (street.closed === 1) {
    parts.push("1 direction closed");
  } else if (street.closed > 1) {
    parts.push(street.closed + " directions closed");
  }
  if (street.narrowed === 1) {
    parts.push("1 with a lane closed");
  } else if (street.narrowed > 1) {
    parts.push(street.narrowed + " with a lane closed");
  }
  return parts.join(" · ");
}

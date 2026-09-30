/**
 * The works form's starting values, and working out which closure on the
 * simulator's map to plan.
 */

import { STYLE, type ClosureType, type World } from "@traffic-lab/simulation";
import { closedStreets } from "../settings/closures";
import type { WorksClosure, WorksRequest } from "./types";

/** The form before anyone changes it. */
export function defaultRequest(closure: WorksClosure): WorksRequest {
  return {
    street: closure.street,
    section: closure.section,
    closureType: closure.closureType,
    workHours: 6,
    longestShift: 8,
    setupHours: 1,
    days: "either",
    times: "any",
    priority: "balanced",
    thoroughness: "quick",
  };
}

/**
 * The closure to plan, from the simulator's map.
 *
 * If a street is closed on the map, that street (the chosen one first, if it
 * is closed), closed the way it is on the map: lanes only when no direction
 * is fully closed. If nothing is closed, the street chosen in the simulator,
 * closed the way the simulator's closure setting says.
 */
export function closureToPlan(
  world: World | null,
  styles: Float32Array | null,
  chosenStreet: string,
  chosenSection: number,
  chosenType: ClosureType,
): WorksClosure {
  let closed = closedStreets(world, styles);
  if (!world || !styles || styles.length !== world.roads.length * STYLE.fields) {
    closed = [];
  }
  if (closed.length === 0) {
    return { street: chosenStreet, section: chosenSection, closureType: chosenType };
  }
  let target = closed[0];
  let section = 0;
  const chosen = closed.find(function (street) {
    return street.street === chosenStreet;
  });
  if (chosen) {
    target = chosen;
    section = chosenSection;
  }

  let closureType: ClosureType = chosenType;
  if (target.closed === 0) {
    closureType = "One lane each direction";
  } else if (closureType === "One lane each direction") {
    closureType = "Both directions";
  }
  return { street: target.street, section: section, closureType: closureType };
}

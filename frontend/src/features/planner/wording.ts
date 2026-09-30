/**
 * Plain words for the planner's times and numbers: "10 pm", "10 pm to 5 am",
 * "2 shifts", "about 18 car-hours".
 */

import { oneDp, whole } from "../../lib/format";
import type { DayType, Plan, Priority } from "./types";

/** A time of day in hours (21.5 = 9:30 pm) as "9:30 pm", "midnight" or "noon". */
export function timeOfDay(hours: number): string {
  const inDay = ((hours % 24) + 24) % 24;
  let hour = Math.floor(inDay);
  let minutes = Math.round((inDay - hour) * 60);
  if (minutes === 60) {
    hour = (hour + 1) % 24;
    minutes = 0;
  }
  if (minutes === 0 && hour === 0) {
    return "midnight";
  }
  if (minutes === 0 && hour === 12) {
    return "noon";
  }
  let suffix = "am";
  if (hour >= 12) {
    suffix = "pm";
  }
  let shown = hour % 12;
  if (shown === 0) {
    shown = 12;
  }
  if (minutes === 0) {
    return shown + " " + suffix;
  }
  return shown + ":" + String(minutes).padStart(2, "0") + " " + suffix;
}

/** "10 pm to 5:30 am" */
export function closedWindow(plan: Plan): string {
  return timeOfDay(plan.start) + " to " + timeOfDay(plan.start + plan.closedPerShift);
}

/** "1 shift", "3 shifts" */
export function shiftsText(count: number): string {
  if (count === 1) {
    return "1 shift";
  }
  return count + " shifts";
}

/** "7.5 hours", "1 hour" */
export function hoursText(hours: number): string {
  if (hours === 1) {
    return "1 hour";
  }
  return oneDp(hours) + " hours";
}

/** "weekday" / "weekend" */
export function dayWord(dayType: DayType): string {
  if (dayType === "weekend") {
    return "weekend";
  }
  return "weekday";
}

/** "weekday nights", "weekend mornings" and so on, from when the road closes. */
export function whenText(plan: Plan): string {
  const middle = (plan.start + plan.closedPerShift / 2) % 24;
  let part: string;
  if (middle >= 21 || middle < 5) {
    part = "nights";
  } else if (middle < 10) {
    part = "mornings";
  } else if (middle < 16) {
    part = "days";
  } else {
    part = "evenings";
  }
  return dayWord(plan.dayType) + " " + part;
}

/** Car-hours, rounded sensibly: "0.4", "18", "1,240". */
export function carHours(value: number): string {
  if (value < 10) {
    return oneDp(value);
  }
  return whole(value);
}

/** "12 to 25" or just "18" when every repeat agreed. */
export function rangeText(low: number, high: number): string {
  const lowText = carHours(low);
  const highText = carHours(high);
  if (lowText === highText) {
    return lowText;
  }
  return lowText + " to " + highText;
}

/** "about 3 minutes", "under a minute" */
export function durationText(seconds: number): string {
  if (seconds < 60) {
    return "under a minute";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes === 1) {
    return "about 1 minute";
  }
  return "about " + minutes + " minutes";
}

export const PRIORITY_TEXT: Record<Priority, { label: string; help: string }> = {
  "least-disruption": {
    label: "Least traffic disruption",
    help: "Pick the quietest times, even if the works take more shifts.",
  },
  balanced: {
    label: "Balanced",
    help: "Weighs up less delay against fewer shifts.",
  },
  "fewest-shifts": {
    label: "Finish in the fewest shifts",
    help: "Use the longest shifts the crew can work, then pick the quietest time for them.",
  },
};

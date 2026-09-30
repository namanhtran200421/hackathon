/**
 * The words the works planner uses: what the user asks for, and the plans it
 * compares.
 */

import type { ClosureType } from "@traffic-lab/simulation";

/** The two traffic patterns in the public detector data. */
export type DayType = "weekday" | "weekend";

export type AllowedDays = "either" | "weekdays" | "weekends";

/** "night" is 7 pm to 7 am; "day" is 7 am to 7 pm. */
export type AllowedTimes = "any" | "night" | "day";

export type Priority = "least-disruption" | "balanced" | "fewest-shifts";

/** Quick uses fewer repeats; thorough uses more and double-checks more plans. */
export type Thoroughness = "quick" | "thorough";

/** What the user needs to do, and the limits the plan must keep to. */
export interface WorksRequest {
  street: string;
  /** 0 means the whole street. */
  section: number;
  closureType: ClosureType;
  /** Hours of actual work needed in total. */
  workHours: number;
  /** The longest the crew can work in one go, in hours. */
  longestShift: number;
  /** Hours the road is closed but no work happens: setting up and packing away, per shift. */
  setupHours: number;
  days: AllowedDays;
  times: AllowedTimes;
  priority: Priority;
  thoroughness: Thoroughness;
}

/** How busy the city is in each quarter of an hour, as a share of the busiest quarter. */
export interface DayProfiles {
  weekday: number[];
  weekend: number[];
}

/** One way to do the works, with its tested cost. */
export interface Plan {
  dayType: DayType;
  /** Hour of the day the road closes, 0 to 23. */
  start: number;
  shifts: number;
  /** Hours of work in each shift. */
  workPerShift: number;
  /** Hours the road is closed each shift (work plus setting up), to the quarter hour. */
  closedPerShift: number;
  /** Extra car-hours in traffic over all shifts, one number per repeat (random seed). */
  samples: number[];
  /** The average of the samples. */
  typical: number;
  low: number;
  high: number;
  /** What the planner minimises: `typical` plus the priority's cost of each shift. */
  score: number;
}

/** A plan's busiest hour, re-tested directly at its real time of day. */
export interface DirectCheck {
  dayType: DayType;
  hour: number;
  /** What the traffic-level curve predicted, in extra car-hours per hour. */
  estimate: number;
  /** What the direct tests measured, one number per repeat. */
  measured: number[];
}

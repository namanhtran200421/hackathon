/**
 * How busy the city is through the day, from the public traffic detector data
 * (Department of Transport and Planning, August 2026). The model files include
 * it as /sim/observed-data.json: 96 quarter-hour shares of the busiest time,
 * one list for weekdays and one for weekends.
 */

import type { DayProfiles } from "./types";

function isProfile(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === 96 &&
    value.every(function (share) {
      return typeof share === "number" && share >= 0 && share <= 1.5;
    })
  );
}

export async function loadDayProfiles(): Promise<DayProfiles> {
  const response = await fetch("/sim/observed-data.json");
  if (!response.ok) {
    throw new Error("The public traffic data could not be loaded.");
  }
  const data = (await response.json()) as { factors?: { weekday?: unknown; weekend?: unknown } };
  const factors = data.factors || {};
  if (!isProfile(factors.weekday) || !isProfile(factors.weekend)) {
    throw new Error("The public traffic data is not in the expected format.");
  }
  return { weekday: factors.weekday, weekend: factors.weekend };
}

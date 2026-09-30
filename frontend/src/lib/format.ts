/**
 * Small helpers for showing numbers and times in Australian English.
 */

const oneDecimal = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 });
const twoDecimals = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 });
const wholeNumber = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const percentage = new Intl.NumberFormat("en-AU", {
  style: "percent",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

/** 1234.5 → "1,235" */
export function whole(value: number): string {
  return wholeNumber.format(value);
}

/** 3.14159 → "3.1" */
export function oneDp(value: number): string {
  return oneDecimal.format(value);
}

/** 3.14159 → "3.14" */
export function twoDp(value: number): string {
  return twoDecimals.format(value);
}

/** 0.25 → "+25%" */
export function percent(value: number): string {
  return percentage.format(value);
}

/** Seconds as a clock: 75 → "01:15", 3725 → "1:02:05". */
export function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const minutesAndSeconds = String(minutes).padStart(2, "0") + ":" + String(rest).padStart(2, "0");
  if (hours > 0) {
    return hours + ":" + minutesAndSeconds;
  }
  return minutesAndSeconds;
}

/** Seconds after midnight as a time of day: 29100 → "8:05 am", 45000 → "12:30 pm". */
export function timeOfDay(seconds: number): string {
  const minutesToday = Math.floor(Math.max(0, seconds) / 60) % (24 * 60);
  const hours = Math.floor(minutesToday / 60);
  const minutes = String(minutesToday % 60).padStart(2, "0");
  let shownHour = hours % 12;
  if (shownHour === 0) {
    shownHour = 12;
  }
  let half = "am";
  if (hours >= 12) {
    half = "pm";
  }
  return shownHour + ":" + minutes + " " + half;
}

/** A model start time such as "08:15" as seconds after midnight. */
export function startSeconds(startTime: string): number {
  const parts = startTime.split(":").map(Number);
  return parts[0] * 3600 + parts[1] * 60;
}

/** A signed change, using a real minus sign: -3 → "−3". */
export function signed(value: number, show: (value: number) => string): string {
  if (value > 0) {
    return "+" + show(value);
  }
  if (value < 0) {
    return "−" + show(Math.abs(value));
  }
  return show(0);
}

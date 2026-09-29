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

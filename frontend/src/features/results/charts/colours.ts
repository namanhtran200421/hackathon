/**
 * Chart colours. These passed the colour-blindness checks against a white
 * background. Text never uses them; they only colour lines, bars and keys.
 */

/** Line colours: this run and the baseline. */
export const SERIES = { run: "#4a3aa7", baseline: "#008300" } as const;

/** Bar colours: more traffic than the baseline, and less. */
export const CHANGE = { more: "#c25e00", less: "#1f66c2" } as const;

export type SeriesKey = keyof typeof SERIES;

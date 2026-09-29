/**
 * Simulation speeds, in seconds of traffic per real second. 0 means as fast as
 * the computer allows.
 */

export const SPEEDS: readonly number[] = [1, 2, 5, 10, 20, 30, 60, 0];
export const DEFAULT_SPEED = 20;

/** The speed as shown on the slider: 20 → "20×", 0 → "Max". */
export function speedLabel(speed: number): string {
  if (speed === 0) {
    return "Max";
  }
  return speed + "×";
}

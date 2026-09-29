/**
 * Round axis marks, such as 0, 100, 200, 300, that cover `max`.
 */

export function niceTicks(max: number, count?: number): number[] {
  const wanted = count || 4;
  if (!(max > 0)) {
    return [0, 1];
  }
  const rough = max / wanted;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  let step = rough;
  const steps = [1, 2, 2.5, 5, 10];
  for (let i = 0; i < steps.length; i++) {
    if (steps[i] * magnitude >= rough) {
      step = steps[i] * magnitude;
      break;
    }
  }
  const ticks: number[] = [];
  for (let value = 0; value <= max + step * 0.001; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }
  if (ticks[ticks.length - 1] < max) {
    ticks.push(ticks[ticks.length - 1] + step);
  }
  return ticks;
}

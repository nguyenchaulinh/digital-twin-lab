// Scale helpers for the line chart. Pure, so they can be tested without a DOM.

const roundTo = (value: number, digits: number): number => Number(value.toFixed(digits));

// Round ticks from 0 up to the first one at or above `max`: 0, 2, 4, 6 ... never an odd step like 1.7
export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / pow;
  const step = (([1, 2, 2.5, 5].find((f) => fraction <= f) ?? 10) * pow);
  const ticks: number[] = [];
  for (let i = 0; i <= 200; i++) {
    const value = roundTo(i * step, 10);
    ticks.push(value);
    if (value >= max) break;
  }
  return ticks;
}

// How many decimals a tick label needs so that every tick of the axis is written the same way
export function tickDecimals(ticks: readonly number[]): number {
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
  let digits = 0;
  while (digits < 6 && Math.abs(step * 10 ** digits - Math.round(step * 10 ** digits)) > 1e-9) digits++;
  return digits;
}

// Index of the value in the ascending `xs` that is closest to `x`; -1 when there are none
export function nearestIndex(xs: readonly number[], x: number): number {
  if (xs.length === 0) return -1;
  let low = 0;
  let high = xs.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (xs[mid] < x) low = mid + 1;
    else high = mid;
  }
  // `low` is the first value >= x; the one before it may be closer
  return low > 0 && x - xs[low - 1] <= xs[low] - x ? low - 1 : low;
}

// At most `maxRows` evenly spaced indices, always including the first and the last: the rows of the table view
export function sampleIndices(length: number, maxRows: number): number[] {
  if (length <= 0) return [];
  if (length <= maxRows || maxRows < 2) return length <= maxRows ? Array.from({ length }, (_, i) => i) : [length - 1];
  const picked = Array.from({ length: maxRows }, (_, i) => Math.round((i * (length - 1)) / (maxRows - 1)));
  return [...new Set(picked)];
}

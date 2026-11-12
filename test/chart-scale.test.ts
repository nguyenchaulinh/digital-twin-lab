// Scale helpers of the line chart. Run: npm run test:chartscale
import assert from "node:assert/strict";
import { nearestIndex, niceTicks, sampleIndices, tickDecimals } from "../src/chart-scale.ts";

// Ticks start at 0, are evenly spaced, and the last one covers the maximum
assert.deepEqual(niceTicks(10, 4), [0, 2.5, 5, 7.5, 10]);
assert.deepEqual(niceTicks(9.3, 4), [0, 2.5, 5, 7.5, 10]);
assert.deepEqual(niceTicks(100, 4), [0, 25, 50, 75, 100]);
assert.deepEqual(niceTicks(7, 4), [0, 2, 4, 6, 8]);
assert.deepEqual(niceTicks(0.3, 3), [0, 0.1, 0.2, 0.3]);
assert.deepEqual(niceTicks(1234, 4), [0, 500, 1000, 1500]);
for (const max of [0.004, 0.7, 1, 3.3, 42, 99.9, 512, 12345, 1e6]) {
  const ticks = niceTicks(max, 4);
  assert.equal(ticks[0], 0);
  assert.ok(ticks.at(-1)! >= max, `covers ${max}`);
  assert.ok(ticks.length >= 3 && ticks.length <= 8, `${max} gives ${ticks.length} ticks`);
  const step = ticks[1] - ticks[0];
  assert.ok(ticks.every((v, i) => Math.abs(v - i * step) < step * 1e-6), `even steps for ${max}`);
}
// Nothing to scale: a sane default axis, never NaN
for (const bad of [0, -5, NaN, Infinity]) assert.deepEqual(niceTicks(bad), [0, 1]);

// Labels share one number of decimals
assert.equal(tickDecimals([0, 2, 4]), 0);
assert.equal(tickDecimals([0, 2.5, 5]), 1);
assert.equal(tickDecimals([0, 0.1, 0.2]), 1);
assert.equal(tickDecimals([0, 0.25, 0.5]), 2);
assert.equal(tickDecimals([0]), 0);

// Nearest point for the crosshair
const xs = [0, 1, 2, 4, 8];
assert.equal(nearestIndex(xs, -3), 0);
assert.equal(nearestIndex(xs, 0.4), 0);
assert.equal(nearestIndex(xs, 0.6), 1);
assert.equal(nearestIndex(xs, 3.1), 3); // 4 is closer than 2
assert.equal(nearestIndex(xs, 2.9), 2); // 2 is closer than 4
assert.equal(nearestIndex(xs, 6), 3); // a tie goes to the earlier point
assert.equal(nearestIndex(xs, 100), 4);
assert.equal(nearestIndex([5], 1), 0);
assert.equal(nearestIndex([], 1), -1);

// Rows of the table view: bounded, ordered, first and last included
assert.deepEqual(sampleIndices(0, 24), []);
assert.deepEqual(sampleIndices(3, 24), [0, 1, 2]);
assert.deepEqual(sampleIndices(5, 5), [0, 1, 2, 3, 4]);
const rows = sampleIndices(1440, 24);
assert.equal(rows.length, 24);
assert.equal(rows[0], 0);
assert.equal(rows.at(-1), 1439);
assert.ok(rows.every((v, i) => i === 0 || v > rows[i - 1]));
assert.deepEqual(sampleIndices(100, 1), [99]);
assert.ok(new Set(sampleIndices(30, 29)).size === sampleIndices(30, 29).length, "no duplicates");

console.log("chart scale: all checks passed");

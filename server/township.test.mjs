// Checks for township parsing and instrumented floors. Run: npm run test:township
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { instrumentedFloors, loadTownship, parseTownship } from "./township.mjs";

// Short buildings: every floor is instrumented
assert.deepEqual(instrumentedFloors(1), [1]);
assert.deepEqual(instrumentedFloors(3), [1, 2, 3]);
assert.equal(instrumentedFloors(12).length, 12);

// Tall buildings: a sample spread from the first to the last level, strictly increasing
const tall = instrumentedFloors(39);
assert.equal(tall.length, 12);
assert.equal(tall[0], 1);
assert.equal(tall.at(-1), 39);
assert.ok(tall.every((f, i) => i === 0 || f > tall[i - 1]));

// Validation rejects malformed data
for (const bad of [null, {}, { buildings: [] }, { buildings: [{ id: "x1", levels: 5 }] }, { buildings: [{ id: "B1", levels: 0 }] }, { buildings: [{ id: "B1", levels: 5.5 }] }, { buildings: [{ id: "B1", levels: 5 }, { id: "B1", levels: 6 }] }]) {
  assert.throws(() => parseTownship(bad), /invalid township/);
}

// The committed data file parses, and every footprint is a polygon of finite coordinates
const url = new URL("../data/township.json", import.meta.url);
const parsed = loadTownship(url);
assert.ok(parsed.length >= 1);
const raw = JSON.parse(readFileSync(url, "utf8"));
for (const item of [...raw.buildings, ...raw.context]) {
  assert.ok(item.footprint.length >= 3);
  assert.ok(item.footprint.every((p) => p.length === 2 && p.every(Number.isFinite)));
}
assert.match(raw.license, /ODbL/);

console.log("township: all checks passed");

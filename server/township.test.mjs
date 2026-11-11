// Checks for township parsing and instrumented floors. Run: npm run test:township
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { instrumentedFloors, loadTownships, parseTownship } from "./township.mjs";

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
const ok = { id: "demo", buildings: [{ id: "S1", levels: 5 }] };
assert.deepEqual(parseTownship(ok).buildings, [{ id: "S1", name: "S1", levels: 5 }]);
const withBuildings = (buildings) => ({ id: "demo", buildings });
for (const bad of [
  null,
  {},
  { id: "Bad Id", buildings: ok.buildings },
  withBuildings([]),
  withBuildings([{ id: "x1", levels: 5 }]),
  withBuildings([{ id: "S1", levels: 0 }]),
  withBuildings([{ id: "S1", levels: 5.5 }]),
  withBuildings([{ id: "S1", levels: 5 }, { id: "S1", levels: 6 }]),
]) {
  assert.throws(() => parseTownship(bad), /invalid township/);
}

// The committed data files parse, building ids are unique across them, and the geometry is sane
const dir = new URL("../data/townships/", import.meta.url);
const townships = loadTownships(dir);
assert.ok(townships.length >= 2);
const isPoint = (p) => p.length === 2 && p.every(Number.isFinite);
for (const file of readdirSync(dir)) {
  const raw = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
  for (const item of [...raw.buildings, ...raw.context, ...raw.areas]) {
    assert.ok(item.footprint.length >= 3);
    assert.ok(item.footprint.every(isPoint));
  }
  for (const road of raw.roads) {
    assert.ok(road.pts.length >= 2 && road.pts.every(isPoint));
    assert.ok(Number.isFinite(road.w) && road.w > 0);
  }
  assert.ok(raw.areas.every((a) => ["green", "water", "sport", "parking"].includes(a.kind)));
  assert.match(raw.license, /ODbL/);
}

console.log("township: all checks passed");

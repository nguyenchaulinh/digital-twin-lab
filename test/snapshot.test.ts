// Checks for snapshot validation. Run: npm run test:snapshot
import assert from "node:assert/strict";
import { isSnapshot } from "../src/types.ts";

const base = {
  type: "snapshot",
  township: "ocean-park",
  simMinutes: 600,
  outside: 30,
  outsideSource: "synthetic",
  air: null,
  acKwh: 0,
  acPowerKw: 1,
  buildings: [{ id: "O1", acKwh: 0 }],
  rooms: [{ id: "O1-F1-A", building: "O1", floor: 1, temp: 27, ac: false }],
};
const ids = new Set(["O1"]);

assert.ok(isSnapshot(base, "ocean-park", ids));

// A snapshot of another township (e.g. one still in flight after switching) is dropped
assert.ok(!isSnapshot(base, "smart-city", ids));
assert.ok(!isSnapshot({ ...base, township: undefined }, "ocean-park", ids));

// Unknown buildings, bad numbers and malformed shapes are dropped
assert.ok(!isSnapshot(base, "ocean-park", new Set(["S1"])));
assert.ok(!isSnapshot({ ...base, rooms: [{ ...base.rooms[0], temp: 500 }] }, "ocean-park", ids));
assert.ok(!isSnapshot({ ...base, rooms: [{ ...base.rooms[0], id: "x" }] }, "ocean-park", ids));
assert.ok(!isSnapshot({ ...base, outside: "30" }, "ocean-park", ids));
assert.ok(!isSnapshot(null, "ocean-park", ids));

console.log("snapshot: all checks passed");

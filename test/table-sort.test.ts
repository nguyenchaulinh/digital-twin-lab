// Sorting and filtering of the building table. Run: npm run test:tablesort
import assert from "node:assert/strict";
import { arrange, nextSort, type SortRow } from "../src/table-sort.ts";

const rows: SortRow[] = [
  { id: "B1", name: "Beta", levels: 30, avgTemp: 24, alerts: 0, kwh: 5 },
  { id: "B2", name: "Alpha", levels: 20, avgTemp: 27, alerts: 3, kwh: 9 },
  { id: "B3", name: "Gamma", levels: 38, avgTemp: null, alerts: 0, kwh: 0 },
  { id: "B4", name: "Delta", levels: 20, avgTemp: 26, alerts: 1, kwh: 9 },
];
const ids = (list: Array<{ id: string }>): string[] => list.map((r) => r.id);

// No sort: the original order
assert.deepEqual(ids(arrange(rows, null, false)), ["B1", "B2", "B3", "B4"]);

// Names A to Z, numbers biggest first
assert.deepEqual(ids(arrange(rows, { key: "name", dir: "asc" }, false)), ["B2", "B1", "B4", "B3"]); // Alpha Beta Delta Gamma
assert.deepEqual(ids(arrange(rows, { key: "name", dir: "desc" }, false)), ["B3", "B4", "B1", "B2"]);
assert.deepEqual(ids(arrange(rows, { key: "alerts", dir: "desc" }, false)), ["B2", "B4", "B1", "B3"]);

// Stable: equal values keep their original order (B2 and B4 both have 9 kWh and 20 floors)
assert.deepEqual(ids(arrange(rows, { key: "kwh", dir: "desc" }, false)).slice(0, 2), ["B2", "B4"]);
assert.deepEqual(ids(arrange(rows, { key: "levels", dir: "asc" }, false)).slice(0, 2), ["B2", "B4"]);

// A missing temperature is last in both directions
assert.equal(arrange(rows, { key: "avgTemp", dir: "desc" }, false).at(-1)?.id, "B3");
assert.equal(arrange(rows, { key: "avgTemp", dir: "asc" }, false).at(-1)?.id, "B3");
assert.deepEqual(ids(arrange(rows, { key: "avgTemp", dir: "desc" }, false)), ["B2", "B4", "B1", "B3"]);

// Filter: rows without alerts are kept (hidden) after the visible ones, in original order
const filtered = arrange(rows, { key: "alerts", dir: "desc" }, true);
assert.deepEqual(filtered, [
  { id: "B2", visible: true },
  { id: "B4", visible: true },
  { id: "B1", visible: false },
  { id: "B3", visible: false },
]);
assert.ok(arrange(rows, null, false).every((r) => r.visible));
assert.ok(arrange([], null, true).length === 0);

// The input is never reordered
assert.deepEqual(ids(rows), ["B1", "B2", "B3", "B4"]);

// Header clicks: default direction, the opposite, then back to the original order
assert.deepEqual(nextSort(null, "name"), { key: "name", dir: "asc" });
assert.deepEqual(nextSort({ key: "name", dir: "asc" }, "name"), { key: "name", dir: "desc" });
assert.equal(nextSort({ key: "name", dir: "desc" }, "name"), null);
assert.deepEqual(nextSort(null, "kwh"), { key: "kwh", dir: "desc" });
assert.deepEqual(nextSort({ key: "kwh", dir: "desc" }, "kwh"), { key: "kwh", dir: "asc" });
assert.equal(nextSort({ key: "kwh", dir: "asc" }, "kwh"), null);
assert.deepEqual(nextSort({ key: "kwh", dir: "asc" }, "alerts"), { key: "alerts", dir: "desc" }); // another column starts over

console.log("table sort: all checks passed");

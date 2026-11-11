// Policy checks for the advisor. Run: npm run test:advisor
import assert from "node:assert/strict";
import { advise, summarize, type AdviceInput } from "../src/advisor.ts";

const base: AdviceInput = { roomTemp: 25, ac: false, outsideTemp: 21, aqi: 60, acPowerKw: 1 };
const withInput = (patch: Partial<AdviceInput>) => advise({ ...base, ...patch });

// Clean and cooler outside: ventilate; saving only counts when the AC is actually on
assert.equal(withInput({}).action, "open-windows");
assert.equal(withInput({ ac: true }).saveKw, 1);
assert.equal(withInput({ ac: false }).saveKw, 0);

// Health beats energy: unhealthy air means closed windows even when outside is cooler
assert.equal(withInput({ aqi: 160 }).action, "keep-closed");
assert.equal(withInput({ aqi: 160 }).saveKw, 0);
assert.equal(withInput({ aqi: 160, roomTemp: 28, outsideTemp: 22 }).action, "run-ac");
assert.equal(withInput({ aqi: 160, roomTemp: 28, ac: true }).action, "keep-closed");

// AQI boundary
assert.equal(withInput({ aqi: 100 }).action, "open-windows");
assert.equal(withInput({ aqi: 101 }).action, "keep-closed");

// No air data: never advise opening windows
assert.notEqual(withInput({ aqi: null }).action, "open-windows");
assert.equal(withInput({ aqi: null, roomTemp: 28 }).action, "run-ac");

// Warm outside: AC only when the room is above the comfort limit
assert.equal(withInput({ outsideTemp: 31, roomTemp: 28 }).action, "run-ac");
assert.equal(withInput({ outsideTemp: 31, roomTemp: 25 }).action, "no-action");
assert.equal(withInput({ outsideTemp: 31, roomTemp: 28, ac: true }).action, "no-action");

// Outside only counts as cooler by a margin
assert.equal(withInput({ outsideTemp: 24.5 }).action, "no-action");

// Reasons are keys (translated by the UI), and carry the AQI they refer to
assert.equal(withInput({}).reasonKey, "ventilate");
assert.equal(withInput({}).aqi, 60);
assert.equal(withInput({ aqi: 160 }).reasonKey, "unhealthy");
assert.equal(withInput({ aqi: null }).reasonKey, "noAqi");
assert.equal(withInput({ outsideTemp: 31, roomTemp: 28 }).reasonKey, "needsCooling");
assert.equal(withInput({ outsideTemp: 31, roomTemp: 25 }).reasonKey, "comfort");

const summary = summarize([withInput({ ac: true }), withInput({}), withInput({ aqi: 160 })]);
assert.deepEqual(summary.counts, { "open-windows": 2, "run-ac": 0, "keep-closed": 1, "no-action": 0 });
assert.equal(summary.saveKw, 1);

console.log("advisor policy: all checks passed");

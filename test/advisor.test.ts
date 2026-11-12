// Policy checks for the advisor. Run: npm run test:advisor
import assert from "node:assert/strict";
import {
  AQI_OVERRIDE_MAX,
  DEFAULT_THRESHOLDS,
  THRESHOLD_LIMITS,
  advise,
  isDefaultThresholds,
  sanitizeAqiOverride,
  sanitizeThresholds,
  summarize,
  type AdviceInput,
  type Thresholds,
} from "../src/advisor.ts";

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

// --- Adjustable thresholds ---
const custom = (patch: Partial<Thresholds>): Thresholds => ({ ...DEFAULT_THRESHOLDS, ...patch });
const withTh = (patch: Partial<AdviceInput>, th: Partial<Thresholds>) => advise({ ...base, ...patch, thresholds: custom(th) });

// Leaving thresholds out is the same as passing the defaults
assert.deepEqual(advise(base), advise({ ...base, thresholds: { ...DEFAULT_THRESHOLDS } }));

// A stricter AQI limit closes the windows sooner, a looser one keeps them open
assert.equal(withTh({ aqi: 80 }, { aqiVentMax: 50 }).action, "keep-closed");
assert.equal(withTh({ aqi: 80 }, { aqiVentMax: 50 }).reasonKey, "unhealthy");
assert.equal(withTh({ aqi: 150 }, { aqiVentMax: 150 }).action, "open-windows");
assert.equal(withTh({ aqi: 151 }, { aqiVentMax: 150 }).action, "keep-closed");

// The comfort limit decides when AC is needed, and how warm "outside helps" may be
assert.equal(withTh({ roomTemp: 25, outsideTemp: 31 }, { comfortMax: 24 }).action, "run-ac");
assert.equal(withTh({ roomTemp: 25, outsideTemp: 31 }, { comfortMax: 26 }).action, "no-action");
assert.equal(withTh({ roomTemp: 29, outsideTemp: 27 }, { comfortMax: 26 }).action, "run-ac"); // 27 > 26: outside does not help
assert.equal(withTh({ roomTemp: 29, outsideTemp: 27 }, { comfortMax: 28 }).action, "open-windows");

// The free-cooling margin
assert.equal(withTh({ outsideTemp: 24.5 }, { freeCoolingMinDelta: 0.5 }).action, "open-windows"); // 25 - 24.5 = 0.5
assert.equal(withTh({ outsideTemp: 24.5 }, { freeCoolingMinDelta: 1 }).action, "no-action");
assert.equal(withTh({ outsideTemp: 25 }, { freeCoolingMinDelta: 0 }).action, "open-windows"); // equal is enough with no margin

// Health still beats energy whatever the thresholds are
assert.equal(withTh({ aqi: 400, outsideTemp: 10 }, { aqiVentMax: 300 }).action, "keep-closed");
assert.notEqual(withTh({ aqi: null }, { aqiVentMax: 300 }).action, "open-windows");

// Sanitising: defaults for junk, snapped to the step, clamped to the limits
assert.deepEqual(sanitizeThresholds(undefined), DEFAULT_THRESHOLDS);
assert.deepEqual(sanitizeThresholds(null), DEFAULT_THRESHOLDS);
assert.deepEqual(sanitizeThresholds("x"), DEFAULT_THRESHOLDS);
assert.deepEqual(sanitizeThresholds({ aqiVentMax: "50", comfortMax: NaN, freeCoolingMinDelta: Infinity }), DEFAULT_THRESHOLDS);
assert.deepEqual(sanitizeThresholds({ aqiVentMax: 5000, comfortMax: -3, freeCoolingMinDelta: 99 }), { aqiVentMax: 300, comfortMax: 22, freeCoolingMinDelta: 5 });
assert.deepEqual(sanitizeThresholds({ aqiVentMax: 52, comfortMax: 26.3, freeCoolingMinDelta: 1.2 }), { aqiVentMax: 50, comfortMax: 26.5, freeCoolingMinDelta: 1 });
assert.deepEqual(sanitizeThresholds({ aqiVentMax: 75, extra: 1 }), { ...DEFAULT_THRESHOLDS, aqiVentMax: 75 }); // unknown keys are dropped
assert.equal(Object.keys(sanitizeThresholds({ __proto__: { aqiVentMax: 1 } })).length, 3);
for (const key of Object.keys(THRESHOLD_LIMITS) as Array<keyof Thresholds>) {
  const { min, max } = THRESHOLD_LIMITS[key];
  assert.ok(DEFAULT_THRESHOLDS[key] >= min && DEFAULT_THRESHOLDS[key] <= max, `default of ${key} is inside its limits`);
}
assert.ok(isDefaultThresholds(DEFAULT_THRESHOLDS));
assert.ok(!isDefaultThresholds(custom({ comfortMax: 27 })));

// The AQI override: whole numbers 0..500, anything else means "no override"
assert.equal(sanitizeAqiOverride("160"), 160);
assert.equal(sanitizeAqiOverride(160), 160);
assert.equal(sanitizeAqiOverride("0"), 0);
assert.equal(sanitizeAqiOverride("9999"), AQI_OVERRIDE_MAX);
for (const bad of ["", "  ", "abc", "-5", "1.5", "1e2x", null, undefined, NaN, {}]) {
  assert.equal(sanitizeAqiOverride(bad), null, `override ${String(bad)}`);
}

console.log("advisor policy: all checks passed");

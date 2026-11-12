// The energy record: what is counted, what is capped, and when it starts over. Run: npm run test:history
import assert from "node:assert/strict";
import { MAX_POINTS, SIM_TICK_MINUTES, createHistory, record, seriesOf, type Step } from "../src/history.ts";
import { estimateAcPowerKw } from "../src/model.ts";

const step = (simMinutes: number, kwh: Record<string, number>, avoidable: Record<string, number> = {}, changed = false): Step => ({
  simMinutes,
  assumptionsChanged: changed,
  buildings: Object.entries(kwh).map(([id, acKwh]) => ({ id, acKwh, avoidableKwh: avoidable[id] ?? 0 })),
});

// --- The first tick is only a baseline: whatever the simulator had already counted is not ours ---
{
  const h = createHistory();
  assert.equal(record(h, step(600, { B1: 40, B2: 10 })), "added");
  assert.equal(h.total.actual, 0);
  assert.equal(h.total.points.length, 1);

  assert.equal(record(h, step(605, { B1: 41, B2: 10.5 }, { B1: 0.25 })), "added");
  assert.equal(h.total.actual, 1.5);
  assert.equal(h.total.avoidable, 0.25);
  assert.equal(h.buildings.get("B1")?.actual, 1);
  assert.equal(h.buildings.get("B2")?.actual, 0.5);
  assert.equal(h.minutes, SIM_TICK_MINUTES);

  // The total is the sum of the buildings, in actual and in avoidable
  record(h, step(610, { B1: 42, B2: 11 }, { B1: 0.5, B2: 0.25 }));
  const sum = (key: "actual" | "avoidable") => [...h.buildings.values()].reduce((s, l) => s + l[key], 0);
  assert.ok(Math.abs(sum("actual") - h.total.actual) < 1e-9);
  assert.ok(Math.abs(sum("avoidable") - h.total.avoidable) < 1e-9);
}

// --- Avoidable can never exceed what was used in the same step ---
{
  const h = createHistory();
  record(h, step(0, { B1: 0 }));
  record(h, step(5, { B1: 0.2 }, { B1: 1 })); // rated power would say 1 kWh, the unit only used 0.2
  assert.equal(h.total.actual, 0.2);
  assert.equal(h.total.avoidable, 0.2);
  record(h, step(10, { B1: 0.2 }, { B1: 0.5 })); // nothing used, so nothing to avoid
  assert.equal(h.total.avoidable, 0.2);
  record(h, step(15, { B1: 0.7 }, { B1: -3 })); // a negative estimate is not a saving
  assert.equal(h.total.avoidable, 0.2);
}

// --- A repeated tick is ignored; going back in time means the simulator restarted ---
{
  const h = createHistory();
  record(h, step(100, { B1: 5 }));
  record(h, step(105, { B1: 6 }, { B1: 0.5 }));
  assert.equal(record(h, step(105, { B1: 6 }, { B1: 0.5 })), "ignored");
  assert.equal(h.total.actual, 1);
  assert.equal(h.total.points.length, 2);

  assert.equal(record(h, step(20, { B1: 0 })), "reset"); // clock went back
  assert.equal(h.total.actual, 0);
  assert.equal(h.total.points.length, 1);

  record(h, step(25, { B1: 3 }));
  assert.equal(record(h, step(30, { B1: 1 })), "reset"); // the energy counter went back
  assert.equal(h.total.actual, 0);
}

// --- A jump in the simulator clock (it kept ticking while this township was not watched) counts as one tick ---
{
  const h = createHistory();
  record(h, step(100, { B1: 5 }));
  record(h, step(2000, { B1: 5.5 }));
  assert.equal(h.minutes, SIM_TICK_MINUTES);
  assert.equal(h.total.actual, 0.5);
}

// --- A building the record never saw is skipped, not invented ---
{
  const h = createHistory();
  record(h, step(0, { B1: 0 }));
  record(h, step(5, { B1: 1, B9: 50 }));
  assert.equal(h.buildings.has("B9"), false);
  assert.equal(h.total.actual, 1);
}

// --- Changed assumptions are remembered, and forgotten on a reset ---
{
  const h = createHistory();
  record(h, step(0, { B1: 0 }));
  record(h, step(5, { B1: 1 }));
  assert.equal(h.tainted, false);
  record(h, step(10, { B1: 2 }, {}, true));
  assert.equal(h.tainted, true);
  record(h, step(15, { B1: 3 })); // stays marked
  assert.equal(h.tainted, true);
  record(h, step(1, { B1: 0 })); // reset
  assert.equal(h.tainted, false);
}

// --- The series is bounded, the totals are not ---
{
  const h = createHistory();
  record(h, step(0, { B1: 0 }));
  const ticks = MAX_POINTS + 50;
  for (let i = 1; i <= ticks; i++) record(h, step(i * 5, { B1: i }));
  assert.equal(h.total.points.length, MAX_POINTS);
  assert.equal(h.total.actual, ticks);
  const series = seriesOf(h, h.total);
  assert.ok(series);
  assert.equal(series.actual.at(-1), ticks);
  assert.equal(series.hours.length, MAX_POINTS);
  assert.ok(series.hours.every((x, i) => i === 0 || x > series.hours[i - 1]), "hours rise");
  assert.ok(series.actual.every((x, i) => i === 0 || x >= series.actual[i - 1]), "cumulative values never fall");
}
assert.equal(seriesOf(createHistory(), undefined), null);

// --- The twin's estimate of what a unit draws ---
assert.equal(estimateAcPowerKw(22, 1), 0); // at the setpoint
assert.equal(estimateAcPowerKw(20, 1), 0); // below it
assert.equal(estimateAcPowerKw(26, 1), 0.5); // half way to full load
assert.equal(estimateAcPowerKw(30, 1), 1);
assert.equal(estimateAcPowerKw(40, 1), 1); // never above the rating
assert.equal(estimateAcPowerKw(26, 2), 1); // scales with the rating

console.log("history: all checks passed");

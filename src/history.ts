// A running record of the AC energy of the township being viewed, kept by the viewer: what the
// simulator reported ("actual") next to what the advisor says could have been avoided. Pure (no DOM),
// so it can be tested. It starts when a township is opened and is dropped when it is left.

// One snapshot = one simulator tick = this many simulated minutes (STEP_MIN in server/sim.mjs)
export const SIM_TICK_MINUTES = 5;
// The series keeps the most recent points only (about 5 simulated days); the totals keep counting
export const MAX_POINTS = 1440;

export interface Point {
  minutes: number; // simulated minutes observed since the record began
  actual: number; // cumulative kWh since the record began
  avoidable: number; // cumulative kWh, estimated
}

export interface Ledger {
  actual: number;
  avoidable: number;
  points: Point[];
}

export interface History {
  lastSim: number | null;
  minutes: number;
  tainted: boolean; // some step was advised under a test AQI or changed thresholds
  lastKwh: Map<string, number>;
  total: Ledger;
  buildings: Map<string, Ledger>;
}

export interface StepBuilding {
  id: string;
  acKwh: number; // cumulative, as the snapshot reports it
  avoidableKwh: number; // estimated for this one step
}

export interface Step {
  simMinutes: number;
  assumptionsChanged: boolean;
  buildings: StepBuilding[];
}

const EPSILON = 1e-6;

const newLedger = (): Ledger => ({ actual: 0, avoidable: 0, points: [{ minutes: 0, actual: 0, avoidable: 0 }] });

export function createHistory(): History {
  return { lastSim: null, minutes: 0, tainted: false, lastKwh: new Map(), total: newLedger(), buildings: new Map() };
}

function start(h: History, step: Step): void {
  h.lastSim = step.simMinutes;
  h.minutes = 0;
  h.tainted = false;
  h.lastKwh = new Map(step.buildings.map((b) => [b.id, b.acKwh]));
  h.total = newLedger();
  h.buildings = new Map(step.buildings.map((b) => [b.id, newLedger()]));
}

function add(ledger: Ledger, actual: number, avoidable: number, minutes: number): void {
  ledger.actual += actual;
  ledger.avoidable += avoidable;
  ledger.points.push({ minutes, actual: ledger.actual, avoidable: ledger.avoidable });
  if (ledger.points.length > MAX_POINTS) ledger.points.shift();
}

// Returns "added" for a new tick, "ignored" for a repeat of the last one, "reset" when the
// simulator was restarted (its clock or its energy counters went back) and the record began again.
export function record(h: History, step: Step): "added" | "ignored" | "reset" {
  if (h.lastSim === null) {
    start(h, step);
    return "added";
  }
  const restarted =
    step.simMinutes < h.lastSim || step.buildings.some((b) => b.acKwh < (h.lastKwh.get(b.id) ?? 0) - EPSILON);
  if (restarted) {
    start(h, step);
    return "reset";
  }
  if (step.simMinutes === h.lastSim) return "ignored";

  h.minutes += SIM_TICK_MINUTES;
  h.lastSim = step.simMinutes;
  if (step.assumptionsChanged) h.tainted = true;
  let actualSum = 0;
  let avoidableSum = 0;
  for (const b of step.buildings) {
    const ledger = h.buildings.get(b.id);
    const before = h.lastKwh.get(b.id);
    if (!ledger || before === undefined) continue; // a building the record does not know
    const actual = Math.max(b.acKwh - before, 0);
    // What could be avoided can never be more than what was used in that step
    const avoidable = Math.min(Math.max(b.avoidableKwh, 0), actual);
    h.lastKwh.set(b.id, b.acKwh);
    add(ledger, actual, avoidable, h.minutes);
    actualSum += actual;
    avoidableSum += avoidable;
  }
  add(h.total, actualSum, avoidableSum, h.minutes);
  return "added";
}

// The shape the chart and the tiles read
export interface EnergySeries {
  hours: number[];
  actual: number[];
  avoidable: number[];
  totalActual: number;
  totalAvoidable: number;
  tainted: boolean;
}

export function seriesOf(h: History, ledger: Ledger | undefined): EnergySeries | null {
  if (!ledger) return null;
  return {
    hours: ledger.points.map((p) => p.minutes / 60),
    actual: ledger.points.map((p) => p.actual),
    avoidable: ledger.points.map((p) => p.avoidable),
    totalActual: ledger.actual,
    totalAvoidable: ledger.avoidable,
    tainted: h.tainted,
  };
}

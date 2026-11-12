// Ventilation / AC advisor (analysis layer). Policy: health first, energy second.
//  1. Never advise opening windows unless the outside air is known to be clean enough.
//  2. If the outside air is clean and cooler than the room, ventilate instead of running AC.
//  3. Otherwise cool with AC only when the room is above the comfort limit.
// The thresholds are tunable assumptions, not standards: the defaults are below and the viewer lets
// the user change them within THRESHOLD_LIMITS.
// The advice carries a reason key, not text, so the UI can translate it.

export interface Thresholds {
  aqiVentMax: number; // windows may be opened only up to this AQI
  comfortMax: number; // °C, above this a room needs cooling
  freeCoolingMinDelta: number; // °C, outside must be at least this much cooler than the room
}

export const DEFAULT_THRESHOLDS: Readonly<Thresholds> = {
  aqiVentMax: 100, // US EPA "Moderate" upper bound
  comfortMax: 26,
  freeCoolingMinDelta: 1,
};

// What the user may set, and in which steps
export const THRESHOLD_LIMITS: Readonly<Record<keyof Thresholds, { min: number; max: number; step: number }>> = {
  aqiVentMax: { min: 0, max: 300, step: 5 },
  comfortMax: { min: 22, max: 30, step: 0.5 },
  freeCoolingMinDelta: { min: 0, max: 5, step: 0.5 },
};

export const AQI_OVERRIDE_MAX = 500;

// Anything that is not a finite number falls back to the default; numbers are snapped to the step
// and clamped to the limits. Used for values from the sliders and from localStorage.
export function sanitizeThresholds(input: unknown): Thresholds {
  const source = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_THRESHOLDS };
  for (const key of Object.keys(THRESHOLD_LIMITS) as Array<keyof Thresholds>) {
    const value = source[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const { min, max, step } = THRESHOLD_LIMITS[key];
    const snapped = Math.round((value - min) / step) * step + min;
    out[key] = Math.min(Math.max(Math.round(snapped * 1000) / 1000, min), max);
  }
  return out;
}

// The demo AQI override: a whole number from 0 to AQI_OVERRIDE_MAX, or null for "no override"
export function sanitizeAqiOverride(input: unknown): number | null {
  const value = typeof input === "string" && input.trim() !== "" ? Number(input) : input;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  return Math.min(value, AQI_OVERRIDE_MAX);
}

export const isDefaultThresholds = (t: Thresholds): boolean =>
  (Object.keys(DEFAULT_THRESHOLDS) as Array<keyof Thresholds>).every((key) => t[key] === DEFAULT_THRESHOLDS[key]);

export type AdviceAction = "open-windows" | "run-ac" | "keep-closed" | "no-action";
export type ReasonKey = "noAqi" | "unhealthy" | "ventilate" | "needsCooling" | "comfort";

export interface AdviceInput {
  roomTemp: number;
  ac: boolean;
  outsideTemp: number;
  aqi: number | null; // null when there is no air quality data
  acPowerKw: number; // rated power of the room's AC unit
  thresholds?: Thresholds; // the defaults when left out
}

export interface Advice {
  action: AdviceAction;
  reasonKey: ReasonKey;
  aqi: number | null; // the AQI the reason refers to, if any
  saveKw: number; // upper bound on the power saved if the advice is followed
}

export function advise(input: AdviceInput): Advice {
  const { roomTemp, ac, outsideTemp, aqi, acPowerKw } = input;
  const { aqiVentMax, comfortMax, freeCoolingMinDelta } = input.thresholds ?? DEFAULT_THRESHOLDS;
  const needsCooling = roomTemp > comfortMax && !ac;

  if (aqi === null) {
    return { action: needsCooling ? "run-ac" : "no-action", reasonKey: "noAqi", aqi, saveKw: 0 };
  }
  if (aqi > aqiVentMax) {
    return { action: needsCooling ? "run-ac" : "keep-closed", reasonKey: "unhealthy", aqi, saveKw: 0 };
  }
  const outsideHelps = outsideTemp <= roomTemp - freeCoolingMinDelta && outsideTemp <= comfortMax;
  if (outsideHelps) {
    return { action: "open-windows", reasonKey: "ventilate", aqi, saveKw: ac ? acPowerKw : 0 };
  }
  if (needsCooling) return { action: "run-ac", reasonKey: "needsCooling", aqi, saveKw: 0 };
  return { action: "no-action", reasonKey: "comfort", aqi, saveKw: 0 };
}

export function summarize(advices: Advice[]): { counts: Record<AdviceAction, number>; saveKw: number } {
  const counts: Record<AdviceAction, number> = { "open-windows": 0, "run-ac": 0, "keep-closed": 0, "no-action": 0 };
  let saveKw = 0;
  for (const a of advices) {
    counts[a.action] += 1;
    saveKw += a.saveKw;
  }
  return { counts, saveKw };
}

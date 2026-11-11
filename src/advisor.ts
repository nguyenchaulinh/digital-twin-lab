// Ventilation / AC advisor (analysis layer). Policy: health first, energy second.
//  1. Never advise opening windows unless the outside air is known to be clean enough.
//  2. If the outside air is clean and cooler than the room, ventilate instead of running AC.
//  3. Otherwise cool with AC only when the room is above the comfort limit.
// The thresholds are tunable assumptions, not standards.
export const AQI_VENT_MAX = 100; // US EPA "Moderate" upper bound
export const COMFORT_MAX = 26; // °C
export const FREE_COOLING_MIN_DELTA = 1; // outside must be at least this much cooler than the room

export type AdviceAction = "open-windows" | "run-ac" | "keep-closed" | "no-action";

export interface AdviceInput {
  roomTemp: number;
  ac: boolean;
  outsideTemp: number;
  aqi: number | null; // null when there is no air quality data
  acPowerKw: number; // rated power of the room's AC unit
}

export interface Advice {
  action: AdviceAction;
  reason: string;
  saveKw: number; // upper bound on the power saved if the advice is followed
}

export function advise(input: AdviceInput): Advice {
  const { roomTemp, ac, outsideTemp, aqi, acPowerKw } = input;
  const needsCooling = roomTemp > COMFORT_MAX && !ac;

  if (aqi === null) {
    return {
      action: needsCooling ? "run-ac" : "no-action",
      reason: "No air quality data, so opening windows is not advised",
      saveKw: 0,
    };
  }
  if (aqi > AQI_VENT_MAX) {
    return {
      action: needsCooling ? "run-ac" : "keep-closed",
      reason: `AQI ${aqi} is unhealthy: keep windows closed`,
      saveKw: 0,
    };
  }
  const outsideHelps = outsideTemp <= roomTemp - FREE_COOLING_MIN_DELTA && outsideTemp <= COMFORT_MAX;
  if (outsideHelps) {
    return {
      action: "open-windows",
      reason: `Outside is cooler and AQI ${aqi} is acceptable: ventilate instead of AC`,
      saveKw: ac ? acPowerKw : 0,
    };
  }
  if (needsCooling) {
    return { action: "run-ac", reason: "Room is above the comfort limit and outside air does not help", saveKw: 0 };
  }
  return { action: "no-action", reason: "Within the comfort range", saveKw: 0 };
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

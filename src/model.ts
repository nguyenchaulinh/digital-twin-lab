// The twin's own thermal model. Deliberately NOT identical to the simulator's
// "real" physics: a twin is an approximation, and drift vs reality is expected.
const K_ENV = 0.012;
const K_AC = 0.07;
const AC_SETPOINT = 22;
const ASSUMED_HEAT = 0.02;
const STEP_MIN = 5;

export const ALERT_TEMP = 25;

export function predictTemp(temp: number, outside: number, ac: boolean, minutes: number): number {
  let t = temp;
  for (let m = 0; m < minutes; m += STEP_MIN) {
    const cooling = ac ? K_AC * Math.max(t - AC_SETPOINT, 0) : 0;
    t += STEP_MIN * (K_ENV * (outside - t) + ASSUMED_HEAT - cooling);
  }
  return t;
}

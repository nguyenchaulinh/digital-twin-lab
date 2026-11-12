import * as THREE from "three";

// The temperature scale is clamped to this range: anything cooler is the coolest colour, anything
// warmer the hottest. The legend (hud.ts) is drawn from the same two numbers.
export const TEMP_MIN = 20;
export const TEMP_MAX = 30;

// Buildings (or rooms) without a reading
export const NO_DATA_COLOR = 0x475569;

// Blue (cool) to red (hot)
export function tempColor(temp: number): THREE.Color {
  const k = Math.min(Math.max((temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN), 0), 1);
  return new THREE.Color().setHSL((1 - k) * 0.6, 0.75, 0.5);
}

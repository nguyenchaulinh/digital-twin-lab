import * as THREE from "three";

const TEMP_MIN = 20;
const TEMP_MAX = 30;

// Blue (cool) to red (hot)
export function tempColor(temp: number): THREE.Color {
  const k = Math.min(Math.max((temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN), 0), 1);
  return new THREE.Color().setHSL((1 - k) * 0.6, 0.75, 0.5);
}

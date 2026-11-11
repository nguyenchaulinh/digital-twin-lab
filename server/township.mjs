// Township data for the simulator: validation and the choice of instrumented floors.
import { readFileSync } from "node:fs";

const MAX_INSTRUMENTED_FLOORS = 12;
const BUILDING_ID = /^B\d{1,2}$/;
const MAX_BUILDINGS = 50;
const MAX_LEVELS = 200;

// A 39-storey tower cannot be simulated floor by floor, so a sample of floors is instrumented.
// Floors are spread evenly from the first to the last level.
export function instrumentedFloors(levels, max = MAX_INSTRUMENTED_FLOORS) {
  const count = Math.min(levels, max);
  if (count <= 1) return [1];
  return Array.from({ length: count }, (_, i) => 1 + Math.round((i * (levels - 1)) / (count - 1)));
}

export function parseTownship(raw) {
  const list = raw?.buildings;
  if (!Array.isArray(list) || list.length < 1 || list.length > MAX_BUILDINGS) throw new Error("invalid township: buildings");
  const seen = new Set();
  return list.map((b) => {
    if (!BUILDING_ID.test(b?.id) || seen.has(b.id)) throw new Error("invalid township: building id");
    seen.add(b.id);
    if (!Number.isInteger(b.levels) || b.levels < 1 || b.levels > MAX_LEVELS) throw new Error("invalid township: levels");
    return { id: b.id, name: String(b.name ?? b.id).slice(0, 60), levels: b.levels };
  });
}

export function loadTownship(url) {
  return parseTownship(JSON.parse(readFileSync(url, "utf8")));
}

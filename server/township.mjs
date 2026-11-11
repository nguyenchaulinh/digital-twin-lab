// Township data for the simulator: validation and the choice of instrumented floors.
import { readdirSync, readFileSync } from "node:fs";

const MAX_INSTRUMENTED_FLOORS = 12;
const BUILDING_ID = /^[A-Z]\d{1,2}$/;
const TOWNSHIP_ID = /^[a-z][a-z-]{0,30}$/;
const FILE_NAME = /^[a-z][a-z-]{0,30}\.json$/;
const MAX_BUILDINGS_PER_TOWNSHIP = 50;
const MAX_LEVELS = 200;

// A 39-storey tower cannot be simulated floor by floor, so a sample of floors is instrumented.
// Floors are spread evenly from the first to the last level.
export function instrumentedFloors(levels, max = MAX_INSTRUMENTED_FLOORS) {
  const count = Math.min(levels, max);
  if (count <= 1) return [1];
  return Array.from({ length: count }, (_, i) => 1 + Math.round((i * (levels - 1)) / (count - 1)));
}

// RegExp.test() coerces its argument, so undefined would be tested as the string "undefined"
const matches = (pattern, value) => typeof value === "string" && pattern.test(value);

export function parseTownship(raw) {
  if (!matches(TOWNSHIP_ID, raw?.id)) throw new Error("invalid township: id");
  const list = raw.buildings;
  if (!Array.isArray(list) || list.length < 1 || list.length > MAX_BUILDINGS_PER_TOWNSHIP) {
    throw new Error("invalid township: buildings");
  }
  const seen = new Set();
  const buildings = list.map((b) => {
    if (!matches(BUILDING_ID, b?.id) || seen.has(b.id)) throw new Error("invalid township: building id");
    seen.add(b.id);
    if (!Number.isInteger(b.levels) || b.levels < 1 || b.levels > MAX_LEVELS) throw new Error("invalid township: levels");
    return { id: b.id, name: String(b.name ?? b.id).slice(0, 60), levels: b.levels };
  });
  return { id: raw.id, name: String(raw.name ?? raw.id).slice(0, 80), buildings };
}

// Loads every data/townships/*.json; building ids must be unique across all of them
export function loadTownships(dirUrl) {
  const files = readdirSync(dirUrl).filter((f) => FILE_NAME.test(f)).sort();
  if (files.length === 0) throw new Error("invalid township: no data files");
  const townships = files.map((f) => parseTownship(JSON.parse(readFileSync(new URL(f, dirUrl), "utf8"))));
  const ids = townships.flatMap((t) => t.buildings.map((b) => b.id));
  if (new Set(ids).size !== ids.length || new Set(townships.map((t) => t.id)).size !== townships.length) {
    throw new Error("invalid township: duplicate id");
  }
  return townships;
}

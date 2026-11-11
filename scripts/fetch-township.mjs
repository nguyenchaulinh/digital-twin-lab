// One-off extract of building footprints around Vinhomes Smart City (Hanoi) from OpenStreetMap.
// Writes data/township.json. Run: npm run fetch:township
// Data: © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)
import { mkdirSync, writeFileSync } from "node:fs";

// Centre of the "Vinhomes Smart City" landuse polygon as returned by Nominatim
const SEED = { lat: 21.0023359, lon: 105.7377569 };
const SEARCH_RADIUS_M = 900;
const MAX_BUILDINGS = 8;
const CONTEXT_RADIUS_M = 500;
const MAX_CONTEXT = 80;
const DEFAULT_CONTEXT_LEVELS = { house: 2, terrace: 3, school: 3, kindergarten: 2 };
const FALLBACK_CONTEXT_LEVELS = 2;
const OUT_FILE = new URL("../data/township.json", import.meta.url);

const M_PER_DEG_LAT = 111320;

async function fetchBuildings() {
  const query = `[out:json][timeout:30];way["building"](around:${SEARCH_RADIUS_M},${SEED.lat},${SEED.lon});out tags geom;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "User-Agent": "digital-twin-lab/0.1 (learning project)", "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  return (await res.json()).elements;
}

function ring(way) {
  const pts = way.geometry.map((p) => ({ lat: p.lat, lon: p.lon }));
  const first = pts[0];
  const last = pts.at(-1);
  if (pts.length > 1 && first.lat === last.lat && first.lon === last.lon) pts.pop();
  return pts;
}

function centroid(pts) {
  return {
    lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
    lon: pts.reduce((s, p) => s + p.lon, 0) / pts.length,
  };
}

const metersBetween = (a, b) => {
  const dx = (a.lon - b.lon) * M_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180);
  const dy = (a.lat - b.lat) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy);
};

const levelsOf = (tags) => {
  const n = Number.parseInt(tags["building:levels"], 10);
  return Number.isInteger(n) && n >= 1 && n <= 200 ? n : null;
};

const ways = (await fetchBuildings()).filter((w) => Array.isArray(w.geometry) && w.geometry.length >= 4);

// Instrumented buildings: named apartment blocks with a known number of levels, nearest to the seed first
const candidates = ways
  .filter((w) => w.tags.building === "apartments" && w.tags.name && (levelsOf(w.tags) ?? 0) >= 3)
  .map((w) => ({ way: w, pts: ring(w) }))
  .map((c) => ({ ...c, c: centroid(c.pts) }))
  .sort((a, b) => metersBetween(a.c, SEED) - metersBetween(b.c, SEED))
  .slice(0, MAX_BUILDINGS);
if (candidates.length === 0) throw new Error("No named apartment buildings found");

const origin = centroid(candidates.map((c) => c.c));
const project = (p) => [
  Math.round((p.lon - origin.lon) * M_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180) * 10) / 10, // east
  Math.round((p.lat - origin.lat) * M_PER_DEG_LAT * 10) / 10, // north
];

const chosenIds = new Set(candidates.map((c) => c.way.id));
const buildings = candidates
  .sort((a, b) => metersBetween(a.c, origin) - metersBetween(b.c, origin))
  .map((c, i) => ({
    id: `B${i + 1}`,
    osmId: c.way.id,
    name: String(c.way.tags.name).slice(0, 60),
    levels: levelsOf(c.way.tags),
    footprint: c.pts.map(project),
  }));

// Context: every other building nearby, footprint only, to give the township its urban fabric
const context = ways
  .filter((w) => !chosenIds.has(w.id))
  .map((w) => ({ way: w, pts: ring(w) }))
  .map((c) => ({ ...c, d: metersBetween(centroid(c.pts), origin) }))
  .filter((c) => c.d <= CONTEXT_RADIUS_M)
  .sort((a, b) => a.d - b.d)
  .slice(0, MAX_CONTEXT)
  .map((c) => ({
    osmId: c.way.id,
    kind: c.way.tags.building,
    levels: levelsOf(c.way.tags) ?? DEFAULT_CONTEXT_LEVELS[c.way.tags.building] ?? FALLBACK_CONTEXT_LEVELS,
    levelsAssumed: levelsOf(c.way.tags) === null,
    footprint: c.pts.map(project),
  }));

const out = {
  name: "Vinhomes Smart City (Tay Mo, Hanoi)",
  source: "OpenStreetMap via Overpass API",
  license: "ODbL 1.0 - (c) OpenStreetMap contributors - https://www.openstreetmap.org/copyright",
  generated: new Date().toISOString().slice(0, 10),
  origin: { lat: Number(origin.lat.toFixed(6)), lon: Number(origin.lon.toFixed(6)) },
  buildings,
  context,
};

mkdirSync(new URL("../data/", import.meta.url), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(out) + "\n");
console.log(`Wrote ${buildings.length} buildings and ${context.length} context footprints`);
for (const b of buildings) console.log(` ${b.id} ${b.name} levels=${b.levels} points=${b.footprint.length}`);

// One-off extract of townships from OpenStreetMap: tower footprints, surrounding buildings, roads,
// green areas, water, sports pitches and parking. Writes data/townships/<id>.json.
// Run: npm run fetch:township            (all townships)
//      npm run fetch:township -- ocean-park   (one)
// Data: © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)
import { mkdirSync, writeFileSync } from "node:fs";

// Seeds are the centre of each "Vinhomes ..." landuse polygon as returned by Nominatim
const TOWNSHIPS = [
  { id: "smart-city", name: "Vinhomes Smart City (Tay Mo, Hanoi)", shortName: "Smart City", prefix: "S", seed: { lat: 21.0023359, lon: 105.7377569 } },
  { id: "ocean-park", name: "Vinhomes Ocean Park (Gia Lam, Hanoi)", shortName: "Ocean Park", prefix: "O", seed: { lat: 20.9942646, lon: 105.948475 } },
];

const BUILDING_RADIUS_M = 900;
const GROUND_RADIUS_M = 700;
const MAX_TOWERS = 8;
const CONTEXT_RADIUS_M = 600;
const MAX_CONTEXT = 160;
const MAX_ROADS = 800;
const MAX_AREAS = 300;
const DEFAULT_CONTEXT_LEVELS = { house: 2, terrace: 3, school: 3, kindergarten: 2 };
const FALLBACK_CONTEXT_LEVELS = 2;
const M_PER_DEG_LAT = 111320;
const REQUEST_GAP_MS = 5000;
const MAX_ATTEMPTS = 5;
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const TRANSIENT_STATUS = new Set([429, 502, 503, 504]);

// Road width in metres by highway class; classes not listed are skipped
const ROAD_WIDTH = {
  motorway: 14, trunk: 12, primary: 12, secondary: 10, tertiary: 8, unclassified: 6, residential: 6,
  living_street: 5, service: 4, pedestrian: 4, track: 3, cycleway: 2, footway: 1.6, path: 1.2, steps: 1.6,
};

function areaKind(tags) {
  if (tags.natural === "water" || tags.leisure === "swimming_pool") return "water";
  if (tags.leisure === "pitch" || tags.leisure === "sports_centre") return "sport";
  if (tags.amenity === "parking") return "parking";
  const green = ["park", "garden", "playground", "recreation_ground"].includes(tags.leisure)
    || ["grass", "recreation_ground", "forest", "meadow"].includes(tags.landuse)
    || tags.natural === "wood";
  return green ? "green" : null;
}

async function fetchElements({ lat, lon }) {
  const around = (r) => `(around:${r},${lat},${lon})`;
  const query = `[out:json][timeout:90];(
    way["building"]${around(BUILDING_RADIUS_M)};
    way["highway"]${around(GROUND_RADIUS_M)};
    way["leisure"~"^(park|garden|pitch|playground|sports_centre|swimming_pool|recreation_ground)$"]${around(GROUND_RADIUS_M)};
    way["natural"~"^(water|wood)$"]${around(GROUND_RADIUS_M)};
    way["landuse"~"^(grass|recreation_ground|forest|meadow)$"]${around(GROUND_RADIUS_M)};
    way["amenity"="parking"]${around(GROUND_RADIUS_M)};
  );out tags geom;`;
  // The public server is often busy: retry transient errors with a growing pause
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "User-Agent": "digital-twin-lab/0.1 (learning project)", "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(query),
      signal: AbortSignal.timeout(150000),
    });
    if (res.ok) return (await res.json()).elements.filter((w) => Array.isArray(w.geometry) && w.geometry.length >= 2);
    if (!TRANSIENT_STATUS.has(res.status) || attempt === MAX_ATTEMPTS) throw new Error(`Overpass HTTP ${res.status}`);
    const pause = REQUEST_GAP_MS * attempt * 2;
    console.log(`Overpass HTTP ${res.status}, retrying in ${pause / 1000}s (attempt ${attempt}/${MAX_ATTEMPTS})`);
    await new Promise((r) => setTimeout(r, pause));
  }
  throw new Error("unreachable");
}

const toPoints = (way) => way.geometry.map((p) => ({ lat: p.lat, lon: p.lon }));

function closedRing(way) {
  const pts = toPoints(way);
  const first = pts[0];
  const last = pts.at(-1);
  if (pts.length < 4 || first.lat !== last.lat || first.lon !== last.lon) return null;
  pts.pop();
  return pts;
}

const centroid = (pts) => ({
  lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
  lon: pts.reduce((s, p) => s + p.lon, 0) / pts.length,
});

const metersBetween = (a, b) =>
  Math.hypot((a.lon - b.lon) * M_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180), (a.lat - b.lat) * M_PER_DEG_LAT);

const levelsOf = (tags) => {
  const n = Number.parseInt(tags["building:levels"], 10);
  return Number.isInteger(n) && n >= 1 && n <= 200 ? n : null;
};

function extract(township, elements) {
  const { seed, prefix } = township;
  const buildings = elements.filter((w) => w.tags.building);

  // Towers: named apartment blocks with a known number of levels, nearest to the seed first
  const towers = buildings
    .filter((w) => w.tags.building === "apartments" && w.tags.name && (levelsOf(w.tags) ?? 0) >= 3)
    .map((w) => ({ way: w, pts: closedRing(w) }))
    .filter((c) => c.pts)
    .map((c) => ({ ...c, c: centroid(c.pts) }))
    .sort((a, b) => metersBetween(a.c, seed) - metersBetween(b.c, seed))
    .slice(0, MAX_TOWERS);
  if (towers.length === 0) throw new Error(`${township.id}: no named apartment buildings found`);

  const origin = centroid(towers.map((c) => c.c));
  const project = (p) => [
    Math.round((p.lon - origin.lon) * M_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180) * 10) / 10, // east
    Math.round((p.lat - origin.lat) * M_PER_DEG_LAT * 10) / 10, // north
  ];
  const within = (pts, radius) => pts.some((p) => metersBetween(p, origin) <= radius);

  const towerIds = new Set(towers.map((c) => c.way.id));
  const towerOut = towers
    .sort((a, b) => metersBetween(a.c, origin) - metersBetween(b.c, origin))
    .map((c, i) => ({
      id: `${prefix}${i + 1}`,
      osmId: c.way.id,
      name: String(c.way.tags.name).slice(0, 60),
      levels: levelsOf(c.way.tags),
      footprint: c.pts.map(project),
    }));

  const context = buildings
    .filter((w) => !towerIds.has(w.id))
    .map((w) => ({ way: w, pts: closedRing(w) }))
    .filter((c) => c.pts)
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

  const roads = elements
    .filter((w) => ROAD_WIDTH[w.tags.highway] && within(toPoints(w), GROUND_RADIUS_M))
    .slice(0, MAX_ROADS)
    .map((w) => ({ kind: w.tags.highway, w: ROAD_WIDTH[w.tags.highway], pts: toPoints(w).map(project) }));

  const areas = elements
    .filter((w) => !w.tags.building && areaKind(w.tags))
    .map((w) => ({ way: w, ring: closedRing(w) }))
    .filter((a) => a.ring && within(a.ring, GROUND_RADIUS_M))
    .slice(0, MAX_AREAS)
    .map((a) => ({ kind: areaKind(a.way.tags), footprint: a.ring.map(project) }));

  return {
    id: township.id,
    name: township.name,
    shortName: township.shortName,
    source: "OpenStreetMap via Overpass API",
    license: "ODbL 1.0 - (c) OpenStreetMap contributors - https://www.openstreetmap.org/copyright",
    generated: new Date().toISOString().slice(0, 10),
    origin: { lat: Number(origin.lat.toFixed(6)), lon: Number(origin.lon.toFixed(6)) },
    buildings: towerOut,
    context,
    roads,
    areas,
  };
}

const only = process.argv[2];
const selected = TOWNSHIPS.filter((t) => !only || t.id === only);
if (selected.length === 0) throw new Error(`Unknown township "${only}"`);

mkdirSync(new URL("../data/townships/", import.meta.url), { recursive: true });
for (const [i, township] of selected.entries()) {
  if (i > 0) await new Promise((r) => setTimeout(r, REQUEST_GAP_MS)); // be gentle with the public Overpass server
  const data = extract(township, await fetchElements(township.seed));
  const json = JSON.stringify(data);
  writeFileSync(new URL(`../data/townships/${township.id}.json`, import.meta.url), json + "\n");
  console.log(`${township.id}: ${data.buildings.length} towers, ${data.context.length} context, ${data.roads.length} roads, ${data.areas.length} areas, ${Math.round(json.length / 1024)} KB`);
  for (const b of data.buildings) console.log(`  ${b.id} ${b.name} levels=${b.levels} points=${b.footprint.length}`);
}

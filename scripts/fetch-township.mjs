// Extracts townships from OpenStreetMap: tower footprints, surrounding buildings, roads, green areas,
// water, sports pitches and parking. Reads scripts/townships.seed.json (see discover-townships.mjs),
// writes data/townships/<id>.json and rebuilds data/catalog.json.
// Run: npm run fetch:township                 (every seed that has no file yet, one at a time, resumable)
//      npm run fetch:township -- vn007 vn012  (just these)
//      npm run fetch:township -- --force ...  (overwrite existing files)
// Data: © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const SEEDS = JSON.parse(readFileSync(new URL("./townships.seed.json", import.meta.url), "utf8"));
const TOWER_KINDS = new Set(["apartments", "residential", "yes", "dormitory", "hotel", "office", "commercial", "mixed_use"]);
const MIN_TOWER_LEVELS = 10;
const DEFAULT_PREFIX = "B";

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
  const query = `[out:json][timeout:180];(
    way["building"]${around(BUILDING_RADIUS_M)};
    way["highway"]${around(GROUND_RADIUS_M)};
    way["leisure"~"^(park|garden|pitch|playground|sports_centre|swimming_pool|recreation_ground)$"]${around(GROUND_RADIUS_M)};
    way["natural"~"^(water|wood)$"]${around(GROUND_RADIUS_M)};
    way["landuse"~"^(grass|recreation_ground|forest|meadow)$"]${around(GROUND_RADIUS_M)};
    way["amenity"="parking"]${around(GROUND_RADIUS_M)};
  );out tags geom;
  is_in(${lat},${lon})->.a;area.a["boundary"="administrative"]["name"];out tags;`;
  // The public server is often busy: retry transient errors with a growing pause
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "User-Agent": "digital-twin-lab/0.1 (learning project)", "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(query),
      signal: AbortSignal.timeout(200000),
    });
    if (res.ok) {
      const elements = (await res.json()).elements;
      return {
        ways: elements.filter((w) => Array.isArray(w.geometry) && w.geometry.length >= 2),
        admin: elements.filter((e) => e.type === "area" && e.tags),
      };
    }
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

// Administrative names for the seed, from the OSM boundaries that contain it
function adminNames(admin) {
  const named = admin
    .map((a) => ({ level: Number.parseInt(a.tags.admin_level, 10), name: a.tags["name:vi"] ?? a.tags.name }))
    .filter((a) => Number.isInteger(a.level) && a.name)
    .sort((a, b) => a.level - b.level);
  const city = named.find((a) => a.level === 4)?.name ?? null;
  const local = named.filter((a) => a.level > 4 && a.level <= 8).at(-1)?.name ?? null;
  return { city, ward: local };
}

// Tower names usually share a brand plus a block code ("Masteri Waterfront H2", "Park 7"). The brand is
// the most common name once trailing code-like words are dropped; if none is shared, no brand is guessed.
const BLOCK_WORDS = /^(toà|tòa|block|tower|building|nhà|tháp|căn hộ|chung cư)$/i;
function brandOf(names) {
  const counts = new Map();
  for (const name of names) {
    const words = name.split(/\s+/);
    while (words.length > 1 && (/\d/.test(words.at(-1)) || words.at(-1).length <= 2 || BLOCK_WORDS.test(words.at(-1)))) words.pop();
    const brand = words.join(" ");
    if (brand.length >= 6 && !BLOCK_WORDS.test(words[0])) counts.set(brand, (counts.get(brand) ?? 0) + 1);
  }
  const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return top && top[1] >= 2 ? top[0] : null;
}

// Names are generated: the brand shared by the towers, else the tower nearest the centre, then the place.
// Seeds can carry a hand-written name (and shortName), which always wins.
function namesFor(township, towerNames, ward, city) {
  const lead = brandOf(towerNames) ?? towerNames[0];
  const place = [ward, city].filter(Boolean).join(", ");
  return {
    name: township.name ?? (place ? `${lead} · ${place}` : lead),
    shortName: township.shortName ?? lead,
  };
}

function extract(township, { ways: elements, admin }) {
  const seed = { lat: township.lat, lon: township.lon };
  const prefix = township.prefix ?? DEFAULT_PREFIX;
  const buildings = elements.filter((w) => w.tags.building);

  // Towers: named high-rise blocks with a known number of levels, nearest to the seed first
  const towers = buildings
    .filter((w) => TOWER_KINDS.has(w.tags.building) && w.tags.name && (levelsOf(w.tags) ?? 0) >= MIN_TOWER_LEVELS)
    .map((w) => ({ way: w, pts: closedRing(w) }))
    .filter((c) => c.pts)
    .map((c) => ({ ...c, c: centroid(c.pts) }))
    .sort((a, b) => metersBetween(a.c, seed) - metersBetween(b.c, seed))
    .slice(0, MAX_TOWERS);
  if (towers.length === 0) throw new Error(`${township.id}: no named high-rise buildings found`);

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

  const { city: adminCity, ward } = adminNames(admin);
  const city = township.city ?? adminCity;
  const { name, shortName } = namesFor(township, towerOut.map((b) => b.name), ward, city);
  return {
    id: township.id,
    name,
    shortName,
    city,
    ward,
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

const args = process.argv.slice(2);
const force = args.includes("--force");
const rename = args.includes("--rename"); // recompute names of the files on disk, no network
const ids = args.filter((a) => !a.startsWith("--"));
const dataDir = new URL("../data/townships/", import.meta.url);
mkdirSync(dataDir, { recursive: true });
const have = new Set(readdirSync(dataDir).map((f) => f.replace(/\.json$/, "")));

if (rename) {
  for (const file of readdirSync(dataDir).filter((f) => f.endsWith(".json"))) {
    const url = new URL(file, dataDir);
    const data = JSON.parse(readFileSync(url, "utf8"));
    const seed = SEEDS.find((t) => t.id === data.id) ?? {};
    const names = namesFor(seed, data.buildings.map((b) => b.name), data.ward ?? null, data.city ?? seed.city ?? null);
    writeFileSync(url, JSON.stringify({ ...data, ...names }) + "\n");
  }
  console.log(`catalog: ${writeCatalog()} townships`);
  process.exit(0);
}

for (const id of ids) if (!SEEDS.some((t) => t.id === id)) throw new Error(`Unknown township "${id}"`);
const selected = SEEDS.filter((t) => (ids.length ? ids.includes(t.id) : true) && (force || !have.has(t.id)));
console.log(`${selected.length} township(s) to extract (${have.size} already on disk)`);

// The catalog is what the map loads up front: one small record per township, no geometry.
// It is rewritten after every township, so it always matches the files on disk even if a run is stopped.
function writeCatalog() {
  const catalog = readdirSync(dataDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(new URL(f, dataDir), "utf8")))
    .map((d) => {
      const seed = SEEDS.find((s) => s.id === d.id);
      return {
        id: d.id,
        name: d.name,
        shortName: d.shortName,
        city: d.city ?? seed?.city ?? null,
        ward: d.ward ?? null,
        lat: d.origin.lat,
        lon: d.origin.lon,
        towers: d.buildings.length,
        tallest: Math.max(...d.buildings.map((b) => b.levels)),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(new URL("../data/catalog.json", import.meta.url), JSON.stringify(catalog) + "\n");
  return catalog.length;
}

const failed = [];
for (const [i, township] of selected.entries()) {
  if (i > 0) await new Promise((r) => setTimeout(r, REQUEST_GAP_MS)); // be gentle with the public Overpass server
  try {
    const data = extract(township, await fetchElements({ lat: township.lat, lon: township.lon }));
    const json = JSON.stringify(data);
    writeFileSync(new URL(`${township.id}.json`, dataDir), json + "\n");
    writeCatalog();
    console.log(`[${i + 1}/${selected.length}] ${township.id} ${data.name}: ${data.buildings.length} towers, ${data.context.length} context, ${data.roads.length} roads, ${data.areas.length} areas, ${Math.round(json.length / 1024)} KB`);
  } catch (err) {
    failed.push(township.id);
    console.log(`[${i + 1}/${selected.length}] ${township.id} FAILED: ${err.message}`);
  }
}

console.log(`catalog: ${writeCatalog()} townships`);
if (failed.length > 0) {
  console.log(`failed: ${failed.join(" ")} (run again to retry them)`);
  process.exitCode = 1;
}

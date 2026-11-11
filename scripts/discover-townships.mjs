// Finds candidate townships across Vietnam in OpenStreetMap and writes scripts/townships.seed.json.
// A candidate is a group of named buildings of 10+ levels within CLUSTER_RADIUS_M of each other.
// Run: npm run discover:townships            (queries Overpass)
//      npm run discover:townships -- --from <overpass-json-file>   (reuse a saved response)
// Data: © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)
import { readFileSync, writeFileSync } from "node:fs";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const CLUSTER_RADIUS_M = 500;
const MIN_TOWERS = 4;
const MIN_LEVELS = 10;
const MAX_LEVELS = 150;
const M_PER_DEG_LAT = 111320;
const MAX_ATTEMPTS = 6;
const TRANSIENT_STATUS = new Set([429, 502, 503, 504]);
const TOWER_KINDS = new Set(["apartments", "residential", "yes", "dormitory", "hotel", "office", "commercial", "mixed_use"]);

// Townships that were extracted by hand first keep their ids, names and exact seeds (the centre of the
// "Vinhomes ..." landuse polygon), so the data already committed for them stays valid
const KNOWN = [
  { id: "smart-city", name: "Vinhomes Smart City (Tay Mo, Hanoi)", shortName: "Smart City", prefix: "S", city: "Hà Nội", lat: 21.0023359, lon: 105.7377569 },
  { id: "ocean-park", name: "Vinhomes Ocean Park (Gia Lam, Hanoi)", shortName: "Ocean Park", prefix: "O", city: "Hà Nội", lat: 20.9942646, lon: 105.948475 },
];

const QUERY = `[out:json][timeout:180];area["ISO3166-1"="VN"]->.vn;
(way["building"]["building:levels"~"^([1-9][0-9]|[1-9][0-9][0-9])$"](area.vn););out center tags;`;

const metres = (a, b) =>
  Math.hypot((a.lat - b.lat) * M_PER_DEG_LAT, (a.lon - b.lon) * M_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180));

async function fetchOverpass() {
  let pause = 20000;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "User-Agent": "digital-twin-lab/0.1 (learning project)", "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(QUERY),
      signal: AbortSignal.timeout(200000),
    });
    if (res.ok) return res.json();
    if (!TRANSIENT_STATUS.has(res.status) || attempt === MAX_ATTEMPTS) throw new Error(`Overpass HTTP ${res.status}`);
    console.log(`Overpass HTTP ${res.status}, retrying in ${pause / 1000}s (attempt ${attempt}/${MAX_ATTEMPTS})`);
    await new Promise((r) => setTimeout(r, pause));
    pause *= 2;
  }
  throw new Error("unreachable");
}

const fromIndex = process.argv.indexOf("--from");
const body = fromIndex > 0 ? JSON.parse(readFileSync(process.argv[fromIndex + 1], "utf8")) : await fetchOverpass();

const towers = body.elements
  .filter((e) => e.center && e.tags?.name)
  .map((e) => ({
    name: String(e.tags.name).slice(0, 60),
    levels: Number.parseInt(e.tags["building:levels"], 10),
    kind: e.tags.building,
    lat: e.center.lat,
    lon: e.center.lon,
  }))
  .filter((b) => b.levels >= MIN_LEVELS && b.levels <= MAX_LEVELS && TOWER_KINDS.has(b.kind));

// Greedy: the building with the most neighbours within the radius starts a cluster and claims them
const free = new Set(towers.keys());
const near = (i) => [...free].filter((j) => metres(towers[i], towers[j]) <= CLUSTER_RADIUS_M);
const clusters = [];
while (free.size > 0) {
  let best = -1;
  let bestCount = 0;
  for (const i of free) {
    const count = near(i).length;
    if (count > bestCount) {
      best = i;
      bestCount = count;
    }
  }
  const members = near(best);
  for (const j of members) free.delete(j);
  const list = members.map((j) => towers[j]);
  clusters.push({
    lat: list.reduce((s, b) => s + b.lat, 0) / list.length,
    lon: list.reduce((s, b) => s + b.lon, 0) / list.length,
    towers: list.length,
    tallest: Math.max(...list.map((b) => b.levels)),
  });
}

const seeds = clusters
  .filter((c) => c.towers >= MIN_TOWERS)
  .sort((a, b) => b.towers - a.towers || a.lat - b.lat)
  .map((c) => ({ lat: Number(c.lat.toFixed(5)), lon: Number(c.lon.toFixed(5)), towers: c.towers, tallest: c.tallest }));

// A cluster that contains a known township's centre becomes that township
const known = KNOWN.map((k) => ({ ...k, towers: 0, tallest: 0 }));
const result = [];
for (const seed of seeds) {
  const match = known.find((k) => k.towers === 0 && metres(k, seed) <= CLUSTER_RADIUS_M * 2);
  if (match) {
    match.towers = seed.towers;
    match.tallest = seed.tallest;
  } else {
    result.push(seed);
  }
}
const all = [...known.filter((k) => k.towers > 0), ...result].sort((a, b) => b.towers - a.towers || a.lat - b.lat);
let next = 1;
const withIds = all.map((s) => (s.id ? s : { id: `vn${String(next++).padStart(3, "0")}`, ...s }));

writeFileSync(new URL("./townships.seed.json", import.meta.url), JSON.stringify(withIds, null, 1) + "\n");
console.log(`${withIds.length} candidate townships (>= ${MIN_TOWERS} named buildings of ${MIN_LEVELS}+ levels within ${CLUSTER_RADIUS_M} m)`);

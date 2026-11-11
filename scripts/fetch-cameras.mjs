// Extracts traffic and public street cameras in Vietnam from OpenStreetMap into data/cameras.json.
// Run: npm run fetch:cameras                     (one Overpass query, a minute or two)
//      npm run fetch:cameras -- --from file.json  (reuse a saved Overpass response)
// Positions only: OSM has no camera images. Data: © OpenStreetMap contributors, ODbL 1.0.
import { readFileSync, writeFileSync } from "node:fs";
import { camerasFrom } from "./camera-data.mjs";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const MAX_ATTEMPTS = 5;
const RETRY_GAP_MS = 10000;
const TRANSIENT_STATUS = new Set([429, 502, 503, 504]);
const OUT = new URL("../data/cameras.json", import.meta.url);

const QUERY = `[out:json][timeout:180];
area["ISO3166-1"="VN"][admin_level=2]->.vn;
(
  nwr["man_made"="surveillance"](area.vn);
  node["highway"="speed_camera"](area.vn);
  node["enforcement"](area.vn);
  relation["type"="enforcement"](area.vn);
);
out center tags;`;

async function fetchElements() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "User-Agent": "digital-twin-lab/0.1 (learning project)", "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(QUERY),
      signal: AbortSignal.timeout(200000),
    });
    if (res.ok) return (await res.json()).elements;
    if (!TRANSIENT_STATUS.has(res.status) || attempt === MAX_ATTEMPTS) throw new Error(`Overpass HTTP ${res.status}`);
    console.log(`Overpass HTTP ${res.status}, retrying in ${(RETRY_GAP_MS * attempt) / 1000}s (attempt ${attempt}/${MAX_ATTEMPTS})`);
    await new Promise((r) => setTimeout(r, RETRY_GAP_MS * attempt));
  }
  throw new Error("unreachable");
}

const fromIndex = process.argv.indexOf("--from");
const elements =
  fromIndex > 0 ? JSON.parse(readFileSync(process.argv[fromIndex + 1], "utf8")).elements : await fetchElements();
if (!Array.isArray(elements)) throw new Error("No elements in the Overpass response");

const cameras = camerasFrom(elements);
const byKind = {};
for (const c of cameras) byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: "OpenStreetMap",
      license: "ODbL-1.0, © OpenStreetMap contributors",
      generated: new Date().toISOString().slice(0, 10),
      cameras,
    },
    null,
    1,
  ) + "\n",
);
console.log(`${elements.length} OSM features → ${cameras.length} cameras`, byKind);

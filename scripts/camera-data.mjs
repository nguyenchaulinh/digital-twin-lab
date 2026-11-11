// Traffic and public street cameras from OpenStreetMap: which features count, what kind they are, and one
// record per camera. Positions only: OSM has no images. Data: © OpenStreetMap contributors, ODbL 1.0.

const BOUNDS = { south: 8, north: 24, west: 102, east: 110 }; // Vietnam, loosely
const DUPLICATE_M = 40; // an enforcement relation and its camera node are usually within a few metres
const M_PER_DEG_LAT = 111320;
const MAX_TEXT = 60;

// "speed" (speed or average speed enforcement), "red_light", "traffic" (other traffic monitoring, ALPR),
// "public" (outdoor public surveillance of the street). Anything else (private, indoor, unknown) is null.
export function cameraKind(tags = {}) {
  const enforcement = tags.enforcement ?? "";
  const surveillance = String(tags.surveillance ?? "").toLowerCase();
  const zone = tags["surveillance:zone"] ?? "";
  if (tags.highway === "speed_camera" || ["maxspeed", "average_speed", "mindistance"].includes(enforcement)) return "speed";
  if (enforcement === "traffic_signals" || /đèn|tín_hiệu|tín hiệu|red.?light/.test(surveillance)) return "red_light";
  if (tags.type === "enforcement" || enforcement !== "") return "traffic";
  if (tags["surveillance:type"] === "ALPR" || zone === "traffic" || surveillance === "traffic") return "traffic";
  if (tags.man_made === "surveillance" && (["public", "outdoor"].includes(surveillance) || ["street", "town"].includes(zone))) return "public";
  return null;
}

const text = (value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed.slice(0, MAX_TEXT);
};

// km/h as a number, only when OSM has a plain number
function maxspeed(value) {
  return typeof value === "string" && /^\d{1,3}$/.test(value.trim()) ? Number(value) : undefined;
}

// One Overpass element to a camera record, or null when it is not a camera we show or has no usable position
export function toCamera(element) {
  const tags = element?.tags ?? {};
  const kind = cameraKind(tags);
  if (!kind || !["node", "way", "relation"].includes(element.type) || !Number.isInteger(element.id)) return null;
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < BOUNDS.south || lat > BOUNDS.north || lon < BOUNDS.west || lon > BOUNDS.east) return null;
  const camera = {
    id: `${element.type[0]}${element.id}`,
    osmType: element.type,
    osmId: element.id,
    lat: Math.round(lat * 1e6) / 1e6,
    lon: Math.round(lon * 1e6) / 1e6,
    kind,
    name: text(tags.name),
    ref: text(tags.ref),
    maxspeed: maxspeed(tags.maxspeed),
    direction: text(tags.direction ?? tags["camera:direction"]),
  };
  for (const key of Object.keys(camera)) if (camera[key] === undefined) delete camera[key];
  return camera;
}

const distance = (a, b) =>
  Math.hypot((a.lon - b.lon) * M_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180), (a.lat - b.lat) * M_PER_DEG_LAT);

// A node is the device itself and is always kept: two nodes side by side are usually two cameras on one pole,
// one per direction. An enforcement relation (or a way) within DUPLICATE_M of a node of the same kind is that
// device mapped a second time, and is dropped. Sorted by id so the output is stable from run to run.
export function dedupe(cameras) {
  const nodes = cameras.filter((c) => c.osmType === "node");
  const kept = [...nodes];
  for (const camera of cameras) {
    if (camera.osmType === "node") continue;
    if (kept.some((k) => k.kind === camera.kind && distance(k, camera) < DUPLICATE_M)) continue;
    kept.push(camera);
  }
  return kept.sort((a, b) => a.id.localeCompare(b.id));
}

export const camerasFrom = (elements) => dedupe(elements.map(toCamera).filter(Boolean));

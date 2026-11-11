// Finding the Mapillary photo nearest to a point: the search box for the Graph API and a strict reading of its
// answer. Self-contained (no imports), so it runs under plain node.

const M_PER_DEG_LAT = 111320;
const IMAGE_ID = /^\d{1,20}$/;

export const GRAPH_IMAGES = "https://graph.mapillary.com/images";

// [west, south, east, north] of a square of about `radius` metres around the point
export function searchBox(lon: number, lat: number, radius: number): [number, number, number, number] {
  const dLat = radius / M_PER_DEG_LAT;
  const dLon = radius / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

export function searchUrl(lon: number, lat: number, radius: number): string {
  const box = searchBox(lon, lat, radius).map((v) => v.toFixed(6)).join(",");
  const params = new URLSearchParams({ fields: "id,computed_geometry,geometry", bbox: box, limit: "100" });
  return `${GRAPH_IMAGES}?${params.toString()}`;
}

function pointOf(value: unknown): [number, number] | null {
  if (typeof value !== "object" || value === null) return null;
  const coordinates = (value as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const [lon, lat] = coordinates;
  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon as number, lat as number] : null;
}

// The id of the nearest photo in a Graph API answer, or null. Anything not shaped as expected is skipped.
export function nearestImage(answer: unknown, lon: number, lat: number): string | null {
  if (typeof answer !== "object" || answer === null) return null;
  const data = (answer as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  const metresPerDegLon = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  let best: { id: string; distance: number } | null = null;
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const { id, computed_geometry, geometry } = item as { id?: unknown; computed_geometry?: unknown; geometry?: unknown };
    if (typeof id !== "string" || !IMAGE_ID.test(id)) continue;
    const point = pointOf(computed_geometry) ?? pointOf(geometry);
    if (!point) continue;
    const distance = Math.hypot((point[0] - lon) * metresPerDegLon, (point[1] - lat) * M_PER_DEG_LAT);
    if (!best || distance < best.distance) best = { id, distance };
  }
  return best?.id ?? null;
}

// Web Mercator tile maths and the township's local metres. Self-contained (no imports), so it runs under plain node.

// Satellite imagery used by both the map and the building view. No key; Esri's terms apply (see the README).
export const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

const M_PER_DEG_LAT = 111320; // the same projection as scripts/fetch-township.mjs

export interface Origin {
  lat: number;
  lon: number;
}

export interface Tile {
  x: number;
  y: number;
  z: number;
}

export interface LonLatBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

const metresPerDegLon = (origin: Origin): number => M_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180);

// [east, north] metres from the township origin
export function toMetres(origin: Origin, lon: number, lat: number): [number, number] {
  return [(lon - origin.lon) * metresPerDegLon(origin), (lat - origin.lat) * M_PER_DEG_LAT];
}

// [lon, lat] of a point given in metres from the township origin
export function fromMetres(origin: Origin, east: number, north: number): [number, number] {
  return [origin.lon + east / metresPerDegLon(origin), origin.lat + north / M_PER_DEG_LAT];
}

export function tileOf(lon: number, lat: number, z: number): Tile {
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;
  return {
    x: Math.floor(((lon + 180) / 360) * n),
    y: Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n),
    z,
  };
}

export function tileBox(tile: Tile): LonLatBox {
  const n = 2 ** tile.z;
  const lon = (x: number): number => (x / n) * 360 - 180;
  const lat = (y: number): number => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return { west: lon(tile.x), east: lon(tile.x + 1), north: lat(tile.y), south: lat(tile.y + 1) };
}

// Esri's REST tile order is z / y / x
export const imageryTileUrl = (tile: Tile): string => `${ESRI}/World_Imagery/MapServer/tile/${tile.z}/${tile.y}/${tile.x}`;

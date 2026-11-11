// Township buildings as GeoJSON polygons, so the map can extrude them. A township file stores each footprint
// as [east, north] metres from its `origin`; this is the inverse of the projection used when it was written
// (scripts/fetch-township.mjs). Only a type is imported from township-data, so this runs under plain node.
import type { TownshipData } from "./township-data";

const M_PER_DEG_LAT = 111320;

export interface BuildingFeature {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: {
    osmId: number;
    kind: "tower" | "context"; // towers are the ones that open in 3D
    township: string;
    building: string; // id inside the township (S1, O1, B1...), "" for context
    name: string;
    height: number; // metres
  };
}

type Origin = TownshipData["origin"];

// A closed [lon, lat] ring, or null when the footprint is not a polygon
function ring(origin: Origin, footprint: number[][]): number[][] | null {
  if (footprint.length < 3) return null;
  const metresPerDegLon = M_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180);
  const points = footprint.map(([east, north]) => [origin.lon + east / metresPerDegLon, origin.lat + north / M_PER_DEG_LAT]);
  const [firstLon, firstLat] = points[0];
  const [lastLon, lastLat] = points[points.length - 1];
  if (firstLon !== lastLon || firstLat !== lastLat) points.push([firstLon, firstLat]);
  return points;
}

export function townshipFeatures(data: TownshipData, metresPerLevel: number): BuildingFeature[] {
  const features: BuildingFeature[] = [];
  const add = (footprint: number[][], levels: number, properties: Omit<BuildingFeature["properties"], "height">): void => {
    const coordinates = ring(data.origin, footprint);
    if (coordinates) {
      features.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [coordinates] }, properties: { ...properties, height: levels * metresPerLevel } });
    }
  };
  for (const c of data.context) add(c.footprint, c.levels, { osmId: c.osmId, kind: "context", township: data.id, building: "", name: "" });
  for (const b of data.buildings) add(b.footprint, b.levels, { osmId: b.osmId, kind: "tower", township: data.id, building: b.id, name: b.name });
  return features;
}

// Neighbouring townships overlap: a tower of one is often context in the next. Each OSM building is kept once,
// and as a tower if any township has it as one; two extrusions in the same place would flicker.
export function mergeFeatures(lists: BuildingFeature[][]): BuildingFeature[] {
  const all = lists.flat();
  const seen = new Set<number>();
  const merged: BuildingFeature[] = [];
  for (const kind of ["tower", "context"] as const) {
    for (const feature of all) {
      if (feature.properties.kind !== kind || seen.has(feature.properties.osmId)) continue;
      seen.add(feature.properties.osmId);
      merged.push(feature);
    }
  }
  return merged;
}

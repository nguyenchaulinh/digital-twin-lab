// The catalog (one small record per township) is loaded up front for the map; the geometry of a township
// is a separate file that is loaded only when it is opened. Coordinates are [east, north] in metres from
// each file's `origin`. Data: © OpenStreetMap contributors (ODbL).
import catalogJson from "../data/catalog.json";

export interface TownshipBuilding {
  id: string;
  osmId: number;
  name: string;
  levels: number;
  footprint: number[][];
}

export interface ContextBuilding {
  osmId: number;
  kind: string;
  levels: number;
  levelsAssumed: boolean;
  footprint: number[][];
}

export interface RoadSegment {
  kind: string;
  w: number; // width in metres
  pts: number[][];
}

export interface AreaPolygon {
  kind: "green" | "water" | "sport" | "parking";
  footprint: number[][];
}

export interface TownshipData {
  id: string;
  name: string;
  shortName: string;
  city: string | null;
  ward: string | null;
  origin: { lat: number; lon: number };
  buildings: TownshipBuilding[];
  context: ContextBuilding[];
  roads: RoadSegment[];
  areas: AreaPolygon[];
}

export interface CatalogEntry {
  id: string;
  name: string;
  shortName: string;
  city: string | null;
  ward: string | null;
  lat: number;
  lon: number;
  towers: number;
  tallest: number;
}

export const catalog: CatalogEntry[] = catalogJson;

const loaders = import.meta.glob<TownshipData>("../data/townships/*.json", { import: "default" });

// Geometry of one township, fetched on demand (Vite makes each file its own chunk)
export async function loadTownship(id: string): Promise<TownshipData> {
  const load = loaders[`../data/townships/${id}.json`];
  if (!load) throw new Error(`Unknown township "${id}"`);
  const data = await load();
  // The files written before the catalog existed have no city; the catalog does
  return { ...data, city: data.city ?? catalog.find((e) => e.id === id)?.city ?? null, ward: data.ward ?? null };
}

// Heights are assumed: 3 m per level
export const METRES_PER_LEVEL = 3;

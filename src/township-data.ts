// Every data/townships/*.json is loaded at build time. Coordinates are [east, north] in metres from
// each file's `origin`. Data: © OpenStreetMap contributors (ODbL).
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
  buildings: TownshipBuilding[];
  context: ContextBuilding[];
  roads: RoadSegment[];
  areas: AreaPolygon[];
}

const modules = import.meta.glob<TownshipData>("../data/townships/*.json", { eager: true, import: "default" });

export const townships: TownshipData[] = Object.values(modules).sort((a, b) => a.id.localeCompare(b.id));
export const buildingIds: ReadonlySet<string> = new Set(townships.flatMap((t) => t.buildings.map((b) => b.id)));

export function townshipOf(buildingId: string): TownshipData | undefined {
  return townships.find((t) => t.buildings.some((b) => b.id === buildingId));
}

// Heights are assumed: 3 m per level
export const METRES_PER_LEVEL = 3;

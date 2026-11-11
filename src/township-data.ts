import raw from "../data/township.json";

// Footprints are [east, north] in metres from `origin`. Data: © OpenStreetMap contributors (ODbL).
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

export interface TownshipData {
  name: string;
  buildings: TownshipBuilding[];
  context: ContextBuilding[];
}

export const township: TownshipData = raw;
export const buildingIds: ReadonlySet<string> = new Set(township.buildings.map((b) => b.id));

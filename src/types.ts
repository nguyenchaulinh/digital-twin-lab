export interface RoomState {
  id: string;
  building: string;
  floor: number;
  temp: number;
  ac: boolean;
}

export interface AirState {
  aqi: number;
  pm25: number | null;
  station: string;
  updated: string;
}

export interface BuildingEnergy {
  id: string;
  acKwh: number;
}

export interface Snapshot {
  outside: number;
  outsideSource: "open-meteo" | "synthetic";
  air: AirState | null;
  acKwh: number;
  acPowerKw: number;
  buildings: BuildingEnergy[];
  simMinutes: number;
  rooms: RoomState[];
}

const ROOM_ID = /^B\d{1,2}-F\d{1,3}-[AB]$/;
const MAX_ROOMS = 1000;
const MAX_BUILDINGS = 50;
const MAX_FLOOR = 200;

function isAir(air: unknown): air is AirState {
  const a = air as AirState;
  return (
    Number.isInteger(a?.aqi) &&
    (a.pm25 === null || Number.isFinite(a.pm25)) &&
    typeof a.station === "string" &&
    typeof a.updated === "string"
  );
}

// The snapshot comes from a local WebSocket, but it is still validated: type, range, known ids
export function isSnapshot(data: unknown, buildingIds: ReadonlySet<string>): data is Snapshot {
  const d = data as Snapshot;
  return (
    Array.isArray(d?.rooms) &&
    d.rooms.length <= MAX_ROOMS &&
    Array.isArray(d.buildings) &&
    d.buildings.length <= MAX_BUILDINGS &&
    Number.isFinite(d.outside) &&
    (d.outsideSource === "open-meteo" || d.outsideSource === "synthetic") &&
    (d.air === null || isAir(d.air)) &&
    Number.isFinite(d.acKwh) &&
    d.acKwh >= 0 &&
    Number.isFinite(d.acPowerKw) &&
    d.acPowerKw >= 0 &&
    Number.isFinite(d.simMinutes) &&
    d.buildings.every((b) => buildingIds.has(b.id) && Number.isFinite(b.acKwh) && b.acKwh >= 0) &&
    d.rooms.every(
      (r) =>
        ROOM_ID.test(r.id) &&
        buildingIds.has(r.building) &&
        r.id.startsWith(`${r.building}-`) &&
        Number.isFinite(r.temp) &&
        r.temp > -50 &&
        r.temp < 100 &&
        typeof r.ac === "boolean" &&
        Number.isInteger(r.floor) &&
        r.floor >= 1 &&
        r.floor <= MAX_FLOOR,
    )
  );
}

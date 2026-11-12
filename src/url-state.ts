// What the page remembers in the URL hash, so a reload or a shared link comes back to the same
// township, building and room: #t=vn001&b=B2&r=B2-F10-A&m=sensors
// The hash is input from outside: every part is checked against a strict format here, and main.ts
// checks it again against the real data (a township that exists, a room that is in the snapshot).
export type BuildingMode = "facade" | "sensors";

export interface UrlState {
  township: string | null;
  building: string | null;
  room: string | null;
  mode: BuildingMode | null;
}

const TOWNSHIP_ID = /^[a-z0-9-]{1,40}$/;
const BUILDING_ID = /^[A-Z]\d{1,2}$/;
const ROOM_ID = /^[A-Z]\d{1,2}-F\d{1,3}-[AB]$/; // same shape as the simulator's room ids (types.ts)

export function parseHash(hash: string): UrlState {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const pick = (name: string, pattern: RegExp): string | null => {
    const value = params.get(name);
    return value !== null && pattern.test(value) ? value : null;
  };
  const township = pick("t", TOWNSHIP_ID);
  const building = township ? pick("b", BUILDING_ID) : null; // a building only makes sense inside a township
  // A room must belong to the building named next to it
  const room = building ? pick("r", ROOM_ID) : null;
  const mode = params.get("m");
  return {
    township,
    building,
    room: room !== null && building !== null && room.startsWith(`${building}-`) ? room : null,
    mode: building && (mode === "facade" || mode === "sensors") ? mode : null,
  };
}

// "" when there is nothing to remember (the map), otherwise "#t=...". Parts that make no sense on
// their own (a room without its building) are left out.
export function formatHash(state: UrlState): string {
  if (!state.township) return "";
  const params = new URLSearchParams({ t: state.township });
  if (state.building) {
    params.set("b", state.building);
    if (state.room) params.set("r", state.room);
    if (state.mode) params.set("m", state.mode);
  }
  return `#${params.toString()}`;
}

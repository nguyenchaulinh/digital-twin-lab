// Official traffic camera services by area. None of them publishes an API or reuse terms (checked 2026-11), so
// the map only links out to them: it shows no image from them and collects nothing. An area's live feed can be
// added here once its operator has given written permission and a documented access method.

export type OfficialSourceId = "hcmc" | "hanoi";

export interface OfficialSource {
  id: OfficialSourceId;
  box: [number, number, number, number]; // west, south, east, north (the area the service covers, roughly)
  url: string | null; // a public page to open, or null when the service is an app only
}

const SOURCES: OfficialSource[] = [
  // Ho Chi Minh City transport portal (operator shown on the site: Sở Xây dựng TP.HCM)
  { id: "hcmc", box: [106.35, 10.37, 107.03, 11.16], url: "https://giaothong.hochiminhcity.gov.vn/" },
  // Hanoi: traffic cameras are in the iHanoi mobile app; no public web page for them was found
  { id: "hanoi", box: [105.28, 20.55, 106.03, 21.4], url: null },
];

export function officialSourceAt(lat: number, lon: number): OfficialSource | null {
  return SOURCES.find(({ box: [w, s, e, n] }) => lon >= w && lon <= e && lat >= s && lat <= n) ?? null;
}

// Live outside data for a point in Vietnam: Open-Meteo (temperature) and AQICN/WAQI (air quality,
// nearest station). All URLs are fixed; only the AQICN token comes from the environment and the
// coordinates come from the township data files, never from a client.
export const TIME_ZONE = "Asia/Ho_Chi_Minh";
// Rough bounding box of Vietnam (incl. islands): anything outside is rejected before it reaches a URL
const VIETNAM_BOUNDS = { minLat: 8, maxLat: 24, minLon: 102, maxLon: 110 };

const FETCH_TIMEOUT_MS = 8000;
const STATION_NAME_MAX = 200; // real names with a Vietnamese translation reach ~95 chars

async function fetchJson(url) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (err) {
    // Surface the cause code (e.g. UNABLE_TO_VERIFY_LEAF_SIGNATURE) but never the URL, which may hold a token
    const code = err.cause?.code ? ` (${err.cause.code})` : "";
    throw new Error(err.message + code);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function parseWeather(body) {
  const temp = body?.current?.temperature_2m;
  if (!Number.isFinite(temp) || temp < -10 || temp > 60) throw new Error("unexpected weather payload");
  return temp;
}

// WAQI reports "-" instead of a number when a station has no data
export function parseAirFeed(body) {
  if (body?.status !== "ok") throw new Error("air quality API status not ok");
  const data = body.data;
  if (data?.aqi === "-") throw new Error("station has no current data");
  const aqi = Number(data?.aqi);
  if (!Number.isInteger(aqi) || aqi < 0 || aqi > 1000) throw new Error("unexpected air quality payload");
  const pm25 = Number(data?.iaqi?.pm25?.v);
  return {
    aqi,
    pm25: Number.isFinite(pm25) ? pm25 : null,
    station: String(data?.city?.name ?? "unknown").slice(0, STATION_NAME_MAX),
    updated: String(data?.time?.iso ?? "").slice(0, 40),
  };
}

export function checkPoint({ lat, lon }) {
  const ok =
    Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= VIETNAM_BOUNDS.minLat && lat <= VIETNAM_BOUNDS.maxLat &&
    lon >= VIETNAM_BOUNDS.minLon && lon <= VIETNAM_BOUNDS.maxLon;
  if (!ok) throw new Error("invalid coordinates");
  return { lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) };
}

export async function fetchTemp(point) {
  const { lat, lon } = checkPoint(point);
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "temperature_2m");
  return parseWeather(await fetchJson(url));
}

// "geo:lat;lon" asks WAQI for the nearest station, which may be some distance away (the name is shown)
export async function fetchAir(token, point) {
  const { lat, lon } = checkPoint(point);
  const url = new URL(`https://api.waqi.info/feed/geo:${lat};${lon}/`);
  url.searchParams.set("token", token);
  return parseAirFeed(await fetchJson(url));
}

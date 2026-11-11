// Live outside data for Hanoi: Open-Meteo (temperature) and AQICN/WAQI (air quality).
// All URLs are fixed; only the AQICN token and station id come from the environment.
export const HANOI = { latitude: 21.0285, longitude: 105.8542, timeZone: "Asia/Ho_Chi_Minh" };

const FETCH_TIMEOUT_MS = 8000;
const STATION_PATTERN = /^@\d{1,7}$/;

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
    station: String(data?.city?.name ?? "unknown").slice(0, 80),
    updated: String(data?.time?.iso ?? "").slice(0, 40),
  };
}

export async function fetchHanoiTemp() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(HANOI.latitude));
  url.searchParams.set("longitude", String(HANOI.longitude));
  url.searchParams.set("current", "temperature_2m");
  return parseWeather(await fetchJson(url));
}

export async function fetchHanoiAir(token, station) {
  if (!STATION_PATTERN.test(station)) throw new Error("invalid AQICN station id");
  const url = new URL(`https://api.waqi.info/feed/${station}/`);
  url.searchParams.set("token", token);
  return parseAirFeed(await fetchJson(url));
}

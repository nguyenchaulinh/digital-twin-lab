// "Physical world" simulator: many townships of towers, each tower with a sample of
// instrumented floors x 2 rooms and a thermal model per room.
// A client "watches" one township at a time; only watched townships are simulated and streamed.
// Accepts AC commands (twin -> physical) for the watched township only.
// Outside temperature and air quality are live data for the watched township's location when available.
import { WebSocketServer } from "ws";
import { TIME_ZONE, fetchAir, fetchTemp } from "./feeds.mjs";
import { instrumentedFloors, loadTownships } from "./township.mjs";

const HOST = "127.0.0.1";
const PORT = 8787;
const ALLOWED_ORIGINS = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);
const TICK_MS = 1000;
const STEP_MIN = 5; // 1 tick = 5 simulated minutes

const WEATHER_POLL_MS = 10 * 60 * 1000;
const AIR_POLL_MS = 15 * 60 * 1000;
const RETRY_MS = 60 * 1000; // after a failed fetch
const STALE_MS = 60 * 60 * 1000; // live readings older than this are ignored

const AQICN_TOKEN = process.env.AQICN_TOKEN;
const FEED_KEY_DECIMALS = 1; // readings are shared by townships within ~10 km of each other
const MAX_FEED_POINTS = 64; // never track more distinct locations than there are townships

const OUTSIDE_BASE = 32; // synthetic fallback only
const K_ENV = 0.01; // heat exchange with outside, per minute
const K_AC = 0.08; // cooling strength, per minute
const AC_SETPOINT = 22;
const AC_POWER_KW = 1; // assumption: rated electrical power of one room unit
const FULL_LOAD_COOLING = K_AC * 8; // the unit runs at full power 8 °C above the setpoint

const townships = new Map(loadTownships(new URL("../data/townships/", import.meta.url)).map((t) => [t.id, t]));

// One simulated state per township, created the first time somebody watches it
const states = new Map();
function stateOf(townshipId) {
  let state = states.get(townshipId);
  if (state) return state;
  const township = townships.get(townshipId);
  const rooms = [];
  for (const building of township.buildings) {
    for (const floor of instrumentedFloors(building.levels)) {
      for (const side of ["A", "B"]) {
        rooms.push({
          id: `${building.id}-F${floor}-${side}`,
          building: building.id,
          floor,
          temp: 26 + Math.random() * 2,
          ac: false,
          heat: 0.01 + Math.random() * 0.03, // occupancy / equipment load
        });
      }
    }
  }
  state = {
    township,
    rooms,
    roomById: new Map(rooms.map((r) => [r.id, r])),
    kwhByBuilding: new Map(township.buildings.map((b) => [b.id, 0])), // cumulative AC energy since the first watch
  };
  states.set(townshipId, state);
  return state;
}

// Start the simulated clock at the current local time in Vietnam
function localMinutesOfDay() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type) => Number(parts.find((p) => p.type === type).value);
  return part("hour") * 60 + part("minute");
}

let simMinutes = localMinutesOfDay();

// --- Live feeds per location: keep the last good reading, drop it once stale, fetch only while watched ---
const feeds = new Map(); // key -> { point, temp, air, tempNextTry, airNextTry, tempBusy, airBusy }
const feedKey = ({ lat, lon }) => `${lat.toFixed(FEED_KEY_DECIMALS)},${lon.toFixed(FEED_KEY_DECIMALS)}`;

function feedFor(origin) {
  const key = feedKey(origin);
  let feed = feeds.get(key);
  if (!feed) {
    if (feeds.size >= MAX_FEED_POINTS) return null;
    feed = { point: origin, temp: null, air: null, tempNextTry: 0, airNextTry: 0, tempBusy: false, airBusy: false };
    feeds.set(key, feed);
  }
  return feed;
}

const isFresh = (reading, maxAge) => reading && Date.now() - reading.fetchedAt < maxAge;

// Called on every tick for watched townships. A fetch starts only when its next-try time has come:
// one poll interval after a success, a short retry after a failure (the last good reading is kept meanwhile).
function refreshFeed(feed) {
  const now = Date.now();
  if (!feed.tempBusy && now >= feed.tempNextTry) {
    feed.tempBusy = true;
    fetchTemp(feed.point)
      .then((value) => {
        feed.temp = { value, fetchedAt: Date.now() };
        feed.tempNextTry = Date.now() + WEATHER_POLL_MS;
      })
      .catch((err) => {
        feed.tempNextTry = Date.now() + RETRY_MS;
        console.warn("[weather] update failed:", err.message);
      })
      .finally(() => { feed.tempBusy = false; });
  }
  if (AQICN_TOKEN && !feed.airBusy && now >= feed.airNextTry) {
    feed.airBusy = true;
    fetchAir(AQICN_TOKEN, feed.point)
      .then((air) => {
        feed.air = { ...air, fetchedAt: Date.now() };
        feed.airNextTry = Date.now() + AIR_POLL_MS;
      })
      .catch((err) => {
        feed.airNextTry = Date.now() + RETRY_MS;
        console.warn("[air] update failed:", err.message);
      })
      .finally(() => { feed.airBusy = false; });
  }
}

function syntheticOutside() {
  // Daily cycle with a 24h period, peak mid-afternoon
  return OUTSIDE_BASE + 4 * Math.sin(((simMinutes / 60 - 9) / 24) * 2 * Math.PI);
}

function outsideReading(feed) {
  if (feed && Number.isFinite(feed.temp?.value) && isFresh(feed.temp, STALE_MS)) return { temp: feed.temp.value, source: "open-meteo" };
  return { temp: syntheticOutside(), source: "synthetic" };
}

function step(state, outside) {
  for (const r of state.rooms) {
    const cooling = r.ac ? K_AC * Math.max(r.temp - AC_SETPOINT, 0) : 0;
    // Modulating unit: power follows the cooling effort, so it idles near the setpoint
    const energy = AC_POWER_KW * Math.min(cooling / FULL_LOAD_COOLING, 1) * (STEP_MIN / 60);
    state.kwhByBuilding.set(r.building, state.kwhByBuilding.get(r.building) + energy);
    const noise = (Math.random() - 0.5) * 0.05;
    r.temp += STEP_MIN * (K_ENV * (outside - r.temp) + r.heat - cooling) + noise;
  }
}

function snapshot(state, outside, feed) {
  const reading = feed?.air;
  const air = Number.isInteger(reading?.aqi) && isFresh(reading, STALE_MS)
    ? { aqi: reading.aqi, pm25: reading.pm25, station: reading.station, updated: reading.updated }
    : null;
  return JSON.stringify({
    type: "snapshot",
    township: state.township.id,
    simMinutes,
    outside: Number(outside.temp.toFixed(2)),
    outsideSource: outside.source,
    air,
    acKwh: Number([...state.kwhByBuilding.values()].reduce((sum, kwh) => sum + kwh, 0).toFixed(3)),
    acPowerKw: AC_POWER_KW,
    buildings: state.township.buildings.map((b) => ({ id: b.id, acKwh: Number(state.kwhByBuilding.get(b.id).toFixed(3)) })),
    rooms: state.rooms.map(({ id, building, floor, temp, ac }) => ({
      id,
      building,
      floor,
      temp: Number(temp.toFixed(2)),
      ac,
    })),
  });
}

const wss = new WebSocketServer({
  host: HOST,
  port: PORT,
  maxPayload: 1024,
  verifyClient: ({ origin }) => ALLOWED_ORIGINS.has(origin),
});

const watching = new Map(); // client -> township id

wss.on("connection", (ws) => {
  // ws emits 'error' on protocol violations such as an oversized frame; without a listener it crashes the process
  ws.on("error", () => {});
  ws.on("close", () => watching.delete(ws));
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return; // ignore malformed input
    }
    // Validate command shape against an allowlist; never trust the client
    if (msg?.type === "watch") {
      if (msg.township === null) watching.delete(ws);
      else if (typeof msg.township === "string" && townships.has(msg.township)) watching.set(ws, msg.township);
      return;
    }
    if (msg?.type !== "setAc") return;
    if (typeof msg.roomId !== "string" || typeof msg.on !== "boolean") return;
    // A client can only command rooms of the township it is watching
    const townshipId = watching.get(ws);
    const room = townshipId ? states.get(townshipId)?.roomById.get(msg.roomId) : undefined;
    if (room) room.ac = msg.on;
  });
});

setInterval(() => {
  simMinutes += STEP_MIN;
  const watchers = new Map(); // township id -> open clients
  for (const [client, id] of watching) {
    if (client.readyState === client.OPEN) (watchers.get(id) ?? watchers.set(id, []).get(id)).push(client);
  }
  for (const [id, clients] of watchers) {
    const state = stateOf(id);
    const feed = feedFor(state.township.origin);
    if (feed) refreshFeed(feed);
    const outside = outsideReading(feed);
    step(state, outside.temp);
    const payload = snapshot(state, outside, feed);
    for (const client of clients) client.send(payload);
  }
}, TICK_MS);

if (!AQICN_TOKEN) console.log("AQICN_TOKEN is not set: air quality is disabled");
console.log(`Simulator listening on ws://${HOST}:${PORT} (${townships.size} townships, simulated while watched)`);

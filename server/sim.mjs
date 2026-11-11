// "Physical world" simulator: 3 floors x 2 rooms, each with a thermal model.
// Streams telemetry over WebSocket and accepts AC commands (twin -> physical).
// Outside temperature and air quality are live Hanoi data when available.
import { WebSocketServer } from "ws";
import { HANOI, fetchHanoiAir, fetchHanoiTemp } from "./feeds.mjs";

const HOST = "127.0.0.1";
const PORT = 8787;
const ALLOWED_ORIGINS = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);
const TICK_MS = 1000;
const STEP_MIN = 5; // 1 tick = 5 simulated minutes

const WEATHER_POLL_MS = 10 * 60 * 1000;
const AIR_POLL_MS = 15 * 60 * 1000;
const STALE_MS = 60 * 60 * 1000; // live readings older than this are ignored

const AQICN_TOKEN = process.env.AQICN_TOKEN;
// UN International School of Hanoi; the US Embassy station (@8641) often reports no data
const AQICN_STATION = process.env.AQICN_STATION ?? "@8688";

const OUTSIDE_BASE = 32; // synthetic fallback only
const K_ENV = 0.01; // heat exchange with outside, per minute
const K_AC = 0.08; // cooling strength, per minute
const AC_SETPOINT = 22;

const rooms = [];
for (let floor = 1; floor <= 3; floor++) {
  for (const side of ["A", "B"]) {
    rooms.push({
      id: `F${floor}-${side}`,
      floor,
      temp: 26 + Math.random() * 2,
      ac: false,
      heat: 0.01 + Math.random() * 0.03, // occupancy / equipment load
    });
  }
}
const roomById = new Map(rooms.map((r) => [r.id, r]));

// Start the simulated clock at the current local time in Hanoi
function hanoiMinutesOfDay() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: HANOI.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type) => Number(parts.find((p) => p.type === type).value);
  return part("hour") * 60 + part("minute");
}

let simMinutes = hanoiMinutesOfDay();

// --- Live feeds: keep the last good reading, drop it once stale ---
let liveTemp = null; // { value, fetchedAt }
let liveAir = null; // { aqi, pm25, station, updated, fetchedAt }

async function pollWeather() {
  try {
    liveTemp = { value: await fetchHanoiTemp(), fetchedAt: Date.now() };
  } catch (err) {
    console.warn("[weather] update failed:", err.message);
  }
}

async function pollAir() {
  try {
    liveAir = { ...(await fetchHanoiAir(AQICN_TOKEN, AQICN_STATION)), fetchedAt: Date.now() };
  } catch (err) {
    console.warn("[air] update failed:", err.message);
  }
}

const isFresh = (reading) => reading && Date.now() - reading.fetchedAt < STALE_MS;

function syntheticOutside() {
  // Daily cycle with a 24h period, peak mid-afternoon
  return OUTSIDE_BASE + 4 * Math.sin(((simMinutes / 60 - 9) / 24) * 2 * Math.PI);
}

function outsideReading() {
  if (isFresh(liveTemp)) return { temp: liveTemp.value, source: "open-meteo" };
  return { temp: syntheticOutside(), source: "synthetic" };
}

function step(outside) {
  simMinutes += STEP_MIN;
  for (const r of rooms) {
    const cooling = r.ac ? K_AC * Math.max(r.temp - AC_SETPOINT, 0) : 0;
    const noise = (Math.random() - 0.5) * 0.05;
    r.temp += STEP_MIN * (K_ENV * (outside - r.temp) + r.heat - cooling) + noise;
  }
}

function snapshot(outside) {
  const air = isFresh(liveAir)
    ? { aqi: liveAir.aqi, pm25: liveAir.pm25, station: liveAir.station, updated: liveAir.updated }
    : null;
  return JSON.stringify({
    type: "snapshot",
    simMinutes,
    outside: Number(outside.temp.toFixed(2)),
    outsideSource: outside.source,
    air,
    rooms: rooms.map(({ id, floor, temp, ac }) => ({
      id,
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

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return; // ignore malformed input
    }
    // Validate command shape against an allowlist; never trust the client
    if (msg?.type !== "setAc") return;
    if (typeof msg.roomId !== "string" || typeof msg.on !== "boolean") return;
    const room = roomById.get(msg.roomId);
    if (room) room.ac = msg.on;
  });
});

setInterval(() => {
  const outside = outsideReading();
  step(outside.temp);
  const payload = snapshot(outside);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}, TICK_MS);

pollWeather();
setInterval(pollWeather, WEATHER_POLL_MS);
if (AQICN_TOKEN) {
  pollAir();
  setInterval(pollAir, AIR_POLL_MS);
} else {
  console.log("AQICN_TOKEN is not set: air quality is disabled");
}

console.log(`Simulator listening on ws://${HOST}:${PORT}`);

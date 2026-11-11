// "Physical world" simulator: 3 floors x 2 rooms, each with a thermal model.
// Streams telemetry over WebSocket and accepts AC commands (twin -> physical).
import { WebSocketServer } from "ws";

const HOST = "127.0.0.1";
const PORT = 8787;
const ALLOWED_ORIGINS = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);
const TICK_MS = 1000;
const STEP_MIN = 5; // 1 tick = 5 simulated minutes

const OUTSIDE_BASE = 32;
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

let simMinutes = 0;

function outsideTemp() {
  // Daily cycle with a 24h period, peak mid-afternoon
  return OUTSIDE_BASE + 4 * Math.sin(((simMinutes / 60 - 9) / 24) * 2 * Math.PI);
}

function step() {
  simMinutes += STEP_MIN;
  const outside = outsideTemp();
  for (const r of rooms) {
    const cooling = r.ac ? K_AC * Math.max(r.temp - AC_SETPOINT, 0) : 0;
    const noise = (Math.random() - 0.5) * 0.05;
    r.temp += STEP_MIN * (K_ENV * (outside - r.temp) + r.heat - cooling) + noise;
  }
}

function snapshot() {
  return JSON.stringify({
    type: "snapshot",
    simMinutes,
    outside: Number(outsideTemp().toFixed(2)),
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
  step();
  const payload = snapshot();
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}, TICK_MS);

console.log(`Simulator listening on ws://${HOST}:${PORT}`);

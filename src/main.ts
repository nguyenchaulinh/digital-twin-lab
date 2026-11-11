import * as THREE from "three";
import { advise, summarize, type AdviceAction } from "./advisor";
import { createBuildingView, type BuildingView } from "./building-view";
import {
  createBuildingTable,
  createFloorTable,
  createTownshipSwitch,
  onBack,
  setDetail,
  setHint,
  setRows,
  showDetail,
  type BuildingStats,
  type FloorTable,
  type Row,
} from "./hud";
import { applyStatic, fmt, getLang, onLangChange, setLang, t, type Key } from "./i18n";
import { ALERT_TEMP, predictTemp } from "./model";
import { camera, canvas, controls, frameView, renderer, scene } from "./scene";
import { METRES_PER_LEVEL, buildingIds, townships, type TownshipData } from "./township-data";
import { createTownshipView } from "./township-view";
import { isSnapshot, type RoomState, type Snapshot } from "./types";

const WS_URL = "ws://127.0.0.1:8787";
const CLICK_SLOP_PX = 5; // a drag that ends on the canvas is a camera move, not a click
const TOOLTIP_OFFSET_PX = 14;

// Demo only: ?demoAqi=160 overrides the AQI fed to the advisor, to see the health-vs-energy rule at work
const demoParam = new URLSearchParams(location.search).get("demoAqi");
const DEMO_AQI = demoParam !== null && /^\d{1,3}$/.test(demoParam) ? Number(demoParam) : null;

const ADVICE_KEYS: Record<AdviceAction, Key> = {
  "open-windows": "advice.open-windows",
  "run-ac": "advice.run-ac",
  "keep-closed": "advice.keep-closed",
  "no-action": "advice.no-action",
};

// US EPA AQI breakpoints
const AQI_LABELS: Array<[number, Key]> = [
  [50, "aqi.good"],
  [100, "aqi.moderate"],
  [150, "aqi.sensitive"],
  [200, "aqi.unhealthy"],
  [300, "aqi.veryUnhealthy"],
];
const aqiLabel = (aqi: number): string => t(AQI_LABELS.find(([max]) => aqi <= max)?.[1] ?? "aqi.hazardous");

// AQICN names look like "English name, Vietnam (Vietnamese name)": show the half that matches the UI language
function stationName(name: string): string {
  const open = name.lastIndexOf("(");
  if (open <= 0 || !name.endsWith(")")) return name;
  return getLang() === "vi" ? name.slice(open + 1, -1).trim() : name.slice(0, open).trim();
}

// --- State: one township overview at a time, and at most one building opened from it ---
const DEFAULT_TOWNSHIP_ID = "smart-city";
let activeTownship: TownshipData = townships.find((x) => x.id === DEFAULT_TOWNSHIP_ID) ?? townships[0];
let townshipView = createTownshipView(activeTownship);
scene.add(townshipView.group);
frameView(townshipView.center, townshipView.radius);

let latest: Snapshot | null = null;
let openBuildingId: string | null = null;
let buildingView: BuildingView | null = null;
let floorTable: FloorTable | null = null;
let selectedRoomId: string | null = null;

const roomsOf = (snap: Snapshot, buildingId: string): RoomState[] => snap.rooms.filter((r) => r.building === buildingId);
const townshipIds = (): Set<string> => new Set(activeTownship.buildings.map((b) => b.id));

function avgTemp(rooms: RoomState[]): number | null {
  return rooms.length === 0 ? null : rooms.reduce((sum, r) => sum + r.temp, 0) / rooms.length;
}

function disposeBuilding(): void {
  if (buildingView) {
    scene.remove(buildingView.group);
    buildingView.dispose();
  }
  buildingView = null;
  floorTable = null;
  openBuildingId = null;
  selectedRoomId = null;
}

function openBuilding(id: string): void {
  const building = activeTownship.buildings.find((b) => b.id === id);
  if (!latest || !building) return;
  const rooms = roomsOf(latest, id);
  if (rooms.length === 0) return;
  disposeBuilding();
  clearHover();
  buildingView = createBuildingView(building, rooms);
  scene.add(buildingView.group);
  townshipView.focus(id);
  floorTable = createFloorTable(rooms, selectRoom, (roomId) => buildingView?.setHover(roomId));
  openBuildingId = id;
  frameView(buildingView.center, buildingView.radius);
  refresh();
}

function closeBuilding(): void {
  disposeBuilding();
  clearHover();
  townshipView.focus(null);
  frameView(townshipView.center, townshipView.radius);
  refresh();
}

function selectRoom(roomId: string | null): void {
  selectedRoomId = roomId;
  refresh();
}

let table = createBuildingTable(activeTownship.buildings, openBuilding, onRowHover);

function selectTownship(id: string): void {
  const next = townships.find((t) => t.id === id);
  if (!next || next === activeTownship) return;
  disposeBuilding();
  clearHover();
  scene.remove(townshipView.group);
  townshipView.dispose();
  activeTownship = next;
  townshipView = createTownshipView(next);
  scene.add(townshipView.group);
  frameView(townshipView.center, townshipView.radius);
  table = createBuildingTable(next.buildings, openBuilding, onRowHover);
  highlightedId = null;
  refresh();
}

// --- Telemetry in (layers 1-2): the twin only mirrors what the physical side reports ---
const ws = new WebSocket(WS_URL);
ws.onopen = () => refresh();
ws.onclose = () => refresh();
ws.onmessage = (ev) => {
  let data: unknown;
  try {
    data = JSON.parse(String(ev.data));
  } catch {
    return;
  }
  if (!isSnapshot(data, buildingIds)) return;
  latest = data;
  refresh();
};

// --- Control back (layer 5): command to the physical side ---
function toggleAc(roomId: string): void {
  const room = latest?.rooms.find((r) => r.id === roomId);
  if (!room || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "setAc", roomId, on: !room.ac }));
}

// --- Picking ---
const raycaster = new THREE.Raycaster();
let pointerDown: { x: number; y: number } | null = null;
canvas.addEventListener("pointerdown", (ev) => {
  pointerDown = { x: ev.clientX, y: ev.clientY };
});

function pickAt(clientX: number, clientY: number): THREE.Intersection | undefined {
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObjects(buildingView?.pickables ?? townshipView.pickables, false)[0];
}

// --- Hover. Township view: a building glows and its table row is highlighted, from either side, and
// over the canvas it gets a name tooltip. Building view: a room glows and so does its table cell. ---
const tooltip = document.getElementById("tooltip") as HTMLElement;
let highlightedId: string | null = null;
let hoverFrame = 0;
let pointerAt = { x: 0, y: 0 };

function showTooltip(text: string | null): void {
  if (!text) {
    tooltip.hidden = true;
    return;
  }
  tooltip.textContent = text;
  tooltip.hidden = false;
  // Keep the tooltip inside the window
  const x = Math.min(pointerAt.x + TOOLTIP_OFFSET_PX, window.innerWidth - tooltip.offsetWidth - 8);
  tooltip.style.left = `${Math.max(x, 8)}px`;
  tooltip.style.top = `${pointerAt.y + TOOLTIP_OFFSET_PX}px`;
}

function highlight(id: string | null): void {
  if (id === highlightedId) return;
  highlightedId = id;
  townshipView.setHover(id);
  table.setHover(id);
}

function onRowHover(id: string | null): void {
  highlight(id);
}

function hoverBuilding(id: string | null): void {
  highlight(id);
  canvas.style.cursor = id ? "pointer" : "";
  showTooltip(activeTownship.buildings.find((b) => b.id === id)?.name ?? null);
}

function hoverRoom(id: string | null): void {
  buildingView?.setHover(id);
  floorTable?.setHover(id);
  canvas.style.cursor = id ? "pointer" : "";
  const room = id ? latest?.rooms.find((r) => r.id === id) : undefined;
  showTooltip(room ? t("tip.room", { floor: room.floor, side: room.id.slice(-1), temp: fmt(room.temp, 1) }) : null);
}

function clearHover(): void {
  hoverBuilding(null);
  hoverRoom(null);
}

canvas.addEventListener("pointermove", (ev) => {
  if (ev.buttons !== 0) {
    clearHover(); // dragging moves the camera
    return;
  }
  pointerAt = { x: ev.clientX, y: ev.clientY };
  if (hoverFrame) return; // one pick per frame
  hoverFrame = requestAnimationFrame(() => {
    hoverFrame = 0;
    const hit = pickAt(pointerAt.x, pointerAt.y);
    if (buildingView) hoverRoom(hit ? (hit.object.userData.roomId as string) : null);
    else hoverBuilding(hit ? (hit.object.userData.buildingId as string) : null);
  });
});
canvas.addEventListener("pointerleave", clearHover);

canvas.addEventListener("click", (ev) => {
  if (pointerDown && Math.hypot(ev.clientX - pointerDown.x, ev.clientY - pointerDown.y) > CLICK_SLOP_PX) return;
  const hit = pickAt(ev.clientX, ev.clientY);
  if (buildingView) selectRoom(hit ? (hit.object.userData.roomId as string) : null);
  else if (hit) openBuilding(hit.object.userData.buildingId as string);
});
window.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && openBuildingId) closeBuilding();
  else if (ev.key.toLowerCase() === "a" && openBuildingId && selectedRoomId) toggleAc(selectedRoomId);
});

// --- HUD ---
const setActiveSwitch = createTownshipSwitch(
  townships.map((x) => ({ id: x.id, label: x.shortName })),
  selectTownship,
);

function buildRows(snap: Snapshot): Row[] {
  const ids = townshipIds();
  const scope = openBuildingId ? roomsOf(snap, openBuildingId) : snap.rooms.filter((r) => ids.has(r.building));
  const rows: Row[] = [];

  const day = Math.floor(snap.simMinutes / 1440);
  const hh = String(Math.floor((snap.simMinutes % 1440) / 60)).padStart(2, "0");
  const mm = String(snap.simMinutes % 60).padStart(2, "0");
  rows.push({ label: t("hud.simTime"), value: t("hud.day", { n: day, time: `${hh}:${mm}` }) });

  const live = snap.outsideSource === "open-meteo";
  rows.push({
    label: t("hud.outside"),
    value: `${fmt(snap.outside, 1)} °C · ${t(live ? "hud.live" : "hud.synthetic")}`,
    alert: !live,
  });
  if (snap.air) {
    rows.push({ label: t("hud.aqi"), value: `${snap.air.aqi} · ${aqiLabel(snap.air.aqi)}`, alert: snap.air.aqi > 150 });
    if (snap.air.pm25 !== null) rows.push({ label: t("hud.pm25"), value: `${snap.air.pm25} µg/m³` });
    rows.push({ label: t("hud.station"), value: stationName(snap.air.station) });
  } else {
    rows.push({ label: t("hud.aqi"), value: t("hud.na") });
  }
  if (DEMO_AQI !== null) rows.push({ label: t("hud.aqiDemo"), value: String(DEMO_AQI), alert: true });

  // In the building view these totals move to the detail panel
  if (!openBuildingId) {
    const alerts = scope.filter((r) => r.temp > ALERT_TEMP).length;
    rows.push({ label: t("hud.roomsOver"), value: `${alerts} / ${scope.length}`, alert: alerts > 0 });
    const kwh = snap.buildings.filter((b) => ids.has(b.id)).reduce((sum, b) => sum + b.acKwh, 0);
    rows.push({ label: t("hud.acEnergy"), value: `${fmt(kwh, 1)} kWh` });
  }

  // Advisor: health first, so the AQI decides before temperature does
  const aqiForAdvice = DEMO_AQI ?? snap.air?.aqi ?? null;
  const adviceFor = (r: RoomState) =>
    advise({ roomTemp: r.temp, ac: r.ac, outsideTemp: snap.outside, aqi: aqiForAdvice, acPowerKw: snap.acPowerKw });
  const summary = summarize(scope.map(adviceFor));
  const saving = summary.saveKw > 0 ? t("hud.saveUpTo", { kw: fmt(summary.saveKw, 1) }) : "";
  rows.push({
    label: t("hud.ventInstead"),
    value: t("hud.roomsCount", { n: summary.counts["open-windows"] }) + saving,
  });

  const room = scope.find((r) => r.id === selectedRoomId);
  if (!room) return rows;
  const advice = adviceFor(room);
  rows.push({ label: t("hud.selected"), value: `${t("hud.floor")} ${room.floor} · ${room.id}` });
  rows.push({ label: t("hud.actualTemp"), value: `${fmt(room.temp, 1)} °C`, alert: room.temp > ALERT_TEMP });
  rows.push({ label: t("hud.ac"), value: t(room.ac ? "hud.on" : "hud.off") });
  rows.push({ label: t("hud.twinOn"), value: `${fmt(predictTemp(room.temp, snap.outside, true, 30), 1)} °C` });
  rows.push({ label: t("hud.twinOff"), value: `${fmt(predictTemp(room.temp, snap.outside, false, 30), 1)} °C` });
  rows.push({ label: t("hud.advice"), value: t(ADVICE_KEYS[advice.action]) });
  rows.push({ label: t("hud.why"), value: t(`reason.${advice.reasonKey}` as const, { aqi: advice.aqi ?? "" }) });
  return rows;
}

// The right-hand detail panel of the open building: name, facts and the instrumented floors
function updateDetail(snap: Snapshot): void {
  const building = activeTownship.buildings.find((b) => b.id === openBuildingId);
  if (!building || !buildingView || !floorTable) return;
  const rooms = roomsOf(snap, building.id);
  const alerts = rooms.filter((r) => r.temp > ALERT_TEMP).length;
  const avg = avgTemp(rooms);
  const kwh = snap.buildings.find((b) => b.id === building.id)?.acKwh ?? 0;
  const instrumented = new Set(rooms.map((r) => r.floor)).size;
  const facts: Row[] = [
    { label: t("hud.floors"), value: String(building.levels) },
    { label: t("detail.height"), value: `~${fmt(building.levels * METRES_PER_LEVEL, 0)} m` },
    { label: t("detail.area"), value: `${fmt(buildingView.footprintArea, 0)} m²` },
    { label: t("hud.instrumented"), value: t("hud.instrumentedValue", { n: instrumented, total: building.levels }) },
    { label: t("detail.avg"), value: avg === null ? "–" : `${fmt(avg, 1)} °C` },
    { label: t("hud.roomsOver"), value: `${alerts} / ${rooms.length}`, alert: alerts > 0 },
    { label: t("hud.acEnergy"), value: `${fmt(kwh, 1)} kWh` },
  ];
  setDetail({
    name: building.name,
    where: activeTownship.shortName,
    osmLabel: t("detail.osm", { id: building.osmId }),
    osmId: building.osmId,
    facts,
  });
  floorTable.update(new Map(rooms.map((r) => [r.id, r])), selectedRoomId, ALERT_TEMP);
}

function refresh(): void {
  const connected = ws.readyState === WebSocket.OPEN;
  const rows: Row[] = [{ label: t("hud.connection"), value: t(connected ? "hud.live" : "hud.disconnected"), alert: !connected }];
  if (latest) rows.push(...buildRows(latest));
  setRows(rows);
  setHint(t(openBuildingId ? "hint.building" : "hint.township"));
  showDetail(openBuildingId !== null);
  setActiveSwitch(activeTownship.id);

  if (!latest) return;
  const stats = new Map<string, BuildingStats>();
  const avgByBuilding = new Map<string, number>();
  for (const b of activeTownship.buildings) {
    const rooms = roomsOf(latest, b.id);
    const avg = avgTemp(rooms);
    if (avg !== null) avgByBuilding.set(b.id, avg);
    const kwh = latest.buildings.find((e) => e.id === b.id)?.acKwh ?? 0;
    stats.set(b.id, { avgTemp: avg, alerts: rooms.filter((r) => r.temp > ALERT_TEMP).length, kwh });
  }
  table.update(stats, openBuildingId);
  townshipView.setTemps(avgByBuilding);
  if (buildingView && openBuildingId) {
    buildingView.setRooms(roomsOf(latest, openBuildingId), selectedRoomId);
    updateDetail(latest);
  }
}

onBack(closeBuilding);
onLangChange(refresh);
for (const button of document.querySelectorAll<HTMLButtonElement>("button[data-lang]")) {
  button.addEventListener("click", () => setLang(button.dataset.lang ?? ""));
}
applyStatic();
refresh();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

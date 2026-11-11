import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ALERT_TEMP, predictTemp } from "./model";

interface RoomState {
  id: string;
  floor: number;
  temp: number;
  ac: boolean;
}

interface Snapshot {
  outside: number;
  simMinutes: number;
  rooms: RoomState[];
}

const WS_URL = "ws://127.0.0.1:8787";
const ROOM_ID = /^F[1-3]-[AB]$/;
const TEMP_MIN = 22;
const TEMP_MAX = 36;

// --- Layer 5 (view): scene ---
const canvas = document.getElementById("view") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(9, 7, 11);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 2.5, 0);
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(5, 10, 7);
scene.add(sun);

const meshes = new Map<string, THREE.Mesh>();
const roomX = (id: string) => (id.endsWith("A") ? -2.1 : 2.1);
const roomY = (floor: number) => (floor - 1) * 2.2 + 1;

function ensureMesh(room: RoomState): THREE.Mesh {
  let mesh = meshes.get(room.id);
  if (!mesh) {
    mesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 2, 4),
      new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.85 }),
    );
    mesh.position.set(roomX(room.id), roomY(room.floor), 0);
    mesh.userData.roomId = room.id;
    scene.add(mesh);
    meshes.set(room.id, mesh);
  }
  return mesh;
}

function tempColor(temp: number): THREE.Color {
  const k = Math.min(Math.max((temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN), 0), 1);
  return new THREE.Color().setHSL((1 - k) * 0.6, 0.75, 0.5); // blue -> red
}

// --- Layer 1-2: telemetry in. The twin only mirrors what the physical side reports. ---
let latest: Snapshot | null = null;
let selectedId: string | null = null;

function isSnapshot(data: unknown): data is Snapshot {
  const d = data as Snapshot;
  return (
    Array.isArray(d?.rooms) &&
    Number.isFinite(d.outside) &&
    Number.isFinite(d.simMinutes) &&
    d.rooms.every(
      (r) =>
        ROOM_ID.test(r.id) &&
        Number.isFinite(r.temp) &&
        r.temp > -50 &&
        r.temp < 100 &&
        typeof r.ac === "boolean" &&
        Number.isInteger(r.floor),
    )
  );
}

const ws = new WebSocket(WS_URL);
ws.onmessage = (ev) => {
  let data: unknown;
  try {
    data = JSON.parse(String(ev.data));
  } catch {
    return;
  }
  if (!isSnapshot(data)) return;
  latest = data;
  for (const room of data.rooms) {
    const mesh = ensureMesh(room);
    (mesh.material as THREE.MeshStandardMaterial).color.copy(tempColor(room.temp));
  }
  renderInfo();
};
ws.onclose = () => renderInfo();

// --- Layer 5 (control back): command to the physical side ---
function toggleAc(roomId: string) {
  const room = latest?.rooms.find((r) => r.id === roomId);
  if (!room || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "setAc", roomId, on: !room.ac }));
}

// --- Selection ---
const raycaster = new THREE.Raycaster();
canvas.addEventListener("click", (ev) => {
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((ev.clientX - rect.left) / rect.width) * 2 - 1,
    -((ev.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects([...meshes.values()])[0];
  selectedId = hit ? (hit.object.userData.roomId as string) : null;
  renderInfo();
});
window.addEventListener("keydown", (ev) => {
  if (ev.key.toLowerCase() === "a" && selectedId) toggleAc(selectedId);
});

// --- Layer 4 + HUD: what-if from the twin's model. Text only, no innerHTML. ---
const info = document.getElementById("info") as HTMLElement;

function addRow(label: string, value: string, alert = false) {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  if (alert) dd.className = "alert";
  info.append(dt, dd);
}

function renderInfo() {
  info.replaceChildren();
  addRow("Connection", ws.readyState === WebSocket.OPEN ? "live" : "disconnected", ws.readyState !== WebSocket.OPEN);
  if (!latest) return;
  const day = Math.floor(latest.simMinutes / 1440);
  const hh = String(Math.floor((latest.simMinutes % 1440) / 60)).padStart(2, "0");
  const mm = String(latest.simMinutes % 60).padStart(2, "0");
  addRow("Sim time", `day ${day} ${hh}:${mm}`);
  addRow("Outside", `${latest.outside.toFixed(1)} °C`);
  const alerts = latest.rooms.filter((r) => r.temp > ALERT_TEMP).length;
  addRow("Rooms over limit", `${alerts} / ${latest.rooms.length}`, alerts > 0);

  const room = latest.rooms.find((r) => r.id === selectedId);
  if (!room) return;
  addRow("Selected", room.id);
  addRow("Actual temp", `${room.temp.toFixed(1)} °C`, room.temp > ALERT_TEMP);
  addRow("AC", room.ac ? "on" : "off");
  addRow("Twin +30min (AC on)", `${predictTemp(room.temp, latest.outside, true, 30).toFixed(1)} °C`);
  addRow("Twin +30min (AC off)", `${predictTemp(room.temp, latest.outside, false, 30).toFixed(1)} °C`);
  // Highlight the selected room by edge scale
  for (const [id, mesh] of meshes) mesh.scale.setScalar(id === room.id ? 1.04 : 1);
}

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();
renderInfo();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export const canvas = document.getElementById("view") as HTMLCanvasElement;
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a);
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(0.5, 1, 0.7);
scene.add(sun);

export const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 4000);
export const controls = new OrbitControls(camera, canvas);
controls.minDistance = 5;
controls.maxPolarAngle = Math.PI / 2 - 0.05; // never look from below the ground

// Place the camera on a fixed diagonal, far enough to fit a sphere of the given radius
export function frameView(center: THREE.Vector3, radius: number): void {
  const distance = radius * 2.4;
  camera.position.copy(center).add(new THREE.Vector3(1, 0.8, 1).normalize().multiplyScalar(distance));
  controls.target.copy(center);
  setZoomLimit(radius);
  controls.update();
}

const MAX_DISTANCE_FACTOR = 3; // how far past the framing distance the user may zoom out

// Only the zoom-out limit for a sphere of the given radius; the camera itself is left where the user put it
export function setZoomLimit(radius: number): void {
  controls.maxDistance = radius * 2.4 * MAX_DISTANCE_FACTOR;
}

// The canvas has no size while it is hidden, so this is also called when it is shown again
export function resize(): void {
  const { clientWidth: w, clientHeight: h } = canvas;
  if (w === 0 || h === 0) return; // hidden
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

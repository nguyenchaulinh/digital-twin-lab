import * as THREE from "three";

// A drawn facade for the building view: one window bay per tile, repeated over the walls. OSM has no
// facade photos, so this is a stand-in for the look of the building, not a picture of it; the street
// view shows the real one. The style is picked from the OSM id, so a building always looks the same.

export const BAY_WIDTH = 3.6; // metres of wall per window bay

interface FacadeStyle {
  wall: string;
  glassTop: string;
  glassBottom: string;
  frame: string;
  sill: string;
}

const STYLES: FacadeStyle[] = [
  { wall: "#d6cfc4", glassTop: "#9cc0da", glassBottom: "#46708f", frame: "#6b7280", sill: "#b8b0a3" }, // warm render, blue glass
  { wall: "#e8e6e1", glassTop: "#8cc4bd", glassBottom: "#3a7573", frame: "#475569", sill: "#cfcac1" }, // white, teal glass
  { wall: "#b7a99a", glassTop: "#a7bfcd", glassBottom: "#52687a", frame: "#3f3a36", sill: "#9a8c7d" }, // stone, grey glass
  { wall: "#a3b3c2", glassTop: "#c0d6e8", glassBottom: "#5a80a3", frame: "#334155", sill: "#8798a9" }, // grey-blue cladding
];

const TEXTURE_W = 240;
const TEXTURE_H = 200; // 3.6 m x 3 m

function draw(style: FacadeStyle): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_W;
  canvas.height = TEXTURE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const w = TEXTURE_W;
  const h = TEXTURE_H;

  ctx.fillStyle = style.wall;
  ctx.fillRect(0, 0, w, h);

  // Window: glass darker towards the bottom, with a pale diagonal reflection
  const left = w * 0.1;
  const right = w * 0.9;
  const top = h * 0.14;
  const bottom = h * 0.78;
  const glass = ctx.createLinearGradient(0, top, 0, bottom);
  glass.addColorStop(0, style.glassTop);
  glass.addColorStop(1, style.glassBottom);
  ctx.fillStyle = glass;
  ctx.fillRect(left, top, right - left, bottom - top);
  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  ctx.beginPath();
  ctx.moveTo(left + (right - left) * 0.15, top);
  ctx.lineTo(left + (right - left) * 0.45, top);
  ctx.lineTo(left + (right - left) * 0.2, bottom);
  ctx.lineTo(left, bottom);
  ctx.lineTo(left, top + (bottom - top) * 0.6);
  ctx.closePath();
  ctx.fill();

  // Frame and mullions
  ctx.strokeStyle = style.frame;
  ctx.lineWidth = 4;
  ctx.strokeRect(left, top, right - left, bottom - top);
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const f of [1 / 3, 2 / 3]) {
    ctx.moveTo(left + (right - left) * f, top);
    ctx.lineTo(left + (right - left) * f, bottom);
  }
  ctx.moveTo(left, top + (bottom - top) * 0.3);
  ctx.lineTo(right, top + (bottom - top) * 0.3);
  ctx.stroke();

  // Sill under the window, and the slab edge at the floor line
  ctx.fillStyle = style.sill;
  ctx.fillRect(left - 6, bottom, right - left + 12, h * 0.05);
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.fillRect(0, h - 6, w, 6);
  return canvas;
}

// Wall UVs of a THREE.ExtrudeGeometry are in metres: u along the wall, v = 1 - height. The repeat turns that
// into one bay per BAY_WIDTH and one floor per floorHeight; the negative v repeat puts the image upright,
// and the offset puts the bottom of each tile on a floor line.
export function createFacadeTexture(osmId: number, floorHeight: number, anisotropy: number): THREE.CanvasTexture {
  const style = STYLES[Math.abs(Math.trunc(osmId)) % STYLES.length];
  const texture = new THREE.CanvasTexture(draw(style));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / BAY_WIDTH, -1 / floorHeight);
  texture.offset.set(0, 1 / floorHeight);
  texture.anisotropy = anisotropy;
  return texture;
}

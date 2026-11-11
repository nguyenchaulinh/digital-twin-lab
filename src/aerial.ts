import * as THREE from "three";
import { fromMetres, imageryTileUrl, tileBox, tileOf, toMetres, type Origin } from "./tiles";

// A square of satellite imagery around a building, stitched from zoom-18 tiles (about 143 m each at 21 N),
// for the ground and the roof of the building view. Loaded only when a building is opened.
const ZOOM = 18;
const GRID = 3; // odd, so the building's tile is in the middle: about 430 m across
const TILE_PX = 256;
const LOAD_TIMEOUT_MS = 15000;

export interface Aerial {
  texture: THREE.CanvasTexture;
  // Extent of the image in the township's [east, north] metres
  minE: number;
  maxE: number;
  minN: number;
  maxN: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // needed to draw it into a canvas that WebGL may read
    img.referrerPolicy = "no-referrer";
    const timer = setTimeout(() => reject(new Error("timeout")), LOAD_TIMEOUT_MS);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error("tile failed"));
    };
    img.src = url;
  });
}

// null when any tile fails (offline, blocked, or served without CORS): the view then keeps its plain ground
export async function loadAerial(origin: Origin, centre: [number, number], anisotropy: number): Promise<Aerial | null> {
  const [lon, lat] = fromMetres(origin, centre[0], centre[1]);
  const middle = tileOf(lon, lat, ZOOM);
  const half = (GRID - 1) / 2;
  const tiles = [];
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) tiles.push({ row, col, tile: { x: middle.x + col - half, y: middle.y + row - half, z: ZOOM } });
  }

  let images: HTMLImageElement[];
  try {
    images = await Promise.all(tiles.map((t) => loadImage(imageryTileUrl(t.tile))));
  } catch {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = GRID * TILE_PX;
  canvas.height = GRID * TILE_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  tiles.forEach((t, i) => ctx.drawImage(images[i], t.col * TILE_PX, t.row * TILE_PX, TILE_PX, TILE_PX));

  const northWest = tileBox(tiles[0].tile);
  const southEast = tileBox(tiles[tiles.length - 1].tile);
  const [minE, maxN] = toMetres(origin, northWest.west, northWest.north);
  const [maxE, minN] = toMetres(origin, southEast.east, southEast.south);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return { texture, minE, maxE, minN, maxN };
}

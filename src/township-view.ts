import * as THREE from "three";
import { tempColor } from "./color";
import type { TownshipData } from "./township-data";

const METRES_PER_LEVEL = 3;
const NO_DATA_COLOR = 0x475569;
const CONTEXT_COLOR = 0x334155;

export interface TownshipView {
  group: THREE.Group;
  pickables: THREE.Object3D[];
  center: THREE.Vector3;
  radius: number;
  setTemps: (avgByBuilding: Map<string, number>) => void;
  setHover: (buildingId: string | null) => void;
}

const HOVER_GLOW = 0x38bdf8;

function glow(mesh: THREE.Mesh | undefined, on: boolean): void {
  if (!mesh) return;
  const material = mesh.material as THREE.MeshStandardMaterial;
  material.emissive.set(on ? HOVER_GLOW : 0x000000);
  material.emissiveIntensity = on ? 0.6 : 0;
}

// A footprint is [east, north]; the shape is extruded along +z and rotated so that +z becomes up
function extrude(footprint: number[][], levels: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape(footprint.map(([east, north]) => new THREE.Vector2(east, north)));
  return new THREE.ExtrudeGeometry(shape, { depth: levels * METRES_PER_LEVEL, bevelEnabled: false });
}

function solid(geometry: THREE.BufferGeometry, color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x0f172a })));
  return mesh;
}

export function createTownshipView(data: TownshipData): TownshipView {
  const group = new THREE.Group();

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: 0x0b1220 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);

  for (const c of data.context) group.add(solid(extrude(c.footprint, c.levels), CONTEXT_COLOR));

  const meshes = new Map<string, THREE.Mesh>();
  for (const b of data.buildings) {
    const mesh = solid(extrude(b.footprint, b.levels), NO_DATA_COLOR);
    mesh.userData.buildingId = b.id;
    meshes.set(b.id, mesh);
    group.add(mesh);
  }

  const reach = data.buildings.flatMap((b) => b.footprint.map(([east, north]) => Math.hypot(east, north)));
  const tallest = Math.max(...data.buildings.map((b) => b.levels * METRES_PER_LEVEL));

  let hovered: string | null = null;

  return {
    group,
    pickables: [...meshes.values()],
    center: new THREE.Vector3(0, tallest / 4, 0),
    radius: Math.max(...reach, tallest),
    setTemps(avgByBuilding) {
      for (const [id, mesh] of meshes) {
        const avg = avgByBuilding.get(id);
        (mesh.material as THREE.MeshStandardMaterial).color.set(avg === undefined ? NO_DATA_COLOR : tempColor(avg));
      }
    },
    setHover(buildingId) {
      if (buildingId === hovered) return;
      glow(hovered ? meshes.get(hovered) : undefined, false);
      hovered = buildingId;
      glow(buildingId ? meshes.get(buildingId) : undefined, true);
    },
  };
}

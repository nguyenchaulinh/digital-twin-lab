import * as THREE from "three";
import { tempColor } from "./color";
import { polygonArea, ringCentroid, splitAlongLongAxis } from "./geometry";
import { METRES_PER_LEVEL, type TownshipBuilding } from "./township-data";
import type { RoomState } from "./types";

const SLAB_HEIGHT = 2.6; // leaves a 0.4 m gap between instrumented floors
const SLAB_LIFT = 0.2;
const SELECTED_GLOW = 0xfbbf24;
const HOVER_GLOW = 0x38bdf8;

export interface BuildingView {
  group: THREE.Group;
  pickables: THREE.Object3D[];
  center: THREE.Vector3;
  radius: number;
  footprintArea: number;
  setRooms: (rooms: RoomState[], selectedId: string | null) => void;
  setHover: (roomId: string | null) => void;
  dispose: () => void;
}

// A footprint is [east, north]; shapes are extruded along +z and the mesh is rotated so +z is up
function extrude(ring: number[][], depth: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape(ring.map(([east, north]) => new THREE.Vector2(east, north)));
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

// The real tower: a ghost shell of the full footprint and height with a line at every level, and
// on each instrumented floor a coloured slab per room (the footprint cut in two across its long axis).
// It stays in township coordinates so the surroundings remain in place behind it.
export function createBuildingView(building: TownshipBuilding, rooms: RoomState[]): BuildingView {
  const group = new THREE.Group();
  const height = building.levels * METRES_PER_LEVEL;
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const shellGeometry = extrude(building.footprint, height);
  const shellMaterial = new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.1, depthWrite: false });
  const shell = new THREE.Mesh(shellGeometry, shellMaterial);
  shell.rotation.x = -Math.PI / 2;
  shell.renderOrder = 20;
  const shellEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(shellGeometry),
    new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 }),
  );
  shell.add(shellEdges);
  group.add(shell);
  geometries.push(shellGeometry, shellEdges.geometry);
  materials.push(shellMaterial, shellEdges.material as THREE.Material);

  // One line loop per level, as segments in a single object
  const levelLines: number[] = [];
  const ring = building.footprint;
  for (let level = 1; level < building.levels; level++) {
    const y = level * METRES_PER_LEVEL;
    for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[(i + 1) % ring.length];
      levelLines.push(ax, y, -ay, bx, y, -by); // north is -z
    }
  }
  const levelGeometry = new THREE.BufferGeometry();
  levelGeometry.setAttribute("position", new THREE.Float32BufferAttribute(levelLines, 3));
  const levelMaterial = new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.35 });
  const levelSegments = new THREE.LineSegments(levelGeometry, levelMaterial);
  levelSegments.renderOrder = 21;
  group.add(levelSegments);
  geometries.push(levelGeometry);
  materials.push(levelMaterial);

  const [halfA, halfB] = splitAlongLongAxis(building.footprint);
  const halves: Record<string, number[][]> = { A: halfA, B: halfB };
  const meshes = new Map<string, THREE.Mesh>();
  for (const room of rooms) {
    const slabGeometry = extrude(halves[room.id.slice(-1)] ?? halfA, SLAB_HEIGHT);
    const slabMaterial = new THREE.MeshStandardMaterial({ color: 0x475569 });
    const slab = new THREE.Mesh(slabGeometry, slabMaterial);
    slab.rotation.x = -Math.PI / 2;
    slab.position.y = (room.floor - 1) * METRES_PER_LEVEL + SLAB_LIFT;
    slab.userData.roomId = room.id;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(slabGeometry), new THREE.LineBasicMaterial({ color: 0x0f172a }));
    slab.add(edges);
    group.add(slab);
    meshes.set(room.id, slab);
    geometries.push(slabGeometry, edges.geometry);
    materials.push(slabMaterial, edges.material as THREE.Material);
  }

  const [cx, cy] = ringCentroid(building.footprint);
  const reach = Math.max(...building.footprint.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  let hovered: string | null = null;
  let selected: string | null = null;

  function paintGlow(id: string | null): void {
    const mesh = id ? meshes.get(id) : undefined;
    if (!mesh) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    const color = id === selected ? SELECTED_GLOW : id === hovered ? HOVER_GLOW : null;
    material.emissive.set(color ?? 0x000000);
    material.emissiveIntensity = color === null ? 0 : 0.6;
  }

  return {
    group,
    pickables: [...meshes.values()],
    center: new THREE.Vector3(cx, height / 2, -cy),
    radius: Math.max(height * 0.65, reach * 1.6, 30),
    footprintArea: polygonArea(building.footprint),
    setRooms(latest, selectedId) {
      const previousSelected = selected;
      selected = selectedId;
      for (const room of latest) {
        const mesh = meshes.get(room.id);
        if (mesh) (mesh.material as THREE.MeshStandardMaterial).color.copy(tempColor(room.temp));
      }
      paintGlow(previousSelected);
      paintGlow(selectedId);
    },
    setHover(roomId) {
      if (roomId === hovered) return;
      const previous = hovered;
      hovered = roomId;
      paintGlow(previous);
      paintGlow(roomId);
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

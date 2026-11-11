import * as THREE from "three";
import type { Aerial } from "./aerial";
import { tempColor } from "./color";
import { createFacadeTexture } from "./facade";
import { polygonArea, ringCentroid, splitAlongLongAxis } from "./geometry";
import { METRES_PER_LEVEL, type TownshipBuilding } from "./township-data";
import type { RoomState } from "./types";

const SLAB_HEIGHT = 2.6; // leaves a 0.4 m gap between instrumented floors
const SLAB_LIFT = 0.2;
const SELECTED_GLOW = 0xfbbf24;
const HOVER_GLOW = 0x38bdf8;
const ROOF_COLOR = 0xa1a1aa;
const XRAY_OPACITY = 0.7;
// The township's ground layers are drawn flat with orders 0-4 and buildings from 10 (see township-view.ts)
const ORDER = { aerial: 5, shell: 20, levels: 21, xray: 25 };

// "facade": a solid, windowed tower on satellite ground; the hovered or selected room shows through the walls.
// "sensors": a ghost shell with every instrumented room as a coloured slab.
export type BuildingMode = "facade" | "sensors";

export interface BuildingView {
  group: THREE.Group;
  pickables: THREE.Object3D[];
  center: THREE.Vector3;
  centre2d: [number, number]; // [east, north] of the footprint centroid, in township metres
  radius: number;
  footprintArea: number;
  setRooms: (rooms: RoomState[], selectedId: string | null) => void;
  setHover: (roomId: string | null) => void;
  setMode: (mode: BuildingMode) => void;
  setAerial: (aerial: Aerial) => void;
  dispose: () => void;
}

// A footprint is [east, north]; shapes are extruded along +z and the mesh is rotated so +z is up
function extrude(ring: number[][], depth: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape(ring.map(([east, north]) => new THREE.Vector2(east, north)));
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

// The real tower and, on each instrumented floor, a slab per room (the footprint cut in two across its long
// axis). It stays in township coordinates so the surroundings remain in place behind it.
export function createBuildingView(building: TownshipBuilding, rooms: RoomState[], anisotropy: number): BuildingView {
  const group = new THREE.Group();
  const height = building.levels * METRES_PER_LEVEL;
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  let mode: BuildingMode = "facade";

  // Shell: one geometry, two looks. ExtrudeGeometry has two groups, 0 the caps (roof and base) and 1 the walls.
  const shellGeometry = extrude(building.footprint, height);
  const ghostMaterial = new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.1, depthWrite: false });
  const facadeTexture = createFacadeTexture(building.osmId, METRES_PER_LEVEL, anisotropy);
  const wallMaterial = new THREE.MeshStandardMaterial({ map: facadeTexture, roughness: 0.55, metalness: 0.15 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: ROOF_COLOR, roughness: 0.9 });
  const shell = new THREE.Mesh<THREE.ExtrudeGeometry, THREE.Material | THREE.Material[]>(shellGeometry, ghostMaterial);
  shell.rotation.x = -Math.PI / 2;
  shell.renderOrder = ORDER.shell;
  const shellEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(shellGeometry),
    new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 }),
  );
  shell.add(shellEdges);
  group.add(shell);
  geometries.push(shellGeometry, shellEdges.geometry);
  materials.push(ghostMaterial, wallMaterial, roofMaterial, shellEdges.material as THREE.Material);
  textures.push(facadeTexture);

  // One line loop per level, as segments in a single object (sensors look only: the facade has its own floors)
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
  levelSegments.renderOrder = ORDER.levels;
  group.add(levelSegments);
  geometries.push(levelGeometry);
  materials.push(levelMaterial);

  // Slabs are transparent from the start: switching `transparent` later would need a shader rebuild. In the
  // facade look they are invisible but still picked (the raycaster does not look at material.visible), so a
  // click on the wall in front of a room still selects it.
  const [halfA, halfB] = splitAlongLongAxis(building.footprint);
  const halves: Record<string, number[][]> = { A: halfA, B: halfB };
  const meshes = new Map<string, THREE.Mesh>();
  const slabEdges = new Map<string, THREE.LineSegments>();
  for (const room of rooms) {
    const slabGeometry = extrude(halves[room.id.slice(-1)] ?? halfA, SLAB_HEIGHT);
    const slabMaterial = new THREE.MeshStandardMaterial({ color: 0x475569, transparent: true });
    const slab = new THREE.Mesh(slabGeometry, slabMaterial);
    slab.rotation.x = -Math.PI / 2;
    slab.position.y = (room.floor - 1) * METRES_PER_LEVEL + SLAB_LIFT;
    slab.userData.roomId = room.id;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(slabGeometry), new THREE.LineBasicMaterial({ color: 0x0f172a }));
    slab.add(edges);
    group.add(slab);
    meshes.set(room.id, slab);
    slabEdges.set(room.id, edges);
    geometries.push(slabGeometry, edges.geometry);
    materials.push(slabMaterial, edges.material as THREE.Material);
  }

  // Satellite ground, added when (and if) the imagery has loaded
  let ground: THREE.Mesh | null = null;

  const [cx, cy] = ringCentroid(building.footprint);
  const reach = Math.max(...building.footprint.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  let hovered: string | null = null;
  let selected: string | null = null;

  function styleSlab(id: string | null): void {
    const mesh = id ? meshes.get(id) : undefined;
    if (!id || !mesh) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    let color: number | null = null;
    if (id === selected) color = SELECTED_GLOW;
    else if (id === hovered) color = HOVER_GLOW;
    material.emissive.set(color ?? 0x000000);
    material.emissiveIntensity = color === null ? 0 : 0.6;
    if (mode === "sensors") {
      material.visible = true;
      material.opacity = 1;
      material.depthTest = true;
      mesh.renderOrder = 0;
    } else {
      material.visible = color !== null; // only the room being looked at, seen through the walls
      material.opacity = XRAY_OPACITY;
      material.depthTest = false;
      mesh.renderOrder = ORDER.xray;
    }
    const edges = slabEdges.get(id);
    if (edges) edges.visible = material.visible;
  }

  function applyMode(): void {
    const facade = mode === "facade";
    shell.material = facade ? [roofMaterial, wallMaterial] : ghostMaterial;
    shellEdges.visible = !facade;
    levelSegments.visible = !facade;
    if (ground) ground.visible = facade;
    for (const id of meshes.keys()) styleSlab(id);
  }
  applyMode();

  return {
    group,
    pickables: [...meshes.values()],
    center: new THREE.Vector3(cx, height / 2, -cy),
    centre2d: [cx, cy],
    radius: Math.max(height * 0.65, reach * 1.6, 30),
    footprintArea: polygonArea(building.footprint),
    setRooms(latest, selectedId) {
      const previousSelected = selected;
      selected = selectedId;
      for (const room of latest) {
        const mesh = meshes.get(room.id);
        if (mesh) (mesh.material as THREE.MeshStandardMaterial).color.copy(tempColor(room.temp));
      }
      styleSlab(previousSelected);
      styleSlab(selectedId);
    },
    setHover(roomId) {
      if (roomId === hovered) return;
      const previous = hovered;
      hovered = roomId;
      styleSlab(previous);
      styleSlab(roomId);
    },
    setMode(next) {
      if (next === mode) return;
      mode = next;
      applyMode();
    },
    setAerial(aerial) {
      const width = aerial.maxE - aerial.minE;
      const depth = aerial.maxN - aerial.minN;
      // Flat like the township's ground layers: no depth test, drawn above them and below every building
      const groundGeometry = new THREE.PlaneGeometry(width, depth);
      const groundMaterial = new THREE.MeshBasicMaterial({ map: aerial.texture, depthTest: false, depthWrite: false });
      ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2; // the image's top (north) goes to -z
      ground.position.set((aerial.minE + aerial.maxE) / 2, 0, -(aerial.minN + aerial.maxN) / 2);
      ground.renderOrder = ORDER.aerial;
      group.add(ground);

      // Roof: the cap UVs are the footprint's own [east, north] metres, so the same image lines up with a
      // repeat and offset. Only the roof is visible from above; the base cap faces the ground.
      const roofTexture = aerial.texture.clone();
      roofTexture.repeat.set(1 / width, 1 / depth);
      roofTexture.offset.set(-aerial.minE / width, -aerial.minN / depth);
      roofTexture.needsUpdate = true;
      roofMaterial.map = roofTexture;
      roofMaterial.color.set(0xffffff);
      roofMaterial.needsUpdate = true;

      geometries.push(groundGeometry);
      materials.push(groundMaterial);
      textures.push(aerial.texture, roofTexture);
      applyMode();
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}

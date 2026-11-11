import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { tempColor } from "./color";
import { ribbonTriangles } from "./geometry";
import { METRES_PER_LEVEL, type AreaPolygon, type TownshipData } from "./township-data";

const NO_DATA_COLOR = 0x475569;
const CONTEXT_COLOR = 0x334155;
const HOVER_GLOW = 0x38bdf8;
const AREA_COLORS: Record<AreaPolygon["kind"], number> = { green: 0x14532d, water: 0x0c4a6e, sport: 0x3f6212, parking: 0x1f2937 };
const ROAD_COLOR = 0x475569;
const FOOTPATH_COLOR = 0x64748b;
const FOOTPATH_MAX_WIDTH = 3;
// Faded buildings must not hide the open one, so the fill is almost gone and the outline stays readable
const DIM_OPACITY = { tower: 0.07, context: 0.05 };
const DIM_EDGE_OPACITY = 0.3;

// Draw order: the ground layers first and flat (no depth test, so they cannot z-fight), buildings last
const ORDER = { ground: 0, area: 1, parking: 2, road: 3, footpath: 4, building: 10 };

export interface TownshipView {
  group: THREE.Group;
  pickables: THREE.Object3D[];
  center: THREE.Vector3;
  radius: number;
  setTemps: (avgByBuilding: Map<string, number>) => void;
  setHover: (buildingId: string | null) => void;
  // While a building is open: hide it (its detail view replaces it) and fade the rest. null restores.
  focus: (buildingId: string | null) => void;
  dispose: () => void;
}

interface Entry {
  mesh: THREE.Mesh;
  edges: THREE.LineSegments;
  buildingId: string | null; // null for context buildings
}

// A footprint is [east, north]; the shape is extruded along +z and rotated so that +z becomes up
function extrude(footprint: number[][], levels: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape(footprint.map(([east, north]) => new THREE.Vector2(east, north)));
  return new THREE.ExtrudeGeometry(shape, { depth: levels * METRES_PER_LEVEL, bevelEnabled: false });
}

function solid(geometry: THREE.BufferGeometry, color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = ORDER.building;
  return mesh;
}

function flat(geometry: THREE.BufferGeometry, color: number, order: number): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = order;
  return mesh;
}

function ribbons(roads: TownshipData["roads"], keep: (width: number) => boolean): THREE.BufferGeometry | null {
  const positions: number[] = [];
  for (const road of roads) {
    if (!keep(road.w)) continue;
    for (const v of ribbonTriangles(road.pts, road.w)) positions.push(v);
  }
  if (positions.length === 0) return null;
  // Interleave to x, y, z = 0
  const xyz = new Float32Array((positions.length / 2) * 3);
  for (let i = 0; i < positions.length / 2; i++) {
    xyz[i * 3] = positions[i * 2];
    xyz[i * 3 + 1] = positions[i * 2 + 1];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(xyz, 3));
  return geometry;
}

function glow(material: THREE.MeshStandardMaterial, on: boolean): void {
  material.emissive.set(on ? HOVER_GLOW : 0x000000);
  material.emissiveIntensity = on ? 0.6 : 0;
}

export function createTownshipView(data: TownshipData): TownshipView {
  const group = new THREE.Group();

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: 0x0b1220 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.renderOrder = ORDER.ground;
  group.add(ground);

  // Areas, merged per kind: one draw call each
  for (const kind of Object.keys(AREA_COLORS) as AreaPolygon["kind"][]) {
    const shapes = data.areas
      .filter((a) => a.kind === kind)
      .map((a) => new THREE.ShapeGeometry(new THREE.Shape(a.footprint.map(([east, north]) => new THREE.Vector2(east, north)))));
    if (shapes.length === 0) continue;
    const merged = mergeGeometries(shapes);
    for (const s of shapes) s.dispose();
    if (merged) group.add(flat(merged, AREA_COLORS[kind], kind === "parking" ? ORDER.parking : ORDER.area));
  }

  const roadGeometry = ribbons(data.roads, (w) => w >= FOOTPATH_MAX_WIDTH);
  if (roadGeometry) group.add(flat(roadGeometry, ROAD_COLOR, ORDER.road));
  const footpathGeometry = ribbons(data.roads, (w) => w < FOOTPATH_MAX_WIDTH);
  if (footpathGeometry) group.add(flat(footpathGeometry, FOOTPATH_COLOR, ORDER.footpath));

  const entries: Entry[] = [];
  const add = (footprint: number[][], levels: number, color: number, buildingId: string | null): Entry => {
    const geometry = extrude(footprint, levels);
    const mesh = solid(geometry, color);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x0f172a }));
    mesh.add(edges);
    group.add(mesh);
    const entry = { mesh, edges, buildingId };
    entries.push(entry);
    return entry;
  };

  for (const c of data.context) add(c.footprint, c.levels, CONTEXT_COLOR, null);
  const towers = new Map<string, Entry>();
  for (const b of data.buildings) {
    const entry = add(b.footprint, b.levels, NO_DATA_COLOR, b.id);
    entry.mesh.userData.buildingId = b.id;
    towers.set(b.id, entry);
  }

  const reach = data.buildings.flatMap((b) => b.footprint.map(([east, north]) => Math.hypot(east, north)));
  const tallest = Math.max(...data.buildings.map((b) => b.levels * METRES_PER_LEVEL));
  let hovered: string | null = null;

  return {
    group,
    pickables: [...towers.values()].map((e) => e.mesh),
    center: new THREE.Vector3(0, tallest / 4, 0),
    radius: Math.max(...reach, tallest),
    setTemps(avgByBuilding) {
      for (const [id, entry] of towers) {
        const avg = avgByBuilding.get(id);
        (entry.mesh.material as THREE.MeshStandardMaterial).color.set(avg === undefined ? NO_DATA_COLOR : tempColor(avg));
      }
    },
    setHover(buildingId) {
      if (buildingId === hovered) return;
      const previous = hovered ? towers.get(hovered) : undefined;
      if (previous) glow(previous.mesh.material as THREE.MeshStandardMaterial, false);
      hovered = buildingId;
      const next = buildingId ? towers.get(buildingId) : undefined;
      if (next) glow(next.mesh.material as THREE.MeshStandardMaterial, true);
    },
    focus(buildingId) {
      const dim = buildingId !== null;
      for (const { mesh, edges, buildingId: id } of entries) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        const opacity = id ? DIM_OPACITY.tower : DIM_OPACITY.context;
        material.opacity = dim ? opacity : 1;
        material.depthWrite = !dim;
        const edgeMaterial = edges.material as THREE.LineBasicMaterial;
        edgeMaterial.opacity = dim ? DIM_EDGE_OPACITY : 1;
        // Flipping `transparent` changes the compiled shader (the OPAQUE define), so the material must be rebuilt
        for (const m of [material, edgeMaterial]) {
          if (m.transparent === dim) continue;
          m.transparent = dim;
          m.needsUpdate = true;
        }
        mesh.visible = !(dim && id === buildingId);
      }
    },
    dispose() {
      group.traverse((object) => {
        const item = object as THREE.Mesh;
        item.geometry?.dispose();
        const material = item.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) for (const m of material) m.dispose();
        else material?.dispose();
      });
    },
  };
}

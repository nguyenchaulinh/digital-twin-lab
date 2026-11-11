import * as THREE from "three";
import { tempColor } from "./color";
import type { RoomState } from "./types";

const FLOOR_PITCH = 2.2;
const ROOM_OFFSET_X = 2.1;

export interface BuildingView {
  group: THREE.Group;
  pickables: THREE.Object3D[];
  center: THREE.Vector3;
  radius: number;
  setRooms: (rooms: RoomState[], selectedId: string | null) => void;
  dispose: () => void;
}

// One box per instrumented room. Instrumented floors are stacked evenly, whatever their real number.
export function createBuildingView(rooms: RoomState[]): BuildingView {
  const group = new THREE.Group();
  const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
  const meshes = new Map<string, THREE.Mesh>();
  const geometry = new THREE.BoxGeometry(3.8, 2, 4);

  for (const room of rooms) {
    const material = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(room.id.endsWith("A") ? -ROOM_OFFSET_X : ROOM_OFFSET_X, floors.indexOf(room.floor) * FLOOR_PITCH + 1, 0);
    mesh.userData.roomId = room.id;
    meshes.set(room.id, mesh);
    group.add(mesh);
  }

  const height = floors.length * FLOOR_PITCH;
  return {
    group,
    pickables: [...meshes.values()],
    center: new THREE.Vector3(0, height / 2, 0),
    radius: Math.max(height / 1.6, 8),
    setRooms(latest, selectedId) {
      for (const room of latest) {
        const mesh = meshes.get(room.id);
        if (!mesh) continue;
        (mesh.material as THREE.MeshStandardMaterial).color.copy(tempColor(room.temp));
        mesh.scale.setScalar(room.id === selectedId ? 1.04 : 1);
      }
    },
    dispose() {
      geometry.dispose();
      for (const mesh of meshes.values()) (mesh.material as THREE.Material).dispose();
    },
  };
}

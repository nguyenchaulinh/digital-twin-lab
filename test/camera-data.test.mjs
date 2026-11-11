// Camera classification and records. Run: npm run test:cameras
import assert from "node:assert/strict";
import { cameraKind, camerasFrom, dedupe, toCamera } from "../scripts/camera-data.mjs";

// Kinds
assert.equal(cameraKind({ highway: "speed_camera" }), "speed");
assert.equal(cameraKind({ type: "enforcement", enforcement: "maxspeed" }), "speed");
assert.equal(cameraKind({ type: "enforcement", enforcement: "traffic_signals" }), "red_light");
assert.equal(cameraKind({ man_made: "surveillance", surveillance: "camera_giám_sát_chấp_hành_tín_hiệu_đèn_giao_thông" }), "red_light");
assert.equal(cameraKind({ type: "enforcement", enforcement: "check" }), "traffic");
assert.equal(cameraKind({ man_made: "surveillance", "surveillance:type": "ALPR" }), "traffic");
assert.equal(cameraKind({ man_made: "surveillance", "surveillance:zone": "traffic" }), "traffic");
assert.equal(cameraKind({ man_made: "surveillance", surveillance: "public" }), "public");
assert.equal(cameraKind({ man_made: "surveillance", surveillance: "outdoor" }), "public");
// Private, indoor or unknown cameras are not shown
assert.equal(cameraKind({ man_made: "surveillance" }), null);
assert.equal(cameraKind({ man_made: "surveillance", surveillance: "indoor" }), null);
assert.equal(cameraKind({ man_made: "surveillance", surveillance: "private" }), null);
assert.equal(cameraKind({}), null);

// Records
const node = { type: "node", id: 10, lat: 21.0245, lon: 105.8412, tags: { highway: "speed_camera", maxspeed: "60", ref: " C1 " } };
assert.deepEqual(toCamera(node), { id: "n10", osmType: "node", osmId: 10, lat: 21.0245, lon: 105.8412, kind: "speed", ref: "C1", maxspeed: 60 });
// A relation takes its position from `center`
const relation = { type: "relation", id: 7, center: { lat: 21.02451, lon: 105.84121 }, tags: { type: "enforcement", enforcement: "maxspeed" } };
assert.equal(toCamera(relation).id, "r7");
// Not a number: no maxspeed; out of Vietnam, no position or a bad id: dropped
assert.equal(toCamera({ ...node, tags: { highway: "speed_camera", maxspeed: "60 mph" } }).maxspeed, undefined);
assert.equal(toCamera({ ...node, lat: 48.85, lon: 2.35 }), null);
assert.equal(toCamera({ type: "node", id: 11, tags: { highway: "speed_camera" } }), null);
assert.equal(toCamera({ ...node, id: "11" }), null);
assert.equal(toCamera({ ...node, type: "area" }), null);
// Free text is trimmed and capped
assert.equal(toCamera({ ...node, tags: { highway: "speed_camera", name: "x".repeat(200) } }).name.length, 60);

// The relation a few metres from its camera node is the same camera; the node is kept
const far = { type: "node", id: 12, lat: 21.03, lon: 105.85, tags: { highway: "speed_camera" } };
const cameras = camerasFrom([relation, node, far]);
assert.deepEqual(cameras.map((c) => c.id), ["n10", "n12"]);
// Two kinds at the same place are two cameras
const redLight = { type: "node", id: 13, lat: 21.0245, lon: 105.8412, tags: { enforcement: "traffic_signals" } };
assert.equal(camerasFrom([node, redLight]).length, 2);
// Two camera nodes on one pole (one per direction) are both kept
const twin = { ...node, id: 14, lat: 21.02451 };
assert.deepEqual(camerasFrom([node, twin]).map((c) => c.id), ["n10", "n14"]);
// A relation far from any node is a camera of its own
const lone = { type: "relation", id: 8, center: { lat: 21.1, lon: 105.9 }, tags: { type: "enforcement", enforcement: "maxspeed" } };
assert.deepEqual(camerasFrom([node, lone]).map((c) => c.id), ["n10", "r8"]);
assert.deepEqual(dedupe([]), []);

console.log("cameras: all checks passed");

// Township footprints as map polygons. Run: npm run test:mapbuildings
import assert from "node:assert/strict";
import { mergeFeatures, townshipFeatures } from "../src/map-buildings.ts";

const near = (actual: number, expected: number, eps: number) => assert.ok(Math.abs(actual - expected) < eps, `${actual} !~ ${expected}`);

const data = {
  id: "t1",
  name: "T",
  shortName: "T",
  city: null,
  ward: null,
  origin: { lat: 21, lon: 105 },
  buildings: [{ id: "B1", osmId: 1, name: "Tower", levels: 30, footprint: [[0, 0], [10, 0], [10, 10], [0, 10]] }],
  context: [
    { osmId: 2, kind: "yes", levels: 5, levelsAssumed: false, footprint: [[20, 0], [30, 0], [30, 10], [20, 10], [20, 0]] }, // already closed
    { osmId: 3, kind: "yes", levels: 5, levelsAssumed: true, footprint: [[0, 0], [1, 1]] }, // not a polygon
  ],
  roads: [],
  areas: [],
};

const features = townshipFeatures(data, 3);
assert.equal(features.length, 2); // the 2-point footprint is dropped

const tower = features.find((f) => f.properties.kind === "tower")!;
assert.equal(tower.properties.building, "B1");
assert.equal(tower.properties.township, "t1");
assert.equal(tower.properties.height, 90); // 30 levels x 3 m
const ringOf = (f: (typeof features)[number]) => f.geometry.coordinates[0];
assert.equal(ringOf(tower).length, 5); // closed
assert.deepEqual(ringOf(tower)[0], ringOf(tower)[4]);
assert.equal(ringOf(features.find((f) => f.properties.osmId === 2)!).length, 5); // an already closed ring is not closed twice

// 10 m east is about 9.6e-5 degrees of longitude at 21 N, and 10 m north about 9.0e-5 of latitude
const [lon0, lat0] = ringOf(tower)[0];
const [lon1] = ringOf(tower)[1];
const [, lat2] = ringOf(tower)[3];
near(lon0, 105, 1e-12);
near(lat0, 21, 1e-12);
near((lon1 - lon0) * 111320 * Math.cos((21 * Math.PI) / 180), 10, 1e-6);
near((lat2 - lat0) * 111320, 10, 1e-6);

// The same OSM building in two townships: kept once, as a tower when either has it as one
const asContext = { ...features[0], properties: { ...tower.properties, kind: "context" as const, building: "", name: "", township: "t2" } };
const merged = mergeFeatures([[asContext], features]);
assert.equal(merged.filter((f) => f.properties.osmId === 1).length, 1);
assert.equal(merged.find((f) => f.properties.osmId === 1)!.properties.kind, "tower");
assert.equal(merged.find((f) => f.properties.osmId === 1)!.properties.township, "t1");
assert.equal(merged.length, 2);

console.log("map buildings: all checks passed");

// Tile maths and local metres. Run: npm run test:tiles
import assert from "node:assert/strict";
import { fromMetres, imageryTileUrl, tileBox, tileOf, toMetres } from "../src/tiles.ts";

const near = (actual: number, expected: number, eps: number) => assert.ok(Math.abs(actual - expected) < eps, `${actual} !~ ${expected}`);

// The four tiles of zoom 1 meet at 0, 0
assert.deepEqual(tileOf(0.0001, -0.0001, 1), { x: 1, y: 1, z: 1 });
assert.deepEqual(tileOf(-0.0001, 0.0001, 1), { x: 0, y: 0, z: 1 });

// A point lies inside the box of its own tile (a few places in Vietnam, two zooms)
for (const [lon, lat] of [[105.8412, 21.0245], [106.7009, 10.7769], [108.2208, 16.0544], [105.944639, 20.994878]]) {
  for (const z of [16, 18]) {
    const box = tileBox(tileOf(lon, lat, z));
    assert.ok(box.west <= lon && lon < box.east, `lon ${lon} z${z}`);
    assert.ok(box.south < lat && lat <= box.north, `lat ${lat} z${z}`);
  }
}

// Neighbouring tiles share their edges
const t = tileOf(105.8412, 21.0245, 18);
near(tileBox(t).east, tileBox({ ...t, x: t.x + 1 }).west, 1e-12);
near(tileBox(t).south, tileBox({ ...t, y: t.y + 1 }).north, 1e-12);

// A zoom-18 tile at 21 N is about 143 m across
const origin = { lat: 21.0245, lon: 105.8412 };
const box = tileBox(t);
const [west] = toMetres(origin, box.west, origin.lat);
const [east] = toMetres(origin, box.east, origin.lat);
near(east - west, 142.7, 1);

// Metres and degrees round-trip
const [lon, lat] = fromMetres(origin, 120, -45);
const [e, n] = toMetres(origin, lon, lat);
near(e, 120, 1e-6);
near(n, -45, 1e-6);

assert.equal(imageryTileUrl({ x: 3, y: 5, z: 7 }), "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/7/5/3");

console.log("tiles: all checks passed");

// Mapillary search box and answer parsing. Run: npm run test:street
import assert from "node:assert/strict";
import { nearestImage, searchBox, searchUrl } from "../src/mapillary-search.ts";

const near = (actual: number, expected: number, eps: number) => assert.ok(Math.abs(actual - expected) < eps, `${actual} !~ ${expected}`);

const lon = 105.8412;
const lat = 21.0245;

// A box of 100 m each way is about 200 m across in both directions
const [w, s, e, n] = searchBox(lon, lat, 100);
near((n - s) * 111320, 200, 1e-6);
near((e - w) * 111320 * Math.cos((lat * Math.PI) / 180), 200, 1e-6);

// The URL carries the box and the fields, and never a token (that goes in a header)
const url = new URL(searchUrl(lon, lat, 100));
assert.equal(url.origin + url.pathname, "https://graph.mapillary.com/images");
assert.equal(url.searchParams.get("fields"), "id,computed_geometry,geometry");
assert.equal(url.searchParams.get("bbox")?.split(",").length, 4);
assert.equal(url.searchParams.has("access_token"), false);

// Nearest wins; computed_geometry is preferred, geometry is the fallback
const at = (dEast: number, dNorth: number) => ({
  type: "Point",
  coordinates: [lon + dEast / (111320 * Math.cos((lat * Math.PI) / 180)), lat + dNorth / 111320],
});
const answer = {
  data: [
    { id: "111", computed_geometry: at(80, 0) },
    { id: "222", computed_geometry: at(5, 5), geometry: at(500, 500) },
    { id: "333", geometry: at(20, 0) },
  ],
};
assert.equal(nearestImage(answer, lon, lat), "222");
assert.equal(nearestImage({ data: [{ id: "333", geometry: at(20, 0) }, { id: "111", computed_geometry: at(80, 0) }] }, lon, lat), "333");

// Malformed answers and items are skipped, never thrown on
assert.equal(nearestImage(null, lon, lat), null);
assert.equal(nearestImage({ error: { message: "x" } }, lon, lat), null);
assert.equal(nearestImage({ data: [] }, lon, lat), null);
assert.equal(
  nearestImage(
    {
      data: [
        { id: "../../x", computed_geometry: at(1, 1) }, // not a numeric id
        { id: 42, computed_geometry: at(1, 1) }, // not a string
        { id: "444", computed_geometry: { coordinates: ["a", 1] } }, // no usable point
        { id: "555", computed_geometry: at(30, 0) },
      ],
    },
    lon,
    lat,
  ),
  "555",
);

console.log("mapillary search: all checks passed");

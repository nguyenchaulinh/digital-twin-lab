// Geometry checks. Run: npm run test:geometry
import assert from "node:assert/strict";
import { clipHalfPlane, polygonArea, principalAngle, ribbonTriangles, ringCentroid, splitAlongLongAxis } from "../src/geometry.ts";

const near = (actual: number, expected: number, eps = 1e-9) => assert.ok(Math.abs(actual - expected) < eps, `${actual} !~ ${expected}`);
const rect = (w: number, h: number) => [[0, 0], [w, 0], [w, h], [0, h]];

near(polygonArea(rect(4, 3)), 12);
near(polygonArea([...rect(4, 3)].reverse()), 12); // orientation does not matter
near(polygonArea([[0, 0], [4, 0], [0, 3]]), 6);

const [cx, cy] = ringCentroid(rect(4, 2));
near(cx, 2);
near(cy, 1);

// Clipping a square in half
near(polygonArea(clipHalfPlane(rect(2, 2), 1, 0, 1)), 2);
assert.equal(clipHalfPlane(rect(2, 2), 1, 0, -1).length, 0); // plane entirely outside
near(polygonArea(clipHalfPlane(rect(2, 2), 1, 0, 5)), 4); // plane entirely inside keeps everything

// The long axis of a wide rectangle is horizontal, and it is cut into two equal halves
near(Math.sin(principalAngle(rect(10, 2))), 0, 1e-9);
const [low, high] = splitAlongLongAxis(rect(10, 2));
near(polygonArea(low), 10);
near(polygonArea(high), 10);
assert.ok(low.every(([x]) => x <= 5 + 1e-9));
assert.ok(high.every(([x]) => x >= 5 - 1e-9));

// A tall rectangle is cut across its vertical axis instead
const [bottom, top] = splitAlongLongAxis(rect(2, 10));
near(polygonArea(bottom), 10);
assert.ok(bottom.every(([, y]) => y <= 5 + 1e-9) !== top.every(([, y]) => y <= 5 + 1e-9));

// Ribbons: 6 vertices (12 numbers) per segment, covering length x width
const strip = ribbonTriangles([[0, 0], [10, 0], [10, 5]], 2);
assert.equal(strip.length, 24);
assert.equal(ribbonTriangles([[0, 0], [0, 0]], 2).length, 0); // zero-length segment is skipped
assert.equal(ribbonTriangles([[0, 0]], 2).length, 0);

console.log("geometry: all checks passed");

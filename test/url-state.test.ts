// The URL hash is outside input: only well-formed values get through. Run: npm run test:urlstate
import assert from "node:assert/strict";
import { formatHash, parseHash, type UrlState } from "../src/url-state.ts";

const none: UrlState = { township: null, building: null, room: null, mode: null };

// Round trip
const full: UrlState = { township: "vn001", building: "B2", room: "B2-F10-A", mode: "sensors" };
assert.equal(formatHash(full), "#t=vn001&b=B2&r=B2-F10-A&m=sensors");
assert.deepEqual(parseHash(formatHash(full)), full);
assert.deepEqual(parseHash("#t=ocean-park"), { ...none, township: "ocean-park" });
assert.deepEqual(parseHash("t=smart-city&b=S3"), { ...none, township: "smart-city", building: "S3" }); // the # is optional

// The map has no hash
assert.equal(formatHash(none), "");
assert.deepEqual(parseHash(""), none);
assert.deepEqual(parseHash("#"), none);

// Parts that make no sense alone are dropped
assert.deepEqual(parseHash("#b=B2&r=B2-F10-A&m=sensors"), none);
assert.deepEqual(parseHash("#t=vn001&r=B2-F10-A&m=sensors"), { ...none, township: "vn001" });
assert.equal(formatHash({ township: null, building: "B2", room: null, mode: null }), "");
assert.equal(formatHash({ township: "vn001", building: null, room: "B2-F10-A", mode: "sensors" }), "#t=vn001");

// A room of another building does not match
assert.equal(parseHash("#t=vn001&b=B2&r=B3-F10-A").room, null);
assert.equal(parseHash("#t=vn001&b=B2&r=B2-F10-A").room, "B2-F10-A");

// Malformed values are ignored, never passed on
for (const bad of ["../../etc", "VN001", "a".repeat(41), "<script>", "vn001/../x", "vn 001", "", "%3Cscript%3E"]) {
  assert.equal(parseHash(`#t=${bad}`).township, null, `township ${JSON.stringify(bad)}`);
}
for (const bad of ["b2", "B", "B123", "B2;drop", "<b>", "B2 ", ""]) {
  assert.equal(parseHash(`#t=vn001&b=${bad}`).building, null, `building ${JSON.stringify(bad)}`);
}
for (const bad of ["B2-F10-C", "B2-F-A", "B2-F1000-A", "B2-F10-A-x", "B2-F10-A<", ""]) {
  assert.equal(parseHash(`#t=vn001&b=B2&r=${bad}`).room, null, `room ${JSON.stringify(bad)}`);
}
for (const bad of ["wireframe", "SENSORS", ""]) {
  assert.equal(parseHash(`#t=vn001&b=B2&m=${bad}`).mode, null, `mode ${JSON.stringify(bad)}`);
}
// Repeated or unknown keys cannot smuggle anything in
assert.deepEqual(parseHash("#t=vn001&t=vn002&x=1"), { ...none, township: "vn001" });

console.log("url state: all checks passed");

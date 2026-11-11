// Parser checks for the live feeds. Run: npm run test:feeds
import assert from "node:assert/strict";
import { checkPoint, parseAirFeed, parseWeather } from "./feeds.mjs";

assert.equal(parseWeather({ current: { temperature_2m: 20.9 } }), 20.9);
for (const bad of [null, {}, { current: {} }, { current: { temperature_2m: "20" } }, { current: { temperature_2m: 999 } }]) {
  assert.throws(() => parseWeather(bad), /unexpected weather payload/);
}

const feed = {
  status: "ok",
  data: {
    aqi: 152,
    city: { name: "Hanoi US Embassy" },
    iaqi: { pm25: { v: 152 } },
    time: { iso: "2026-11-11T15:00:00+07:00" },
  },
};
assert.deepEqual(parseAirFeed(feed), {
  aqi: 152,
  pm25: 152,
  station: "Hanoi US Embassy",
  updated: "2026-11-11T15:00:00+07:00",
});
assert.equal(parseAirFeed({ status: "ok", data: { aqi: 40 } }).pm25, null);

// Full real station name must not be truncated; absurdly long ones are capped
const longName = "United Nations International School of Hanoi, Vietnam (Trường Quốc tế Liên Hợp Quốc Hà Nội)";
assert.equal(parseAirFeed({ status: "ok", data: { aqi: 68, city: { name: longName } } }).station, longName);
assert.equal(parseAirFeed({ status: "ok", data: { aqi: 68, city: { name: "x".repeat(500) } } }).station.length, 200);
assert.throws(() => parseAirFeed({ status: "error", data: "Invalid key" }), /status not ok/);
assert.throws(() => parseAirFeed({ status: "ok", data: { aqi: "-" } }), /no current data/);
assert.throws(() => parseAirFeed({ status: "ok", data: { aqi: "abc" } }), /unexpected air quality payload/);
assert.throws(() => parseAirFeed({ status: "ok", data: { aqi: 12.5 } }), /unexpected air quality payload/);

// Coordinates are checked before they are put into a URL
assert.deepEqual(checkPoint({ lat: 21.0285123456, lon: 105.8542 }), { lat: 21.0285, lon: 105.8542 });
for (const bad of [{ lat: NaN, lon: 105 }, { lat: 21, lon: "105" }, { lat: 51.5, lon: -0.1 }, { lat: 21, lon: 200 }, {}]) {
  assert.throws(() => checkPoint(bad), /invalid coordinates/);
}

console.log("feeds parsers: all checks passed");

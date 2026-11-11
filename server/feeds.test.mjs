// Parser checks for the live feeds. Run: npm run test:feeds
import assert from "node:assert/strict";
import { parseAirFeed, parseWeather } from "./feeds.mjs";

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
assert.throws(() => parseAirFeed({ status: "error", data: "Invalid key" }), /status not ok/);
assert.throws(() => parseAirFeed({ status: "ok", data: { aqi: "-" } }), /no current data/);
assert.throws(() => parseAirFeed({ status: "ok", data: { aqi: "abc" } }), /unexpected air quality payload/);
assert.throws(() => parseAirFeed({ status: "ok", data: { aqi: 12.5 } }), /unexpected air quality payload/);

console.log("feeds parsers: all checks passed");

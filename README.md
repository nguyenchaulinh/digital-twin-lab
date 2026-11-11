# Digital Twin Lab

[Tiếng Việt](README.vi.md)

A small learning project that builds a **digital twin of townships across Vietnam**: a map of Vietnam with every township found in OpenStreetMap (named high-rise towers of 10+ levels; the two Vinhomes townships Smart City and Ocean Park are among them), each opening into a 3D view with up to 8 real towers, simulated indoor conditions, live outside weather and air quality for that location, and an advisor that recommends ventilation or air conditioning.

> **Independent learning project. Not affiliated with Vingroup or Vinhomes, and it uses no data from their systems.** Building footprints and names come from OpenStreetMap. Everything inside the buildings (room temperatures, AC power and energy) is **simulated**.

## What it does

- **Map of Vietnam:** the app starts on a map (MapLibre GL, OpenFreeMap vector tiles) with one marker per township, clustered when zoomed out. Click a marker for its name and a button that opens it in 3D, or search the list on the right by name, city or ward. A Map / Satellite switch (bottom left) shows aerial imagery with place names, to see the buildings, roads and rivers. Zoom in to level 15 or more and the buildings of the townships in view are drawn on the map, extruded by floor count (the simulated towers in amber, the rest grey); hover a tower for its name and click it to go straight to its detail. Going back from a township keeps the map exactly as it was left.
- **Township view:** the real campus from OpenStreetMap: 8 towers, up to 160 surrounding buildings, roads and footpaths, parks, water, sports pitches and parking, with buildings extruded by number of levels. **Esc** (or the button above the list) returns to the map. Each tower is coloured by its average room temperature. Hovering a tower (or its row in the list) highlights both and shows the building name in a tooltip.
- **Building view:** click a tower to open it in its real shape, in one of two looks (switch in the detail panel). *Facade*: a solid tower with drawn windows on every floor, standing on satellite imagery of the surroundings (about 430 m across) with the imagery also on its roof; the hovered or selected room shows through the walls. *Sensors*: a ghost shell with a line at every level and a coloured slab per room on each instrumented floor. The facade is drawn, not photographed: OSM has no facade photos (the street view shows the real building). A detail panel shows the name, OSM link, floors, estimated height, footprint area, averages and a table of the instrumented floors. Select a room from the 3D view or the table and toggle its air conditioner (the command goes back to the simulator).
- **Street view:** street-level photos from Mapillary in a panel, opened from the map (press *Street view*, then click a street), from a township's popup, or from the open building. The nearest photo within 60 m is shown, else within 150 m. Needs `VITE_MAPILLARY_TOKEN`; without it the buttons are hidden.
- **Cameras:** from zoom 10, the traffic and street cameras mapped in OpenStreetMap show as dots (speed red, red-light magenta, other traffic blue, street surveillance grey; *Cameras* button to hide them). A popup gives the kind, speed limit and direction when mapped, the OSM link and a street view button. **Positions only, no live images:** no Vietnamese camera service publishes an API or reuse terms, so the popup only links to the official service of the area (the HCMC traffic portal; for Hanoi, the iHanoi app). An approved live feed would be added in `src/camera-sources.ts`.
- **Live outside data:** temperature from Open-Meteo and air quality (AQI, PM2.5) from the nearest AQICN station, for the coordinates of the township being viewed (the HUD shows the station name). If a feed is missing or stale the simulator falls back to a synthetic daily cycle and the HUD says so.
- **Advisor:** per room, recommends *open windows*, *run AC*, *keep windows closed* or *no action*, with the reason and the maximum power that could be saved. Health comes first (see [policy](#advisor-policy)).
- **English / Vietnamese** UI with a switch (EN/VI). The choice is remembered in the browser.

## Architecture

```
server/sim.mjs  ──snapshot every 1s (WebSocket)──►  src/main.ts  ─► map + 3D views + HUD + advisor
   ▲  thermal model per room, live feeds                 │
   └──────── {watch} township, {setAc} command ◄─────────┘
```

| Layer | Where |
|---|---|
| 1. Collection | `server/sim.mjs` (simulated rooms), `server/feeds.mjs` (Open-Meteo, AQICN) |
| 2. Transport | WebSocket on `ws://127.0.0.1:8787` |
| 3. Modelling | `data/catalog.json` (map markers), `data/townships/*.json` OSM extracts (loaded on demand), `src/map-view.ts`, `src/township-view.ts`, `src/building-view.ts` |
| 4. Analysis | `src/model.ts` (what-if prediction), `src/advisor.ts` (policy) |
| 5. Interaction | `src/main.ts`, `src/hud.ts`, AC command back to the simulator |

The simulator streams and simulates only the township a client is **watching**; the viewer sends `{watch}` when a township opens and `null` when it returns to the map. A client can only command rooms of the township it watches.

The twin's own model (`src/model.ts`) is deliberately slightly different from the simulator's physics: a twin is an approximation, and the gap is the point of calibration.

A 39-storey tower is not simulated floor by floor. **12 floors are instrumented**, spread evenly from the first to the last level, and the HUD shows "12 of 39".

## Quick start

Requires Node.js. Tested on **Node 24.22.1** and npm 11.

```bash
git clone https://github.com/nguyenchaulinh/digital-twin-lab.git
cd digital-twin-lab
npm install
cp .env.example .env     # optional, see "Configuration"
# After pulling the map feature use `npm install`, not `npm ci`: maplibre-gl was added to package.json
```

Two terminals:

```bash
npm run sim    # simulator on ws://127.0.0.1:8787
npm run dev    # viewer on http://localhost:5173
```

Open http://localhost:5173. Click a township marker and "Open in 3D", click a tower (or a row in the list), click a room, press **A** to toggle its AC, **Esc** to go back one level.

Restart `npm run sim` whenever the simulator code changes. The viewer rejects snapshots from an older simulator.

### Configuration

| Variable | Purpose |
|---|---|
| `AQICN_TOKEN` | Free token from https://aqicn.org/data-platform/token/. Without it air quality is disabled and the HUD shows "n/a" |
| `VITE_MAPILLARY_TOKEN` | Mapillary **client** token (`MLY\|…`), free at https://www.mapillary.com/dashboard/developers. Read by Vite and built into the page, as client tokens are meant to be; never put a secret in a `VITE_` variable. Without it the street view is off. Restart `npm run dev` after changing it |

`npm run sim` loads `.env` if present. `.env` is git-ignored; never commit a token.

### Demo override

Open `http://localhost:5173/?demoAqi=160` to feed a fake AQI to the advisor and see it choose health over energy. The HUD shows a separate "AQI (demo override)" row so it cannot be mistaken for real data.

## Advisor policy

Health first, energy second (`src/advisor.ts`):

1. No air quality data: never advise opening windows.
2. AQI above 100: keep windows closed; advise AC only if the room is above the comfort limit and AC is off.
3. AQI 100 or below, and outside at least 1 °C cooler than the room and not above 26 °C: ventilate instead of running AC.
4. Otherwise: AC only when the room is above 26 °C.

The thresholds (100, 26 °C, 1 °C) are **tunable assumptions, not standards**. The AC unit is assumed to be 1 kW rated and modulating, so "save up to X kW" is an upper bound, not a measured saving.

## Scripts

| Command | What it does |
|---|---|
| `npm run sim` | Start the simulator |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm test` | Run all tests (`test:feeds`, `test:township`, `test:advisor`, `test:geometry`, `test:snapshot`, `test:mapbuildings`, `test:tiles`, `test:street`, `test:cameras`) |
| `npm run discover:townships` | Find township candidates across Vietnam in OpenStreetMap and write `scripts/townships.seed.json` (only needed to refresh the list) |
| `npm run fetch:township` | Extract every seed that has no file yet (writes `data/townships/*.json` and `data/catalog.json`). Resumable; about 45 s per township on the public Overpass server. `-- vn007` for one, `-- --force` to overwrite, `-- --rename` to regenerate names offline |
| `npm run fetch:cameras` | Extract traffic and public street cameras in Vietnam from OSM into `data/cameras.json` (one Overpass query). `-- --from <file>` reuses a saved Overpass response |
| `npx tsc -p .` | Typecheck |

## Project layout

```
data/catalog.json      one small record per township, for the map
data/townships/        OSM extracts: towers, buildings, roads, green areas, water
scripts/               township discovery and extraction (+ the seed list)
server/                simulator, live feeds, township loader (+ tests)
src/                   viewer: scenes, HUD, advisor, i18n
test/                  advisor tests
```

## Versions

three 0.187.0, maplibre-gl ^5.21.0, vite 8.3.5, typescript 7.0.2, ws 8.22.1 (`package-lock.json` is committed).

## Data sources and licences

| Data | Source | Licence / terms |
|---|---|---|
| Outside temperature | [Open-Meteo](https://open-meteo.com/) | CC BY 4.0, attribution required. The free tier is for **non-commercial** use |
| Air quality | [World Air Quality Index Project](https://aqicn.org/) | Requires a free token. Read their terms before any use beyond learning |
| Basemap | [OpenFreeMap](https://openfreemap.org/) vector tiles, © OpenMapTiles, data © OpenStreetMap contributors | No key. The browser requests tiles from `tiles.openfreemap.org`, so that host sees the visitor's IP. Read their terms before use beyond learning |
| Satellite | [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9) and Esri's place-name overlay | No key, loaded only when the Satellite switch is used (`server.arcgisonline.com` sees the visitor's IP). Esri's terms apply and keep the attribution on screen; use beyond this lab needs an ArcGIS account or another provider (`src/tiles.ts` and `src/map-view.ts`). The building view also loads 9 imagery tiles around the open building |
| Street photos | [Mapillary](https://www.mapillary.com/) via `mapillary-js`, photos CC BY-SA | Free client token. Loaded only when the street view is opened; `graph.mapillary.com` and Mapillary's image hosts see the visitor's IP and the clicked location. Coverage in Vietnam is uneven |
| Cameras | Positions from OpenStreetMap (`man_made=surveillance`, `highway=speed_camera`, enforcement relations), ODbL | 137 cameras at extraction (2026-11): 46 speed, 2 red-light, 20 other traffic, 69 street surveillance; private and indoor cameras are left out. OSM coverage is sparse and not the official camera network. Official services (HCMC portal, iHanoi) are only linked to: their terms of reuse were not found, and their images may show people and number plates (personal data), so using them needs the operator's permission and a legal review |
| Footprints, names, levels, roads, green areas, water | [OpenStreetMap](https://www.openstreetmap.org/copyright) | ODbL 1.0, © OpenStreetMap contributors. `data/townships/*.json` are extracts and carry the same licence |

Levels missing in OSM are assumed (2 for houses, 3 for terraces and schools); those buildings are context only and are not simulated.

## Design notes

- **Why OpenStreetMap and not Google Maps.** OSM gives footprints, names, levels, roads, parks and water with no key and no bill. Google's Photorealistic 3D Tiles need billing and an API key, are an Enterprise SKU with only a small free quota, require Google's attribution and logo, and their policies prohibit caching or extracting the data for offline use. Whether Vietnam is covered was not confirmed. These points come from web search, not from a contract: check Google's current terms before relying on them. A key shipped to a browser is also exposed, so any Google integration should go through a small server-side proxy.
- **Why these townships.** `npm run discover:townships` queries OSM for every building of 10+ levels in Vietnam (2,225 at the time of writing), keeps the named ones of residential or office type, and groups those within 500 m of each other. Groups of 4+ become townships (139: mostly Hanoi, then Ho Chi Minh City, Da Nang and a few others, reflecting where OSM is mapped, not where buildings are). Each township shows its 8 towers nearest the centre; its other towers appear as grey context. Names are generated (shared brand, else the tower nearest the centre, then ward and city) and can be set by hand in the seed file.
- **The map and the 3D view are separate scenes.** The map draws the buildings as plain extrusions so they can be found and clicked in place; the rooms, floors and facade live in the township's own three.js scene.
- **The public Overpass server is not meant for bulk automated use.** The extraction is a one-off, resumable and spaced out; the committed JSON files are the result, so nobody needs to run it.
- **Heights are assumed** at 3 m per level; the floor count itself comes from OSM (`building:levels`).
- **Lakes mapped as OSM multipolygon relations are not drawn**; only closed ways are extracted.

## Troubleshooting

- **Viewer says "disconnected":** `npm run sim` is not running, or Vite is not on port 5173. The simulator only accepts WebSocket connections from `http://localhost:5173` and `http://127.0.0.1:5173`. The viewer retries every 2 s, so restarting the simulator needs no page reload.
- **The page jumps back to the map by itself:** a page reload always starts on the map. The dev server does not watch `data/` (see `vite.config.js`), because `npm run fetch:township` writes there every few seconds and each write would reload the page. After a fetch, restart `npm run dev` to load the new files.
- **`UNABLE_TO_VERIFY_LEAF_SIGNATURE` in the simulator log:** you are behind a TLS-inspecting proxy. `npm run sim` already passes `--use-system-ca`, so the system trust store is used. Do not disable TLS verification.
- **Installing behind a corporate registry:** `npm install` may write internal registry URLs into `package-lock.json`. Check it before committing to a public repository: `grep -c <your-registry-host> package-lock.json`.

## Limitations

- Only townships OSM maps well are listed: a township with few named high-rise buildings in OSM is missing from the map. Names of generated townships can be clumsy.
- Indoor data is simulated; there is no open dataset of indoor conditions for Vietnamese buildings.
- The simulator listens on `127.0.0.1` only and has no authentication. It is a local lab, not a deployable service.
- Time runs 300× faster than real time (1 s = 5 simulated minutes) while the outside temperature is the real current value, and a township only advances while it is watched, so the clock and the weather are not consistent over a long run.

## Roadmap

Operations layer (alerts to incidents, work orders), rooftop solar and EV charging what-ifs, flood scenarios, an ISO 37122 indicator board, and a natural-language "ask the twin" interface.

# Digital Twin Lab

[Tiếng Việt](README.vi.md)

A small learning project that builds a **digital twin of a township**: 8 real apartment towers around Vinhomes Smart City (Hanoi), with simulated indoor conditions, live outside weather and air quality, and an advisor that recommends ventilation or air conditioning.

> **Independent learning project. Not affiliated with Vingroup or Vinhomes, and it uses no data from their systems.** Building footprints and names come from OpenStreetMap. Everything inside the buildings (room temperatures, AC power and energy) is **simulated**.

## What it does

- **Township view:** 3D footprints of the towers plus ~40 surrounding buildings, extruded by number of levels. Each tower is coloured by its average room temperature.
- **Building view:** click a tower to see its instrumented rooms, select a room, and toggle its air conditioner (the command goes back to the simulator).
- **Live outside data:** Hanoi temperature from Open-Meteo and air quality (AQI, PM2.5) from AQICN. If a feed is missing or stale the simulator falls back to a synthetic daily cycle and the HUD says so.
- **Advisor:** per room, recommends *open windows*, *run AC*, *keep windows closed* or *no action*, with the reason and the maximum power that could be saved. Health comes first (see [policy](#advisor-policy)).
- **English / Vietnamese** UI with a switch (EN/VI). The choice is remembered in the browser.

## Architecture

```
server/sim.mjs  ──snapshot every 1s (WebSocket)──►  src/main.ts  ─► 3D views + HUD + advisor
   ▲  thermal model per room, live feeds                 │
   └────────────── {setAc} command ◄─────────────────────┘
```

| Layer | Where |
|---|---|
| 1. Collection | `server/sim.mjs` (simulated rooms), `server/feeds.mjs` (Open-Meteo, AQICN) |
| 2. Transport | WebSocket on `ws://127.0.0.1:8787` |
| 3. Modelling | `data/township.json` footprints, `src/township-view.ts`, `src/building-view.ts` |
| 4. Analysis | `src/model.ts` (what-if prediction), `src/advisor.ts` (policy) |
| 5. Interaction | `src/main.ts`, `src/hud.ts`, AC command back to the simulator |

The twin's own model (`src/model.ts`) is deliberately slightly different from the simulator's physics: a twin is an approximation, and the gap is the point of calibration.

A 39-storey tower is not simulated floor by floor. **12 floors are instrumented**, spread evenly from the first to the last level, and the HUD shows "12 of 39".

## Quick start

Requires Node.js. Tested on **Node 24.22.1** and npm 11.

```bash
git clone https://github.com/nguyenchaulinh/digital-twin-lab.git
cd digital-twin-lab
npm install
cp .env.example .env     # optional, see "Configuration"
```

Two terminals:

```bash
npm run sim    # simulator on ws://127.0.0.1:8787
npm run dev    # viewer on http://localhost:5173
```

Open http://localhost:5173. Click a tower (or a row in the list), click a room, press **A** to toggle its AC, **Esc** to go back.

Restart `npm run sim` whenever the simulator code changes. The viewer rejects snapshots from an older simulator.

### Configuration

| Variable | Purpose |
|---|---|
| `AQICN_TOKEN` | Free token from https://aqicn.org/data-platform/token/. Without it air quality is disabled and the HUD shows "n/a" |
| `AQICN_STATION` | Optional station id. Default `@8688` (UN International School of Hanoi). Stations can go offline and then report `aqi: "-"` |

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
| `npm test` | Run all tests (`test:feeds`, `test:township`, `test:advisor`) |
| `npm run fetch:township` | Re-extract the township footprints from OpenStreetMap (writes `data/township.json`) |
| `npx tsc -p .` | Typecheck |

## Project layout

```
data/township.json     building footprints (OSM extract)
scripts/               one-off data extraction
server/                simulator, live feeds, township loader (+ tests)
src/                   viewer: scenes, HUD, advisor, i18n
test/                  advisor tests
```

## Versions

three 0.187.0, vite 8.3.5, typescript 7.0.2, ws 8.22.1 (`package-lock.json` is committed).

## Data sources and licences

| Data | Source | Licence / terms |
|---|---|---|
| Outside temperature | [Open-Meteo](https://open-meteo.com/) | CC BY 4.0, attribution required. The free tier is for **non-commercial** use |
| Air quality | [World Air Quality Index Project](https://aqicn.org/) | Requires a free token. Read their terms before any use beyond learning |
| Building footprints, names, levels | [OpenStreetMap](https://www.openstreetmap.org/copyright) | ODbL 1.0, © OpenStreetMap contributors. `data/township.json` is an extract and carries the same licence |

Levels missing in OSM are assumed (2 for houses, 3 for terraces and schools); those buildings are context only and are not simulated.

## Troubleshooting

- **Viewer says "disconnected":** `npm run sim` is not running, or Vite is not on port 5173. The simulator only accepts WebSocket connections from `http://localhost:5173` and `http://127.0.0.1:5173`.
- **`UNABLE_TO_VERIFY_LEAF_SIGNATURE` in the simulator log:** you are behind a TLS-inspecting proxy. `npm run sim` already passes `--use-system-ca`, so the system trust store is used. Do not disable TLS verification.
- **Installing behind a corporate registry:** `npm install` may write internal registry URLs into `package-lock.json`. Check it before committing to a public repository: `grep -c <your-registry-host> package-lock.json`.

## Limitations

- Indoor data is simulated; there is no open dataset of indoor conditions for Vietnamese buildings.
- The simulator listens on `127.0.0.1` only and has no authentication. It is a local lab, not a deployable service.
- Time runs 300× faster than real time (1 s = 5 simulated minutes) while the outside temperature is the real current value, so the clock and the weather are not consistent over a long run.

## Roadmap

Operations layer (alerts to incidents, work orders), rooftop solar and EV charging what-ifs, flood scenarios, an ISO 37122 indicator board, and a natural-language "ask the twin" interface.

import type { BuildingMode } from "./building-view";
import { NO_DATA_COLOR, TEMP_MAX, TEMP_MIN, tempColor } from "./color";
import { fmt, t } from "./i18n";
import {
  DEFAULT_THRESHOLDS,
  THRESHOLD_LIMITS,
  isDefaultThresholds,
  sanitizeAqiOverride,
  sanitizeThresholds,
  type Thresholds,
} from "./advisor";
import { ALERT_TEMP } from "./model";
import { arrange, nextSort, type SortKey, type SortState } from "./table-sort";
import type { RoomState } from "./types";

// All text goes in through textContent; nothing here builds HTML from data.
export interface Row {
  label: string;
  value: string;
  alert?: boolean;
}

export interface BuildingStats {
  avgTemp: number | null;
  alerts: number;
  kwh: number;
}

export interface BuildingTable {
  update: (stats: Map<string, BuildingStats>, activeId: string | null) => void;
  setHover: (id: string | null) => void;
}

export interface FloorTable {
  update: (rooms: Map<string, RoomState>, selectedId: string | null, alertTemp: number) => void;
  setHover: (roomId: string | null) => void;
}

export interface DetailInfo {
  name: string;
  where: string;
  osmLabel: string;
  osmId: number;
  facts: Row[];
}

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const info = byId("info");
const hint = byId("hint");
const backButton = byId<HTMLButtonElement>("back");
const tableBody = byId("blist-body");
const floorBody = byId("floor-body");
const townsPanel = byId("towns");
const detailPanel = byId("detail");
const placesPanel = byId("places");

function fillList(list: HTMLElement, rows: Row[]): void {
  list.replaceChildren();
  for (const row of rows) {
    const dt = document.createElement("dt");
    dt.textContent = row.label;
    const dd = document.createElement("dd");
    dd.textContent = row.value;
    if (row.alert) dd.className = "alert";
    list.append(dt, dd);
  }
}

export const setRows = (rows: Row[]): void => fillList(info, rows);

export function setHint(text: string): void {
  hint.textContent = text;
}

export function onBack(handler: () => void): void {
  backButton.addEventListener("click", handler);
}

// --- Right panels: the list of townships (map), the buildings of one township, or the detail of one building ---
export type Panel = "places" | "towns" | "detail";

export function showPanel(panel: Panel): void {
  placesPanel.hidden = panel !== "places";
  townsPanel.hidden = panel !== "towns";
  detailPanel.hidden = panel !== "detail";
}

// A hidden (display: none) panel loses its scroll position, so the township list's is kept by hand
export const getTownsScroll = (): number => townsPanel.scrollTop;
export function setTownsScroll(top: number): void {
  townsPanel.scrollTop = top;
}

export function setTownshipTitle(name: string, place: string): void {
  byId("towns-name").textContent = name;
  byId("towns-place").textContent = place;
}

export function onMapBack(handler: () => void): void {
  byId("map-back").addEventListener("click", handler);
}

// The building view's look (facade or sensors) and its street view button
const modeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("#detail-mode button[data-mode]"));

export function onDetailMode(handler: (mode: BuildingMode) => void): void {
  for (const button of modeButtons) {
    button.addEventListener("click", () => handler(button.dataset.mode === "sensors" ? "sensors" : "facade"));
  }
}

export function setDetailMode(mode: BuildingMode): void {
  for (const button of modeButtons) button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
}

export function onDetailStreet(handler: () => void, available: boolean): void {
  const button = byId<HTMLButtonElement>("detail-street");
  button.hidden = !available;
  button.addEventListener("click", handler);
}

export function setDetail(detail: DetailInfo): void {
  byId("detail-name").textContent = detail.name;
  byId("detail-where").textContent = detail.where;
  const osm = byId<HTMLAnchorElement>("detail-osm");
  osm.textContent = detail.osmLabel;
  if (Number.isInteger(detail.osmId)) osm.href = `https://www.openstreetmap.org/way/${detail.osmId}`;
  fillList(byId("detail-facts"), detail.facts);
}

// --- Township list next to the map: search by name, city or ward (diacritics ignored) ---
const plain = (text: string): string => text.normalize("NFD").replaceAll(/[\u0300-\u036f]/g, "").replaceAll("đ", "d").replaceAll("Đ", "D").toLowerCase();

export interface PlaceRow {
  id: string;
  name: string;
  secondary: string;
  search: string; // extra text the search also matches, e.g. the city
}

export function createPlacesList(onPick: (id: string) => void): (rows: PlaceRow[]) => void {
  const list = byId("places-list");
  const query = byId<HTMLInputElement>("places-q");
  const count = byId("places-count");
  let rows: PlaceRow[] = [];

  function render(): void {
    const needle = plain(query.value.trim());
    const shown = rows.filter((r) => needle === "" || plain(`${r.name} ${r.search}`).includes(needle));
    list.replaceChildren();
    for (const row of shown) {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "placebtn";
      const name = document.createElement("span");
      name.textContent = row.name;
      const secondary = document.createElement("small");
      secondary.textContent = row.secondary;
      button.append(name, secondary);
      button.addEventListener("click", () => onPick(row.id));
      li.append(button);
      list.append(li);
    }
    count.textContent = `${shown.length} / ${rows.length}`;
  }

  query.addEventListener("input", render);
  return (next) => {
    rows = next;
    render();
  };
}

function numberCell(): HTMLTableCellElement {
  const td = document.createElement("td");
  td.className = "num";
  return td;
}

// --- Colour legend: drawn from the same scale as the 3D view (color.ts), so they cannot drift apart ---
const legend = byId("legend");
{
  const steps = 10;
  const stops = Array.from({ length: steps + 1 }, (_, i) => {
    const temp = TEMP_MIN + ((TEMP_MAX - TEMP_MIN) * i) / steps;
    return `${tempColor(temp).getStyle()} ${(i / steps) * 100}%`;
  });
  byId("legend-bar").style.background = `linear-gradient(to right, ${stops.join(", ")})`;
  legend.style.setProperty("--limit", `${((ALERT_TEMP - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * 100}%`);
  const swatch = byId("legend-nodata").querySelector("i");
  if (swatch) swatch.style.background = `#${NO_DATA_COLOR.toString(16).padStart(6, "0")}`;
}

// Shown wherever the 3D view colours things by temperature; the labels follow the language
export function showLegend(visible: boolean): void {
  legend.hidden = !visible;
  if (!visible) return;
  byId("legend-min").textContent = t("legend.min", { t: TEMP_MIN });
  byId("legend-limit").textContent = t("legend.limit", { t: ALERT_TEMP });
  byId("legend-max").textContent = t("legend.max", { t: TEMP_MAX });
}

// --- Advisor settings: sliders for the policy thresholds, and a test AQI that replaces the real one ---
export interface AdvisorSettings {
  thresholds: Thresholds;
  demoAqi: number | null;
}

export interface AdvisorPanel {
  show: (visible: boolean) => void;
  sync: (settings: AdvisorSettings) => void;
}

const THRESHOLD_KEYS = Object.keys(THRESHOLD_LIMITS) as Array<keyof Thresholds>;

export function createAdvisorPanel(onChange: (settings: AdvisorSettings) => void): AdvisorPanel {
  const panel = byId("advisor");
  const demo = byId<HTMLInputElement>("th-demo");
  const reset = byId<HTMLButtonElement>("th-reset");
  const modified = byId("advisor-modified");
  const sliders = new Map(
    THRESHOLD_KEYS.map((key) => {
      const input = byId<HTMLInputElement>(`th-${key}`);
      const { min, max, step } = THRESHOLD_LIMITS[key];
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      return [key, input] as const;
    }),
  );

  const read = (): AdvisorSettings => ({
    thresholds: sanitizeThresholds(Object.fromEntries(THRESHOLD_KEYS.map((key) => [key, Number(sliders.get(key)?.value)]))),
    demoAqi: sanitizeAqiOverride(demo.value),
  });

  for (const input of [...sliders.values(), demo]) input.addEventListener("input", () => onChange(read()));
  reset.addEventListener("click", () => onChange({ thresholds: { ...DEFAULT_THRESHOLDS }, demoAqi: null }));

  return {
    show(visible) {
      panel.hidden = !visible;
    },
    sync({ thresholds, demoAqi }) {
      // refresh() runs every second: leave a control alone while it already shows the value, so a drag or typing is not fought
      for (const key of THRESHOLD_KEYS) {
        const input = sliders.get(key);
        if (input && Number(input.value) !== thresholds[key]) input.value = String(thresholds[key]);
        byId(`out-${key}`).textContent = key === "aqiVentMax" ? String(thresholds[key]) : `${fmt(thresholds[key], 1)} °C`;
      }
      if (document.activeElement !== demo && sanitizeAqiOverride(demo.value) !== demoAqi) demo.value = demoAqi === null ? "" : String(demoAqi);
      const changed = !isDefaultThresholds(thresholds) || demoAqi !== null;
      modified.hidden = !changed;
      reset.disabled = !changed;
    },
  };
}

// --- Building table: sortable by column, filterable to the buildings with alerts ---
const headerCells = Array.from(document.querySelectorAll<HTMLTableCellElement>("#blist th[data-sort]"));
const alertsOnly = byId<HTMLInputElement>("blist-alerts");
const emptyNote = byId("blist-empty");
// The sort is kept from one township to the next; the filter starts off again
let sortState: SortState | null = null;

function showSortState(): void {
  for (const th of headerCells) {
    if (sortState !== null && th.dataset.sort === sortState.key) {
      th.setAttribute("aria-sort", sortState.dir === "asc" ? "ascending" : "descending");
    } else {
      th.removeAttribute("aria-sort");
    }
  }
}

// The table is built once and then updated in place: rebuilding it on every snapshot would swap
// the buttons out from under a click in progress and drop keyboard focus. Row states ("active",
// "hover") are toggled with classList so that updates never overwrite each other.
// The values change every second, so a sorted or filtered table would reshuffle under the pointer.
// While the pointer or focus is inside the rows only the numbers update; the order and the filter
// catch up as soon as it leaves, or at once when the user changes the sort or the filter.
export function createBuildingTable(
  buildings: Array<{ id: string; name: string; levels: number }>,
  onOpen: (id: string) => void,
  onHover: (id: string | null) => void,
): BuildingTable {
  tableBody.replaceChildren();
  const rows = buildings.map((b) => {
    const tr = document.createElement("tr");
    const nameCell = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rowbtn";
    button.textContent = b.name;
    nameCell.append(button);
    const levels = numberCell();
    levels.textContent = String(b.levels);
    const avg = numberCell();
    const alerts = numberCell();
    const kwh = numberCell();
    tr.append(nameCell, levels, avg, alerts, kwh);
    // The whole row opens the building; a click on the name button bubbles up to here
    tr.addEventListener("click", () => onOpen(b.id));
    // Pointer and keyboard focus both count as "hovering" the row
    tr.addEventListener("pointerenter", () => onHover(b.id));
    tr.addEventListener("pointerleave", () => onHover(null));
    tr.addEventListener("focusin", () => onHover(b.id));
    tr.addEventListener("focusout", () => onHover(null));
    tableBody.append(tr);
    return { id: b.id, name: b.name, levels: b.levels, tr, avg, alerts, kwh };
  });
  const rowById = new Map(rows.map((r) => [r.id, r]));

  let latest = new Map<string, BuildingStats>();
  let shownOrder: string[] = rows.map((r) => r.id);

  alertsOnly.checked = false;
  showSortState();

  const pointerOrFocusInside = (): boolean => tableBody.matches(":hover") || tableBody.contains(document.activeElement);

  function layout(): void {
    const arranged = arrange(
      rows.map((r) => {
        const s = latest.get(r.id);
        return { id: r.id, name: r.name, levels: r.levels, avgTemp: s?.avgTemp ?? null, alerts: s?.alerts ?? 0, kwh: s?.kwh ?? 0 };
      }),
      sortState,
      alertsOnly.checked,
    );
    let visible = 0;
    for (const a of arranged) {
      const row = rowById.get(a.id);
      if (!row) continue;
      row.tr.hidden = !a.visible;
      if (a.visible) visible += 1;
    }
    emptyNote.hidden = visible > 0 || rows.length === 0;
    const order = arranged.map((a) => a.id);
    if (order.some((id, i) => id !== shownOrder[i])) {
      // Moving rows drops keyboard focus, so it is only done when the order really changed
      tableBody.append(...order.map((id) => rowById.get(id)!.tr));
      shownOrder = order;
    }
  }

  // These elements are static markup shared by every township's table, so the handlers are
  // assigned (replacing the previous table's) rather than added
  for (const th of headerCells) {
    const button = th.querySelector("button");
    if (!button) continue;
    button.onclick = () => {
      sortState = nextSort(sortState, th.dataset.sort as SortKey);
      showSortState();
      layout();
    };
  }
  alertsOnly.onchange = layout;
  tableBody.onpointerleave = layout;

  return {
    update(stats, activeId) {
      latest = stats;
      for (const row of rows) {
        const s = stats.get(row.id);
        row.tr.classList.toggle("active", row.id === activeId);
        row.avg.textContent = s?.avgTemp == null ? "–" : fmt(s.avgTemp, 1);
        row.alerts.textContent = s ? String(s.alerts) : "–";
        row.alerts.className = s && s.alerts > 0 ? "num alert" : "num";
        row.kwh.textContent = s ? fmt(s.kwh, 1) : "–";
      }
      if (!pointerOrFocusInside()) layout();
    },
    setHover(id) {
      for (const row of rows) row.tr.classList.toggle("hover", row.id === id);
    },
  };
}

// One row per instrumented floor, top floor first; each room is a button that selects it
export function createFloorTable(
  rooms: RoomState[],
  onSelect: (roomId: string) => void,
  onHover: (roomId: string | null) => void,
): FloorTable {
  floorBody.replaceChildren();
  const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => b - a);
  const buttons = new Map<string, HTMLButtonElement>();

  for (const floor of floors) {
    const tr = document.createElement("tr");
    const label = document.createElement("td");
    label.textContent = String(floor);
    tr.append(label);
    for (const side of ["A", "B"]) {
      const room = rooms.find((r) => r.floor === floor && r.id.endsWith(`-${side}`));
      const td = numberCell();
      if (room) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell";
        button.addEventListener("click", () => onSelect(room.id));
        button.addEventListener("pointerenter", () => onHover(room.id));
        button.addEventListener("pointerleave", () => onHover(null));
        button.addEventListener("focus", () => onHover(room.id));
        button.addEventListener("blur", () => onHover(null));
        td.append(button);
        buttons.set(room.id, button);
      }
      tr.append(td);
    }
    floorBody.append(tr);
  }

  return {
    update(latest, selectedId, alertTemp) {
      for (const [id, button] of buttons) {
        const room = latest.get(id);
        if (!room) continue;
        button.textContent = fmt(room.temp, 1);
        button.classList.toggle("alert", room.temp > alertTemp);
        button.classList.toggle("ac-on", room.ac);
        button.classList.toggle("selected", id === selectedId);
        button.setAttribute("aria-pressed", String(id === selectedId));
      }
    },
    setHover(roomId) {
      for (const [id, button] of buttons) button.classList.toggle("hover", id === roomId);
    },
  };
}

import type { BuildingMode } from "./building-view";
import { fmt } from "./i18n";
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

// The tables are built once and then updated in place: rebuilding them on every snapshot would swap
// the buttons out from under a click in progress and drop keyboard focus. Row states ("active",
// "hover") are toggled with classList so that updates never overwrite each other.
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
    return { id: b.id, tr, avg, alerts, kwh };
  });

  return {
    update(stats, activeId) {
      for (const row of rows) {
        const s = stats.get(row.id);
        row.tr.classList.toggle("active", row.id === activeId);
        row.avg.textContent = s?.avgTemp == null ? "–" : fmt(s.avgTemp, 1);
        row.alerts.textContent = s ? String(s.alerts) : "–";
        row.alerts.className = s && s.alerts > 0 ? "num alert" : "num";
        row.kwh.textContent = s ? fmt(s.kwh, 1) : "–";
      }
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

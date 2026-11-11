import { fmt } from "./i18n";

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

const info = document.getElementById("info") as HTMLElement;
const hint = document.getElementById("hint") as HTMLElement;
const backButton = document.getElementById("back") as HTMLButtonElement;
const tableBody = document.getElementById("blist-body") as HTMLElement;

export function setRows(rows: Row[]): void {
  info.replaceChildren();
  for (const row of rows) {
    const dt = document.createElement("dt");
    dt.textContent = row.label;
    const dd = document.createElement("dd");
    dd.textContent = row.value;
    if (row.alert) dd.className = "alert";
    info.append(dt, dd);
  }
}

export function setHint(text: string): void {
  hint.textContent = text;
}

export function setBackVisible(visible: boolean): void {
  backButton.hidden = !visible;
}

export function onBack(handler: () => void): void {
  backButton.addEventListener("click", handler);
}

function numberCell(): HTMLTableCellElement {
  const td = document.createElement("td");
  td.className = "num";
  return td;
}

// The table is built once and then updated in place: rebuilding it on every snapshot would swap
// the buttons out from under a click in progress and drop keyboard focus. Row states ("active",
// "hover") are toggled with classList so that updates never overwrite each other.
export function createBuildingTable(
  buildings: Array<{ id: string; name: string; levels: number }>,
  onOpen: (id: string) => void,
  onHover: (id: string | null) => void,
): BuildingTable {
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

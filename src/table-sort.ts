// Sorting and filtering of the township's building table. Pure, so it can be tested without a DOM.
export type SortKey = "name" | "levels" | "avgTemp" | "alerts" | "kwh";
export type SortDir = "asc" | "desc";
export interface SortState {
  key: SortKey;
  dir: SortDir;
}

export interface SortRow {
  id: string;
  name: string;
  levels: number;
  avgTemp: number | null; // null until the first snapshot
  alerts: number;
  kwh: number;
}

// Numbers are most useful biggest first, names A to Z
const defaultDir = (key: SortKey): SortDir => (key === "name" ? "asc" : "desc");

// Click on a header: first its default direction, then the opposite, then back to the original order
export function nextSort(current: SortState | null, key: SortKey): SortState | null {
  if (current?.key !== key) return { key, dir: defaultDir(key) };
  return current.dir === defaultDir(key) ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : null;
}

function compare(a: SortRow, b: SortRow, key: SortKey): number {
  if (key === "name") return a.name.localeCompare(b.name);
  if (key === "avgTemp") return (a.avgTemp ?? 0) - (b.avgTemp ?? 0); // missing values are handled by the caller
  return a[key] - b[key];
}

export interface Arranged {
  id: string;
  visible: boolean;
}

// The display order. Rows that pass the filter come first, sorted; the rest follow in their original
// order (the table hides them, but keeps them in the DOM). A row without a temperature is always
// last among the visible ones, whichever direction is chosen. The sort is stable.
export function arrange(rows: readonly SortRow[], sort: SortState | null, onlyAlerts: boolean): Arranged[] {
  const visible = rows.filter((r) => !onlyAlerts || r.alerts > 0);
  const hidden = rows.filter((r) => onlyAlerts && r.alerts <= 0);
  if (sort) {
    const sign = sort.dir === "asc" ? 1 : -1;
    visible.sort((a, b) => {
      if (sort.key === "avgTemp" && (a.avgTemp === null || b.avgTemp === null)) {
        return a.avgTemp === b.avgTemp ? 0 : a.avgTemp === null ? 1 : -1;
      }
      return sign * compare(a, b, sort.key);
    });
  }
  return [...visible.map((r) => ({ id: r.id, visible: true })), ...hidden.map((r) => ({ id: r.id, visible: false }))];
}

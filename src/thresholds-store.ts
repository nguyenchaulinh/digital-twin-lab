import { DEFAULT_THRESHOLDS, sanitizeThresholds, type Thresholds } from "./advisor";

// The advisor thresholds the user chose are kept in this browser only (nothing is sent anywhere).
// What is read back is sanitised like any other outside input: a hand-edited or stale entry cannot
// put a value outside the slider limits.
const STORAGE_KEY = "dt-lab-thresholds";

export function loadThresholds(): Thresholds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) return sanitizeThresholds(JSON.parse(raw));
  } catch {
    // storage blocked or not JSON: use the defaults
  }
  return { ...DEFAULT_THRESHOLDS };
}

export function saveThresholds(thresholds: Thresholds): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(thresholds));
  } catch {
    // ignore: the choice just won't persist
  }
}

// Minimal English / Vietnamese dictionary. The Vietnamese table is typed against the English
// keys, so a missing translation fails the typecheck.
export type Lang = "en" | "vi";

const en = {
  "lang.label": "Language",
  "hud.back": "← Township",
  "hud.connection": "Connection",
  "hud.live": "live",
  "hud.synthetic": "synthetic",
  "hud.disconnected": "disconnected",
  "hud.simTime": "Sim time",
  "hud.day": "day {n} {time}",
  "hud.outside": "Outside (Hanoi)",
  "hud.aqi": "AQI",
  "hud.aqiDemo": "AQI (demo override)",
  "hud.pm25": "PM2.5",
  "hud.station": "Station",
  "hud.na": "n/a",
  "hud.roomsOver": "Rooms over limit",
  "hud.acEnergy": "AC energy (sim)",
  "hud.ventInstead": "Ventilate instead of AC",
  "hud.roomsCount": "{n} rooms",
  "hud.saveUpTo": " · save up to {kw} kW",
  "hud.building": "Building",
  "hud.floors": "Floors (OSM)",
  "hud.instrumented": "Instrumented floors",
  "hud.instrumentedValue": "{n} of {total}",
  "hud.selected": "Selected",
  "hud.floor": "Floor",
  "hud.actualTemp": "Actual temp",
  "hud.ac": "AC",
  "hud.on": "on",
  "hud.off": "off",
  "hud.twinOn": "Twin +30min (AC on)",
  "hud.twinOff": "Twin +30min (AC off)",
  "hud.advice": "Advice",
  "hud.why": "Why",
  "hint.township": "Click a building, or pick one in the list, to open it. Drag to rotate, scroll to zoom.",
  "hint.building": "Click a room to select it. Press A to toggle its AC. Esc goes back.",
  "credits.weather": "Weather:",
  "credits.air": "Air quality:",
  "credits.buildings": "Buildings:",
  "towns.title": "Vinhomes Smart City · buildings (OSM)",
  "towns.name": "Name",
  "towns.floors": "Floors",
  "towns.avg": "Avg °C",
  "towns.alerts": "Alerts",
  "towns.kwh": "AC kWh",
  "aqi.good": "Good",
  "aqi.moderate": "Moderate",
  "aqi.sensitive": "Unhealthy for sensitive groups",
  "aqi.unhealthy": "Unhealthy",
  "aqi.veryUnhealthy": "Very unhealthy",
  "aqi.hazardous": "Hazardous",
  "advice.open-windows": "Open windows",
  "advice.run-ac": "Run AC",
  "advice.keep-closed": "Keep windows closed",
  "advice.no-action": "No action",
  "reason.noAqi": "No air quality data, so opening windows is not advised",
  "reason.unhealthy": "AQI {aqi} is unhealthy: keep windows closed",
  "reason.ventilate": "Outside is cooler and AQI {aqi} is acceptable: ventilate instead of AC",
  "reason.needsCooling": "Room is above the comfort limit and outside air does not help",
  "reason.comfort": "Within the comfort range",
} as const;

export type Key = keyof typeof en;

const vi: Record<Key, string> = {
  "lang.label": "Ngôn ngữ",
  "hud.back": "← Khu đô thị",
  "hud.connection": "Kết nối",
  "hud.live": "trực tiếp",
  "hud.synthetic": "giả lập",
  "hud.disconnected": "mất kết nối",
  "hud.simTime": "Giờ mô phỏng",
  "hud.day": "ngày {n} {time}",
  "hud.outside": "Ngoài trời (Hà Nội)",
  "hud.aqi": "AQI",
  "hud.aqiDemo": "AQI (ghi đè demo)",
  "hud.pm25": "PM2.5",
  "hud.station": "Trạm",
  "hud.na": "không có",
  "hud.roomsOver": "Phòng vượt ngưỡng",
  "hud.acEnergy": "Điện điều hòa (mô phỏng)",
  "hud.ventInstead": "Thông gió thay điều hòa",
  "hud.roomsCount": "{n} phòng",
  "hud.saveUpTo": " · tiết kiệm tối đa {kw} kW",
  "hud.building": "Tòa nhà",
  "hud.floors": "Số tầng (OSM)",
  "hud.instrumented": "Tầng có cảm biến",
  "hud.instrumentedValue": "{n} / {total}",
  "hud.selected": "Đang chọn",
  "hud.floor": "Tầng",
  "hud.actualTemp": "Nhiệt độ thực",
  "hud.ac": "Điều hòa",
  "hud.on": "bật",
  "hud.off": "tắt",
  "hud.twinOn": "Twin +30 phút (bật điều hòa)",
  "hud.twinOff": "Twin +30 phút (tắt điều hòa)",
  "hud.advice": "Khuyến nghị",
  "hud.why": "Lý do",
  "hint.township": "Bấm vào một tòa nhà, hoặc chọn trong danh sách, để mở. Kéo để xoay, cuộn để phóng to.",
  "hint.building": "Bấm vào phòng để chọn. Nhấn A để bật/tắt điều hòa. Nhấn Esc để quay lại.",
  "credits.weather": "Thời tiết:",
  "credits.air": "Chất lượng không khí:",
  "credits.buildings": "Tòa nhà:",
  "towns.title": "Vinhomes Smart City · các tòa nhà (OSM)",
  "towns.name": "Tên",
  "towns.floors": "Tầng",
  "towns.avg": "TB °C",
  "towns.alerts": "Cảnh báo",
  "towns.kwh": "kWh điều hòa",
  "aqi.good": "Tốt",
  "aqi.moderate": "Trung bình",
  "aqi.sensitive": "Không tốt cho nhóm nhạy cảm",
  "aqi.unhealthy": "Không tốt",
  "aqi.veryUnhealthy": "Rất không tốt",
  "aqi.hazardous": "Nguy hại",
  "advice.open-windows": "Mở cửa sổ",
  "advice.run-ac": "Bật điều hòa",
  "advice.keep-closed": "Giữ cửa sổ đóng",
  "advice.no-action": "Không cần làm gì",
  "reason.noAqi": "Không có dữ liệu chất lượng không khí nên không khuyến nghị mở cửa sổ",
  "reason.unhealthy": "AQI {aqi} không tốt cho sức khỏe: giữ cửa sổ đóng",
  "reason.ventilate": "Ngoài trời mát hơn và AQI {aqi} chấp nhận được: thông gió thay vì bật điều hòa",
  "reason.needsCooling": "Phòng vượt ngưỡng thoải mái và không khí ngoài trời không giúp được",
  "reason.comfort": "Trong ngưỡng thoải mái",
};

const dictionaries: Record<Lang, Record<Key, string>> = { en, vi };
const STORAGE_KEY = "dt-lab-lang";

const isLang = (value: unknown): value is Lang => value === "en" || value === "vi";

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // storage can be blocked; fall through to the browser language
  }
  return navigator.language.toLowerCase().startsWith("vi") ? "vi" : "en";
}

let lang: Lang = initialLang();
const listeners: Array<() => void> = [];

export const getLang = (): Lang => lang;

export function t(key: Key, params: Record<string, string | number> = {}): string {
  return dictionaries[lang][key].replaceAll(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ""));
}

// Locale-aware number formatting (Vietnamese uses a decimal comma)
export function fmt(value: number, digits: number): string {
  return new Intl.NumberFormat(lang === "vi" ? "vi-VN" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

// Fill static markup: [data-i18n] text, [data-i18n-label] aria-labels and the language buttons
export function applyStatic(): void {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n as Key);
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n-label]")) {
    el.setAttribute("aria-label", t(el.dataset.i18nLabel as Key));
  }
  for (const btn of document.querySelectorAll<HTMLButtonElement>("button[data-lang]")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
  }
}

export function setLang(next: string): void {
  if (!isLang(next) || next === lang) return;
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore: the choice just won't persist
  }
  applyStatic();
  for (const listener of listeners) listener();
}

export function onLangChange(listener: () => void): void {
  listeners.push(listener);
}

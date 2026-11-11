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
  "hud.outside": "Outside ({city})",
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
  "hint.township": "Click a building, or pick one in the list, to open it. Drag to rotate, scroll to zoom. Esc goes back to the map.",
  "hint.building": "Click the building at a floor, or a value in the table, to select a room. Press A to toggle its AC. Esc goes back.",
  "hud.townships": "Townships",
  "hint.map": "Click a township on the map, or pick one in the list, to open it in 3D. Drag to pan, scroll to zoom.",
  "credits.basemap": "Basemap:",
  "credits.imagery": "Satellite:",
  "credits.street": "Street photos:",
  "map.layerMap": "Map",
  "map.layerSatellite": "Satellite",
  "detail.mode": "View",
  "detail.modeFacade": "Facade",
  "detail.modeSensors": "Sensors",
  "street.open": "Street view",
  "street.title": "Street view (Mapillary)",
  "street.close": "Close",
  "street.loading": "Looking for street photos nearby…",
  "street.none": "No Mapillary photos within {m} m of this point.",
  "street.failed": "Could not load the street view.",
  "camera.toggle": "Cameras",
  "camera.kind.speed": "Speed camera",
  "camera.kind.redLight": "Red-light camera",
  "camera.kind.traffic": "Traffic camera",
  "camera.kind.public": "Street surveillance camera",
  "camera.ref": "Ref {r}",
  "camera.maxspeed": "Speed limit {v} km/h",
  "camera.direction": "Facing {d}",
  "camera.positionOnly": "Position from OpenStreetMap; no live image.",
  "camera.official.hcmc": "Open the HCMC traffic camera portal",
  "camera.official.hanoi": "Live images: in the iHanoi mobile app",
  "camera.official.none": "No official camera service is linked for this area.",
  "camera.osm": "OSM {type} {id}",
  "street.timeout": "Mapillary did not answer within {s} s. The network may block graph.mapillary.com, or the service is slow; try again.",
  "street.denied": "Mapillary refused the token. Check VITE_MAPILLARY_TOKEN (a client token, MLY|…) and restart npm run dev.",
  "map.title": "Townships in Vietnam (OSM)",
  "map.search": "Search by name, city or ward",
  "map.back": "← Map",
  "map.open": "Open in 3D",
  "map.detail": "{towers} towers · up to {levels} floors",
  "map.loading": "Loading {name}…",
  "map.loadFailed": "Could not load this township.",
  "credits.weather": "Weather:",
  "credits.air": "Air quality:",
  "credits.buildings": "Map data:",
  "towns.title": "Buildings (OSM)",
  "detail.osm": "OSM way {id}",
  "detail.height": "Height (est.)",
  "detail.area": "Footprint area",
  "detail.avg": "Average temp",
  "detail.colFloor": "Floor",
  "detail.colA": "Room A °C",
  "detail.colB": "Room B °C",
  "detail.legend": "Click a value to select the room. Underlined: AC on.",
  "tip.room": "Floor {floor} · Room {side} · {temp} °C",
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
  "hud.outside": "Ngoài trời ({city})",
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
  "hint.township": "Bấm vào một tòa nhà, hoặc chọn trong danh sách, để mở. Kéo để xoay, cuộn để phóng to. Nhấn Esc để về bản đồ.",
  "hint.building": "Bấm vào tòa nhà ở một tầng, hoặc một giá trị trong bảng, để chọn phòng. Nhấn A để bật/tắt điều hòa. Nhấn Esc để quay lại.",
  "hud.townships": "Khu đô thị",
  "hint.map": "Bấm vào một khu trên bản đồ, hoặc chọn trong danh sách, để mở 3D. Kéo để di chuyển, cuộn để phóng to.",
  "credits.basemap": "Bản đồ nền:",
  "credits.imagery": "Ảnh vệ tinh:",
  "credits.street": "Ảnh đường phố:",
  "map.layerMap": "Bản đồ",
  "map.layerSatellite": "Vệ tinh",
  "detail.mode": "Hiển thị",
  "detail.modeFacade": "Mặt tiền",
  "detail.modeSensors": "Cảm biến",
  "street.open": "Xem phố",
  "street.title": "Xem phố (Mapillary)",
  "street.close": "Đóng",
  "street.loading": "Đang tìm ảnh đường phố gần đó…",
  "street.none": "Không có ảnh Mapillary trong bán kính {m} m quanh điểm này.",
  "street.failed": "Không tải được ảnh đường phố.",
  "camera.toggle": "Camera",
  "camera.kind.speed": "Camera tốc độ",
  "camera.kind.redLight": "Camera đèn đỏ",
  "camera.kind.traffic": "Camera giao thông",
  "camera.kind.public": "Camera giám sát đường phố",
  "camera.ref": "Mã {r}",
  "camera.maxspeed": "Giới hạn {v} km/h",
  "camera.direction": "Hướng {d}",
  "camera.positionOnly": "Vị trí từ OpenStreetMap; không có hình ảnh trực tiếp.",
  "camera.official.hcmc": "Mở cổng camera giao thông TP.HCM",
  "camera.official.hanoi": "Hình ảnh trực tiếp: trên ứng dụng iHanoi (di động)",
  "camera.official.none": "Chưa liên kết dịch vụ camera chính thức nào cho khu vực này.",
  "camera.osm": "OSM {type} {id}",
  "street.timeout": "Mapillary không phản hồi trong {s} giây. Có thể mạng đang chặn graph.mapillary.com, hoặc dịch vụ chậm; thử lại.",
  "street.denied": "Mapillary từ chối token. Kiểm tra VITE_MAPILLARY_TOKEN (token client, MLY|…) rồi restart npm run dev.",
  "map.title": "Các khu đô thị ở Việt Nam (OSM)",
  "map.search": "Tìm theo tên, thành phố hoặc phường",
  "map.back": "← Bản đồ",
  "map.open": "Mở 3D",
  "map.detail": "{towers} tòa · cao đến {levels} tầng",
  "map.loading": "Đang tải {name}…",
  "map.loadFailed": "Không tải được khu này.",
  "credits.weather": "Thời tiết:",
  "credits.air": "Chất lượng không khí:",
  "credits.buildings": "Dữ liệu bản đồ:",
  "towns.title": "Các tòa nhà (OSM)",
  "detail.osm": "OSM way {id}",
  "detail.height": "Chiều cao (ước tính)",
  "detail.area": "Diện tích nền",
  "detail.avg": "Nhiệt độ trung bình",
  "detail.colFloor": "Tầng",
  "detail.colA": "Phòng A °C",
  "detail.colB": "Phòng B °C",
  "detail.legend": "Bấm một giá trị để chọn phòng. Gạch chân: điều hòa đang bật.",
  "tip.room": "Tầng {floor} · Phòng {side} · {temp} °C",
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
  for (const el of document.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]")) {
    el.placeholder = t(el.dataset.i18nPlaceholder as Key);
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

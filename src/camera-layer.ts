import maplibregl from "maplibre-gl";
import camerasJson from "../data/cameras.json";

// Traffic and street cameras from OpenStreetMap (scripts/fetch-cameras.mjs), as dots on the map. Positions only:
// a popup tells what the camera is and links to the official service of its area, if there is one.

export type CameraKind = "speed" | "red_light" | "traffic" | "public";

export interface Camera {
  id: string;
  osmType: "node" | "way" | "relation";
  osmId: number;
  lat: number;
  lon: number;
  kind: CameraKind;
  name?: string;
  ref?: string;
  maxspeed?: number;
  direction?: string;
}

export const cameras = camerasJson.cameras as Camera[];

export interface CameraText {
  title: string;
  lines: string[];
  official: { label: string; url: string | null };
  osm: string;
  street?: string; // the street view button, when it is available
}

export interface CameraLayer {
  setVisible: (on: boolean) => void;
  isAt: (point: maplibregl.PointLike) => boolean; // a camera dot is under this point
}

const SOURCE = "cameras";
const LAYER = "cameras";
const MIN_ZOOM = 10;
const KIND_COLORS: Record<CameraKind, string> = { speed: "#dc2626", red_light: "#c026d3", traffic: "#2563eb", public: "#475569" };
const OSM_TYPES = new Set(["node", "way", "relation"]);

// All popup text goes in through textContent; the only URLs are the fixed official ones and an OSM link built
// from a checked type and a number.
function popupBody(camera: Camera, text: CameraText, onStreetView?: (lon: number, lat: number) => void): HTMLElement {
  const body = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = text.title;
  body.append(title);
  for (const line of text.lines) {
    const div = document.createElement("div");
    div.textContent = line;
    body.append(div);
  }
  if (text.official.url) {
    const link = document.createElement("a");
    link.className = "popup-link";
    link.href = text.official.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = text.official.label;
    body.append(link);
  } else {
    const note = document.createElement("div");
    note.className = "popup-muted";
    note.textContent = text.official.label;
    body.append(note);
  }
  if (onStreetView && text.street) {
    const street = document.createElement("button");
    street.type = "button";
    street.className = "secondary";
    street.textContent = text.street;
    street.addEventListener("click", () => onStreetView(camera.lon, camera.lat));
    body.append(street);
  }
  if (OSM_TYPES.has(camera.osmType) && Number.isInteger(camera.osmId)) {
    const osm = document.createElement("a");
    osm.className = "popup-osm";
    osm.href = `https://www.openstreetmap.org/${camera.osmType}/${camera.osmId}`;
    osm.target = "_blank";
    osm.rel = "noopener noreferrer";
    osm.textContent = text.osm;
    body.append(osm);
  }
  return body;
}

export function installCameraLayer(
  map: maplibregl.Map,
  options: {
    visible: boolean;
    describe: (camera: Camera) => CameraText;
    onStreetView?: (lon: number, lat: number) => void;
    skip: (ev: maplibregl.MapMouseEvent) => boolean; // the street view picker is using this click
  },
): CameraLayer {
  const byId = new Map(cameras.map((c) => [c.id, c]));
  map.addSource(SOURCE, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: cameras.map((c) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [c.lon, c.lat] },
        properties: { id: c.id, kind: c.kind },
      })),
    },
  });
  map.addLayer({
    id: LAYER,
    type: "circle",
    source: SOURCE,
    minzoom: MIN_ZOOM,
    layout: { visibility: options.visible ? "visible" : "none" },
    paint: {
      "circle-color": [
        "match",
        ["get", "kind"],
        "speed",
        KIND_COLORS.speed,
        "red_light",
        KIND_COLORS.red_light,
        "traffic",
        KIND_COLORS.traffic,
        KIND_COLORS.public,
      ],
      "circle-radius": ["interpolate", ["linear"], ["zoom"], MIN_ZOOM, 3.5, 16, 7],
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#ffffff",
    },
  });

  let popup: maplibregl.Popup | null = null;
  map.on("click", LAYER, (ev) => {
    if (options.skip(ev)) return;
    const camera = byId.get(String(ev.features?.[0]?.properties.id));
    if (!camera) return;
    popup?.remove();
    popup = new maplibregl.Popup({ closeButton: true, offset: 8, maxWidth: "280px" })
      .setLngLat([camera.lon, camera.lat])
      .setDOMContent(popupBody(camera, options.describe(camera), options.onStreetView))
      .addTo(map);
  });
  map.on("mouseenter", LAYER, (ev) => {
    if (!options.skip(ev)) map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", LAYER, (ev) => {
    if (!options.skip(ev)) map.getCanvas().style.cursor = "";
  });

  return {
    setVisible(on) {
      map.setLayoutProperty(LAYER, "visibility", on ? "visible" : "none");
      if (!on) popup?.remove();
    },
    isAt(point) {
      return map.getLayoutProperty(LAYER, "visibility") !== "none" && map.queryRenderedFeatures(point, { layers: [LAYER] }).length > 0;
    },
  };
}

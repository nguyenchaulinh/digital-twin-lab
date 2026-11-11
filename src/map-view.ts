import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { installCameraLayer, type Camera, type CameraLayer, type CameraText } from "./camera-layer";
import { mergeFeatures, townshipFeatures, type BuildingFeature } from "./map-buildings";
import { ESRI } from "./tiles";
import { METRES_PER_LEVEL, type CatalogEntry, type TownshipData } from "./township-data";

// Vector tiles by OpenFreeMap (no key). Basemap © OpenMapTiles, data © OpenStreetMap contributors.
// Any other MapLibre style URL works here; "liberty" and "bright" are the other OpenFreeMap styles.
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const VIETNAM_BOUNDS: [[number, number], [number, number]] = [
  [102.1, 8.4],
  [109.6, 23.4],
];
const SOURCE = "townships";
const CLUSTERS = "township-clusters";
const POINTS = "township-points";
const FOCUS_ZOOM = 16; // close enough to tell the towers, roads and rivers apart
const FOCUS_PITCH = 55; // tilted, so the extruded buildings read as 3D
const CLUSTER_MAX_ZOOM = 12;
const POINTS_MAX_ZOOM = 17; // past this the buildings themselves are the thing to click

// From this zoom on, the buildings of the townships in view are loaded and extruded on the map
const BUILDINGS_MIN_ZOOM = 15;
const MAX_TOWNSHIPS_PER_VIEW = 16;
const VIEW_PAD_DEG = 0.01; // a township reaches about 500 m (0.005 deg) past its centre
const BUILDINGS_SOURCE = "township-buildings";
const TOWERS = "township-towers";
const CONTEXT = "township-context";
const TOWER_COLOR = "#f59e0b";
const CONTEXT_COLOR = "#94a3b8";

// Satellite basemap: Esri World Imagery, with Esri's place-name overlay on top. No key is needed, but
// Esri's terms apply (see the README); swap the tile URLs for another provider's if needed.
const IMAGERY_SOURCE = "imagery";
const LABELS_SOURCE = "imagery-labels";
const IMAGERY_MAX_ZOOM = 19;
const IMAGERY_ATTRIBUTION = "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community";

export type Basemap = "map" | "satellite";
type ToolButton = Basemap | "street" | "cameras";
export type MapLabels = Record<ToolButton, string>;

export interface PopupText {
  title: string;
  detail: string;
  action: string;
  street: string;
}

export interface MapHandlers {
  onOpen: (townshipId: string) => void; // the whole township in 3D
  onOpenBuilding: (townshipId: string, buildingId: string) => void; // one tower, straight to its detail
  // Street view at a point; when absent (no Mapillary token) the street view buttons are not shown
  onStreetView?: (lon: number, lat: number) => void;
  load: (townshipId: string) => Promise<TownshipData>;
  describe: (entry: CatalogEntry) => PopupText;
  describeCamera: (camera: Camera) => CameraText;
  labels: () => MapLabels;
}

export interface MapView {
  show: () => void;
  hide: () => void;
  // Fly to a township and open its popup
  focus: (id: string) => void;
  // Re-reads the labels of the map's buttons (the language changed)
  relabel: () => void;
}

type Coordinates = [number, number];

// A group of text buttons in the map's own control stack
function createButtonGroup(names: readonly ToolButton[], onPress: (name: ToolButton) => void) {
  const box = document.createElement("div");
  box.className = "maplibregl-ctrl maplibregl-ctrl-group text-buttons";
  const buttons = new Map<ToolButton, HTMLButtonElement>();
  for (const name of names) {
    const button = document.createElement("button");
    button.type = "button";
    button.addEventListener("click", () => onPress(name));
    buttons.set(name, button);
    box.append(button);
  }
  const control: maplibregl.IControl = {
    onAdd: () => box,
    onRemove: () => box.remove(),
  };
  return {
    control,
    relabel(labels: MapLabels): void {
      for (const [name, button] of buttons) button.textContent = labels[name];
    },
    setPressed(pressed: (name: ToolButton) => boolean): void {
      for (const [name, button] of buttons) button.setAttribute("aria-pressed", String(pressed(name)));
    },
  };
}

// All popup text goes in through textContent; nothing here builds HTML from data.
export function createMapView(container: HTMLElement, entries: CatalogEntry[], handlers: MapHandlers): MapView {
  const { onOpen, onOpenBuilding, onStreetView, load, describe, describeCamera, labels } = handlers;
  const map = new maplibregl.Map({
    container,
    style: STYLE_URL,
    bounds: VIETNAM_BOUNDS,
    fitBoundsOptions: { padding: 20 },
    attributionControl: { compact: true },
    maxBounds: [
      [95, 3],
      [117, 28],
    ],
  });
  // Bottom left: the HUD panel covers the top left corner
  // The compass also resets the tilt; right-drag (or Ctrl-drag) rotates and tilts the map
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");

  let basemap: Basemap = "map";
  const switcher = createButtonGroup(["map", "satellite"], (name) => setBasemap(name as Basemap));
  map.addControl(switcher.control, "bottom-left");
  switcher.relabel(labels());
  switcher.setPressed((name) => name === basemap);

  // Before the style has loaded there are no layers yet; the choice is applied when they are added
  function setBasemap(next: Basemap): void {
    basemap = next;
    switcher.setPressed((name) => name === next);
    for (const layer of [IMAGERY_SOURCE, LABELS_SOURCE]) {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", next === "satellite" ? "visible" : "none");
    }
  }

  // Street view: press the button, then click a street. While picking, the click is not a township or a building.
  let picking = false;
  let consumed: Event | null = null; // the click that picked: the layer handlers see the same event and skip it
  const streetButton = onStreetView ? createButtonGroup(["street"], () => setPicking(!picking)) : null;
  if (streetButton) {
    map.addControl(streetButton.control, "bottom-left");
    streetButton.relabel(labels());
    streetButton.setPressed(() => false);
  }
  function setPicking(on: boolean): void {
    picking = on;
    streetButton?.setPressed(() => on);
    map.getCanvas().style.cursor = on ? "crosshair" : "";
  }
  if (onStreetView) {
    map.on("click", (ev) => {
      if (!picking) return;
      consumed = ev.originalEvent;
      setPicking(false);
      onStreetView(ev.lngLat.lng, ev.lngLat.lat);
    });
  }
  const skip = (ev: maplibregl.MapMouseEvent): boolean => picking || ev.originalEvent === consumed;

  // Cameras (OpenStreetMap positions): on by default, from zoom 10
  let camerasOn = true;
  let cameraLayer: CameraLayer | null = null; // added with the other layers once the style has loaded
  const cameraButton = createButtonGroup(["cameras"], () => {
    camerasOn = !camerasOn;
    cameraButton.setPressed(() => camerasOn);
    cameraLayer?.setVisible(camerasOn);
  });
  map.addControl(cameraButton.control, "bottom-left");
  cameraButton.relabel(labels());
  cameraButton.setPressed(() => camerasOn);
  const cameraAt = (ev: maplibregl.MapMouseEvent): boolean => cameraLayer?.isAt(ev.point) ?? false;

  const byId = new Map(entries.map((e) => [e.id, e]));
  let popup: maplibregl.Popup | null = null;

  function openPopup(entry: CatalogEntry): void {
    popup?.remove();
    const text = describe(entry);
    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = text.title;
    const detail = document.createElement("div");
    detail.textContent = text.detail;
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = text.action;
    open.addEventListener("click", () => onOpen(entry.id));
    body.append(title, detail, open);
    if (onStreetView) {
      const street = document.createElement("button");
      street.type = "button";
      street.className = "secondary";
      street.textContent = text.street;
      street.addEventListener("click", () => onStreetView(entry.lon, entry.lat));
      body.append(street);
    }
    popup = new maplibregl.Popup({ closeButton: true, offset: 10, maxWidth: "260px" })
      .setLngLat([entry.lon, entry.lat])
      .setDOMContent(body)
      .addTo(map);
  }

  // Township files are loaded lazily and only for the townships near the view; each is requested at most once
  // (a failed one is not retried on every move, a reload tries again)
  const featuresByTownship = new Map<string, BuildingFeature[]>();
  const requested = new Set<string>();

  async function loadVisibleBuildings(): Promise<void> {
    const source = map.getSource(BUILDINGS_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!source || map.getZoom() < BUILDINGS_MIN_ZOOM) return;
    const view = map.getBounds();
    const centre = map.getCenter();
    const distance = (e: CatalogEntry): number => Math.hypot(e.lon - centre.lng, e.lat - centre.lat);
    const wanted = entries
      .filter(
        (e) =>
          !requested.has(e.id) &&
          e.lon > view.getWest() - VIEW_PAD_DEG &&
          e.lon < view.getEast() + VIEW_PAD_DEG &&
          e.lat > view.getSouth() - VIEW_PAD_DEG &&
          e.lat < view.getNorth() + VIEW_PAD_DEG,
      )
      .sort((a, b) => distance(a) - distance(b))
      .slice(0, MAX_TOWNSHIPS_PER_VIEW);
    if (wanted.length === 0) return;
    for (const e of wanted) requested.add(e.id);
    await Promise.all(
      wanted.map(async (e) => {
        try {
          featuresByTownship.set(e.id, townshipFeatures(await load(e.id), METRES_PER_LEVEL));
        } catch {
          // left out of the map; the township can still be opened from its marker
        }
      }),
    );
    source.setData({ type: "FeatureCollection", features: mergeFeatures([...featuresByTownship.values()]) });
    if (wanted.length === MAX_TOWNSHIPS_PER_VIEW) void loadVisibleBuildings(); // more in view than one batch
  }

  const onReady = (action: () => void): void => {
    if (map.isStyleLoaded()) action();
    else void map.once("load", action); // with a listener this returns the map, not a promise
  };

  onReady(() => {
    map.addSource(SOURCE, {
      type: "geojson",
      cluster: true,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
      clusterRadius: 45,
      data: {
        type: "FeatureCollection",
        features: entries.map((e) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [e.lon, e.lat] },
          properties: { id: e.id },
        })),
      },
    });
    // The cluster size is the number of townships in it; no text layer, so no dependency on the style's fonts
    map.addLayer({
      id: CLUSTERS,
      type: "circle",
      source: SOURCE,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#0284c7",
        "circle-opacity": 0.75,
        "circle-radius": ["step", ["get", "point_count"], 12, 5, 16, 20, 22, 50, 28],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });
    map.addLayer({
      id: POINTS,
      type: "circle",
      source: SOURCE,
      maxzoom: POINTS_MAX_ZOOM,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "#f97316",
        "circle-radius": 7,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });

    // Satellite imagery and its place names go above every layer of the style and below the township markers
    map.addSource(IMAGERY_SOURCE, {
      type: "raster",
      tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      maxzoom: IMAGERY_MAX_ZOOM,
      attribution: IMAGERY_ATTRIBUTION,
    });
    map.addSource(LABELS_SOURCE, {
      type: "raster",
      tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      maxzoom: IMAGERY_MAX_ZOOM,
    });
    map.addLayer({ id: IMAGERY_SOURCE, type: "raster", source: IMAGERY_SOURCE, layout: { visibility: "none" } }, CLUSTERS);
    map.addLayer({ id: LABELS_SOURCE, type: "raster", source: LABELS_SOURCE, layout: { visibility: "none" } }, CLUSTERS);
    setBasemap(basemap);

    // The buildings of the townships in view, extruded by floor count. Towers (the ones with simulated rooms)
    // are amber and open in 3D when clicked; the other buildings are grey context.
    map.addSource(BUILDINGS_SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    const extrusion = (id: string, kind: BuildingFeature["properties"]["kind"], color: string): void => {
      map.addLayer(
        {
          id,
          type: "fill-extrusion",
          source: BUILDINGS_SOURCE,
          minzoom: BUILDINGS_MIN_ZOOM,
          filter: ["==", ["get", "kind"], kind],
          paint: { "fill-extrusion-color": color, "fill-extrusion-height": ["coalesce", ["get", "height"], 0], "fill-extrusion-opacity": 0.9 },
        },
        CLUSTERS,
      );
    };
    extrusion(CONTEXT, "context", CONTEXT_COLOR);
    extrusion(TOWERS, "tower", TOWER_COLOR);

    map.on("moveend", () => void loadVisibleBuildings());
    void loadVisibleBuildings();

    // A name tag under the pointer; it must never take the pointer itself, or it would flicker
    const nameTag = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8, className: "name-tag" });
    map.on("mousemove", TOWERS, (ev) => {
      const props = ev.features?.[0]?.properties;
      if (!props || picking) return;
      map.getCanvas().style.cursor = "pointer";
      nameTag.setLngLat(ev.lngLat).setText(String(props.name)).addTo(map);
    });
    map.on("mouseleave", TOWERS, () => {
      if (!picking) map.getCanvas().style.cursor = "";
      nameTag.remove();
    });
    cameraLayer = installCameraLayer(map, { visible: camerasOn, describe: describeCamera, onStreetView, skip });

    map.on("click", TOWERS, (ev) => {
      const props = ev.features?.[0]?.properties;
      if (!props || skip(ev) || cameraAt(ev)) return; // a camera dot in front of the tower takes the click
      nameTag.remove();
      onOpenBuilding(String(props.township), String(props.building));
    });

    map.on("click", CLUSTERS, async (ev) => {
      if (skip(ev)) return;
      const feature = ev.features?.[0];
      if (!feature) return;
      const source = map.getSource(SOURCE) as maplibregl.GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(Number(feature.properties.cluster_id));
      const [lon, lat] = (feature.geometry as unknown as { coordinates: number[] }).coordinates;
      map.easeTo({ center: [lon, lat] as Coordinates, zoom });
    });
    map.on("click", POINTS, (ev) => {
      if (skip(ev) || cameraAt(ev)) return;
      if (map.queryRenderedFeatures(ev.point, { layers: [TOWERS] }).length > 0) return; // a tower in front of the marker
      const entry = byId.get(String(ev.features?.[0]?.properties.id));
      if (entry) openPopup(entry);
    });
    for (const layer of [CLUSTERS, POINTS]) {
      map.on("mouseenter", layer, () => {
        if (!picking) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layer, () => {
        if (!picking) map.getCanvas().style.cursor = "";
      });
    }
  });

  return {
    show() {
      container.classList.remove("off");
      map.resize(); // the container had no size while it was hidden
    },
    hide() {
      setPicking(false);
      container.classList.add("off");
    },
    focus(id) {
      const entry = byId.get(id);
      if (!entry) return;
      map.easeTo({ center: [entry.lon, entry.lat], zoom: Math.max(map.getZoom(), FOCUS_ZOOM), pitch: FOCUS_PITCH });
      openPopup(entry);
    },
    relabel() {
      switcher.relabel(labels());
      streetButton?.relabel(labels());
      cameraButton.relabel(labels());
      popup?.remove(); // its text is in the old language; a click opens it again
    },
  };
}

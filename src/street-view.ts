import type { Viewer } from "mapillary-js";
import { t, type Key } from "./i18n";
import { nearestImage, searchUrl } from "./mapillary-search";

// Street-level photos from Mapillary (crowd-sourced, CC BY-SA), in a panel over the map or the 3D view.
// The client token comes from VITE_MAPILLARY_TOKEN; without a valid one the street view is simply not offered.
// It is sent in the Authorization header for the search (so it is not in any URL) and handed to the viewer.
// Like every VITE_ variable it is part of the page, which is what a Mapillary client token is meant for.

const TOKEN_FORMAT = /^MLY\|\d+\|[A-Za-z0-9]+$/;
const RADII = [60, 150]; // metres: the nearest photo first, a wider look if there is none
const SEARCH_TIMEOUT_MS = 20000; // the Graph API can take several seconds

// What went wrong, for a message that helps: no answer at all, the token refused, or anything else
type Failure = "timeout" | "denied" | "failed";

function failureOf(error: unknown): Failure {
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) return "timeout";
  if (error instanceof Error && /^HTTP (401|403)$/.test(error.message)) return "denied";
  return "failed";
}

const FAILURE_KEYS: Record<Failure, Key> = { timeout: "street.timeout", denied: "street.denied", failed: "street.failed" };

export interface StreetView {
  available: boolean;
  open: (lon: number, lat: number) => Promise<void>;
  close: () => void;
  isOpen: () => boolean;
  relabel: () => void;
}

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

export function createStreetView(rawToken: string | undefined): StreetView {
  const token = rawToken?.trim() ?? "";
  const available = TOKEN_FORMAT.test(token);
  if (!available && token !== "") console.warn("VITE_MAPILLARY_TOKEN is not a Mapillary client token (MLY|…); street view is off");

  const panel = byId("street");
  const container = byId("street-viewer");
  const message = byId("street-msg");
  byId("street-close").addEventListener("click", () => close());

  let viewer: Viewer | null = null;
  let request = 0; // a search that is no longer the latest one is dropped when it answers
  let messageKey: { key: Key; params?: Record<string, number> } | null = null;

  function say(key: Key | null, params?: Record<string, number>): void {
    messageKey = key ? { key, params } : null;
    message.textContent = key ? t(key, params) : "";
    message.hidden = key === null;
  }

  async function search(lon: number, lat: number): Promise<string | null> {
    for (const radius of RADII) {
      const response = await fetch(searchUrl(lon, lat, radius), {
        headers: { Authorization: `OAuth ${token}` },
        referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const id = nearestImage(await response.json(), lon, lat);
      if (id) return id;
    }
    return null;
  }

  async function show(imageId: string): Promise<void> {
    if (viewer) {
      await viewer.moveTo(imageId);
      return;
    }
    // Loaded on first use: the viewer is a large library and most visits never open it
    const [{ Viewer: MapillaryViewer }] = await Promise.all([import("mapillary-js"), import("mapillary-js/dist/mapillary.css")]);
    viewer = new MapillaryViewer({ accessToken: token, container, imageId });
  }

  async function open(lon: number, lat: number): Promise<void> {
    if (!available || !Number.isFinite(lon) || !Number.isFinite(lat)) return;
    const mine = ++request;
    panel.hidden = false;
    viewer?.resize();
    say("street.loading");
    try {
      const imageId = await search(lon, lat);
      if (mine !== request) return;
      if (!imageId) {
        say("street.none", { m: RADII[RADII.length - 1] });
        return;
      }
      await show(imageId);
      if (mine === request) say(null);
    } catch (error) {
      if (mine !== request) return;
      // Generic message on screen; the console gets the reason without the token or the URL
      console.warn("street view failed:", error instanceof Error ? error.message : "unknown error");
      say(FAILURE_KEYS[failureOf(error)], { s: SEARCH_TIMEOUT_MS / 1000 });
    }
  }

  function close(): void {
    request++; // drops a search in progress
    panel.hidden = true;
  }

  return {
    available,
    open,
    close,
    isOpen: () => !panel.hidden,
    relabel() {
      if (messageKey) message.textContent = t(messageKey.key, messageKey.params);
    },
  };
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Mapillary client token for the street view (optional; without it the street view buttons are hidden)
  readonly VITE_MAPILLARY_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

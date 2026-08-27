"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { hydroposts as allHydroposts, type Hydropost } from "@/lib/akmolaMapData";
import type { Layer, Place, Region, SuggestedPlacement, WaterObject } from "@/lib/types";
import {
  buildGraph,
  haversineKm,
  measureWaterPath,
  projectPointToPolyline,
  type MeasureResult,
  type PolylineWaterObject,
  type WaterTraceResult,
} from "@/lib/measure";

// ── Map styles ────────────────────────────────────────────────────────────────

// Self-hosted-friendly vector styles — no API key, no foreign token, tiles
// served from OpenFreeMap (OSM data).
//
// "imagery" is real satellite/aerial photography — Esri World Imagery, free,
// no API key, no account. Foreign (US) live tiles, same tradeoff as
// OpenFreeMap before self-hosting — kept because Sentinel (our self-hosted
// snapshot) is only 10m/pixel and too coarse to see much at street scale.
const ESRI_IMAGERY_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "esri-imagery": {
      type: "raster",
      tiles: ["https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [{ id: "esri-imagery-layer", type: "raster", source: "esri-imagery" }],
};

const MAP_STYLES = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  bright: "https://tiles.openfreemap.org/styles/bright",
  imagery: ESRI_IMAGERY_STYLE,
} as const;

type MapStyleKey = keyof typeof MAP_STYLES;
const STYLE_ORDER: MapStyleKey[] = ["dark", "bright", "imagery"];
const STYLE_LABEL: Record<MapStyleKey, string> = { dark: "Тёмная", bright: "Светлая", imagery: "Спутник" };

// ── Data fetchers (module-level cache) ────────────────────────────────────────

type DistrictFeature = {
  properties: { name: string };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: [number, number][][] | [number, number][][][];
  };
};

const waterCache = new Map<Region, WaterObject[]>();
const graphCacheMap = new Map<Region, ReturnType<typeof buildGraph>>();
const waterLoadPromise = new Map<Region, Promise<WaterObject[]>>();
const placesCacheMap = new Map<Region, Place[]>();
const districtsCache = new Map<Region, DistrictFeature[]>();
const borderCache = new Map<Region, [number, number][][]>();

const REGION_VIEW: Record<Region, { center: [number, number]; zoom: number }> = {
  akmola: { center: [70.45, 52.25], zoom: 7.1 },
  kyzylorda: { center: [63.55, 45.08], zoom: 6.4 },
};

function fetchWaterObjects(region: Region): Promise<WaterObject[]> {
  const cached = waterCache.get(region);
  if (cached) return Promise.resolve(cached);
  let pending = waterLoadPromise.get(region);
  if (!pending) {
    // akmola-hydro-rivers.json is an extra supplemental dataset with no
    // per-region equivalent yet — only fetch it for akmola.
    const extra =
      region === "akmola"
        ? fetch("/akmola-hydro-rivers.json")
            .then((r) => r.json() as Promise<WaterObject[]>)
            .catch(() => [] as WaterObject[])
        : Promise.resolve([] as WaterObject[]);
    pending = Promise.all([
      fetch(`/${region}-water-bodies.json`).then((r) => r.json() as Promise<WaterObject[]>),
      fetch(`/${region}-waterways.json`).then((r) => r.json() as Promise<WaterObject[]>),
      extra,
    ]).then(([bodies, ways, rivers]) => {
      const combined = [...bodies, ...ways, ...rivers];
      waterCache.set(region, combined);
      return combined;
    });
    waterLoadPromise.set(region, pending);
  }
  return pending;
}

function fetchPlaces(region: Region): Promise<Place[]> {
  const cached = placesCacheMap.get(region);
  if (cached) return Promise.resolve(cached);
  return fetch(`/${region}-places.json`)
    .then((r) => r.json() as Promise<Place[]>)
    .then((d) => { placesCacheMap.set(region, d); return d; })
    .catch(() => []);
}

function fetchDistricts(region: Region): Promise<DistrictFeature[]> {
  const cached = districtsCache.get(region);
  if (cached) return Promise.resolve(cached);
  return fetch(`/${region}-districts.geojson`)
    .then((r) => r.json())
    .then((d) => { const features = d?.features ?? []; districtsCache.set(region, features); return features; })
    .catch(() => []);
}

function fetchBorder(region: Region): Promise<[number, number][][]> {
  const cached = borderCache.get(region);
  if (cached) return Promise.resolve(cached);
  return fetch(`/${region}-border.geojson`)
    .then((r) => r.json())
    .then((d) => { const rings = d?.features?.[0]?.geometry?.coordinates ?? []; borderCache.set(region, rings); return rings; })
    .catch(() => []);
}

function hydropostsFor(region: Region): Hydropost[] {
  return allHydroposts.filter((p) => p.region === region);
}

// ── Layer helpers (pure, no refs) ─────────────────────────────────────────────

function setupBorderLayer(map: maplibregl.Map, rings: [number, number][][]) {
  if (map.getLayer("border-line")) map.removeLayer("border-line");
  if (map.getSource("border")) map.removeSource("border");
  if (!rings.length) return;
  map.addSource("border", {
    type: "geojson",
    data: { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: rings as number[][][] } },
  });
  map.addLayer({ id: "border-line", type: "line", source: "border", paint: { "line-color": "#34d399", "line-width": 2, "line-opacity": 0.8 } });
}

function districtExpr(highlighted: string[]) {
  if (!highlighted.length) return ["boolean", false] as maplibregl.ExpressionSpecification;
  return ["in", ["get", "name"], ["literal", highlighted]] as maplibregl.ExpressionSpecification;
}

function setupDistrictLayers(
  map: maplibregl.Map,
  districts: DistrictFeature[],
  highlighted: string[],
  visible: boolean,
) {
  ["districts-labels", "districts-line", "districts-fill", "districts-hit"].forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource("districts")) map.removeSource("districts");
  if (!districts.length) return;

  const fc: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: districts.map((d) => ({
      type: "Feature" as const,
      properties: d.properties,
      geometry: d.geometry as GeoJSON.Geometry,
    })),
  };
  map.addSource("districts", { type: "geojson", data: fc });

  const vis = visible ? "visible" : "none";
  const expr = districtExpr(highlighted);

  // Invisible hit-test layer — needed so queryRenderedFeatures finds districts even when opacity=0
  map.addLayer({
    id: "districts-hit",
    type: "fill",
    source: "districts",
    layout: { visibility: "visible" },
    paint: { "fill-color": "#000000", "fill-opacity": 0.001 },
  });

  map.addLayer({
    id: "districts-fill",
    type: "fill",
    source: "districts",
    layout: { visibility: vis },
    paint: {
      "fill-color": ["case", expr, "#f97316", "transparent"],
      "fill-opacity": ["case", expr, 0.18, 0],
    },
  });
  map.addLayer({
    id: "districts-line",
    type: "line",
    source: "districts",
    layout: { visibility: vis },
    paint: {
      "line-color": ["case", expr, "#f97316", "rgba(148,163,184,0.35)"],
      "line-width": ["case", expr, 2.5, 1],
    },
  });
  map.addLayer({
    id: "districts-labels",
    type: "symbol",
    source: "districts",
    layout: {
      visibility: vis,
      "text-field": ["get", "name"],
      "text-size": 11,
      "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
      "text-allow-overlap": false,
      "text-max-width": 8,
    },
    paint: {
      "text-color": ["case", expr, "#f97316", "rgba(203,213,225,0.65)"],
      "text-halo-color": "rgba(0,0,0,0.85)",
      "text-halo-width": 1.5,
    },
  });
}

function updateDistrictPaint(map: maplibregl.Map, highlighted: string[]) {
  if (!map.getLayer("districts-fill")) return;
  const expr = districtExpr(highlighted);
  map.setPaintProperty("districts-fill", "fill-color", ["case", expr, "#f97316", "transparent"]);
  map.setPaintProperty("districts-fill", "fill-opacity", ["case", expr, 0.18, 0]);
  map.setPaintProperty("districts-line", "line-color", ["case", expr, "#f97316", "rgba(148,163,184,0.35)"]);
  map.setPaintProperty("districts-line", "line-width", ["case", expr, 2.5, 1]);
  map.setPaintProperty("districts-labels", "text-color", ["case", expr, "#f97316", "rgba(203,213,225,0.65)"]);
}

function polylineApproxLengthDeg(coords: [number, number][]): number {
  let len = 0;
  for (let i = 1; i < coords.length; i++) {
    const dx = coords[i][0] - coords[i - 1][0], dy = coords[i][1] - coords[i - 1][1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}
function polygonApproxAreaDeg(coords: [number, number][][]): number {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const ring of coords) for (const [x, y] of ring) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return (maxX - minX) * (maxY - minY);
}
const MIN_LINE_DEG = 0.04, MIN_AREA_DEG = 0.0003;
function shouldRender(obj: WaterObject, highlighted: boolean): boolean {
  if (highlighted) return true;
  if (obj.geometry === "polyline") return polylineApproxLengthDeg(obj.coordinates as [number, number][]) >= MIN_LINE_DEG;
  if (obj.kind === "river") return false;
  return polygonApproxAreaDeg(obj.coordinates as [number, number][][]) >= MIN_AREA_DEG;
}

function setupWaterLayers(
  map: maplibregl.Map,
  objects: WaterObject[],
  highlighted: string[],
  currentLayer: Layer,
) {
  ["water-fills", "water-lines", "water-lines-hit"].forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
  ["water-fills-src", "water-lines-src", "water-lines-hit-src"].forEach((id) => { if (map.getSource(id)) map.removeSource(id); });

  // "Водные объекты" toggle off (layer !== "water") — hide water entirely,
  // same as the hydroposts toggle hides markers. Ruler/water-trace snapping
  // still works regardless (renderedPolylinesRef is filled independently).
  if (currentLayer !== "water") return;

  const dim = false;

  // Hit features: ALL polylines (no length filter) so short river segments are still clickable
  const polyHitFeats: GeoJSON.Feature[] = objects
    .filter((o) => o.geometry === "polyline" && (o.coordinates as [number, number][]).length >= 2)
    .map((o) => ({
      type: "Feature" as const,
      properties: { id: o.id, name: o.name, kind: o.kind },
      geometry: { type: "LineString", coordinates: o.coordinates as number[][] } as GeoJSON.Geometry,
    }));

  const polyFeats: GeoJSON.Feature[] = objects
    .filter((o) => o.geometry === "polyline" && shouldRender(o, highlighted.includes(o.id)))
    .map((o) => ({
      type: "Feature" as const,
      properties: { id: o.id, name: o.name, kind: o.kind, hl: highlighted.includes(o.id) ? 1 : 0 },
      geometry: { type: "LineString", coordinates: o.coordinates as number[][] } as GeoJSON.Geometry,
    }));

  const polyFills: GeoJSON.Feature[] = objects
    .filter((o) => o.geometry === "polygon" && shouldRender(o, highlighted.includes(o.id)))
    .map((o) => ({
      type: "Feature" as const,
      properties: { id: o.id, name: o.name, kind: o.kind, hl: highlighted.includes(o.id) ? 1 : 0 },
      geometry: { type: "Polygon", coordinates: o.coordinates as number[][][] } as GeoJSON.Geometry,
    }));

  // Invisible hit layer uses ALL river segments (no length filter), width 24px ≈ 1-2 km buffer
  if (polyHitFeats.length) {
    map.addSource("water-lines-hit-src", { type: "geojson", data: { type: "FeatureCollection", features: polyHitFeats } });
    map.addLayer({
      id: "water-lines-hit",
      type: "line",
      source: "water-lines-hit-src",
      paint: { "line-color": "#000000", "line-width": 10, "line-opacity": 0.001 },
    });
  }

  if (polyFeats.length) {
    map.addSource("water-lines-src", { type: "geojson", data: { type: "FeatureCollection", features: polyFeats } });
    map.addLayer({
      id: "water-lines",
      type: "line",
      source: "water-lines-src",
      paint: {
        "line-color": ["case", ["==", ["get", "hl"], 1], "#22d3ee", ["==", ["get", "kind"], "river"], "#3b82f6", "#60a5fa"],
        "line-width": ["case", ["==", ["get", "hl"], 1], 4, ["==", ["get", "kind"], "river"], 1.5, 1],
        "line-opacity": dim ? 0.25 : 0.85,
      },
    });
  }

  if (polyFills.length) {
    map.addSource("water-fills-src", { type: "geojson", data: { type: "FeatureCollection", features: polyFills } });
    map.addLayer({
      id: "water-fills",
      type: "fill",
      source: "water-fills-src",
      paint: {
        "fill-color": ["case",
          ["==", ["get", "hl"], 1], "rgba(34,211,238,0.18)",
          ["==", ["get", "kind"], "reservoir"], "rgba(32,196,176,0.18)",
          "rgba(59,130,246,0.14)",
        ],
        "fill-opacity": dim ? 0.3 : 1,
        "fill-outline-color": ["case",
          ["==", ["get", "hl"], 1], "#22d3ee",
          ["==", ["get", "kind"], "reservoir"], "#14b8a6",
          "#3b82f6",
        ],
      },
    });
  }
}

function drawTracePath(map: maplibregl.Map, path: [number, number][]) {
  if (map.getLayer("trace-path")) map.removeLayer("trace-path");
  if (map.getSource("trace-path-src")) map.removeSource("trace-path-src");
  if (path.length < 2) return;
  map.addSource("trace-path-src", {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: path as number[][] },
    },
  });
  map.addLayer({
    id: "trace-path",
    type: "line",
    source: "trace-path-src",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#60a5fa", "line-width": 5, "line-opacity": 0.88 },
  });
}

function clearTracePath(map: maplibregl.Map) {
  if (map.getLayer("trace-path")) map.removeLayer("trace-path");
  if (map.getSource("trace-path-src")) map.removeSource("trace-path-src");
}

function drawMeasureLine(map: maplibregl.Map, from: [number, number], to: [number, number]) {
  if (map.getLayer("measure-line")) map.removeLayer("measure-line");
  if (map.getSource("measure-line-src")) map.removeSource("measure-line-src");
  map.addSource("measure-line-src", {
    type: "geojson",
    data: {
      type: "Feature", properties: {},
      geometry: { type: "LineString", coordinates: [from, to] },
    } as GeoJSON.Feature<GeoJSON.LineString>,
  });
  map.addLayer({
    id: "measure-line",
    type: "line",
    source: "measure-line-src",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#22d3ee", "line-width": 2, "line-dasharray": [5, 3], "line-opacity": 0.85 },
  });
}

function clearMeasureLine(map: maplibregl.Map) {
  if (map.getLayer("measure-line")) map.removeLayer("measure-line");
  if (map.getSource("measure-line-src")) map.removeSource("measure-line-src");
}

type SatelliteMeta = { bbox: [number, number, number, number]; imageUrl: string };

function setupSatelliteLayer(map: maplibregl.Map, meta: SatelliteMeta | null, visible: boolean) {
  if (map.getLayer("satellite-overlay")) map.removeLayer("satellite-overlay");
  if (map.getSource("satellite-overlay-src")) map.removeSource("satellite-overlay-src");
  if (!visible || !meta) return;
  const [minLon, minLat, maxLon, maxLat] = meta.bbox;
  map.addSource("satellite-overlay-src", {
    type: "image",
    url: meta.imageUrl,
    coordinates: [
      [minLon, maxLat],
      [maxLon, maxLat],
      [maxLon, minLat],
      [minLon, minLat],
    ],
  });
  map.addLayer({
    id: "satellite-overlay",
    type: "raster",
    source: "satellite-overlay-src",
    paint: { "raster-opacity": 0.92 },
  });
}

// Self-hosted 3D terrain — elevation tiles built once from Copernicus DEM,
// served from our own server (src/lib/terrainTiles.ts), no live foreign call.
// Each region's tile pyramid can have a different max zoom (rio-rgbify --min-z/--max-z
// at build time — Kyzylorda was built shallower than Akmola to keep the mbtiles
// file small) — minzoom/maxzoom must match what was actually built or MapLibre
// either 404s below minzoom or fails to overzoom correctly past maxzoom.
const TERRAIN_ZOOM: Record<Region, { min: number; max: number }> = {
  akmola: { min: 5, max: 11 },
  kyzylorda: { min: 5, max: 9 },
};

function setupTerrainSource(map: maplibregl.Map, region: Region, visible: boolean) {
  if (!visible) {
    map.setTerrain(null);
    if (map.getSource("terrain-dem")) map.removeSource("terrain-dem");
    return;
  }
  if (!map.getSource("terrain-dem")) {
    const zoom = TERRAIN_ZOOM[region];
    map.addSource("terrain-dem", {
      type: "raster-dem",
      tiles: [`/api/terrain/{z}/{x}/{y}.png?region=${region}`],
      tileSize: 512,
      minzoom: zoom.min,
      maxzoom: zoom.max,
      encoding: "mapbox",
    });
  }
  map.setTerrain({ source: "terrain-dem", exaggeration: 1.5 });
}

// Hypsometric tint (color-by-elevation) — plain pre-rendered colored tiles,
// same DEM/tile grid as the 3D terrain — but instead of MapLibre's native
// color-relief layer (needs v6, which broke rendering entirely when tested)
// tiles are colorized server-side on every request from the terrain-RGB
// elevation data (src/lib/elevationColor.ts), using whatever min/max the
// current viewport reports via /api/relief/stats. That's what makes the tint
// rescale as you pan/zoom instead of using one fixed range for the whole
// region — mirrors RELATIVE_STOPS server-side exactly, keep both in sync.
const RELIEF_ZOOM: Record<Region, { min: number; max: number }> = TERRAIN_ZOOM;
const RELIEF_DEFAULT_RANGE: Record<Region, { min: number; max: number }> = {
  akmola: { min: 46, max: 923 },
  kyzylorda: { min: 20, max: 600 },
};
const RELIEF_RELATIVE_STOPS: { t: number; color: string }[] = [
  { t: 0, color: "rgb(34,85,51)" },
  { t: 0.12, color: "rgb(76,153,76)" },
  { t: 0.20, color: "rgb(154,191,94)" },
  { t: 0.27, color: "rgb(216,209,112)" },
  { t: 0.34, color: "rgb(222,173,105)" },
  { t: 0.43, color: "rgb(199,134,84)" },
  { t: 0.57, color: "rgb(163,101,68)" },
  { t: 0.75, color: "rgb(140,96,82)" },
  { t: 1.0, color: "rgb(245,245,240)" },
];

function reliefTileUrl(region: Region, min: number, max: number): string {
  return `/api/relief/{z}/{x}/{y}.png?region=${region}&min=${Math.round(min)}&max=${Math.round(max)}`;
}

function setupReliefLayer(map: maplibregl.Map, region: Region, visible: boolean, min: number, max: number) {
  if (!visible) {
    if (map.getLayer("relief-layer")) map.removeLayer("relief-layer");
    if (map.getSource("relief-src")) map.removeSource("relief-src");
    return;
  }
  if (!map.getSource("relief-src")) {
    const zoom = RELIEF_ZOOM[region];
    map.addSource("relief-src", {
      type: "raster",
      tiles: [reliefTileUrl(region, min, max)],
      tileSize: 512,
      minzoom: zoom.min,
      maxzoom: zoom.max,
    });
    map.addLayer({
      id: "relief-layer",
      type: "raster",
      source: "relief-src",
      paint: { "raster-opacity": 0.85 },
    });
  }
}

function setup3DBuildings(map: maplibregl.Map) {
  if (map.getLayer("3d-buildings")) map.removeLayer("3d-buildings");
  // OpenFreeMap/OpenMapTiles schema: source "openmaptiles", building heights come
  // as render_height/render_min_height (not Mapbox's height/min_height/extrude).
  if (!map.getSource("openmaptiles")) return;
  try {
    map.addLayer({
      id: "3d-buildings",
      source: "openmaptiles",
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": "#334455",
        "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 14.05, ["get", "render_height"]],
        "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 14, 0, 14.05, ["coalesce", ["get", "render_min_height"], 0]],
        "fill-extrusion-opacity": 0.8,
      },
    });
  } catch {
    // style variant without a building layer
  }
}

// ── Marker helpers ────────────────────────────────────────────────────────────

function markerColor(post: Hydropost, active: boolean, highlighted: boolean): string {
  if (active) return "#22c55e";
  if (highlighted) return "#f97316";
  if (post.status === "danger") return "#ef4444";
  if (post.status === "warning") return "#f59e0b";
  return "#60a5fa";
}

function makeMarkerEl(post: Hydropost, active: boolean, highlighted: boolean, onClick: () => void): HTMLElement {
  const color = markerColor(post, active, highlighted);
  const size = active ? 16 : highlighted ? 14 : 11;
  const el = document.createElement("button");
  el.type = "button";
  el.title = post.label;
  el.style.cssText = `
    width:${size}px;height:${size}px;border-radius:50%;background:${color};
    border:2px solid ${active ? "#fff" : "rgba(255,255,255,0.4)"};
    cursor:pointer;box-shadow:0 0 ${active ? 10 : 5}px ${color}99;padding:0;
  `;
  el.addEventListener("click", onClick);
  return el;
}

function makeMeasureEl(color: string): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = `width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 8px ${color};`;
  return el;
}

// ── fitPosts ──────────────────────────────────────────────────────────────────

function fitPosts(posts: { coordinates: [number, number] }[]): { center: [number, number]; zoom: number } | null {
  if (!posts.length) return null;
  const lngs = posts.map((p) => p.coordinates[0]);
  const lats = posts.map((p) => p.coordinates[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
  const span = Math.max(maxLng - minLng, (maxLat - minLat) * 1.5);
  const zoom = span < 0.3 ? 10 : span < 0.8 ? 9 : span < 2 ? 8 : span < 4 ? 7.5 : 7;
  return { center, zoom };
}

function ringCentroid(coords: [number, number][]): [number, number] {
  let x = 0, y = 0;
  for (const [cx, cy] of coords) { x += cx; y += cy; }
  return [x / coords.length, y / coords.length];
}

// ── Popup HTML builders ───────────────────────────────────────────────────────

function postPopupHTML(post: Hydropost): string {
  const sc = post.status === "danger" ? "#ef4444" : post.status === "warning" ? "#f59e0b" : "#22c55e";
  const sl = post.status === "danger" ? "Опасно" : post.status === "warning" ? "Внимание" : "Норма";
  const levelLine = post.hasLevelData
    ? `<div style="font-size:13px;font-weight:600;color:${sc}">${post.waterLevel} см <span style="font-size:10px;font-weight:400;opacity:0.75">${sl}</span></div>`
    : `<div style="font-size:12px;font-weight:500;color:#6e7681">Нет данных</div>`;
  return `
    <div style="font-weight:600;color:#e6edf3;font-size:13px;margin-bottom:3px">${post.label}</div>
    <div style="font-size:11px;color:#60a5fa;margin-bottom:1px">${post.waterBody}</div>
    <div style="font-size:11px;color:#6e7681;margin-bottom:6px">${post.district}</div>
    ${levelLine}`;
}

const PLACE_KIND: Record<string, string> = {
  national_capital: "Столица", city: "Город", town: "Посёлок", suburb: "Микрорайон", village: "Село",
};
function placePopupHTML(place: Place): string {
  return `
    <div style="font-weight:600;color:#e6edf3;font-size:13px;margin-bottom:3px">${place.name}</div>
    <div style="font-size:11px;color:#8b949e">${PLACE_KIND[place.kind] ?? "Нас. пункт"}</div>`;
}

// ── Types ─────────────────────────────────────────────────────────────────────


// How far a click may be from the nearest rendered river and still snap to it
// in water-trace mode (settlements sit near water, not exactly on it, so this
// is more forgiving than the ruler tool's 5 km).
const TRACE_SNAP_MAX_KM = 8;

type TracePoint = {
  coords: [number, number];
  label: string;
  obj: PolylineWaterObject;
  proj: NonNullable<ReturnType<typeof projectPointToPolyline>>;
};

type Props = {
  region: Region;
  activePostCode: number | null;
  highlightedPostCodes: number[];
  highlightedWaterIds: string[];
  highlightedPlaceIds: string[];
  highlightedDistricts: string[];
  suggestedPlacements: SuggestedPlacement[];
  layer: Layer;
  showPlaces: boolean;
  showDistricts: boolean;
  showHydroposts: boolean;
  isMeasureMode: boolean;
  isWaterTraceMode: boolean;
  onPostClick: (code: number) => void;
  onWaterClick: (water: WaterObject) => void;
  onLayerChange: (layer: Layer) => void;
  onTogglePlaces: () => void;
  onToggleDistricts: () => void;
  onToggleHydroposts: () => void;
  onMeasureResult: (result: MeasureResult) => void;
  onWaterTraceResult: (result: WaterTraceResult) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AkmolaMap({
  region,
  activePostCode,
  highlightedPostCodes,
  highlightedWaterIds,
  highlightedPlaceIds,
  highlightedDistricts,
  suggestedPlacements,
  layer,
  showPlaces,
  showDistricts,
  showHydroposts,
  isMeasureMode,
  isWaterTraceMode,
  onPostClick,
  onWaterClick,
  onLayerChange,
  onTogglePlaces,
  onToggleDistricts,
  onToggleHydroposts,
  onMeasureResult,
  onWaterTraceResult,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const popupRef = useRef<maplibregl.Popup | null>(null);
  const suppressMapClickRef = useRef(false); // prevents map click after marker click

  // Marker instances (survive style changes automatically)
  const markerRefs = useRef<maplibregl.Marker[]>([]);
  const suggestedRefs = useRef<maplibregl.Marker[]>([]);
  const measureMarkerRefs = useRef<maplibregl.Marker[]>([]);
  const placeRefs = useRef<maplibregl.Marker[]>([]);
  const hlPlaceRefs = useRef<maplibregl.Marker[]>([]);

  // Cached data from fetch
  const borderDataRef = useRef<[number, number][][] | null>(null);
  const districtDataRef = useRef<DistrictFeature[] | null>(null);
  const waterDataRef = useRef<WaterObject[] | null>(null);

  // Current prop values as refs (for style.load handler)
  const regionRef = useRef(region);
  const layerRef = useRef(layer);
  const hlWaterRef = useRef(highlightedWaterIds);
  const hlDistrictsRef = useRef(highlightedDistricts);
  const showDistrictsRef = useRef(showDistricts);

  // Measure
  const measureFirstRef = useRef<[number, number] | null>(null);
  // True right after a measurement finishes — the parent auto-flips isMeasureMode
  // to false at that point too, so the cleanup effect needs to tell "just finished,
  // keep the result visible" apart from "user cancelled, wipe it".
  const measureJustCompletedRef = useRef(false);
  const isMeasureRef = useRef(isMeasureMode);
  const onMeasureResultRef = useRef(onMeasureResult);
  const renderedPolylinesRef = useRef<PolylineWaterObject[]>([]);
  const [measureStep, setMeasureStep] = useState<0 | 1>(0);

  // Water trace
  const traceFirstRef = useRef<TracePoint | null>(null);
  const traceMeasureMarkersRef = useRef<maplibregl.Marker[]>([]);
  const isWaterTraceRef = useRef(isWaterTraceMode);
  const onWaterClickRef = useRef(onWaterClick);
  const onWaterTraceResultRef = useRef(onWaterTraceResult);
  const [traceStep, setTraceStep] = useState<0 | 1>(0);
  const [traceMsg, setTraceMsg] = useState<string | null>(null);
  const traceJustCompletedRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyleKey>("dark");
  const layersInitRef = useRef(false);

  // Sentinel satellite overlay (self-hosted cache — see /api/satellite)
  const [showSatellite, setShowSatellite] = useState(false);
  const [satelliteLoading, setSatelliteLoading] = useState(false);
  const [satelliteError, setSatelliteError] = useState<string | null>(null);
  const [satelliteDate, setSatelliteDate] = useState<number | null>(null);
  const satelliteMetaRef = useRef<SatelliteMeta | null>(null);
  const showSatelliteRef = useRef(false);

  // Self-hosted 3D terrain (elevation) — see /api/terrain
  const [showTerrain, setShowTerrain] = useState(false);
  const showTerrainRef = useRef(false);

  // Hypsometric tint (color-by-elevation) — see /api/relief
  const [showRelief, setShowRelief] = useState(false);
  const showReliefRef = useRef(false);
  const [reliefRange, setReliefRange] = useState(RELIEF_DEFAULT_RANGE[region]);
  const reliefRangeRef = useRef(reliefRange);
  const reliefDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync refs
  useEffect(() => { regionRef.current = region; }, [region]);
  useEffect(() => { isMeasureRef.current = isMeasureMode; }, [isMeasureMode]);
  useEffect(() => { onMeasureResultRef.current = onMeasureResult; }, [onMeasureResult]);
  useEffect(() => { layerRef.current = layer; }, [layer]);
  useEffect(() => { hlWaterRef.current = highlightedWaterIds; }, [highlightedWaterIds]);
  useEffect(() => { hlDistrictsRef.current = highlightedDistricts; }, [highlightedDistricts]);
  useEffect(() => { showDistrictsRef.current = showDistricts; }, [showDistricts]);
  useEffect(() => { isWaterTraceRef.current = isWaterTraceMode; }, [isWaterTraceMode]);
  useEffect(() => { onWaterClickRef.current = onWaterClick; }, [onWaterClick]);
  useEffect(() => { onWaterTraceResultRef.current = onWaterTraceResult; }, [onWaterTraceResult]);

  // Measure cleanup — cancelling mid-measurement wipes markers/line off the map;
  // finishing one keeps it visible (mode still auto-turns off, but nothing to clear).
  useEffect(() => {
    if (!isMeasureMode) {
      measureFirstRef.current = null;
      setMeasureStep(0);
      if (measureJustCompletedRef.current) {
        measureJustCompletedRef.current = false;
      } else {
        measureMarkerRefs.current.forEach((m) => m.remove());
        measureMarkerRefs.current = [];
        if (mapRef.current) clearMeasureLine(mapRef.current);
      }
    }
  }, [isMeasureMode]);

  // Water trace cleanup — cancelling mid-trace wipes markers/path off the map;
  // finishing one keeps it visible (mode still auto-turns off, but nothing to clear).
  useEffect(() => {
    if (!isWaterTraceMode) {
      traceFirstRef.current = null;
      setTraceStep(0);
      setTraceMsg(null);
      if (traceJustCompletedRef.current) {
        traceJustCompletedRef.current = false;
      } else {
        traceMeasureMarkersRef.current.forEach((m) => m.remove());
        traceMeasureMarkersRef.current = [];
        if (mapRef.current) clearTracePath(mapRef.current);
      }
    }
  }, [isWaterTraceMode]);

  // handleTracePoint defined at component level so it can be called directly from
  // marker/place click handlers (avoids ref indirection that could silently fail).
  // Uses mapRef.current instead of a closed-over map variable.
  const handleTracePoint = useCallback((coords: [number, number], label: string) => {
    const map = mapRef.current;
    if (!map) return;
    let best: { obj: PolylineWaterObject; proj: NonNullable<ReturnType<typeof projectPointToPolyline>> } | null = null;
    let bestDist = TRACE_SNAP_MAX_KM;
    for (const obj of renderedPolylinesRef.current) {
      const proj = projectPointToPolyline(obj.coordinates, coords);
      if (!proj) continue;
      const d = haversineKm(coords, proj.projected);
      if (d < bestDist) { bestDist = d; best = { obj, proj }; }
    }
    if (!best) {
      setTraceMsg(`«${label}» слишком далеко от ближайшей реки (нет воды в пределах ~${TRACE_SNAP_MAX_KM} км) — отсюда след не построить.`);
      return;
    }
    setTraceMsg(null);
    const snapped = best.proj.projected;
    if (!traceFirstRef.current) {
      // Clear markers and path from any previous trace session
      traceMeasureMarkersRef.current.forEach((m) => m.remove());
      traceMeasureMarkersRef.current = [];
      clearTracePath(map);
      traceFirstRef.current = { coords: snapped, label, obj: best.obj, proj: best.proj };
      setTraceStep(1);
      traceMeasureMarkersRef.current.push(
        new maplibregl.Marker({ element: makeMeasureEl("#22d3ee"), anchor: "center" }).setLngLat(snapped).addTo(map),
      );
    } else {
      const first = traceFirstRef.current;
      traceFirstRef.current = null;
      traceJustCompletedRef.current = true;
      traceMeasureMarkersRef.current.push(
        new maplibregl.Marker({ element: makeMeasureEl("#f97316"), anchor: "center" }).setLngLat(snapped).addTo(map),
      );
      // Try to find connected water path via graph; show route if found
      const currentGraph = graphCacheMap.get(regionRef.current);
      const waterPath = currentGraph
        ? measureWaterPath(currentGraph, first.obj, first.proj, best.obj, best.proj)
        : null;
      if (waterPath) {
        drawTracePath(map, waterPath.path);
        onWaterTraceResultRef.current({
          distanceKm: waterPath.distanceKm,
          labelA: first.label,
          labelB: label,
          connected: true,
          path: waterPath.path,
        });
      } else {
        onWaterTraceResultRef.current({
          distanceKm: 0,
          labelA: first.label,
          labelB: label,
          connected: false,
        });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Which region's data is currently loaded into borderDataRef/districtDataRef/
  // waterDataRef — null until the first region-data effect run completes.
  const loadedRegionRef = useRef<Region | null>(null);

  const redrawLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setupBorderLayer(map, borderDataRef.current ?? []);
    setupDistrictLayers(map, districtDataRef.current ?? [], hlDistrictsRef.current, showDistrictsRef.current);
    setupWaterLayers(map, waterDataRef.current ?? [], hlWaterRef.current, layerRef.current);
    setup3DBuildings(map);
    setupSatelliteLayer(map, satelliteMetaRef.current, showSatelliteRef.current);
    setupReliefLayer(map, region, showReliefRef.current, reliefRangeRef.current.min, reliefRangeRef.current.max);
    setupTerrainSource(map, region, showTerrainRef.current);
  }, [region]);

  // ── Init map ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    const initialView = REGION_VIEW[region];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLES.dark,
      center: initialView.center,
      zoom: initialView.zoom,
      maxZoom: 22,
      canvasContextAttributes: { antialias: true },
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    // Region data (border/districts/water/places) is loaded by the dedicated
    // [region, ready] effect below, once this map instance signals `ready`.

    map.on("load", () => {
      if (cancelled) return;
      layersInitRef.current = true;
      redrawLayers();
      setReady(true);
    });

    map.on("style.load", () => {
      if (cancelled || !layersInitRef.current) return;
      redrawLayers();
    });

    // Map click — water trace / measure mode / feature popup
    map.on("click", (e) => {
      const currentPlaces = placesCacheMap.get(regionRef.current);
      // ── Water trace mode — highest priority ───────────────────────────────
      if (isWaterTraceRef.current) {
        if (suppressMapClickRef.current) { suppressMapClickRef.current = false; return; }
        const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        let label = `${coords[1].toFixed(3)}°N, ${coords[0].toFixed(3)}°E`;
        if (currentPlaces) {
          let nearest: Place | null = null;
          let nearestDist = 40;
          for (const place of currentPlaces) {
            const pt = map.project(place.coordinates as maplibregl.LngLatLike);
            const dx = e.point.x - pt.x, dy = e.point.y - pt.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < nearestDist) { nearestDist = d; nearest = place; }
          }
          if (nearest) { coords[0] = nearest.coordinates[0]; coords[1] = nearest.coordinates[1]; label = nearest.name; }
        }
        handleTracePoint(coords, label);
        return;
      }

      // ── Feature popup (when not measuring) ───────────────────────────────
      if (!isMeasureRef.current) {
        // Marker already handled this click — skip map-level handler
        if (suppressMapClickRef.current) {
          suppressMapClickRef.current = false;
          return;
        }
        popupRef.current?.remove();
        popupRef.current = null;

        // ── Priority: nearest place within 40px (skipped in water-only layer) ──
        if (currentPlaces && layerRef.current !== "water") {
          let nearest: Place | null = null;
          let nearestDist = 40;
          for (const place of currentPlaces) {
            const pt = map.project(place.coordinates as maplibregl.LngLatLike);
            const dx = e.point.x - pt.x, dy = e.point.y - pt.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < nearestDist) { nearestDist = d; nearest = place; }
          }
          if (nearest) {
            popupRef.current = new maplibregl.Popup({ closeButton: false, className: "edumap-popup", maxWidth: "200px", offset: 8 })
              .setLngLat(nearest.coordinates)
              .setHTML(placePopupHTML(nearest))
              .addTo(map);
            return;
          }
        }

        // ── Fallback: water object (priority) or district ─────────────────
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["districts-hit", "districts-fill", "water-lines-hit", "water-lines", "water-fills"],
        });

        if (!features.length) return;

        // Water beats district — find water feature first regardless of render order
        const waterFeat = features.find((f) =>
          f.layer?.id === "water-lines-hit" || f.layer?.id === "water-lines" || f.layer?.id === "water-fills",
        );

        if (waterFeat) {
          const props = waterFeat.properties ?? {};
          const id = props.id as string;
          const waterObj = waterDataRef.current?.find((o) => o.id === id);
          if (waterObj) {
            onWaterClickRef.current(waterObj);
            return;
          }
          // Fallback popup if object not in cache yet
          const name = (props.name as string) || "Водный объект";
          const kind = props.kind as string;
          const kindLabel = kind === "river" ? "🏞 Река" : kind === "lake" ? "💧 Озеро" : "🌊 Водохранилище";
          const postsOnObj = hydropostsFor(regionRef.current).filter((p) => p.waterBody === name);
          popupRef.current = new maplibregl.Popup({ closeButton: false, className: "edumap-popup", maxWidth: "240px", offset: 8 })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-weight:600;color:#e6edf3;font-size:13px;margin-bottom:4px">${name}</div>
              <div style="font-size:11px;color:#3b82f6;margin-bottom:${postsOnObj.length ? 5 : 0}px">${kindLabel}</div>
              ${postsOnObj.length ? `<div style="font-size:11px;color:#8b949e">${postsOnObj.length} гидропостов</div>` : ""}`)
            .addTo(map);
          return;
        }

        // District popup
        const distFeat = features.find((f) =>
          f.layer?.id === "districts-fill" || f.layer?.id === "districts-hit",
        );
        if (distFeat) {
          const props = distFeat.properties ?? {};
          const name = props.name as string;
          const posts = hydropostsFor(regionRef.current).filter((p) => p.district === name);
          const danger = posts.filter((p) => p.status === "danger").length;
          const warning = posts.filter((p) => p.status === "warning").length;
          const normal = posts.length - danger - warning;
          popupRef.current = new maplibregl.Popup({ closeButton: false, className: "edumap-popup", maxWidth: "240px", offset: 8 })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-weight:600;color:#e6edf3;font-size:13px;margin-bottom:6px">${name}</div>
              <div style="font-size:12px;color:#8b949e;margin-bottom:4px">${posts.length} гидропостов</div>
              <div style="display:flex;gap:8px;font-size:11px">
                ${normal ? `<span style="color:#22c55e">✓ ${normal} норма</span>` : ""}
                ${warning ? `<span style="color:#f59e0b">⚠ ${warning} внимание</span>` : ""}
                ${danger ? `<span style="color:#ef4444">⛔ ${danger} опасно</span>` : ""}
              </div>`)
            .addTo(map);
        }
        return;
      }

      // ── Measure mode — straight-line distance between two arbitrary points ──
      const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      if (!measureFirstRef.current) {
        // Clear previous measurement visuals before starting a new one
        measureMarkerRefs.current.forEach((m) => m.remove());
        measureMarkerRefs.current = [];
        clearMeasureLine(map);

        measureFirstRef.current = coords;
        setMeasureStep(1);
        measureMarkerRefs.current.push(
          new maplibregl.Marker({ element: makeMeasureEl("#22d3ee"), anchor: "center" })
            .setLngLat(coords)
            .addTo(map),
        );
      } else {
        const first = measureFirstRef.current;
        measureFirstRef.current = null;

        measureMarkerRefs.current.push(
          new maplibregl.Marker({ element: makeMeasureEl("#f97316"), anchor: "center" })
            .setLngLat(coords)
            .addTo(map),
        );

        const distKm = haversineKm(first, coords);

        // Draw dashed ruler line between the two points
        drawMeasureLine(map, first, coords);

        // Distance label at midpoint
        const mid: [number, number] = [(first[0] + coords[0]) / 2, (first[1] + coords[1]) / 2];
        const labelEl = document.createElement("div");
        labelEl.style.cssText =
          "background:rgba(13,17,23,0.9);color:#22d3ee;border:1px solid rgba(34,211,238,0.3);" +
          "border-radius:6px;padding:3px 8px;font-size:12px;font-weight:700;" +
          "white-space:nowrap;pointer-events:none;backdrop-filter:blur(4px);";
        labelEl.textContent = `${distKm.toFixed(2)} км`;
        measureJustCompletedRef.current = true;
        measureMarkerRefs.current.push(
          new maplibregl.Marker({ element: labelEl, anchor: "center" }).setLngLat(mid).addTo(map),
        );

        onMeasureResultRef.current({ status: "success", objectName: "Прямая линия", distanceKm: distKm });
      }
    });

    return () => {
      cancelled = true;
      layersInitRef.current = false;
      loadedRegionRef.current = null;
      [markerRefs, suggestedRefs, measureMarkerRefs, traceMeasureMarkersRef, placeRefs, hlPlaceRefs].forEach((r) => {
        r.current.forEach((m) => m.remove());
        r.current = [];
      });
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Region data (border/districts/water) — loads on first ready, reloads on
  // region switch and re-centers the map to the new region's default view ──────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let cancelled = false;
    const isInitialLoad = loadedRegionRef.current === null;

    fetchPlaces(region);
    Promise.all([fetchBorder(region), fetchDistricts(region), fetchWaterObjects(region)]).then(
      ([border, districts, water]) => {
        if (cancelled || regionRef.current !== region) return;
        borderDataRef.current = border;
        districtDataRef.current = districts;
        waterDataRef.current = water;
        const polylines = water.filter(
          (o): o is PolylineWaterObject => o.geometry === "polyline" && (o.coordinates as [number, number][]).length >= 2,
        );
        renderedPolylinesRef.current = polylines;
        // Pre-build routing graph once per region (O(n) with spatial hash, ~100ms for 150k coords)
        if (!graphCacheMap.has(region)) graphCacheMap.set(region, buildGraph(polylines));
        redrawLayers();
        if (!isInitialLoad) {
          const view = REGION_VIEW[region];
          map.easeTo({ center: view.center, zoom: view.zoom });
        }
        loadedRegionRef.current = region;
      },
    );

    return () => { cancelled = true; };
  }, [region, ready, redrawLayers]);

  // ── Hydropost markers ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    markerRefs.current.forEach((m) => m.remove());
    markerRefs.current = [];

    const regionPosts = hydropostsFor(region);

    if (showHydroposts) {
      markerRefs.current = regionPosts.map((post) => {
        const active = post.code === activePostCode;
        const highlighted = highlightedPostCodes.includes(post.code);
        const handleClick = () => {
          if (isWaterTraceRef.current) {
            suppressMapClickRef.current = true; // block map click that fires after this
            handleTracePoint(post.coordinates, post.label);
            return;
          }
          suppressMapClickRef.current = true;
          onPostClick(post.code);
          popupRef.current?.remove();
          popupRef.current = new maplibregl.Popup({ closeButton: false, className: "edumap-popup", maxWidth: "240px", offset: 14 })
            .setLngLat(post.coordinates)
            .setHTML(postPopupHTML(post))
            .addTo(map);
        };
        return new maplibregl.Marker({ element: makeMarkerEl(post, active, highlighted, handleClick), anchor: "center" })
          .setLngLat(post.coordinates)
          .addTo(map);
      });
    }

    if (highlightedPostCodes.length > 1) {
      const hPosts = regionPosts.filter((p) => highlightedPostCodes.includes(p.code));
      const fit = fitPosts(hPosts);
      if (fit) map.easeTo({ center: fit.center as [number, number], zoom: fit.zoom });
    } else if (highlightedPostCodes.length === 1) {
      const post = regionPosts.find((p) => p.code === highlightedPostCodes[0]);
      if (post) map.easeTo({ center: post.coordinates as [number, number], zoom: 10 });
    } else if (activePostCode !== null) {
      const post = regionPosts.find((p) => p.code === activePostCode);
      if (post) map.easeTo({ center: post.coordinates as [number, number] });
    }
  }, [activePostCode, highlightedPostCodes, onPostClick, ready, showHydroposts, region]);

  // ── Water layer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    setupWaterLayers(map, waterDataRef.current ?? [], highlightedWaterIds, layer);
    // Refresh rendered polylines list
    if (waterDataRef.current) {
      renderedPolylinesRef.current = waterDataRef.current.filter(
        (o): o is PolylineWaterObject => o.geometry === "polyline" && (o.coordinates as [number, number][]).length >= 2,
      );
    }
  }, [highlightedWaterIds, layer, ready]);

  // ── Sentinel satellite overlay ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    showSatelliteRef.current = showSatellite;

    if (!showSatellite) {
      setupSatelliteLayer(map, satelliteMetaRef.current, false);
      return;
    }

    if (satelliteMetaRef.current) {
      setupSatelliteLayer(map, satelliteMetaRef.current, true);
      return;
    }

    let cancelled = false;
    setSatelliteLoading(true);
    setSatelliteError(null);
    fetch("/api/satellite")
      .then((r) => r.json())
      .then((data: { bbox?: [number, number, number, number]; imageUrl?: string; fetchedAt?: number; error?: string }) => {
        if (cancelled) return;
        if (data.error || !data.bbox || !data.imageUrl) {
          setSatelliteError(data.error ?? "Не удалось загрузить снимок");
          setShowSatellite(false);
          return;
        }
        satelliteMetaRef.current = { bbox: data.bbox, imageUrl: data.imageUrl };
        setSatelliteDate(data.fetchedAt ?? null);
        if (mapRef.current) setupSatelliteLayer(mapRef.current, satelliteMetaRef.current, true);
      })
      .catch(() => {
        if (cancelled) return;
        setSatelliteError("Не удалось загрузить снимок");
        setShowSatellite(false);
      })
      .finally(() => {
        if (!cancelled) setSatelliteLoading(false);
      });

    return () => { cancelled = true; };
  }, [showSatellite, ready]);

  // ── 3D terrain ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    showTerrainRef.current = showTerrain;
    setupTerrainSource(map, region, showTerrain);
    // Flat top-down view hides elevation entirely — tilt in/out so the effect is visible.
    map.easeTo({ pitch: showTerrain ? 60 : 0, duration: 600 });
  }, [showTerrain, ready, region]);

  // ── Hypsometric tint (color-by-elevation) — rescales to the current viewport,
  // same idea as topographic-map.com: re-fetch the real min/max for whatever's
  // on screen after each pan/zoom (debounced) and re-tint via setTiles(),
  // instead of one fixed range for the whole region. ─────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    showReliefRef.current = showRelief;
    setupReliefLayer(map, region, showRelief, reliefRangeRef.current.min, reliefRangeRef.current.max);
    if (!showRelief) return;

    let cancelled = false;

    function refreshStats() {
      const m = mapRef.current;
      if (!m) return;
      const b = m.getBounds();
      const zoom = Math.round(m.getZoom());
      const bbox = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
      fetch(`/api/relief/stats?region=${region}&bbox=${encodeURIComponent(bbox)}&zoom=${zoom}`)
        .then((r) => r.json())
        .then((data: { min?: number; max?: number }) => {
          if (cancelled || !mapRef.current) return;
          if (typeof data.min !== "number" || typeof data.max !== "number") return;
          reliefRangeRef.current = { min: data.min, max: data.max };
          setReliefRange({ min: data.min, max: data.max });
          const src = mapRef.current.getSource("relief-src") as maplibregl.RasterTileSource | undefined;
          src?.setTiles([reliefTileUrl(region, data.min, data.max)]);
        })
        .catch(() => {});
    }

    refreshStats();

    function onMoveEnd() {
      if (reliefDebounceRef.current) clearTimeout(reliefDebounceRef.current);
      reliefDebounceRef.current = setTimeout(refreshStats, 400);
    }
    map.on("moveend", onMoveEnd);

    return () => {
      cancelled = true;
      map.off("moveend", onMoveEnd);
      if (reliefDebounceRef.current) clearTimeout(reliefDebounceRef.current);
    };
  }, [showRelief, ready, region]);

  // ── Districts layer ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    // Toggle visibility (keep hit layer always on for click detection)
    ["districts-fill", "districts-line", "districts-labels"].forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", showDistricts ? "visible" : "none");
    });
    // districts-hit stays always visible (for queryRenderedFeatures)
    showDistrictsRef.current = showDistricts;
  }, [showDistricts, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    hlDistrictsRef.current = highlightedDistricts;
    updateDistrictPaint(map, highlightedDistricts);

    if (!highlightedDistricts.length) return;

    // Auto-zoom
    const districtPosts = hydropostsFor(region).filter((p) => highlightedDistricts.includes(p.district));
    if (districtPosts.length > 0) {
      const fit = fitPosts(districtPosts);
      if (fit) map.easeTo({ center: fit.center as [number, number], zoom: fit.zoom });
    } else if (districtDataRef.current) {
      const target = districtDataRef.current.find((d) => highlightedDistricts.includes(d.properties.name));
      if (target) {
        const groups: [number, number][][][] =
          target.geometry.type === "Polygon"
            ? [target.geometry.coordinates as [number, number][][]]
            : (target.geometry.coordinates as unknown as [number, number][][][]);
        const firstOuter = groups[0]?.[0];
        if (firstOuter) map.easeTo({ center: ringCentroid(firstOuter), zoom: 9 });
      }
    }
  }, [highlightedDistricts, ready, region]);

  // ── Suggested placements ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    suggestedRefs.current.forEach((m) => m.remove());
    suggestedRefs.current = suggestedPlacements.map((p) => {
      const el = document.createElement("div");
      el.style.cssText = `width:10px;height:10px;border-radius:50%;background:#a78bfa;border:2px solid rgba(167,139,250,0.5);box-shadow:0 0 8px #a78bfa99;`;
      return new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(p.coordinates).addTo(map);
    });
  }, [suggestedPlacements, ready]);

  // ── Highlighted places ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    hlPlaceRefs.current.forEach((m) => m.remove());
    hlPlaceRefs.current = [];
    if (!highlightedPlaceIds.length) return;

    fetchPlaces(region).then((places) => {
      if (!mapRef.current) return;
      hlPlaceRefs.current = places
        .filter((p) => highlightedPlaceIds.includes(p.id))
        .map((place) => {
          const el = document.createElement("div");
          el.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none;";
          const label = document.createElement("span");
          label.textContent = place.name;
          label.style.cssText = `font-size:12px;font-weight:700;color:#fff;background:#f97316;padding:3px 8px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 8px rgba(249,115,22,0.6);`;
          const pin = document.createElement("span");
          pin.style.cssText = `width:10px;height:10px;border-radius:50%;background:#f97316;border:2px solid #fff;box-shadow:0 0 10px #f97316;`;
          el.appendChild(label);
          el.appendChild(pin);
          return new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(place.coordinates).addTo(mapRef.current!);
        });
    });
  }, [highlightedPlaceIds, ready, region]);

  // ── Places layer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    placeRefs.current.forEach((m) => m.remove());
    placeRefs.current = [];
    if (!showPlaces) return;

    fetchPlaces(region).then((places) => {
      if (!mapRef.current) return;
      placeRefs.current = places.map((place) => {
        const isCapital = place.kind === "national_capital";
        const isCity = place.kind === "city";
        const isTown = place.kind === "town";
        const isVillage = place.kind === "village" || place.kind === "suburb";

        const el = document.createElement("div");
        el.style.cssText = "pointer-events:auto;cursor:pointer;";

        // Click → popup for ALL place types (or water trace point in trace mode)
        el.addEventListener("click", () => {
          if (layerRef.current === "water") return; // water-only layer: settlements not clickable
          if (isWaterTraceRef.current) {
            suppressMapClickRef.current = true;
            handleTracePoint(place.coordinates, place.name);
            return;
          }
          suppressMapClickRef.current = true;
          popupRef.current?.remove();
          popupRef.current = new maplibregl.Popup({
            closeButton: false, className: "edumap-popup", maxWidth: "200px", offset: 10,
          })
            .setLngLat(place.coordinates)
            .setHTML(placePopupHTML(place))
            .addTo(mapRef.current!);
        });

        if (isCapital || isCity || isTown) {
          el.style.cssText += "display:flex;align-items:center;gap:5px;";
          const dotSize = isCapital ? 11 : isCity ? 9 : 7;
          const dotColor = isCapital ? "#f97316" : isCity ? "#f59e0b" : "#94a3b8";
          const fontSize = isCapital ? 13 : isCity ? 12 : 10;
          const dot = document.createElement("span");
          dot.style.cssText = `width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:${dotColor};border:2px solid rgba(255,255,255,0.85);box-shadow:0 1px 4px rgba(0,0,0,0.5);flex-shrink:0;pointer-events:none;`;
          const label = document.createElement("span");
          label.textContent = place.name;
          label.style.cssText = `font-size:${fontSize}px;font-weight:${isCapital || isCity ? 700 : 500};color:#fff;background:rgba(0,0,0,0.55);padding:1px 5px;border-radius:4px;white-space:nowrap;backdrop-filter:blur(2px);pointer-events:none;`;
          el.appendChild(dot);
          el.appendChild(label);
        } else if (isVillage) {
          const dot = document.createElement("span");
          dot.style.cssText = `display:block;width:6px;height:6px;border-radius:50%;background:rgba(203,213,225,0.75);border:1px solid rgba(255,255,255,0.5);box-shadow:0 1px 3px rgba(0,0,0,0.4);pointer-events:none;`;
          el.appendChild(dot);
        }

        return new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(place.coordinates).addTo(mapRef.current!);
      });
    });
  }, [showPlaces, ready, region]);

  // ── Style toggle — cycles dark → bright → real satellite imagery ───────────────
  function handleStyleToggle() {
    const next = STYLE_ORDER[(STYLE_ORDER.indexOf(mapStyle) + 1) % STYLE_ORDER.length];
    setMapStyle(next);
    mapRef.current?.setStyle(MAP_STYLES[next]);
  }

  return (
    <div style={styles.wrapper}>
      <div
        ref={containerRef}
        style={{ ...styles.canvas, cursor: (isMeasureMode || isWaterTraceMode) ? "crosshair" : "default" }}
      />

      {/* Layer switcher */}
      <div style={styles.layerBar}>
        <button
          onClick={() => onLayerChange(layer === "water" ? "all" : "water")}
          style={{
            ...styles.layerBtn,
            background: layer === "water" ? "#22c55e" : "rgba(13,17,23,0.82)",
            color: layer === "water" ? "#fff" : "#8b949e",
            borderColor: layer === "water" ? "#22c55e" : "rgba(255,255,255,0.08)",
          }}
        >
          Водные объекты
        </button>
        <button
          onClick={onToggleHydroposts}
          style={{
            ...styles.layerBtn,
            background: showHydroposts ? "#22c55e" : "rgba(13,17,23,0.82)",
            color: showHydroposts ? "#fff" : "#8b949e",
            borderColor: showHydroposts ? "#22c55e" : "rgba(255,255,255,0.08)",
          }}
        >
          Гидропосты
        </button>
        <button
          onClick={onTogglePlaces}
          style={{
            ...styles.layerBtn,
            background: showPlaces ? "#f59e0b" : "rgba(13,17,23,0.82)",
            color: showPlaces ? "#fff" : "#8b949e",
            borderColor: showPlaces ? "#f59e0b" : "rgba(255,255,255,0.08)",
          }}
        >
          Нас. пункты
        </button>
        <button
          onClick={onToggleDistricts}
          style={{
            ...styles.layerBtn,
            background: showDistricts ? "#a78bfa" : "rgba(13,17,23,0.82)",
            color: showDistricts ? "#fff" : "#8b949e",
            borderColor: showDistricts ? "#a78bfa" : "rgba(255,255,255,0.08)",
          }}
        >
          Районы
        </button>
        <button
          onClick={handleStyleToggle}
          style={{
            ...styles.layerBtn,
            background: mapStyle === "imagery" ? "#0ea5e9" : "rgba(13,17,23,0.82)",
            color: mapStyle === "imagery" ? "#fff" : "#8b949e",
            borderColor: mapStyle === "imagery" ? "#0ea5e9" : "rgba(255,255,255,0.08)",
          }}
        >
          {STYLE_LABEL[mapStyle]}
        </button>
        <button
          onClick={() => setShowTerrain((v) => !v)}
          style={{
            ...styles.layerBtn,
            background: showTerrain ? "#8b5cf6" : "rgba(13,17,23,0.82)",
            color: showTerrain ? "#fff" : "#8b949e",
            borderColor: showTerrain ? "#8b5cf6" : "rgba(255,255,255,0.08)",
          }}
        >
          ⛰ 3D
        </button>
        <button
          onClick={() => setShowRelief((v) => !v)}
          style={{
            ...styles.layerBtn,
            background: showRelief ? "#16a34a" : "rgba(13,17,23,0.82)",
            color: showRelief ? "#fff" : "#8b949e",
            borderColor: showRelief ? "#16a34a" : "rgba(255,255,255,0.08)",
          }}
        >
          🎨 Топография
        </button>
      </div>

      {/* Elevation color legend — vertical scale on the right, rescales with the view */}
      {showRelief && (
        <div style={styles.reliefLegend}>
          <div style={styles.reliefLegendTitle}>Высота, м</div>
          <div style={styles.reliefLegendRow}>
            <div style={styles.reliefLegendBar}>
              {[...RELIEF_RELATIVE_STOPS].reverse().map((stop) => (
                <div key={stop.t} style={{ flex: 1, background: stop.color }} />
              ))}
            </div>
            <div style={styles.reliefLegendLabels}>
              {[...RELIEF_RELATIVE_STOPS].reverse().map((stop) => (
                <span key={stop.t}>
                  {Math.round(reliefRange.min + stop.t * (reliefRange.max - reliefRange.min))}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Satellite overlay status/error */}
      {showSatellite && satelliteDate && (
        <div style={styles.satelliteHint}>
          Снимок Sentinel-2 от {new Date(satelliteDate).toLocaleDateString("ru-RU")}
        </div>
      )}
      {satelliteError && (
        <div style={{ ...styles.satelliteHint, color: "#ef4444", borderColor: "#ef444440" }}>
          {satelliteError}
        </div>
      )}

      {/* Measure hint */}
      {isMeasureMode && (
        <div style={styles.measureHint}>
          {measureStep === 1 ? "Теперь кликни вторую точку" : "Кликни первую точку — расстояние по прямой"}
        </div>
      )}

      {/* Water trace hint */}
      {isWaterTraceMode && (
        <div style={traceMsg ? styles.traceHintError : styles.traceHint}>
          {traceMsg ?? (traceStep === 1
            ? "Теперь кликни вторую точку — гидропост, нас. пункт или место на реке"
            : "Кликни первую точку — гидропост, населённый пункт или место на реке")}
        </div>
      )}

      {/* Zoom buttons — visible during water trace mode so user can navigate without leaving trace */}
      {isWaterTraceMode && (
        <div style={styles.zoomBtns}>
          <button
            style={styles.zoomBtn}
            onClick={() => mapRef.current?.zoomIn()}
            title="Приблизить"
          >+</button>
          <button
            style={styles.zoomBtn}
            onClick={() => mapRef.current?.zoomOut()}
            title="Отдалить"
          >−</button>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  wrapper: { flex: 1, position: "relative" as const, overflow: "hidden" },
  canvas: { width: "100%", height: "100%" },
  fallback: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
    background: "#0d1117", color: "#8b949e", fontSize: 14, padding: 24, textAlign: "center" as const,
  },
  layerBar: { position: "absolute" as const, top: 12, left: 12, display: "flex", gap: 6, zIndex: 10 },
  measureHint: {
    position: "absolute" as const, bottom: 16, left: "50%", transform: "translateX(-50%)",
    background: "rgba(13,17,23,0.9)", color: "#22d3ee", border: "1px solid #22d3ee40",
    borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 500,
    backdropFilter: "blur(6px)", zIndex: 10, pointerEvents: "none" as const,
  },
  traceHint: {
    position: "absolute" as const, bottom: 52, left: "50%", transform: "translateX(-50%)",
    background: "rgba(13,17,23,0.9)", color: "#60a5fa", border: "1px solid #60a5fa40",
    borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 500,
    backdropFilter: "blur(6px)", zIndex: 10, pointerEvents: "none" as const,
    whiteSpace: "nowrap" as const, maxWidth: "90%", textAlign: "center" as const,
  },
  traceHintError: {
    position: "absolute" as const, bottom: 52, left: "50%", transform: "translateX(-50%)",
    background: "rgba(13,17,23,0.9)", color: "#ef4444", border: "1px solid #ef444440",
    borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 500,
    backdropFilter: "blur(6px)", zIndex: 10, pointerEvents: "none" as const,
    maxWidth: "90%", textAlign: "center" as const,
  },
  satelliteHint: {
    position: "absolute" as const, top: 56, left: 12,
    background: "rgba(13,17,23,0.9)", color: "#22d3ee", border: "1px solid #22d3ee40",
    borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 500,
    backdropFilter: "blur(6px)", zIndex: 10, pointerEvents: "none" as const,
  },
  layerBtn: {
    padding: "6px 14px", borderRadius: 8, border: "1px solid", cursor: "pointer",
    fontSize: 13, fontWeight: 500, backdropFilter: "blur(6px)", transition: "all 0.15s",
  },
  reliefLegend: {
    position: "absolute" as const, top: "50%", right: 12, transform: "translateY(-50%)",
    background: "rgba(13,17,23,0.9)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "10px 10px 12px", backdropFilter: "blur(6px)", zIndex: 10,
  },
  reliefLegendTitle: {
    fontSize: 11, color: "#8b949e", textAlign: "center" as const, marginBottom: 6,
  },
  reliefLegendRow: { display: "flex", gap: 6, alignItems: "stretch" },
  reliefLegendBar: {
    width: 14, height: 180, borderRadius: 4, overflow: "hidden",
    display: "flex", flexDirection: "column" as const, border: "1px solid rgba(255,255,255,0.15)",
  },
  reliefLegendLabels: {
    height: 180, display: "flex", flexDirection: "column" as const, justifyContent: "space-between",
    fontSize: 10, color: "#c9d1d9", fontVariantNumeric: "tabular-nums" as const,
  },
  zoomBtns: {
    position: "absolute" as const, bottom: 96, right: 12,
    display: "flex", flexDirection: "column" as const, gap: 4, zIndex: 10,
  },
  zoomBtn: {
    width: 36, height: 36, borderRadius: 8, border: "1px solid rgba(96,165,250,0.4)",
    background: "rgba(13,17,23,0.88)", color: "#60a5fa", fontSize: 22, fontWeight: 400,
    cursor: "pointer", backdropFilter: "blur(6px)", lineHeight: "1",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
  },
} as const;

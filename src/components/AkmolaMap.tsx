"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { hydroposts, type Hydropost } from "@/lib/akmolaMapData";
import type { Layer, Place, SuggestedPlacement, WaterObject } from "@/lib/types";
import {
  buildGraph,
  haversineKm,
  measureDistance,
  measureWaterPath,
  projectPointToPolyline,
  type MeasurePoint,
  type MeasureResult,
  type PolylineWaterObject,
  type WaterTraceResult,
} from "@/lib/measure";

// ── Map styles ────────────────────────────────────────────────────────────────

const MAP_STYLES = {
  dark: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
} as const;

type MapStyleKey = keyof typeof MAP_STYLES;

// ── Data fetchers (module-level cache) ────────────────────────────────────────

type DistrictFeature = {
  properties: { name: string };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: [number, number][][] | [number, number][][][];
  };
};

let waterCache: WaterObject[] | null = null;
let graphCache: ReturnType<typeof buildGraph> | null = null;
let waterLoadPromise: Promise<WaterObject[]> | null = null;
let placesCache: Place[] | null = null;
let districtsCache: DistrictFeature[] | null = null;
let borderCache: [number, number][][] | null = null;

function fetchWaterObjects(): Promise<WaterObject[]> {
  if (waterCache) return Promise.resolve(waterCache);
  if (!waterLoadPromise) {
    waterLoadPromise = Promise.all([
      fetch("/akmola-water-bodies.json").then((r) => r.json() as Promise<WaterObject[]>),
      fetch("/akmola-waterways.json").then((r) => r.json() as Promise<WaterObject[]>),
      fetch("/akmola-hydro-rivers.json")
        .then((r) => r.json() as Promise<WaterObject[]>)
        .catch(() => [] as WaterObject[]),
    ]).then(([bodies, ways, rivers]) => {
      waterCache = [...bodies, ...ways, ...rivers];
      return waterCache;
    });
  }
  return waterLoadPromise;
}

function fetchPlaces(): Promise<Place[]> {
  if (placesCache) return Promise.resolve(placesCache);
  return fetch("/akmola-places.json")
    .then((r) => r.json() as Promise<Place[]>)
    .then((d) => { placesCache = d; return d; })
    .catch(() => []);
}

function fetchDistricts(): Promise<DistrictFeature[]> {
  if (districtsCache) return Promise.resolve(districtsCache);
  return fetch("/akmola-districts.geojson")
    .then((r) => r.json())
    .then((d) => { districtsCache = d?.features ?? []; return districtsCache!; })
    .catch(() => []);
}

function fetchBorder(): Promise<[number, number][][]> {
  if (borderCache) return Promise.resolve(borderCache);
  return fetch("/akmola-border.geojson")
    .then((r) => r.json())
    .then((d) => { borderCache = d?.features?.[0]?.geometry?.coordinates ?? []; return borderCache!; })
    .catch(() => []);
}

// ── Layer helpers (pure, no refs) ─────────────────────────────────────────────

function setupBorderLayer(map: mapboxgl.Map, rings: [number, number][][]) {
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
  if (!highlighted.length) return ["boolean", false] as mapboxgl.ExpressionSpecification;
  return ["in", ["get", "name"], ["literal", highlighted]] as mapboxgl.ExpressionSpecification;
}

function setupDistrictLayers(
  map: mapboxgl.Map,
  districts: DistrictFeature[],
  highlighted: string[],
  visible: boolean,
) {
  ["districts-labels", "districts-line", "districts-fill"].forEach((id) => {
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

function updateDistrictPaint(map: mapboxgl.Map, highlighted: string[]) {
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
  map: mapboxgl.Map,
  objects: WaterObject[],
  highlighted: string[],
  currentLayer: Layer,
) {
  ["water-fills", "water-lines", "water-lines-hit"].forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
  ["water-fills-src", "water-lines-src", "water-lines-hit-src"].forEach((id) => { if (map.getSource(id)) map.removeSource(id); });

  // Always render water so clicks work in any layer mode.
  // In hydroposts-only mode, reduce opacity so water is subtle but clickable.
  const dim = currentLayer === "hydroposts";

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

function drawTracePath(map: mapboxgl.Map, path: [number, number][]) {
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

function clearTracePath(map: mapboxgl.Map) {
  if (map.getLayer("trace-path")) map.removeLayer("trace-path");
  if (map.getSource("trace-path-src")) map.removeSource("trace-path-src");
}

function drawMeasureLine(map: mapboxgl.Map, from: [number, number], to: [number, number]) {
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

function clearMeasureLine(map: mapboxgl.Map) {
  if (map.getLayer("measure-line")) map.removeLayer("measure-line");
  if (map.getSource("measure-line-src")) map.removeSource("measure-line-src");
}

function setup3DBuildings(map: mapboxgl.Map) {
  if (map.getLayer("3d-buildings")) map.removeLayer("3d-buildings");
  try {
    map.addLayer({
      id: "3d-buildings",
      source: "composite",
      "source-layer": "building",
      filter: ["==", "extrude", "true"],
      type: "fill-extrusion",
      minzoom: 15,
      paint: {
        "fill-extrusion-color": "#334455",
        "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.05, ["get", "height"]],
        "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.05, ["get", "min_height"]],
        "fill-extrusion-opacity": 0.75,
      },
    });
  } catch {
    // composite source may not exist on some tile sets
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
  return `
    <div style="font-weight:600;color:#e6edf3;font-size:13px;margin-bottom:3px">${post.label}</div>
    <div style="font-size:11px;color:#60a5fa;margin-bottom:1px">${post.waterBody}</div>
    <div style="font-size:11px;color:#6e7681;margin-bottom:6px">${post.district}</div>
    <div style="font-size:13px;font-weight:600;color:${sc}">${post.waterLevel} см <span style="font-size:10px;font-weight:400;opacity:0.75">${sl}</span></div>`;
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

const LAYERS: { value: Layer; label: string }[] = [
  { value: "all", label: "Все слои" },
  { value: "hydroposts", label: "Гидропосты" },
  { value: "water", label: "Водные объекты" },
];

type TracePoint = {
  coords: [number, number];
  label: string;
  obj: PolylineWaterObject;
  proj: NonNullable<ReturnType<typeof projectPointToPolyline>>;
};

type Props = {
  activePostCode: number | null;
  highlightedPostCodes: number[];
  highlightedWaterIds: string[];
  highlightedPlaceIds: string[];
  highlightedDistricts: string[];
  suggestedPlacements: SuggestedPlacement[];
  layer: Layer;
  showPlaces: boolean;
  showDistricts: boolean;
  isMeasureMode: boolean;
  isWaterTraceMode: boolean;
  onPostClick: (code: number) => void;
  onWaterClick: (water: WaterObject) => void;
  onLayerChange: (layer: Layer) => void;
  onTogglePlaces: () => void;
  onToggleDistricts: () => void;
  onMeasureResult: (result: MeasureResult) => void;
  onWaterTraceResult: (result: WaterTraceResult) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AkmolaMap({
  activePostCode,
  highlightedPostCodes,
  highlightedWaterIds,
  highlightedPlaceIds,
  highlightedDistricts,
  suggestedPlacements,
  layer,
  showPlaces,
  showDistricts,
  isMeasureMode,
  isWaterTraceMode,
  onPostClick,
  onWaterClick,
  onLayerChange,
  onTogglePlaces,
  onToggleDistricts,
  onMeasureResult,
  onWaterTraceResult,
}: Props) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const suppressMapClickRef = useRef(false); // prevents map click after marker click

  // Marker instances (survive style changes automatically)
  const markerRefs = useRef<mapboxgl.Marker[]>([]);
  const suggestedRefs = useRef<mapboxgl.Marker[]>([]);
  const measureMarkerRefs = useRef<mapboxgl.Marker[]>([]);
  const placeRefs = useRef<mapboxgl.Marker[]>([]);
  const hlPlaceRefs = useRef<mapboxgl.Marker[]>([]);

  // Cached data from fetch
  const borderDataRef = useRef<[number, number][][] | null>(null);
  const districtDataRef = useRef<DistrictFeature[] | null>(null);
  const waterDataRef = useRef<WaterObject[] | null>(null);

  // Current prop values as refs (for style.load handler)
  const layerRef = useRef(layer);
  const hlWaterRef = useRef(highlightedWaterIds);
  const hlDistrictsRef = useRef(highlightedDistricts);
  const showDistrictsRef = useRef(showDistricts);

  // Measure
  const measureFirstRef = useRef<MeasurePoint | null>(null);
  const isMeasureRef = useRef(isMeasureMode);
  const onMeasureResultRef = useRef(onMeasureResult);
  const renderedPolylinesRef = useRef<PolylineWaterObject[]>([]);
  const [measureStep, setMeasureStep] = useState<0 | 1>(0);

  // Water trace
  const traceFirstRef = useRef<TracePoint | null>(null);
  const traceMeasureMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const isWaterTraceRef = useRef(isWaterTraceMode);
  const onWaterClickRef = useRef(onWaterClick);
  const onWaterTraceResultRef = useRef(onWaterTraceResult);
  const [traceStep, setTraceStep] = useState<0 | 1>(0);

  const [ready, setReady] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyleKey>("dark");
  const layersInitRef = useRef(false);

  // Sync refs
  useEffect(() => { isMeasureRef.current = isMeasureMode; }, [isMeasureMode]);
  useEffect(() => { onMeasureResultRef.current = onMeasureResult; }, [onMeasureResult]);
  useEffect(() => { layerRef.current = layer; }, [layer]);
  useEffect(() => { hlWaterRef.current = highlightedWaterIds; }, [highlightedWaterIds]);
  useEffect(() => { hlDistrictsRef.current = highlightedDistricts; }, [highlightedDistricts]);
  useEffect(() => { showDistrictsRef.current = showDistricts; }, [showDistricts]);
  useEffect(() => { isWaterTraceRef.current = isWaterTraceMode; }, [isWaterTraceMode]);
  useEffect(() => { onWaterClickRef.current = onWaterClick; }, [onWaterClick]);
  useEffect(() => { onWaterTraceResultRef.current = onWaterTraceResult; }, [onWaterTraceResult]);

  // Measure cleanup — only reset state; markers/line kept until next measurement starts
  useEffect(() => {
    if (!isMeasureMode) {
      measureFirstRef.current = null;
      setMeasureStep(0);
    }
  }, [isMeasureMode]);

  // Water trace cleanup — only state; markers kept visible until next session starts
  useEffect(() => {
    if (!isWaterTraceMode) {
      traceFirstRef.current = null;
      setTraceStep(0);
    }
  }, [isWaterTraceMode]);

  // handleTracePoint defined at component level so it can be called directly from
  // marker/place click handlers (avoids ref indirection that could silently fail).
  // Uses mapRef.current instead of a closed-over map variable.
  const handleTracePoint = useCallback((coords: [number, number], label: string) => {
    const map = mapRef.current;
    if (!map) return;
    let best: { obj: PolylineWaterObject; proj: NonNullable<ReturnType<typeof projectPointToPolyline>> } | null = null;
    let bestDist = Infinity;
    for (const obj of renderedPolylinesRef.current) {
      const proj = projectPointToPolyline(obj.coordinates, coords);
      if (!proj) continue;
      const d = haversineKm(coords, proj.projected);
      if (d < bestDist) { bestDist = d; best = { obj, proj }; }
    }
    if (!best) return;
    const snapped = best.proj.projected;
    if (!traceFirstRef.current) {
      // Clear markers and path from any previous trace session
      traceMeasureMarkersRef.current.forEach((m) => m.remove());
      traceMeasureMarkersRef.current = [];
      clearTracePath(map);
      traceFirstRef.current = { coords: snapped, label, obj: best.obj, proj: best.proj };
      setTraceStep(1);
      traceMeasureMarkersRef.current.push(
        new mapboxgl.Marker({ element: makeMeasureEl("#22d3ee"), anchor: "center" }).setLngLat(snapped).addTo(map),
      );
    } else {
      const first = traceFirstRef.current;
      traceFirstRef.current = null;
      traceMeasureMarkersRef.current.push(
        new mapboxgl.Marker({ element: makeMeasureEl("#f97316"), anchor: "center" }).setLngLat(snapped).addTo(map),
      );
      // Try to find connected water path via graph; show route if found
      const waterPath = graphCache
        ? measureWaterPath(graphCache, first.obj, first.proj, best.obj, best.proj)
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

  // ── Init map ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !containerRef.current) return;
    let cancelled = false;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLES.dark,
      center: [70.45, 52.25] as [number, number],
      zoom: 7.1,
      maxZoom: 22,
      antialias: true,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    // Preload places into cache so click proximity works even without places layer enabled
    fetchPlaces();

    // Fetch data — if map already loaded when data arrives, rebuild layers
    Promise.all([fetchBorder(), fetchDistricts(), fetchWaterObjects()]).then(([border, districts, water]) => {
      if (cancelled) return;
      borderDataRef.current = border;
      districtDataRef.current = districts;
      waterDataRef.current = water;
      const polylines = water.filter(
        (o): o is PolylineWaterObject => o.geometry === "polyline" && (o.coordinates as [number, number][]).length >= 2,
      );
      renderedPolylinesRef.current = polylines;
      // Pre-build routing graph once on data load (O(n) with spatial hash, ~100ms for 150k coords)
      if (!graphCache) graphCache = buildGraph(polylines);
      // Race condition fix: if map loaded before data arrived, rebuild now
      if (layersInitRef.current) redrawLayers();
    });

    function redrawLayers() {
      setupBorderLayer(map, borderDataRef.current ?? []);
      setupDistrictLayers(map, districtDataRef.current ?? [], hlDistrictsRef.current, showDistrictsRef.current);
      setupWaterLayers(map, waterDataRef.current ?? [], hlWaterRef.current, layerRef.current);
      setup3DBuildings(map);
    }

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
      // ── Water trace mode — highest priority ───────────────────────────────
      if (isWaterTraceRef.current) {
        if (suppressMapClickRef.current) { suppressMapClickRef.current = false; return; }
        const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        let label = `${coords[1].toFixed(3)}°N, ${coords[0].toFixed(3)}°E`;
        if (placesCache) {
          let nearest: Place | null = null;
          let nearestDist = 40;
          for (const place of placesCache) {
            const pt = map.project(place.coordinates as mapboxgl.LngLatLike);
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
        if (placesCache && layerRef.current !== "water") {
          let nearest: Place | null = null;
          let nearestDist = 40;
          for (const place of placesCache) {
            const pt = map.project(place.coordinates as mapboxgl.LngLatLike);
            const dx = e.point.x - pt.x, dy = e.point.y - pt.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < nearestDist) { nearestDist = d; nearest = place; }
          }
          if (nearest) {
            popupRef.current = new mapboxgl.Popup({ closeButton: false, className: "edumap-popup", maxWidth: "200px", offset: 8 })
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
          const postsOnObj = hydroposts.filter((p) => p.waterBody === name);
          popupRef.current = new mapboxgl.Popup({ closeButton: false, className: "edumap-popup", maxWidth: "240px", offset: 8 })
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
          const posts = hydroposts.filter((p) => p.district === name);
          const danger = posts.filter((p) => p.status === "danger").length;
          const warning = posts.filter((p) => p.status === "warning").length;
          const normal = posts.length - danger - warning;
          popupRef.current = new mapboxgl.Popup({ closeButton: false, className: "edumap-popup", maxWidth: "240px", offset: 8 })
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

      // ── Measure mode ──────────────────────────────────────────────────────
      const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      let best: { obj: PolylineWaterObject; proj: NonNullable<ReturnType<typeof projectPointToPolyline>> } | null = null;
      let bestDist = 5; // 5 km threshold
      for (const obj of renderedPolylinesRef.current) {
        const proj = projectPointToPolyline(obj.coordinates, coords);
        if (!proj) continue;
        const dist = haversineKm(coords, proj.projected);
        if (dist < bestDist) { bestDist = dist; best = { obj, proj }; }
      }
      if (!best) return;

      const snapped = best.proj.projected;

      if (!measureFirstRef.current) {
        // Clear previous measurement visuals before starting a new one
        measureMarkerRefs.current.forEach((m) => m.remove());
        measureMarkerRefs.current = [];
        clearMeasureLine(map);

        measureFirstRef.current = { objectId: best.obj.id, coordinates: snapped };
        setMeasureStep(1);
        measureMarkerRefs.current.push(
          new mapboxgl.Marker({ element: makeMeasureEl("#22d3ee"), anchor: "center" })
            .setLngLat(snapped)
            .addTo(map),
        );
      } else {
        const first = measureFirstRef.current;
        measureFirstRef.current = null;
        const firstObj = renderedPolylinesRef.current.find((p) => p.id === first.objectId);
        if (!firstObj) { onMeasureResultRef.current({ status: "error", message: "Первая точка не найдена." }); return; }
        const firstProj = projectPointToPolyline(firstObj.coordinates, first.coordinates);
        if (!firstProj) { onMeasureResultRef.current({ status: "error", message: "Ошибка проекции." }); return; }

        measureMarkerRefs.current.push(
          new mapboxgl.Marker({ element: makeMeasureEl("#f97316"), anchor: "center" })
            .setLngLat(snapped)
            .addTo(map),
        );

        const dist = graphCache ? measureDistance(graphCache, firstObj, firstProj, best.obj, best.proj) : null;
        const distKm = dist ?? haversineKm(first.coordinates, snapped);
        const name = firstObj.name === best.obj.name ? best.obj.name : `${firstObj.name} → ${best.obj.name}`;

        // Draw dashed ruler line between the two snapped points
        drawMeasureLine(map, first.coordinates, snapped);

        // Distance label at midpoint
        const mid: [number, number] = [
          (first.coordinates[0] + snapped[0]) / 2,
          (first.coordinates[1] + snapped[1]) / 2,
        ];
        const labelEl = document.createElement("div");
        labelEl.style.cssText =
          "background:rgba(13,17,23,0.9);color:#22d3ee;border:1px solid rgba(34,211,238,0.3);" +
          "border-radius:6px;padding:3px 8px;font-size:12px;font-weight:700;" +
          "white-space:nowrap;pointer-events:none;backdrop-filter:blur(4px);";
        labelEl.textContent = `${distKm.toFixed(2)} км`;
        measureMarkerRefs.current.push(
          new mapboxgl.Marker({ element: labelEl, anchor: "center" }).setLngLat(mid).addTo(map),
        );

        onMeasureResultRef.current({ status: "success", objectName: name, distanceKm: distKm });
      }
    });

    return () => {
      cancelled = true;
      layersInitRef.current = false;
      [markerRefs, suggestedRefs, measureMarkerRefs, traceMeasureMarkersRef, placeRefs, hlPlaceRefs].forEach((r) => {
        r.current.forEach((m) => m.remove());
        r.current = [];
      });
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Hydropost markers ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    markerRefs.current.forEach((m) => m.remove());
    markerRefs.current = [];

    if (layer !== "water") {
      markerRefs.current = hydroposts.map((post) => {
        const active = post.code === activePostCode;
        const highlighted = highlightedPostCodes.includes(post.code);
        const handleClick = () => {
          if (layerRef.current === "water") return; // water-only layer: hydropost markers not clickable
          if (isWaterTraceRef.current) {
            suppressMapClickRef.current = true; // block map click that fires after this
            handleTracePoint(post.coordinates, post.label);
            return;
          }
          suppressMapClickRef.current = true;
          onPostClick(post.code);
          popupRef.current?.remove();
          popupRef.current = new mapboxgl.Popup({ closeButton: false, className: "edumap-popup", maxWidth: "240px", offset: 14 })
            .setLngLat(post.coordinates)
            .setHTML(postPopupHTML(post))
            .addTo(map);
        };
        return new mapboxgl.Marker({ element: makeMarkerEl(post, active, highlighted, handleClick), anchor: "center" })
          .setLngLat(post.coordinates)
          .addTo(map);
      });
    }

    if (highlightedPostCodes.length > 1) {
      const hPosts = hydroposts.filter((p) => highlightedPostCodes.includes(p.code));
      const fit = fitPosts(hPosts);
      if (fit) map.easeTo({ center: fit.center as [number, number], zoom: fit.zoom });
    } else if (highlightedPostCodes.length === 1) {
      const post = hydroposts.find((p) => p.code === highlightedPostCodes[0]);
      if (post) map.easeTo({ center: post.coordinates as [number, number], zoom: 10 });
    } else if (activePostCode !== null) {
      const post = hydroposts.find((p) => p.code === activePostCode);
      if (post) map.easeTo({ center: post.coordinates as [number, number] });
    }
  }, [activePostCode, highlightedPostCodes, layer, onPostClick, ready]);

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
    const districtPosts = hydroposts.filter((p) => highlightedDistricts.includes(p.district));
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
  }, [highlightedDistricts, ready]);

  // ── Suggested placements ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    suggestedRefs.current.forEach((m) => m.remove());
    suggestedRefs.current = suggestedPlacements.map((p) => {
      const el = document.createElement("div");
      el.style.cssText = `width:10px;height:10px;border-radius:50%;background:#a78bfa;border:2px solid rgba(167,139,250,0.5);box-shadow:0 0 8px #a78bfa99;`;
      return new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat(p.coordinates).addTo(map);
    });
  }, [suggestedPlacements, ready]);

  // ── Highlighted places ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    hlPlaceRefs.current.forEach((m) => m.remove());
    hlPlaceRefs.current = [];
    if (!highlightedPlaceIds.length) return;

    fetchPlaces().then((places) => {
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
          return new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat(place.coordinates).addTo(mapRef.current!);
        });
    });
  }, [highlightedPlaceIds, ready]);

  // ── Places layer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    placeRefs.current.forEach((m) => m.remove());
    placeRefs.current = [];
    if (!showPlaces) return;

    fetchPlaces().then((places) => {
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
          popupRef.current = new mapboxgl.Popup({
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

        return new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat(place.coordinates).addTo(mapRef.current!);
      });
    });
  }, [showPlaces, ready]);

  // ── Style toggle ──────────────────────────────────────────────────────────────
  function handleStyleToggle() {
    const next: MapStyleKey = mapStyle === "dark" ? "satellite" : "dark";
    setMapStyle(next);
    mapRef.current?.setStyle(MAP_STYLES[next]);
  }

  if (!token) {
    return <div style={styles.fallback}>Добавь <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> в <code>.env.local</code></div>;
  }

  return (
    <div style={styles.wrapper}>
      <div
        ref={containerRef}
        style={{ ...styles.canvas, cursor: (isMeasureMode || isWaterTraceMode) ? "crosshair" : "default" }}
      />

      {/* Layer switcher */}
      <div style={styles.layerBar}>
        {LAYERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onLayerChange(value)}
            style={{
              ...styles.layerBtn,
              background: layer === value ? "#22c55e" : "rgba(13,17,23,0.82)",
              color: layer === value ? "#fff" : "#8b949e",
              borderColor: layer === value ? "#22c55e" : "rgba(255,255,255,0.08)",
            }}
          >
            {label}
          </button>
        ))}
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
            background: mapStyle === "satellite" ? "#0ea5e9" : "rgba(13,17,23,0.82)",
            color: mapStyle === "satellite" ? "#fff" : "#8b949e",
            borderColor: mapStyle === "satellite" ? "#0ea5e9" : "rgba(255,255,255,0.08)",
          }}
        >
          {mapStyle === "satellite" ? "Карта" : "Спутник"}
        </button>
      </div>

      {/* Measure hint */}
      {isMeasureMode && (
        <div style={styles.measureHint}>
          {measureStep === 1 ? "Теперь кликни вторую точку на реке" : "Кликни первую точку на реке"}
        </div>
      )}

      {/* Water trace hint */}
      {isWaterTraceMode && (
        <div style={styles.traceHint}>
          {traceStep === 1
            ? "Теперь кликни вторую точку — гидропост, нас. пункт или место на реке"
            : "Кликни первую точку — гидропост, населённый пункт или место на реке"}
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
  layerBtn: {
    padding: "6px 14px", borderRadius: 8, border: "1px solid", cursor: "pointer",
    fontSize: 13, fontWeight: 500, backdropFilter: "blur(6px)", transition: "all 0.15s",
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

"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Region } from "@/lib/types";

const DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";

// Only oblasts with a real name:ru match here have hydropost data wired up —
// everything else on the map is shown but not clickable-through.
const OBLAST_TO_REGION: Record<string, Region> = {
  "Акмолинская область": "akmola",
  "Кызылординская область": "kyzylorda",
};

type OblastFeature = {
  type: "Feature";
  properties: { id: number; name: string };
  geometry: GeoJSON.Geometry;
};

let oblastsCache: OblastFeature[] | null = null;

function fetchOblasts(): Promise<OblastFeature[]> {
  if (oblastsCache) return Promise.resolve(oblastsCache);
  return fetch("/kazakhstan-oblasts.geojson")
    .then((r) => r.json())
    .then((d) => {
      oblastsCache = d?.features ?? [];
      return oblastsCache!;
    })
    .catch(() => []);
}

interface Props {
  onSelectRegion: (region: Region) => void;
}

export function KazakhstanOverview({ onSelectRegion }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onSelectRegionRef = useRef(onSelectRegion);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onSelectRegionRef.current = onSelectRegion; }, [onSelectRegion]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_STYLE,
      center: [67.5, 48.2],
      zoom: 3.9,
      minZoom: 3,
      maxZoom: 8,
      canvasContextAttributes: { antialias: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", async () => {
      const oblasts = await fetchOblasts();
      if (cancelled) return;

      const fc: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: oblasts.map((o) => ({
          type: "Feature",
          properties: { ...o.properties, hasData: !!OBLAST_TO_REGION[o.properties.name] },
          geometry: o.geometry,
        })),
      };
      map.addSource("oblasts", { type: "geojson", data: fc });

      map.addLayer({
        id: "oblasts-fill",
        type: "fill",
        source: "oblasts",
        paint: {
          "fill-color": ["case", ["get", "hasData"], "#22c55e", "#334155"],
          "fill-opacity": ["case", ["get", "hasData"], 0.28, 0.14],
        },
      });
      map.addLayer({
        id: "oblasts-line",
        type: "line",
        source: "oblasts",
        paint: {
          "line-color": ["case", ["get", "hasData"], "#22c55e", "#64748b"],
          "line-width": ["case", ["get", "hasData"], 2, 1],
        },
      });
      map.addLayer({
        id: "oblasts-labels",
        type: "symbol",
        source: "oblasts",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-font": ["Noto Sans Regular"],
        },
        paint: {
          "text-color": ["case", ["get", "hasData"], "#e6edf3", "#8b949e"],
          "text-halo-color": "#0d1117",
          "text-halo-width": 1.2,
        },
      });

      map.on("mousemove", "oblasts-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "oblasts-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "oblasts-fill", (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const name = feat.properties?.name as string;
        const region = OBLAST_TO_REGION[name];
        if (region) {
          onSelectRegionRef.current(region);
          return;
        }
        if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
        setNotice(`${name}: данные скоро появятся`);
        noticeTimerRef.current = setTimeout(() => setNotice(null), 2800);
      });
    });

    return () => {
      cancelled = true;
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div style={styles.wrapper}>
      <div ref={containerRef} style={styles.canvas} />
      <div style={styles.titleCard}>
        <div style={styles.titleMain}>AI Gidromap</div>
        <div style={styles.titleSub}>Выберите область на карте</div>
      </div>
      {notice && <div style={styles.notice}>{notice}</div>}
    </div>
  );
}

const styles = {
  wrapper: { position: "relative" as const, width: "100%", height: "100dvh", overflow: "hidden" },
  canvas: { position: "absolute" as const, inset: 0 },
  titleCard: {
    position: "absolute" as const, top: 16, left: 16, zIndex: 10,
    background: "rgba(13,17,23,0.82)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10, padding: "10px 16px", backdropFilter: "blur(6px)",
  },
  titleMain: { fontSize: 15, fontWeight: 700, color: "#22c55e" },
  titleSub: { fontSize: 12, color: "#8b949e", marginTop: 2 },
  notice: {
    position: "absolute" as const, bottom: 24, left: "50%", transform: "translateX(-50%)",
    zIndex: 10, background: "rgba(13,17,23,0.92)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "8px 16px", fontSize: 13, color: "#e6edf3",
    backdropFilter: "blur(6px)", pointerEvents: "none" as const,
  },
} as const;

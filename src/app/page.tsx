"use client";

import { useState, useCallback } from "react";
import { AkmolaMap } from "@/components/AkmolaMap";
import { ChatPanel } from "@/components/ChatPanel";
import { PostDetailPanel } from "@/components/PostDetailPanel";
import { WaterObjectPanel } from "@/components/WaterObjectPanel";
import { WeatherWidget } from "@/components/WeatherWidget";
import { hydroposts } from "@/lib/akmolaMapData";
import { track } from "@/lib/track";
import type { Layer, MapState, WaterObject } from "@/lib/types";
import type { MeasureResult, WaterTraceResult } from "@/lib/measure";

const INIT: MapState = {
  activePostCode: hydroposts[0]?.code ?? null,
  highlightedPostCodes: [],
  highlightedWaterIds: [],
  highlightedPlaceIds: [],
  highlightedDistricts: [],
  suggestedPlacements: [],
  layer: "hydroposts",
  showPlaces: false,
  showDistricts: true,
};

export default function Page() {
  const [mapState, setMapState] = useState<MapState>(INIT);
  const [isMeasureMode, setIsMeasureMode] = useState(false);
  const [measureResult, setMeasureResult] = useState<MeasureResult | null>(null);
  const [detailPostCode, setDetailPostCode] = useState<number | null>(null);
  const [detailWater, setDetailWater] = useState<WaterObject | null>(null);
  const [isWaterTraceMode, setIsWaterTraceMode] = useState(false);
  const [waterTraceResult, setWaterTraceResult] = useState<WaterTraceResult | null>(null);
  const [weatherSummary, setWeatherSummary] = useState<string>("");

  const updateMap = useCallback((patch: Partial<MapState>) => {
    setMapState((prev) => ({ ...prev, ...patch }));
  }, []);

  const handlePostClick = useCallback(
    (code: number) => {
      updateMap({ activePostCode: code, highlightedPostCodes: [] });
      setDetailPostCode(code);
      setDetailWater(null);
      const post = hydroposts.find((p) => p.code === code);
      if (post) {
        track("view_hydropost", {
          code: post.code,
          label: post.label,
          district: post.district,
          waterBody: post.waterBody,
          status: post.status,
        });
      }
    },
    [updateMap],
  );

  const handleCloseDetail = useCallback(() => {
    setDetailPostCode(null);
    updateMap({ activePostCode: null });
  }, [updateMap]);

  const handleWaterClick = useCallback((water: WaterObject) => {
    setDetailWater(water);
    setDetailPostCode(null);
    updateMap({ activePostCode: null });
    track("view_water_object", { id: water.id, name: water.name, kind: water.kind });
  }, [updateMap]);

  const handleCloseWaterDetail = useCallback(() => setDetailWater(null), []);

  const handleWaterTraceModeChange = useCallback((active: boolean) => {
    setIsWaterTraceMode(active);
    if (!active) setWaterTraceResult(null);
  }, []);

  const handleWaterTraceResult = useCallback((result: WaterTraceResult) => {
    setWaterTraceResult(result);
    setIsWaterTraceMode(false);
    track("water_trace", {
      labelA: result.labelA,
      labelB: result.labelB,
      connected: result.connected,
      distanceKm: result.connected ? result.distanceKm : null,
    });
  }, []);

  const handleLayerChange = useCallback((layer: Layer) => updateMap({ layer }), [updateMap]);
  const handleTogglePlaces = useCallback(() => updateMap({ showPlaces: !mapState.showPlaces }), [updateMap, mapState.showPlaces]);
  const handleToggleDistricts = useCallback(() => updateMap({ showDistricts: !mapState.showDistricts }), [updateMap, mapState.showDistricts]);

  const handleMeasureModeChange = useCallback((active: boolean) => {
    setIsMeasureMode(active);
    if (!active) setMeasureResult(null);
  }, []);

  const handleMeasureResult = useCallback((result: MeasureResult) => {
    setMeasureResult(result);
    setIsMeasureMode(false);
    if (result.status === "success") {
      track("measure_distance", { objectName: result.objectName, distanceKm: result.distanceKm });
    }
  }, []);

  return (
    <div className="app-shell">
      <div style={{ position: "relative", flex: 1, minWidth: 0, height: "100dvh", overflow: "hidden", display: "flex" }}>
        <AkmolaMap
          activePostCode={mapState.activePostCode}
          highlightedPostCodes={mapState.highlightedPostCodes}
          highlightedWaterIds={mapState.highlightedWaterIds}
          highlightedPlaceIds={mapState.highlightedPlaceIds}
          highlightedDistricts={mapState.highlightedDistricts}
          suggestedPlacements={mapState.suggestedPlacements}
          layer={mapState.layer}
          showPlaces={mapState.showPlaces}
          showDistricts={mapState.showDistricts}
          isMeasureMode={isMeasureMode}
          isWaterTraceMode={isWaterTraceMode}
          onPostClick={handlePostClick}
          onWaterClick={handleWaterClick}
          onLayerChange={handleLayerChange}
          onTogglePlaces={handleTogglePlaces}
          onToggleDistricts={handleToggleDistricts}
          onMeasureResult={handleMeasureResult}
          onWaterTraceResult={handleWaterTraceResult}
        />

        {detailPostCode != null && (
          <div style={{ position: "absolute", top: 8, left: 8, bottom: 8, width: 324, zIndex: 10 }}>
            <PostDetailPanel postCode={detailPostCode} onClose={handleCloseDetail} />
          </div>
        )}

        {detailWater != null && (
          <div style={{ position: "absolute", top: 8, left: 8, bottom: 8, width: 324, zIndex: 10 }}>
            <WaterObjectPanel water={detailWater} onClose={handleCloseWaterDetail} />
          </div>
        )}

        <WeatherWidget onWeatherSummary={setWeatherSummary} />
      </div>

      <ChatPanel
        activePostCode={mapState.activePostCode}
        highlightedPostCodes={mapState.highlightedPostCodes}
        isMeasureMode={isMeasureMode}
        measureResult={measureResult}
        isWaterTraceMode={isWaterTraceMode}
        waterTraceResult={waterTraceResult}
        weatherContext={weatherSummary}
        onMapUpdate={updateMap}
        onMeasureModeChange={handleMeasureModeChange}
        onWaterTraceModeChange={handleWaterTraceModeChange}
      />
    </div>
  );
}

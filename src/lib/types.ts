export type Layer = "all" | "hydroposts" | "water";

export type Region = "akmola" | "kyzylorda";

export type SuggestedPlacement = {
  id: string;
  label: string;
  coordinates: [number, number];
};

export type MapState = {
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
};

export type Place = {
  id: string;
  name: string;
  kind: "national_capital" | "city" | "town" | "suburb" | "village";
  coordinates: [number, number];
};

export type ChatMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
};

export type Clarification = {
  question: string;
  queryBase: string;
};

export type ChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export type ChatResponse = {
  answer: string;
  mapUpdate: Partial<MapState> | null;
  clarification?: Clarification | null;
  sessionId: string;
};

export type WaterObject = {
  id: string;
  name: string;
  kind: "river" | "lake" | "reservoir";
  geometry: "polyline" | "polygon";
  coordinates: [number, number][] | [number, number][][];
};

// One measured reach from the GRWL (Global River Widths from Landsat) dataset —
// CC-BY 4.0, Allen & Pavelsky (2018). `name` is our own nearest-named-waterway
// match (within 3km), not a GRWL field — null when nothing matched confidently.
// GRWL only resolves rivers roughly >=30m wide, so absence from this file does
// not mean a river is narrow, only that GRWL didn't detect/report it.
export type RiverWidthSegment = {
  id: string;
  name: string | null;
  widthMinM: number;
  widthMedianM: number;
  widthMeanM: number;
  widthMaxM: number;
  lengthKm: number;
  isLake: boolean;
  coordinates: [number, number][];
};

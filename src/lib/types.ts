export type Layer = "all" | "hydroposts" | "water";

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

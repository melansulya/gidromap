import { NextResponse } from "next/server";
import { getTerrainTile } from "@/lib/terrainTiles";
import { colorizeElevations, decodeElevationTileCached } from "@/lib/elevationColor";
import type { Region } from "@/lib/types";

// Colorizes on the fly from the terrain-RGB elevation tiles using whatever
// min/max the client passes (the current viewport's real range) — no more
// pre-baked color tiles, so the same source data can be tinted differently
// depending on what's on screen. Falls back to the whole region's range
// if no min/max is given.
const DEFAULT_RANGE: Record<Region, { min: number; max: number }> = {
  akmola: { min: 46, max: 923 },
  kyzylorda: { min: 20, max: 600 },
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z, x, y } = await params;

  const zoom = Number(z);
  const col = Number(x);
  const row = Number(y.replace(/\.png$/, ""));
  if (!Number.isInteger(zoom) || !Number.isInteger(col) || !Number.isInteger(row)) {
    return NextResponse.json({ error: "Bad tile coordinates" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const region: Region = searchParams.get("region") === "kyzylorda" ? "kyzylorda" : "akmola";

  const tile = getTerrainTile(region, zoom, col, row);
  if (!tile) return new NextResponse(null, { status: 404 });

  const defaults = DEFAULT_RANGE[region];
  const min = Number(searchParams.get("min"));
  const max = Number(searchParams.get("max"));
  const useMin = Number.isFinite(min) ? min : defaults.min;
  const useMax = Number.isFinite(max) && max > useMin ? max : defaults.max;

  const { elevations, width, height } = await decodeElevationTileCached(`${region}/${zoom}/${col}/${row}`, tile);
  const png = await colorizeElevations(elevations, width, height, useMin, useMax);

  return new NextResponse(new Uint8Array(png), {
    // Dynamic per-viewport tint — must not be cached long-term like the static version was.
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=60" },
  });
}

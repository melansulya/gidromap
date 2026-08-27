import { NextResponse } from "next/server";
import { getTerrainTile } from "@/lib/terrainTiles";
import { decodeElevationTileCached } from "@/lib/elevationColor";
import type { Region } from "@/lib/types";

const RELIEF_ZOOM: Record<Region, { min: number; max: number }> = {
  akmola: { min: 5, max: 11 },
  kyzylorda: { min: 5, max: 9 },
};

function lonLatToTile(lon: number, lat: number, z: number) {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
}

// Real min/max elevation for the current viewport — computed from whichever
// terrain-RGB tiles intersect the bbox at the given zoom, so a tightly zoomed
// viewport gets a tightly-scoped (and therefore more contrasty) range instead
// of the whole region's 46-923m span.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region: Region = searchParams.get("region") === "kyzylorda" ? "kyzylorda" : "akmola";
  const zoomRange = RELIEF_ZOOM[region];
  const bbox = searchParams.get("bbox");
  const zoomParam = Number(searchParams.get("zoom"));
  if (!bbox) return NextResponse.json({ error: "bbox required" }, { status: 400 });

  const parts = bbox.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return NextResponse.json({ error: "bad bbox" }, { status: 400 });
  }
  const [west, south, east, north] = parts;
  const zoom = Math.max(zoomRange.min, Math.min(zoomRange.max, Math.round(zoomParam) || zoomRange.min));

  const topLeft = lonLatToTile(west, north, zoom);
  const bottomRight = lonLatToTile(east, south, zoom);

  const xMin = Math.min(topLeft.x, bottomRight.x);
  const xMax = Math.max(topLeft.x, bottomRight.x);
  const yMin = Math.min(topLeft.y, bottomRight.y);
  const yMax = Math.max(topLeft.y, bottomRight.y);

  let min = Infinity;
  let max = -Infinity;
  let found = 0;
  const MAX_TILES = 16; // safety cap — a huge bbox at high zoom shouldn't decode dozens of tiles

  outer: for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      if (found >= MAX_TILES) break outer;
      const tile = getTerrainTile(region, zoom, x, y);
      if (!tile) continue;
      found++;
      const { elevations } = await decodeElevationTileCached(`${region}/${zoom}/${x}/${y}`, tile);
      for (const e of elevations) {
        if (e < min) min = e;
        if (e > max) max = e;
      }
    }
  }

  if (!found) return NextResponse.json({ error: "No terrain data for this view" }, { status: 404 });

  return NextResponse.json({ min: Math.round(min), max: Math.round(max), zoom, tiles: found });
}

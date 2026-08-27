import { NextResponse } from "next/server";
import { getTerrainTile } from "@/lib/terrainTiles";
import type { Region } from "@/lib/types";

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
  const regionParam = searchParams.get("region");
  const region: Region = regionParam === "kyzylorda" ? "kyzylorda" : "akmola";

  const tile = getTerrainTile(region, zoom, col, row);
  if (!tile) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(tile), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}

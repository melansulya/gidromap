import { NextResponse } from "next/server";
import { getSatelliteMeta } from "@/lib/satelliteCache";

export async function GET() {
  try {
    const meta = await getSatelliteMeta();
    return NextResponse.json({
      bbox: meta.bbox,
      fetchedAt: meta.fetchedAt,
      imageUrl: "/api/satellite/image",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка получения спутникового снимка" },
      { status: 500 },
    );
  }
}

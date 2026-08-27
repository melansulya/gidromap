import { NextResponse } from "next/server";
import { getSatelliteImage } from "@/lib/satelliteCache";

export async function GET() {
  const image = await getSatelliteImage();
  if (!image) return NextResponse.json({ error: "Снимок ещё не загружен" }, { status: 404 });

  return new NextResponse(new Uint8Array(image), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { hydroposts } from "@/lib/akmolaMapData";
import type { Region } from "@/lib/types";

// One point per hydropost (src/lib/akmolaMapData.ts `hydroposts`), so weather
// is read at each monitored location instead of a handful of regional cities.
// Derived directly from `hydroposts` (not a separately hand-maintained list) so
// weather points can never drift out of sync with the hydropost array's order
// or length as regions are added — the dashboard pairs weather to posts by
// `code`, not by array index, so this must stay a true 1:1 mapping.
const LOCATIONS = hydroposts.map((p) => ({
  code: p.code,
  region: p.region,
  name: p.label,
  lat: p.coordinates[1],
  lon: p.coordinates[0],
}));

function conditionRu(code: number): string {
  if (code === 0)  return "Ясно";
  if (code <= 2)   return "Малооблачно";
  if (code <= 3)   return "Облачно";
  if (code <= 48)  return "Туман";
  if (code <= 55)  return "Морось";
  if (code <= 65)  return "Дождь";
  if (code <= 77)  return "Снег";
  if (code <= 82)  return "Ливень";
  if (code <= 86)  return "Снегопад";
  return "Гроза";
}

function conditionIcon(code: number): string {
  if (code === 0)  return "sun";
  if (code <= 2)   return "cloud-sun";
  if (code <= 3)   return "cloud";
  if (code <= 48)  return "fog";
  if (code <= 55)  return "drizzle";
  if (code <= 65)  return "rain";
  if (code <= 77)  return "snow";
  if (code <= 82)  return "showers";
  if (code <= 86)  return "snowshower";
  return "storm";
}

// Precip risk level for hydro relevance
function precipLevel(precip24h: number): "none" | "low" | "moderate" | "high" {
  if (precip24h <= 0)   return "none";
  if (precip24h < 5)    return "low";
  if (precip24h < 20)   return "moderate";
  return "high";
}

// Open-Meteo has no direct snowmelt variable. Estimated with the temperature-index
// (degree-day) method standard in operational hydrology: melt_mm = factor × mean
// daily temperature above 0°C, only while snow is actually on the ground.
// Factor of 3 mm/°C/day is a mid-range value (typical range 2-6 depending on terrain).
const DEGREE_DAY_FACTOR = 3;

function snowMeltLevel(snowMeltMm24h: number): "none" | "low" | "moderate" | "high" {
  if (snowMeltMm24h <= 0) return "none";
  if (snowMeltMm24h < 5)  return "low";
  if (snowMeltMm24h < 15) return "moderate";
  return "high";
}

export type WeatherPoint = {
  postCode: number;
  region: Region;
  name: string;
  temp: number;
  precip: number;
  precip24h: number;
  windspeed: number;
  code: number;
  condition: string;
  icon: string;
  precipLevel: "none" | "low" | "moderate" | "high";
  snowMeltMm24h: number;
  snowMeltLevel: "none" | "low" | "moderate" | "high";
};

// Own short-TTL cache instead of relying on Next.js's fetch cache (which only
// works predictably in a single-instance `next build && next start` deployment).
// Weather changes fast, so the TTL stays short — this isn't about avoiding
// re-checking (like the 5-day Sentinel cache), just about not hitting Open-Meteo
// on every single page load, and having something to serve if it's unreachable.
const CACHE_TTL_MS = 15 * 60 * 1000;
let cache: { data: WeatherPoint[]; fetchedAt: number } | null = null;

async function fetchOneLocation(loc: (typeof LOCATIONS)[number]): Promise<WeatherPoint> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${loc.lat}&longitude=${loc.lon}` +
    `&current=temperature_2m,precipitation,weathercode,windspeed_10m,snow_depth` +
    `&hourly=precipitation,temperature_2m` +
    `&timezone=Asia%2FAlmaty` +
    `&forecast_days=1&past_days=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status} for ${loc.name}`);
  const data = await res.json() as {
    current?: { temperature_2m: number; precipitation: number; weathercode: number; windspeed_10m: number; snow_depth: number };
    hourly?: { time: string[]; precipitation: number[]; temperature_2m: number[] };
  };
  if (!data.current || !data.hourly) throw new Error(`Open-Meteo malformed response for ${loc.name}`);

  const c = data.current;
  const hourly = data.hourly;

  // Sum/average last 24h of precipitation and temperature
  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 3600 * 1000);
  let precipSum = 0;
  let tempSum = 0;
  let tempCount = 0;
  hourly.time.forEach((t, i) => {
    const dt = new Date(t);
    if (dt >= cutoff && dt <= now) {
      precipSum += hourly.precipitation[i] ?? 0;
      tempSum += hourly.temperature_2m[i] ?? 0;
      tempCount += 1;
    }
  });
  const precip24h = precipSum;
  const meanTemp24h = tempCount > 0 ? tempSum / tempCount : c.temperature_2m;

  // Snowmelt estimate: temperature-index method, only while snow is present.
  const snowMeltMm24h = c.snow_depth > 0
    ? Math.round(Math.max(0, DEGREE_DAY_FACTOR * meanTemp24h) * 10) / 10
    : 0;

  return {
    postCode: loc.code,
    region: loc.region,
    name: loc.name,
    temp: Math.round(c.temperature_2m * 10) / 10,
    precip: c.precipitation,
    precip24h: Math.round(precip24h * 10) / 10,
    windspeed: Math.round(c.windspeed_10m),
    code: c.weathercode,
    condition: conditionRu(c.weathercode),
    icon: conditionIcon(c.weathercode),
    precipLevel: precipLevel(precip24h),
    snowMeltMm24h,
    snowMeltLevel: snowMeltLevel(snowMeltMm24h),
  };
}

// Open-Meteo occasionally returns a malformed/error response for one location
// out of the batch (more likely now that LOCATIONS spans 40 points across two
// regions) — Promise.allSettled + filtering keeps one bad point from taking
// down the whole endpoint.
async function fetchFreshWeather(): Promise<WeatherPoint[]> {
  const settled = await Promise.allSettled(LOCATIONS.map(fetchOneLocation));
  const points: WeatherPoint[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") points.push(result.value);
    else console.error("[weather] location fetch failed:", result.reason);
  }
  return points;
}

function filterByRegion(points: WeatherPoint[], region: string | null): WeatherPoint[] {
  if (region !== "akmola" && region !== "kyzylorda") return points;
  return points.filter((p) => p.region === region);
}

export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get("region");
  const isFresh = cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (isFresh) {
    return NextResponse.json(filterByRegion(cache!.data, region), {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" },
    });
  }

  try {
    const results = await fetchFreshWeather();
    cache = { data: results, fetchedAt: Date.now() };
    return NextResponse.json(filterByRegion(results, region), {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" },
    });
  } catch (err) {
    console.error("[weather]", err);
    // Open-Meteo unreachable — serve the last known data instead of failing outright.
    if (cache) {
      return NextResponse.json(filterByRegion(cache.data, region), {
        headers: { "Cache-Control": "public, s-maxage=60", "X-Weather-Stale": "true" },
      });
    }
    return NextResponse.json({ error: "Не удалось получить данные о погоде" }, { status: 500 });
  }
}

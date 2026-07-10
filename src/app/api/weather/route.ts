import { NextResponse } from "next/server";

const LOCATIONS = [
  { name: "Астана",      lat: 51.16, lon: 71.43 },
  { name: "Кокшетау",   lat: 53.28, lon: 69.38 },
  { name: "Атбасар",    lat: 51.80, lon: 68.37 },
  { name: "Степногорск",lat: 52.34, lon: 71.90 },
  { name: "Щучинск",    lat: 53.00, lon: 70.19 },
  { name: "г. Есиль",   lat: 52.02, lon: 66.27 },
];

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

export type WeatherPoint = {
  name: string;
  temp: number;
  precip: number;
  precip24h: number;
  windspeed: number;
  code: number;
  condition: string;
  icon: string;
  precipLevel: "none" | "low" | "moderate" | "high";
};

export async function GET() {
  try {
    const results = await Promise.all(
      LOCATIONS.map(async (loc) => {
        const url =
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${loc.lat}&longitude=${loc.lon}` +
          `&current=temperature_2m,precipitation,weathercode,windspeed_10m` +
          `&hourly=precipitation` +
          `&timezone=Asia%2FAlmaty` +
          `&forecast_days=1&past_days=1`;

        const res = await fetch(url, { next: { revalidate: 1800 } });
        const data = await res.json() as {
          current: { temperature_2m: number; precipitation: number; weathercode: number; windspeed_10m: number };
          hourly: { time: string[]; precipitation: number[] };
        };

        const c = data.current;

        // Sum last 24h of precipitation
        const now = new Date();
        const cutoff = new Date(now.getTime() - 24 * 3600 * 1000);
        const precip24h = data.hourly.time.reduce((sum, t, i) => {
          const dt = new Date(t);
          return dt >= cutoff && dt <= now ? sum + (data.hourly.precipitation[i] ?? 0) : sum;
        }, 0);

        const point: WeatherPoint = {
          name: loc.name,
          temp: Math.round(c.temperature_2m * 10) / 10,
          precip: c.precipitation,
          precip24h: Math.round(precip24h * 10) / 10,
          windspeed: Math.round(c.windspeed_10m),
          code: c.weathercode,
          condition: conditionRu(c.weathercode),
          icon: conditionIcon(c.weathercode),
          precipLevel: precipLevel(precip24h),
        };
        return point;
      }),
    );

    return NextResponse.json(results, {
      headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
    });
  } catch (err) {
    console.error("[weather]", err);
    return NextResponse.json({ error: "Не удалось получить данные о погоде" }, { status: 500 });
  }
}

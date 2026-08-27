import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { hydroposts as allHydroposts, getHydropostHistory, analyzeLowWaterRisk } from "@/lib/akmolaMapData";
import { runLocalMechanism } from "@/lib/aiMechanisms";
import { getAuthFromToken } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import type { ChatResponse, MapState, Place, Region, RiverWidthSegment } from "@/lib/types";

function hydropostsFor(region: Region) {
  return allHydroposts.filter((p) => p.region === region);
}

// ─── Places cache ─────────────────────────────────────────────────────────────

const placesCache = new Map<Region, Place[]>();

// ─── Water objects cache ──────────────────────────────────────────────────────

type WaterEntry = { id: string; name: string };
const waterCache2 = new Map<Region, WaterEntry[]>();

function loadWaterObjects(region: Region): WaterEntry[] {
  const cached = waterCache2.get(region);
  if (cached) return cached;
  let result: WaterEntry[];
  try {
    const bodies = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public", `${region}-water-bodies.json`), "utf-8")
    ) as Array<{ id: string; name?: string }>;
    const ways = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public", `${region}-waterways.json`), "utf-8")
    ) as Array<{ id: string; name?: string }>;
    result = [...bodies, ...ways]
      .filter((w) => w.name && w.name.trim().length > 1)
      .map((w) => ({ id: w.id, name: w.name! }));
  } catch {
    result = [];
  }
  waterCache2.set(region, result);
  return result;
}

function findWaterIds(query: string, region: Region): string[] {
  const objects = loadWaterObjects(region);
  // Strip common prefixes
  const q = query.toLowerCase()
    .replace(/^(р\.|р\s+|река\s+|оз\.|оз\s+|озеро\s+|вдхр\.|вдхр\s+|водохранилище\s+)/i, "")
    .trim();

  // Russian → Kazakh spelling variants
  const variants: string[] = [q];
  const aliases: Record<string, string[]> = {
    "есиль": ["есіл", "есил"],
    "есил":  ["есіл", "есиль"],
    "нура":  ["нур"],
    "нур":   ["нура"],
    // NB: previously had a Latin "c" here instead of Cyrillic "с" (сілеті) —
    // visually identical but never matches real Cyrillic text. Silently
    // broke both aliases below since they were first written.
    "силеты": ["сілеті", "силети"],
    "селеты": ["сілеті", "силеты", "селети"],
    "жыланды": ["жиланды"],
    "бурабай": ["бурабай көлі"],
    "копа":  ["копа", "копа-копа", "қопа"],
    "зеренды": ["зеренды", "зеренді"],
    "шортан": ["шортанкөл", "шортанды"],
    "терисаккан": ["терісаққан"],
    "калкутан": ["қалқұтан"],
    "боксук": ["боқсық"],
    // "Астанинское водохранилище" and "Арнасай бөгені" are the same reservoir
    // under two different names — confirmed by hydropost coordinates
    // (с. Михайловка, с. Арнасай) falling inside its polygon bounds.
    "астанинское": ["арнасай"],
  };
  if (aliases[q]) variants.push(...aliases[q]);

  return objects
    .filter((w) => {
      const name = w.name.toLowerCase();
      return variants.some((v) => name.includes(v) || v.includes(name.replace(/\s*(көлі|бөгені|арнасы)\s*/g, "").trim()));
    })
    .map((w) => w.id);
}

// ─── River width cache (GRWL — Global River Widths from Landsat, CC-BY 4.0,
// Allen & Pavelsky 2018) ────────────────────────────────────────────────────
// Pre-extracted once for our two regions from the public GRWL_summaryStats
// dataset (Zenodo, static one-time download — no live foreign API at
// runtime, same pattern as the terrain DEM data). GRWL only resolves rivers
// roughly >=30m wide, so a river missing from this file isn't necessarily
// narrow — it just wasn't detected/reported by GRWL.

const riverWidthCache = new Map<Region, RiverWidthSegment[]>();

function loadRiverWidths(region: Region): RiverWidthSegment[] {
  const cached = riverWidthCache.get(region);
  if (cached) return cached;
  let result: RiverWidthSegment[];
  try {
    result = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public", `${region}-river-widths.json`), "utf-8")
    ) as RiverWidthSegment[];
  } catch {
    result = [];
  }
  riverWidthCache.set(region, result);
  return result;
}

function loadPlaces(region: Region): Place[] {
  const cached = placesCache.get(region);
  if (cached) return cached;
  let result: Place[];
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "public", `${region}-places.json`),
      "utf-8",
    );
    result = JSON.parse(raw) as Place[];
  } catch {
    result = [];
  }
  placesCache.set(region, result);
  return result;
}

function normName(s: string) {
  return s
    .toLowerCase()
    .replace(/^(с\.|с |г\.|г |пос\.|пос |аул )/i, "")
    .replace(/[её]/g, "е")
    .trim();
}

function matchPlaceNames(names: string[], region: Region): string[] {
  const places = loadPlaces(region);
  return names.flatMap((n) => {
    const needle = normName(n);
    const found =
      places.find((p) => normName(p.name) === needle) ??
      places.find(
        (p) =>
          normName(p.name).includes(needle) || needle.includes(normName(p.name)),
      );
    return found ? [found.id] : [];
  });
}

// ─── Haversine ────────────────────────────────────────────────────────────────

function haversineKm(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number],
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "filter_hydroposts",
      description:
        "Найти гидропосты по статусу, реке или району. Используй когда нужно показать/выделить посты на карте.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["danger", "warning", "normal", "any"],
            description: "Статус: danger=красная зона, warning=жёлтая, normal=норма, any=все",
          },
          river: { type: "string", description: "Название реки (частичное совпадение)" },
          district: { type: "string", description: "Название района" },
          sort_by: {
            type: "string",
            enum: ["level_desc", "level_asc", "none"],
            description: "Сортировка по уровню воды",
          },
        },
        required: ["status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_posts_near_city",
      description: "Найти гидропосты в заданном радиусе от города или населённого пункта",
      parameters: {
        type: "object",
        properties: {
          city_name: { type: "string", description: "Название города/посёлка" },
          radius_km: { type: "number", description: "Радиус поиска в км" },
        },
        required: ["city_name", "radius_km"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_hydropost_history",
      description: "Получить историю наблюдений уровня воды по конкретному гидропосту",
      parameters: {
        type: "object",
        properties: {
          post_code: { type: "number", description: "Числовой код гидропоста" },
        },
        required: ["post_code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_spatial_coverage",
      description:
        "Рассчитать покрытие рек гидропостами и найти места для установки новых постов",
      parameters: {
        type: "object",
        properties: {
          interval_km: {
            type: "number",
            description: "Желаемый шаг между постами в км (обычно 10-20)",
          },
          main_rivers_only: {
            type: "boolean",
            description: "true — только основные реки, false — все реки",
          },
        },
        required: ["interval_km", "main_rivers_only"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_settlements_near_posts",
      description:
        "Найти населённые пункты (сёла, города) рядом с гидропостами. Можно фильтровать по реке или району — например для запроса «сёла вдоль реки Есиль» передай river='Есиль'.",
      parameters: {
        type: "object",
        properties: {
          radius_km: {
            type: "number",
            description: "Радиус поиска вокруг каждого поста в км (рекомендуется 15–25)",
          },
          river: {
            type: "string",
            description: "Фильтр по реке: искать только вдоль постов на этой реке (частичное совпадение)",
          },
          district: {
            type: "string",
            description: "Фильтр по району: искать только вдоль постов в этом районе",
          },
        },
        required: ["radius_km"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_settlements",
      description: "Отметить конкретные населённые пункты на карте оранжевыми метками",
      parameters: {
        type: "object",
        properties: {
          names: {
            type: "array",
            items: { type: "string" },
            description: "Список названий населённых пунктов",
          },
        },
        required: ["names"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "change_map_layer",
      description: "Переключить слой карты",
      parameters: {
        type: "object",
        properties: {
          layer: {
            type: "string",
            enum: ["all", "hydroposts", "water"],
            description: "all=все слои, hydroposts=только посты, water=только водные объекты",
          },
        },
        required: ["layer"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "highlight_district",
      description: "Подсветить район(ы) на карте оранжевым цветом. Используй когда пользователь просит показать район или когда ты говоришь о конкретных районах.",
      parameters: {
        type: "object",
        properties: {
          district_names: {
            type: "array",
            items: { type: "string" },
            description: "Список точных русских названий районов (напр. 'Аршалынский район', 'г. Кокшетау')",
          },
        },
        required: ["district_names"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reset_map",
      description: "Очистить все выделения на карте и вернуться к обычному виду. Используй когда пользователь говорит 'очисти', 'сбрось', 'убери выделение', 'покажи всё'.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "detect_low_water_risk",
      description:
        "Анализ риска маловодья по историческим данным минимального уровня открытого русла. Использует медиану как норму и считает отклонение по годам. Вызывай при запросах: 'риск маловодья', 'маловодье на реке', 'исторически низкий уровень', 'дефицит воды', 'маловодный год'.",
      parameters: {
        type: "object",
        properties: {
          post_code: {
            type: "number",
            description: "Код конкретного гидропоста (если известен)",
          },
          river: {
            type: "string",
            description: "Название реки — анализ всех постов на ней (частичное совпадение)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "highlight_water",
      description: "Выделить реку, озеро или другой водный объект на карте синими линиями/заливкой. ОБЯЗАТЕЛЬНО используй при любом запросе 'выдели реку', 'покажи реку', 'выдели озеро', 'покажи озеро' и т.п.",
      parameters: {
        type: "object",
        properties: {
          water_name: {
            type: "string",
            description: "Название водного объекта БЕЗ префиксов р./оз./вдхр. Примеры: 'Есиль', 'Нура', 'Жабай', 'Бурабай', 'Копа', 'Зеренды', 'Шортан', 'Силеты'",
          },
        },
        required: ["water_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_river_widths",
      description:
        "Найти реки/участки рек шириной не менее заданного порога (в метрах). Используй при вопросах 'какие реки шириной от N метров', 'сколько рек шире N метров', 'ширина реки X'. Данные из GRWL (спутниковые измерения Landsat) — покрывают не всю речную сеть, только реки примерно от 30м, измерено участками (реках может быть несколько участков с разной шириной).",
      parameters: {
        type: "object",
        properties: {
          min_width_m: {
            type: "number",
            description: "Минимальная медианная ширина в метрах (по умолчанию 40)",
          },
          river_name: {
            type: "string",
            description: "Необязательно: название конкретной реки для фильтра (частичное совпадение, без префиксов р./оз.)",
          },
        },
        required: ["min_width_m"],
      },
    },
  },
];

// ─── Tool execution ───────────────────────────────────────────────────────────

type ToolResult = {
  data: unknown;
  mapUpdate?: Partial<MapState>;
};

function execFilterHydroposts(args: {
  status: string;
  river?: string;
  district?: string;
  sort_by?: string;
}, region: Region): ToolResult {
  let posts = hydropostsFor(region);
  if (args.status !== "any") {
    posts = posts.filter((p) => p.status === args.status);
  }
  if (args.river) {
    const r = args.river.toLowerCase();
    posts = posts.filter((p) => p.waterBody.toLowerCase().includes(r));
  }
  if (args.district) {
    const d = args.district.toLowerCase();
    posts = posts.filter((p) => p.district.toLowerCase().includes(d));
  }
  if (args.sort_by === "level_desc") posts.sort((a, b) => b.waterLevel - a.waterLevel);
  if (args.sort_by === "level_asc") posts.sort((a, b) => a.waterLevel - b.waterLevel);

  const districtNames = [...new Set(posts.map((p) => p.district))];

  return {
    data: posts.map((p) => ({
      code: p.code,
      label: p.label,
      waterBody: p.waterBody,
      district: p.district,
      status: p.status,
      waterLevel: p.waterLevel,
    })),
    mapUpdate: {
      highlightedPostCodes: posts.map((p) => p.code),
      activePostCode: posts[0]?.code ?? null,
      highlightedDistricts: districtNames,
    },
  };
}

function execFindPostsNearCity(args: { city_name: string; radius_km: number }, region: Region): ToolResult {
  const places = loadPlaces(region);
  const needle = normName(args.city_name);
  const city =
    places.find((p) => normName(p.name) === needle) ??
    places.find((p) => normName(p.name).includes(needle) || needle.includes(normName(p.name)));

  if (!city) {
    return { data: { error: `Город "${args.city_name}" не найден в базе данных.` } };
  }

  const nearby = hydropostsFor(region).filter(
    (p) => haversineKm(city.coordinates, p.coordinates) <= args.radius_km,
  );

  return {
    data: {
      city: city.name,
      radius_km: args.radius_km,
      found: nearby.length,
      posts: nearby.map((p) => ({
        code: p.code,
        label: p.label,
        waterLevel: p.waterLevel,
        status: p.status,
        distanceKm: Math.round(haversineKm(city.coordinates, p.coordinates) * 10) / 10,
      })),
    },
    mapUpdate: {
      highlightedPostCodes: nearby.map((p) => p.code),
      activePostCode: nearby[0]?.code ?? null,
      highlightedPlaceIds: [city.id],
      showPlaces: true,
    },
  };
}

function execGetHistory(args: { post_code: number }, region: Region): ToolResult {
  const post = hydropostsFor(region).find((p) => p.code === args.post_code);
  if (!post) return { data: { error: `Пост с кодом ${args.post_code} не найден.` } };

  const history = getHydropostHistory(args.post_code);
  if (!history) return { data: { error: `История для поста ${post.label} не найдена.` } };

  return {
    data: {
      post: post.label,
      years: history.stats.years,
      peakOpenWaterCm: history.stats.peakOpenWaterCm,
      peakYearCm: history.stats.peakYearCm,
      lowestOpenWaterCm: history.stats.lowestOpenWaterCm,
      records: history.history,
    },
    mapUpdate: {
      activePostCode: post.code,
      highlightedPostCodes: [post.code],
    },
  };
}

function execSpatialCoverage(args: {
  interval_km: number;
  main_rivers_only: boolean;
}, region: Region): ToolResult {
  const query = `нужно установить каждые ${args.interval_km} км вдоль рек. Считать только основные реки: ${args.main_rivers_only ? "да" : "нет"}.`;
  const result = runLocalMechanism(query, region);

  if (!result) {
    return { data: { error: "Не удалось выполнить пространственный анализ." } };
  }

  return {
    data: {
      answer: result.answer,
      existingPostsMatched: result.markers.length,
      suggestedPlacements: result.spatialOverlay?.suggestedPlacements?.length ?? 0,
      highlightedRivers: result.spatialOverlay?.highlightedWaterIds?.length ?? 0,
    },
    mapUpdate: {
      highlightedPostCodes: result.markers.map((p) => p.code),
      highlightedWaterIds: result.spatialOverlay?.highlightedWaterIds ?? [],
      suggestedPlacements: result.spatialOverlay?.suggestedPlacements ?? [],
      layer: "water",
    },
  };
}

function execFindSettlementsNearPosts(args: {
  radius_km: number;
  river?: string;
  district?: string;
}, region: Region): ToolResult {
  const places = loadPlaces(region);
  const matched = new Set<string>();

  let targetPosts = hydropostsFor(region);
  if (args.river) {
    const r = args.river.toLowerCase();
    targetPosts = targetPosts.filter((p) => p.waterBody.toLowerCase().includes(r));
  }
  if (args.district) {
    const d = args.district.toLowerCase();
    targetPosts = targetPosts.filter((p) => p.district.toLowerCase().includes(d));
  }

  for (const post of targetPosts) {
    for (const place of places) {
      if (haversineKm(post.coordinates, place.coordinates) <= args.radius_km) {
        matched.add(place.id);
      }
    }
  }

  const matchedPlaces = places.filter((p) => matched.has(p.id));
  const filterLabel = args.river
    ? `вдоль р. ${args.river}`
    : args.district
      ? `в районе ${args.district}`
      : "у всех постов";

  return {
    data: {
      filter: filterLabel,
      posts_checked: targetPosts.length,
      radius_km: args.radius_km,
      total: matchedPlaces.length,
      cities: matchedPlaces
        .filter((p) => p.kind === "city" || p.kind === "town")
        .map((p) => p.name),
      villages: matchedPlaces.filter((p) => p.kind === "village" || p.kind === "suburb").length,
    },
    mapUpdate: {
      highlightedPlaceIds: [...matched],
      showPlaces: true,
    },
  };
}

function execMarkSettlements(args: { names: string[] }, region: Region): ToolResult {
  const ids = matchPlaceNames(args.names, region);
  return {
    data: {
      requested: args.names.length,
      matched: ids.length,
      note: ids.length < args.names.length ? "Часть населённых пунктов не найдена в базе." : "Все найдены.",
    },
    mapUpdate: {
      highlightedPlaceIds: ids,
      showPlaces: true,
    },
  };
}

function execChangeLayer(args: { layer: "all" | "hydroposts" | "water" }): ToolResult {
  return {
    data: { layer: args.layer },
    mapUpdate: { layer: args.layer },
  };
}

function execHighlightDistrict(args: { district_names: string[] }): ToolResult {
  return {
    data: { highlighted: args.district_names },
    mapUpdate: { highlightedDistricts: args.district_names },
  };
}

function execResetMap(): ToolResult {
  return {
    data: { reset: true },
    mapUpdate: {
      highlightedPostCodes: [],
      highlightedWaterIds: [],
      highlightedPlaceIds: [],
      highlightedDistricts: [],
      suggestedPlacements: [],
    },
  };
}

function execDetectLowWaterRisk(args: { post_code?: number; river?: string }, region: Region): ToolResult {
  let targets = hydropostsFor(region);
  if (args.post_code != null) {
    targets = targets.filter((p) => p.code === args.post_code);
  } else if (args.river) {
    const r = args.river.toLowerCase();
    targets = targets.filter((p) => p.waterBody.toLowerCase().includes(r));
  }

  if (targets.length === 0) {
    return { data: { error: "Гидропосты не найдены по заданному критерию." } };
  }

  const results: Array<{
    post: string; code: number; river: string;
    norm: number; lastRisk: string | null; highRiskYears: number[]; years: number;
  }> = [];
  const highRiskCodes: number[] = [];
  const moderateRiskCodes: number[] = [];

  for (const post of targets) {
    const analysis = analyzeLowWaterRisk(post.code);
    if (!analysis || !analysis.hasSufficientData) continue;
    results.push({
      post: post.label,
      code: post.code,
      river: post.waterBody,
      norm: Math.round(analysis.norm),
      lastRisk: analysis.lastRisk,
      highRiskYears: analysis.highRiskYears,
      years: analysis.entries.length,
    });
    if (analysis.lastRisk === "high") highRiskCodes.push(post.code);
    else if (analysis.lastRisk === "moderate") moderateRiskCodes.push(post.code);
  }

  const highlightCodes = [...highRiskCodes, ...moderateRiskCodes];

  return {
    data: {
      analyzed: results.length,
      skipped: targets.length - results.length,
      results,
      summary: { highRisk: highRiskCodes.length, moderateRisk: moderateRiskCodes.length },
    },
    mapUpdate: highlightCodes.length > 0
      ? {
          highlightedPostCodes: highlightCodes,
          activePostCode: highRiskCodes[0] ?? moderateRiskCodes[0] ?? null,
        }
      : undefined,
  };
}

function execHighlightWater(args: { water_name: string }, region: Region): ToolResult {
  const ids = findWaterIds(args.water_name, region);
  if (ids.length === 0) {
    return { data: { error: `Водный объект "${args.water_name}" не найден в базе данных карты.` } };
  }
  return {
    data: { found: ids.length, name: args.water_name },
    mapUpdate: {
      highlightedWaterIds: ids,
      highlightedDistricts: [],
      highlightedPostCodes: [],
      layer: "water",
    },
  };
}

function execRiverWidths(args: { min_width_m?: number; river_name?: string }, region: Region): ToolResult {
  const minWidth = typeof args.min_width_m === "number" && Number.isFinite(args.min_width_m) ? args.min_width_m : 40;
  let segments = loadRiverWidths(region).filter((s) => !s.isLake && s.widthMedianM >= minWidth);

  if (args.river_name) {
    const needle = args.river_name.toLowerCase().trim();
    segments = segments.filter((s) => s.name && s.name.toLowerCase().includes(needle));
  }

  const distinctNames = new Set(segments.map((s) => s.name).filter((n): n is string => n !== null));

  return {
    data: {
      minWidthM: minWidth,
      source: "GRWL (Global River Widths from Landsat, Allen & Pavelsky 2018) — измерено участками по спутниковым снимкам, покрывает реки примерно от 30м",
      segmentsFound: segments.length,
      distinctNamedRivers: distinctNames.size,
      segments: segments.map((s) => ({
        name: s.name ?? "неопознанный участок (нет рядом именованной реки в наших данных)",
        widthMedianM: s.widthMedianM,
        widthMeanM: s.widthMeanM,
        widthMaxM: s.widthMaxM,
        lengthKm: s.lengthKm,
      })),
    },
  };
}

function executeTool(name: string, args: Record<string, unknown>, region: Region): ToolResult {
  switch (name) {
    case "filter_hydroposts":
      return execFilterHydroposts(args as Parameters<typeof execFilterHydroposts>[0], region);
    case "find_posts_near_city":
      return execFindPostsNearCity(args as Parameters<typeof execFindPostsNearCity>[0], region);
    case "get_hydropost_history":
      return execGetHistory(args as Parameters<typeof execGetHistory>[0], region);
    case "get_spatial_coverage":
      return execSpatialCoverage(args as Parameters<typeof execSpatialCoverage>[0], region);
    case "find_settlements_near_posts":
      return execFindSettlementsNearPosts(args as Parameters<typeof execFindSettlementsNearPosts>[0], region);
    case "mark_settlements":
      return execMarkSettlements(args as Parameters<typeof execMarkSettlements>[0], region);
    case "change_map_layer":
      return execChangeLayer(args as Parameters<typeof execChangeLayer>[0]);
    case "highlight_district":
      return execHighlightDistrict(args as Parameters<typeof execHighlightDistrict>[0]);
    case "reset_map":
      return execResetMap();
    case "highlight_water":
      return execHighlightWater(args as Parameters<typeof execHighlightWater>[0], region);
    case "detect_low_water_risk":
      return execDetectLowWaterRisk(args as Parameters<typeof execDetectLowWaterRisk>[0], region);
    case "get_river_widths":
      return execRiverWidths(args as Parameters<typeof execRiverWidths>[0], region);
    default:
      return { data: { error: `Unknown tool: ${name}` } };
  }
}

// ─── Session store ────────────────────────────────────────────────────────────

type Session = { messages: DeepSeekMessage[]; lastActivity: number };
const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSION_MESSAGES = 60; // ~15 turns with tool calls

function pruneExpired() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastActivity > SESSION_TTL_MS) sessions.delete(id);
  }
}

function getSessionMessages(id: string): DeepSeekMessage[] {
  const s = sessions.get(id);
  if (!s || Date.now() - s.lastActivity > SESSION_TTL_MS) return [];
  return s.messages;
}

function setSessionMessages(id: string, msgs: DeepSeekMessage[]) {
  const trimmed = msgs.length > MAX_SESSION_MESSAGES
    ? msgs.slice(msgs.length - MAX_SESSION_MESSAGES)
    : msgs;
  sessions.set(id, { messages: trimmed, lastActivity: Date.now() });
  if (sessions.size > 200) pruneExpired();
}

// ─── Per-user rate limit ──────────────────────────────────────────────────────
// Best-effort, in-memory (resets per serverless instance) — deters runaway loops
// and casual abuse from a single authenticated account, not a hard guarantee.

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 15;
const rateLimitHits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (rateLimitHits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitHits.set(key, hits);
    return true;
  }
  hits.push(now);
  rateLimitHits.set(key, hits);
  if (rateLimitHits.size > 500) {
    for (const [k, v] of rateLimitHits) {
      if (v.every((t) => now - t > RATE_LIMIT_WINDOW_MS)) rateLimitHits.delete(k);
    }
  }
  return false;
}

// ─── LLM agent ────────────────────────────────────────────────────────────────

// LLM_BACKEND=ollama switches to a locally-hosted model via Ollama's OpenAI-compatible
// endpoint (same request/response shape as DeepSeek, so runAgent needs no branching
// beyond the base URL/model/auth below). Kept behind an env flag rather than replacing
// DeepSeek outright so it's a one-line rollback if the local model underperforms.
const LLM_BACKEND = process.env.LLM_BACKEND === "ollama" ? "ollama" : "deepseek";
const MODEL =
  LLM_BACKEND === "ollama"
    ? (process.env.OLLAMA_MODEL ?? "qwen2.5:3b-instruct-q4_K_M")
    : (process.env.DEEPSEEK_MODEL ?? "deepseek-chat");
const LLM_ENDPOINT =
  LLM_BACKEND === "ollama"
    ? `${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}/v1/chat/completions`
    : "https://api.deepseek.com/chat/completions";

type RegionMeta = {
  regionTitle: string;
  postCount: number;
  factsBlock: string;
  exampleDistricts: string;
  exampleRiver: string;
  exampleWaterNames: string;
};

const REGION_META: Record<Region, RegionMeta> = {
  akmola: {
    regionTitle: "Акмолинской области",
    postCount: 28,
    factsBlock: [
      "• 28 гидропостов на реках и озёрах Акмолинской области",
      "• Районы с гидропостами: Аккольский, Аршалынский, Астраханский, Атбасарский, Буландынский, Бурабайский, Ерейментауский, Есильский, Жаркаинский, Зерендинский, Коргалжынский, Сандыктауский, Целиноградский, Шортандинский, Астана (город), Кокшетау (город)",
      "• Реки с постами: р. Есиль (Ишим), р. Нура, р. Жабай, р. Силеты, р. Селеты, р. Калкутан, р. Терисаккан, р. Жыланды, р. Аршалы, р. Мойылды, р. Боксук, р. Шагалалы",
      "• Озёра/водохранилища: оз. Бурабай, оз. Копа, оз. Зеренды, оз. Шортан, Астанинское водохранилище",
      "• Исторические ряды наблюдений: по 20 постам за 2016–2022 гг. (по некоторым — с 1940–1970-х) — данные по каждому году (наивысший уровень, открытая вода макс/мин, амплитуда)",
      "• Населённые пункты области в базе: города, посёлки, сёла с координатами",
    ].join("\n"),
    exampleDistricts: `"Аршалынский район", "г. Кокшетау", "Есильский район"`,
    exampleRiver: "Есиль",
    exampleWaterNames: `"Есиль", "Нура", "Жабай", "Силеты", "Бурабай", "Копа", "Зеренды", "Шортан"`,
  },
  kyzylorda: {
    regionTitle: "Кызылординской области",
    postCount: 13,
    factsBlock: [
      "• 13 гидропостов: большинство на реке Сырдарья (включая протоку Караозек) и на Малом Аральском море, один — Бесарык — на одноимённой реке/канале",
      "• Районы с гидропостами: Жанакорганский, Шиелийский, Сырдарьинский, Кармакшинский, Казалинский, Аральский районы, Кызылординская городская администрация",
      "• Реки с постами: р. Сырдарья (в т.ч. протока Караозек), р. Бесарык",
      "• Водоёмы: Аральское море, Малое Аральское море (район Кокаральской плотины)",
      "• Исторические ряды наблюдений по этим постам ПОКА НЕ ПОДКЛЮЧЕНЫ — будут добавлены позже",
      "• Текущий уровень воды (waterLevel) для всех постов этого региона — ПЛЕЙСХОЛДЕР (0), это НЕ реальное измерение. Если спрашивают про текущий уровень или статус конкретного поста — честно говори, что данные по текущему уровню ещё не подключены, НИКОГДА не называй 0 см как настоящий уровень воды",
      "• Населённые пункты области в базе: города, посёлки, сёла с координатами",
    ].join("\n"),
    exampleDistricts: `"Казалинский район", "Аральский район", "Кызылординская городская администрация"`,
    exampleRiver: "Сырдарья",
    exampleWaterNames: `"Сырдарья", "Аральское море", "Малое Аральское море"`,
  },
};

function buildSystemPrompt(region: Region, includeDataDump: boolean): string {
  const meta = REGION_META[region];
  const posts = hydropostsFor(region);
  const dataSection = includeDataDump
    ? `Текущие данные гидропостов:
${JSON.stringify(
  posts.map((p) => ({
    code: p.code,
    label: p.label,
    waterBody: p.waterBody,
    district: p.district,
    status: p.status,
    waterLevel: p.waterLevel,
  })),
  null,
  0,
)}`
    : `Данные по гидропостам сюда не включены (чтобы не раздувать промпт) — если нужен полный список постов с их статусом/уровнем, вызови filter_hydroposts(status="any").`;
  return `Ты — AI-ассистент AI Gidromap, интерактивной карты мониторинга гидропостов ${meta.regionTitle} Казахстана.

━━ ДАННЫЕ В СИСТЕМЕ ━━
${meta.factsBlock}

━━ КАРТА — ТЫ УМЕЕШЬ ЕЁ РЕДАКТИРОВАТЬ ━━
У тебя есть полный контроль над картой. ВСЕГДА вызывай инструменты для обновления карты.

ИНСТРУМЕНТЫ КАРТЫ:

filter_hydroposts — подсветить посты, автоматически выделяет и район
  → status: danger/warning/normal/any | river: название реки | district: название района

highlight_district — подсветить район(ы) оранжевой рамкой на карте
  → ОБЯЗАТЕЛЬНО вызывай при: "выдели район", "покажи район", "выдели его", "покажи на карте", "отметь район"
  → "выдели этот район" / "его" / "этот" = используй район из предыдущего контекста разговора
  → district_names: точные названия — ${meta.exampleDistricts} и т.д.

reset_map — очистить все выделения
  → при: "очисти", "сбрось", "убери выделение", "покажи всё"

highlight_water — выделить реку или озеро синими линиями на карте
  → ОБЯЗАТЕЛЬНО вызывай при: "выдели реку", "покажи реку", "выдели озеро", "выдели р. ${meta.exampleRiver}" и любых похожих
  → water_name: только название БЕЗ префиксов — ${meta.exampleWaterNames}

change_map_layer — переключить слой
  → "водные объекты" → water | "только посты" → hydroposts | "все" → all

get_hydropost_history — история/динамика уровней по годам конкретного поста

find_posts_near_city — посты в радиусе от города

get_spatial_coverage — где установить новые посты

find_settlements_near_posts — сёла вдоль реки или района (параметры: radius_km, river, district)

mark_settlements — отметить конкретные населённые пункты

detect_low_water_risk — анализ риска маловодья по историческим минимумам открытого русла
  → post_code: код поста | river: название реки
  → ВЫЗЫВАЙ при: "риск маловодья", "маловодье на реке", "исторически низкий уровень", "маловодный год"
  → подсвечивает посты с умеренным и высоким риском на карте

get_river_widths — реки/участки рек шириной от заданного порога (по умолчанию 40м)
  → min_width_m: порог в метрах | river_name: фильтр по названию (необязательно)
  → ВЫЗЫВАЙ при: "реки шириной от N метров", "сколько рек шире N метров", "ширина реки X"
  → данные из GRWL (спутниковые измерения) — покрывают не всю речную сеть, только реки примерно от 30м, участками. Если реки нет в ответе — это не значит, что она узкая, просто GRWL её не измерил. Если пользователь просит просто "самые широкие реки" без числа — используй min_width_m=40 как разумный порог по умолчанию

━━ АЛГОРИТМЫ ━━
• "посты в [район]" → filter_hydroposts(district=...) — район подсвечивается автоматически
• "выдели [район]" / "покажи [район] на карте" → highlight_district(district_names=[...])
• "выдели этот/его/их" → highlight_district с районом/постами из предыдущего ответа
• "выдели реку [название]" / "покажи реку [название]" → highlight_water(water_name=[название])
• "выдели р. ${meta.exampleRiver}" → highlight_water(water_name="${meta.exampleRiver}")
• "риск маловодья на р. [название]" → detect_low_water_risk(river=...)
• "самый опасный/критичный гидропост" (без указания реки/района) → filter_hydroposts(status="danger", sort_by="level_desc") и назови пост с наименьшим отклонением от нормы из результата — НИКОГДА не вызывай detect_low_water_risk без river или post_code и не придумывай post_code самостоятельно
• "динамика на [река]" → filter_hydroposts + get_hydropost_history для каждого поста
• "сёла вдоль [река]" → find_settlements_near_posts(river=..., radius_km=20)
• "реки шириной от N метров" / "какие реки широкие" → get_river_widths(min_width_m=N)

━━ ПРАВИЛА ━━
- Никогда не говори "я не могу выделить район" — инструмент highlight_district для этого и существует
- Язык ответа = язык вопроса (рус/каз/англ)
- "их", "эти посты", "этот район", "там" = объект из предыдущего контекста разговора
- Ответы краткие; данные за 2016–2022 — упоминай при необходимости
- Если тебя спрашивают, на какой основе ты работаешь (Claude, DeepSeek, GPT, Gemini, OpenAI и т.д.) — не отвечай. Отвечай строго: «Я — AI-ассистент системы AI Gidromap. Информация о применяемых технологиях является конфиденциальной.» Не подтверждай и не отрицай название конкретной модели.
- Цвет выделения рек и водных объектов на карте ФИКСИРОВАН — всегда голубой/циановый. Изменить цвет нельзя. Если пользователь просит другой цвет — выдели водный объект стандартным способом и кратко поясни: «Цвет выделения фиксирован — голубой».
- Если в запросе есть данные о погоде — используй их при анализе гидрологической ситуации. Осадки за 24 ч ≥ 20 мм — высокий риск подъёма уровней через 12–48 ч. Снеготаяние (оценка температурным методом, не измерение) ≥ 15 мм воды за 24 ч — также высокий риск подъёма уровней, особенно весной.
- В данных НЕТ информации о том, какой пост выше или ниже по течению относительно другого, и нет связей между постами вообще — только code, label, waterBody, district, status, waterLevel по каждому посту отдельно. Никогда не утверждай, что один пост "upstream"/"downstream" по отношению к другому, что "волна" или изменение уровня дойдёт от одного поста до другого, или любую другую причинно-следственную связь между постами — таких данных нет, и придумывать их нельзя. Если вопрос требует именно такой связи (влияние одного поста/города на другой, порядок по течению и т.п.) — прямо ответь, что для этого вывода нет данных в системе, вместо того чтобы предполагать.

${dataSection}`;
}

type DeepSeekMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
};

// Qwen3 via Ollama has a documented multi-turn bug: a reply that thinks then
// calls a tool with no other text leaves an unclosed <think> tag, corrupting
// every later turn (ollama/ollama#14493, #11135). Strip any think-tag remnants
// (closed or not) from history before resending, regardless of root cause.
function stripThinkTags(content: string): string {
  return content.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();
}

// Keeps the most recent messages, then drops any leading "tool" messages —
// a tool result is only valid immediately after the assistant message that
// requested it, so a slice can't safely start mid-tool-exchange.
//
// Also shortens older assistant replies: testing on-hardware showed even one
// prior *verbose* text answer (a paragraph of prose) reliably threw off the next
// turn's tool selection on small local models — they'd narrate what tool *should*
// be called instead of calling it. Truncating old assistant prose to a short
// summary keeps just enough for pronoun references ("этот район") without
// drowning the next tool decision in leftover explanation text.
function trimPriorForLocalModel(prior: DeepSeekMessage[], maxMessages = 4): DeepSeekMessage[] {
  let trimmed = prior.slice(-maxMessages);
  while (trimmed.length > 0 && trimmed[0].role === "tool") trimmed = trimmed.slice(1);
  return trimmed.map((m, i) => {
    const isLast = i === trimmed.length - 1;
    if (m.role === "assistant" && m.content) {
      const cleaned = stripThinkTags(m.content);
      if (!isLast && cleaned.length > 150) return { ...m, content: `${cleaned.slice(0, 150)}…` };
      if (cleaned !== m.content) return { ...m, content: cleaned };
    }
    return m;
  });
}

async function runAgent(
  query: string,
  sessionId: string,
  mapContext: string | null,
  region: Region,
): Promise<{ answer: string; mapUpdate: Partial<MapState> | null }> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (LLM_BACKEND === "deepseek" && !key) throw new Error("DEEPSEEK_API_KEY missing");

  // Resending the full conversation history every turn is fine for DeepSeek's cloud
  // inference, but on CPU-only local inference it makes context grow without bound —
  // a single prior exchange pushed one real test from ~2100 to ~7000 prompt tokens,
  // taking prompt processing from ~15s to ~100s+ and visibly degrading answer quality.
  // Cap history to the last few messages for Ollama; DeepSeek keeps the full history.
  const prior = LLM_BACKEND === "ollama" ? trimPriorForLocalModel(getSessionMessages(sessionId)) : getSessionMessages(sessionId);

  // The hydropost data dump is the single biggest cost on CPU-only local inference
  // (see qwen-local-llm-benchmark) — only DeepSeek's cloud inference can afford it
  // unconditionally. Ollama-backed sessions fall back to the filter_hydroposts tool.
  const messages: DeepSeekMessage[] = [
    { role: "system", content: buildSystemPrompt(region, LLM_BACKEND !== "ollama") },
    ...prior,
  ];

  const userContent = mapContext ? `${mapContext}\n\n${query}` : query;
  messages.push({ role: "user", content: userContent });

  let accumulatedMapUpdate: Partial<MapState> | null = null;

  // Agent loop — up to 8 iterations (handles multi-step tool use)
  for (let i = 0; i < 8; i++) {
    const res = await fetch(LLM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_BACKEND === "ollama" ? "ollama" : key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools: TOOLS,
        tool_choice: "auto",
        max_tokens: 1200,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${LLM_BACKEND} ${res.status}: ${text}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;

    if (!msg) throw new Error(`Empty response from ${LLM_BACKEND}`);

    messages.push(msg);

    // No tool calls — final answer
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      setSessionMessages(sessionId, messages.slice(1));
      return {
        answer: msg.content ?? "Готово.",
        mapUpdate: accumulatedMapUpdate,
      };
    }

    // Execute each tool call
    for (const toolCall of msg.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      const result = executeTool(toolCall.function.name, args, region);

      // Merge map updates
      if (result.mapUpdate) {
        accumulatedMapUpdate = { ...(accumulatedMapUpdate ?? {}), ...result.mapUpdate };
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result.data),
      });
    }
  }

  setSessionMessages(sessionId, messages.slice(1));
  return {
    answer: "Не удалось завершить анализ. Попробуй переформулировать запрос.",
    mapUpdate: accumulatedMapUpdate,
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

const ChatBodySchema = z.object({
  query: z.string().trim().min(1).max(2000),
  sessionId: z.string().max(200).optional(),
  chatId: z.string().max(200).optional(),
  mapContext: z.string().max(4000).optional(),
  region: z.enum(["akmola", "kyzylorda"]).default("akmola"),
});

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = ChatBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const body = parsed.data;
  const query = body.query;

  // chatId takes priority (used when auth is enabled); sessionId is legacy fallback
  const sessionId = body.chatId ?? body.sessionId ?? crypto.randomUUID();
  const auth = await getAuthFromToken(request.cookies.get("auth_token")?.value, process.env.AUTH_SECRET);

  if (isRateLimited(auth?.email ?? sessionId)) {
    return NextResponse.json(
      { answer: "Слишком много запросов. Подожди минуту и попробуй снова.", mapUpdate: null, sessionId } satisfies ChatResponse,
      { status: 429 },
    );
  }

  let resp: ChatResponse;
  try {
    const { answer, mapUpdate } = await runAgent(query, sessionId, body.mapContext ?? null, body.region);
    resp = { answer, mapUpdate, clarification: null, sessionId };
  } catch (err) {
    console.error("[Agent error]", err);
    resp = {
      answer: "Произошла ошибка при обработке запроса. Проверь баланс DeepSeek или попробуй позже.",
      mapUpdate: null,
      sessionId,
    } satisfies ChatResponse;
  }

  if (auth?.email) {
    await logActivity({
      email: auth.email,
      name: auth.name,
      role: auth.role,
      action: "chat_query",
      details: { query, answer: resp.answer, sessionId },
    });
  }

  return NextResponse.json(resp);
}

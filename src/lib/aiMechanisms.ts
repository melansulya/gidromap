import fs from "node:fs";
import path from "node:path";
import {
  getHydropostHistory,
  hydroposts,
  pickLocalResult,
  type Hydropost,
} from "@/lib/akmolaMapData";

export type QueryMechanism =
  | "reference"
  | "operational"
  | "historical"
  | "spatial"
  | "generic";

export type QueryOperation =
  | "reference_post_info"
  | "operational_filter_posts"
  | "operational_count_posts_by_district"
  | "operational_count_posts_by_river"
  | "operational_extreme_levels"
  | "historical_summary"
  | "historical_missing"
  | "spatial_nearest_posts"
  | "spatial_spacing_coverage"
  | "generic_fallback";

export type MechanismResult = {
  mechanism: QueryMechanism;
  operation: QueryOperation;
  answer: string;
  bestMatch: Hydropost;
  markers: Hydropost[];
  clarification?: {
    kind: "main_rivers_only";
    question: string;
  };
  spatialOverlay?: {
    highlightedWaterIds: string[];
    suggestedPlacements: Array<{
      id: string;
      label: string;
      coordinates: [number, number];
    }>;
  };
};

function normalize(text: string) {
  return text.toLowerCase().trim();
}

function matchesAny(query: string, tokens: string[]) {
  return tokens.some((token) => query.includes(token));
}

function classifyQuery(text: string): QueryMechanism {
  const query = normalize(text);

  if (
    matchesAny(query, [
      "минимальное расстояние",
      "минимальное растояние",
      "минимальная дистанция",
      "ближайшие гидропосты",
      "между гидропостами",
      "сколько постов",
      "сколько гидропостов",
      "каждые 10 км",
      "через 10 км",
      "каждые",
      "вдоль рек",
      "вдоль реки",
      "покрытие",
      "где установить",
      "нужно установить",
      "где поставить",
      "нужно поставить",
      "проставь",
      "расставить",
      "расставь",
      "точки постов",
      "новые посты",
      "новых постов",
      "новые гидропосты",
      "новых гидропостов",
      "рекомендуемые посты",
      "дефицит постов",
      "не хватает постов",
    ])
  ) {
    return "spatial";
  }

  if (
    matchesAny(query, [
      "история",
      "истор",
      "максимум за ряд",
      "минимум за ряд",
      "период наблюдений",
      "по годам",
      "последний год",
      "длина ряда",
    ])
  ) {
    return "historical";
  }

  if (
    matchesAny(query, [
      "где находится",
      "код",
      "какой район",
      "к какой реке",
      "что за пост",
      "информация о посте",
      "какой водный объект",
    ])
  ) {
    return "reference";
  }

  if (
    matchesAny(query, [
      "покажи",
      "какие",
      "сколько",
      "сравни",
      "в красной зоне",
      "warning",
      "danger",
      "максимальный уровень",
      "средний уровень",
      "уровень воды",
      "гидропосты",
    ])
  ) {
    return "operational";
  }

  return "generic";
}

function resolveOperation(query: string, mechanism: QueryMechanism): QueryOperation {
  const text = normalize(query);

  if (mechanism === "reference") {
    return "reference_post_info";
  }

  if (mechanism === "historical") {
    if (matchesAny(text, ["без истории", "нет истории", "не подключена история"])) {
      return "historical_missing";
    }
    return "historical_summary";
  }

  if (mechanism === "spatial") {
    if (
      matchesAny(text, [
        "минимальное расстояние",
        "минимальное растояние",
        "минимальная дистанция",
        "ближайшие гидропосты",
      ]) &&
      matchesAny(text, ["между гидропостами", "гидропостами", "гидропостов"])
    ) {
      return "spatial_nearest_posts";
    }
    return "spatial_spacing_coverage";
  }

  if (mechanism === "operational") {
    if (
      text.includes("сколько") &&
      matchesAny(text, ["в районе", "по району", "район", "округе", "области"])
    ) {
      return "operational_count_posts_by_district";
    }

    if (
      text.includes("сколько") &&
      matchesAny(text, ["на ", "по реке", "река", "р."])
    ) {
      return "operational_count_posts_by_river";
    }

    if (matchesAny(text, [
      "максимальный уровень", "минимальный уровень",
      "самый высокий", "самый низкий",
      "самый опасный", "наиболее опасный", "самый критичный",
      "хуже всего", "критическ", "самый плохой",
      "самый высок", "самый низк",
    ])) {
      return "operational_extreme_levels";
    }

    return "operational_filter_posts";
  }

  return "generic_fallback";
}

function scoreHydropost(post: Hydropost, query: string) {
  let score = 0;
  const text = normalize(query);

  if (text.includes(post.label.toLowerCase())) {
    score += 8;
  }

  if (text.includes(post.district.toLowerCase())) {
    score += 4;
  }

  if (text.includes(post.waterBody.toLowerCase())) {
    score += 4;
  }

  if (text.includes(String(post.code))) {
    score += 10;
  }

  for (const topic of post.topics) {
    if (text.includes(topic.toLowerCase())) {
      score += 3;
    }
  }

  return score;
}

function resolveBestMatch(query: string) {
  const ranked = hydroposts
    .map((post) => ({ post, score: scoreHydropost(post, query) }))
    .sort((left, right) => right.score - left.score || right.post.waterLevel - left.post.waterLevel);

  return ranked[0]?.score ? ranked[0].post : pickLocalResult(query).bestMatch;
}

function handleReference(query: string): MechanismResult {
  const bestMatch = resolveBestMatch(query);
  const history = getHydropostHistory(bestMatch.code);

  return {
    mechanism: "reference",
    operation: "reference_post_info",
    answer: [
      `Гидропост ${bestMatch.label}.`,
      `Код поста: ${bestMatch.code}.`,
      `Административный район: ${bestMatch.district}.`,
      `Водный объект: ${bestMatch.waterBody}.`,
      `Текущий уровень: ${bestMatch.waterLevel} см.`,
      history
        ? `История подключена, длина ряда: ${history.stats.years} лет.`
        : "История по посту пока не подключена.",
    ].join(" "),
    bestMatch,
    markers: [bestMatch],
  };
}

function handleOperational(query: string): MechanismResult {
  const fallback = pickLocalResult(query);
  return {
    mechanism: "operational",
    operation: "operational_filter_posts",
    answer: fallback.answer,
    bestMatch: fallback.bestMatch,
    markers: fallback.markers,
  };
}

function handleOperationalCountByDistrict(query: string): MechanismResult {
  const text = normalize(query);
  const districtMatches = hydroposts.filter(
    (post) =>
      text.includes(post.district.toLowerCase()) ||
      post.topics.some((topic) => text.includes(topic.toLowerCase())),
  );
  const markers = districtMatches.length > 0 ? districtMatches : pickLocalResult(query).markers;
  const bestMatch = markers[0] ?? pickLocalResult(query).bestMatch;

  return {
    mechanism: "operational",
    operation: "operational_count_posts_by_district",
    answer:
      districtMatches.length > 0
        ? `В выбранном административном районе найдено ${districtMatches.length} гидропост(а/ов).`
        : `Точное совпадение по административному району не найдено. Показываю ближайшую выборку из ${markers.length} гидропост(а/ов).`,
    bestMatch,
    markers,
  };
}

function handleOperationalCountByRiver(query: string): MechanismResult {
  const text = normalize(query);
  const riverMatches = hydroposts.filter(
    (post) =>
      text.includes(post.waterBody.toLowerCase()) ||
      post.topics.some((topic) => text.includes(topic.toLowerCase())),
  );
  const markers = riverMatches.length > 0 ? riverMatches : pickLocalResult(query).markers;
  const bestMatch = markers[0] ?? pickLocalResult(query).bestMatch;

  return {
    mechanism: "operational",
    operation: "operational_count_posts_by_river",
    answer:
      riverMatches.length > 0
        ? `На выбранном водном объекте найдено ${riverMatches.length} гидропост(а/ов).`
        : `Точное совпадение по водному объекту не найдено. Показываю ближайшую выборку из ${markers.length} гидропост(а/ов).`,
    bestMatch,
    markers,
  };
}

function handleOperationalExtremes(query: string): MechanismResult {
  const text = normalize(query);
  const wantMin = matchesAny(text, ["минимальный уровень", "самый низкий", "минимум"]);
  const wantDanger = matchesAny(text, ["опасн", "критичн", "плохой", "хуже"]);

  let pool = [...hydroposts];
  if (wantDanger) pool = pool.filter((p) => p.status === "danger");
  if (pool.length === 0) pool = [...hydroposts];

  const sorted = pool.sort((a, b) =>
    wantMin ? a.waterLevel - b.waterLevel : b.waterLevel - a.waterLevel,
  );
  const bestMatch = sorted[0];
  const markers = sorted.slice(0, 3);

  const dangerLabel = wantDanger
    ? `Самый опасный гидропост — ${bestMatch.label}: уровень ${bestMatch.waterLevel} см, статус DANGER.`
    : wantMin
      ? `Минимальный текущий уровень зафиксирован на гидропосту ${bestMatch.label}: ${bestMatch.waterLevel} см.`
      : `Максимальный текущий уровень зафиксирован на гидропосту ${bestMatch.label}: ${bestMatch.waterLevel} см.`;

  return {
    mechanism: "operational",
    operation: "operational_extreme_levels",
    answer: dangerLabel,
    bestMatch,
    markers,
  };
}

function handleHistorical(query: string): MechanismResult {
  const bestMatch = resolveBestMatch(query);
  const history = getHydropostHistory(bestMatch.code);

  if (!history || history.history.length === 0) {
    return {
      mechanism: "historical",
      operation: "historical_summary",
      answer: `Для гидропоста ${bestMatch.label} исторический ряд наблюдений пока не подключён.`,
      bestMatch,
      markers: [bestMatch],
    };
  }

  const firstYear = history.history[0]?.year ?? "—";
  const lastYear = history.history[history.history.length - 1]?.year ?? "—";

  return {
    mechanism: "historical",
    operation: "historical_summary",
    answer: [
      `История по гидропосту ${bestMatch.label}.`,
      `Период наблюдений: ${firstYear}–${lastYear}.`,
      `Длина ряда: ${history.stats.years} лет.`,
      `Наибольший уровень: ${history.stats.peakOpenWaterCm ?? "—"} см.`,
      `Наименьший уровень: ${history.stats.lowestOpenWaterCm ?? "—"} см.`,
    ].join(" "),
    bestMatch,
    markers: [bestMatch],
  };
}

function handleHistoricalMissing(query: string): MechanismResult {
  const markers = hydroposts.filter((post) => !getHydropostHistory(post.code));
  const bestMatch = markers[0] ?? resolveBestMatch(query);

  return {
    mechanism: "historical",
    operation: "historical_missing",
    answer:
      markers.length > 0
        ? `История пока не подключена для ${markers.length} гидропост(а/ов).`
        : "Для всех гидропостов из текущей выборки история подключена.",
    bestMatch,
    markers: markers.length > 0 ? markers : [bestMatch],
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceKm(a: [number, number], b: [number, number]) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b[1] - a[1]);
  const dLon = toRadians(b[0] - a[0]);
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function polylineLengthKm(points: [number, number][]) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += distanceKm(points[index - 1], points[index]);
  }
  return length;
}

type ProjectedPost = {
  post: Hydropost;
  distanceToRiverKm: number;
  chainageKm: number;
};

type RiverCoverage = {
  id: string;
  name: string;
  lengthKm: number;
  posts: Hydropost[];
  missingPosts: number;
  maxGapKm: number;
  requiredPosts: number;
  suggestedPlacements: Array<{
    id: string;
    label: string;
    coordinates: [number, number];
  }>;
  highlightedWaterIds: string[];
};

type ServerWaterway = {
  id: string;
  name: string;
  kind: "river" | "lake" | "reservoir";
  geometry: "polyline" | "polygon";
  coordinates: [number, number][] | [number, number][][];
};

type RiverGroup = {
  key: string;
  name: string;
  segments: Array<{
    id: string;
    coordinates: [number, number][];
    lengthKm: number;
  }>;
};

let cachedServerWaterways: ServerWaterway[] | null = null;

function loadServerWaterways(): ServerWaterway[] {
  if (cachedServerWaterways) {
    return cachedServerWaterways;
  }

  const filePath = path.join(process.cwd(), "public", "akmola-waterways.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as ServerWaterway[];
  cachedServerWaterways = parsed;
  return parsed;
}

function normalizeWaterBodyName(value: string) {
  return value
    .toLowerCase()
    .replaceAll("ё", "е")
    .replaceAll("й", "и")
    .replaceAll("қ", "к")
    .replaceAll("ң", "н")
    .replaceAll("ғ", "г")
    .replaceAll("ү", "у")
    .replaceAll("ұ", "у")
    .replaceAll("ө", "о")
    .replaceAll("һ", "х")
    .replace(/\b(р|р\.|река|оз|оз\.|озеро|водохранилище|канал)\b/g, " ")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericWaterwayName(name: string) {
  return ["river", "stream", "ditch", "drain", "canal"].includes(name.toLowerCase().trim());
}

function getRiverGroups(): RiverGroup[] {
  const grouped = new Map<string, RiverGroup>();

  for (const object of loadServerWaterways()) {
    if (object.kind !== "river" || object.geometry !== "polyline") {
      continue;
    }

    if (isGenericWaterwayName(object.name)) {
      continue;
    }

    const key = normalizeWaterBodyName(object.name);
    if (!key) {
      continue;
    }

    const segment = {
      id: object.id,
      coordinates: object.coordinates as [number, number][],
      lengthKm: polylineLengthKm(object.coordinates as [number, number][]),
    };

    const existing = grouped.get(key);
    if (existing) {
      existing.segments.push(segment);
      continue;
    }

    grouped.set(key, {
      key,
      name: object.name,
      segments: [segment],
    });
  }

  return [...grouped.values()];
}

function resolveMainRiverPreference(query: string): boolean | null {
  const text = normalize(query);

  if (
    matchesAny(text, [
      "только основные реки",
      "основные реки да",
      "считать только основные реки",
      "учитывать только основные реки",
      "только крупные реки",
    ])
  ) {
    return true;
  }

  if (
    matchesAny(text, [
      "основные реки нет",
      "не только основные реки",
      "все реки",
      "все русла",
      "всю речную сеть",
    ])
  ) {
    return false;
  }

  return null;
}

function isMainRiver(group: RiverGroup) {
  const key = group.key;
  const totalLengthKm = group.segments.reduce((sum, segment) => sum + segment.lengthKm, 0);
  const majorKeys = new Set([
    "есил",
    "ишим",
    "нура",
    "силети",
    "селеты",
    "жабаи",
    "шагагалы",
    "шагалалы",
    "калкутан",
    "терисаккан",
    "жыланды",
    "аршалы",
    "моиылды",
    "боксук",
  ]);

  return majorKeys.has(key) || totalLengthKm >= 50;
}

function projectPointToSegment(
  point: [number, number],
  start: [number, number],
  end: [number, number],
) {
  const ax = start[0];
  const ay = start[1];
  const bx = end[0];
  const by = end[1];
  const px = point[0];
  const py = point[1];
  const dx = bx - ax;
  const dy = by - ay;
  const segmentLengthSq = dx * dx + dy * dy;

  if (segmentLengthSq === 0) {
    return {
      point: start,
      t: 0,
    };
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / segmentLengthSq));
  return {
    point: [ax + dx * t, ay + dy * t] as [number, number],
    t,
  };
}

function projectPostToRiver(
  post: Hydropost,
  coordinates: [number, number][],
): ProjectedPost | null {
  if (coordinates.length < 2) {
    return null;
  }

  let bestDistanceKm = Number.POSITIVE_INFINITY;
  let bestChainageKm = 0;
  let traversedKm = 0;

  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1];
    const end = coordinates[index];
    const segmentLengthKm = distanceKm(start, end);
    const projection = projectPointToSegment(post.coordinates, start, end);
    const projectedDistanceKm = distanceKm(post.coordinates, projection.point);

    if (projectedDistanceKm < bestDistanceKm) {
      bestDistanceKm = projectedDistanceKm;
      bestChainageKm = traversedKm + segmentLengthKm * projection.t;
    }

    traversedKm += segmentLengthKm;
  }

  return {
    post,
    distanceToRiverKm: bestDistanceKm,
    chainageKm: bestChainageKm,
  };
}

function pointAtChainageWithIndex(
  coordinates: [number, number][],
  targetKm: number,
) {
  if (coordinates.length === 0) {
    return { point: [0, 0] as [number, number], segmentIndex: 0 };
  }

  let traversedKm = 0;

  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1];
    const end = coordinates[index];
    const segmentLengthKm = distanceKm(start, end);

    if (traversedKm + segmentLengthKm >= targetKm) {
      const remainingKm = targetKm - traversedKm;
      const ratio = segmentLengthKm === 0 ? 0 : remainingKm / segmentLengthKm;
      return {
        point: [
          start[0] + (end[0] - start[0]) * ratio,
          start[1] + (end[1] - start[1]) * ratio,
        ] as [number, number],
        segmentIndex: index,
      };
    }

    traversedKm += segmentLengthKm;
  }

  return {
    point: coordinates[coordinates.length - 1],
    segmentIndex: Math.max(1, coordinates.length - 1),
  };
}

function angleBetweenSegments(
  previousPoint: [number, number],
  currentPoint: [number, number],
  nextPoint: [number, number],
) {
  const vectorA: [number, number] = [
    currentPoint[0] - previousPoint[0],
    currentPoint[1] - previousPoint[1],
  ];
  const vectorB: [number, number] = [
    nextPoint[0] - currentPoint[0],
    nextPoint[1] - currentPoint[1],
  ];
  const magnitudeA = Math.hypot(vectorA[0], vectorA[1]);
  const magnitudeB = Math.hypot(vectorB[0], vectorB[1]);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 180;
  }

  const cosine =
    (vectorA[0] * vectorB[0] + vectorA[1] * vectorB[1]) / (magnitudeA * magnitudeB);
  const clamped = Math.max(-1, Math.min(1, cosine));
  return (Math.acos(clamped) * 180) / Math.PI;
}

function isStraightEnoughAtSegment(
  coordinates: [number, number][],
  segmentIndex: number,
  minAngleDegrees = 135,
) {
  if (segmentIndex <= 1 || segmentIndex >= coordinates.length - 1) {
    return true;
  }

  const previousPoint = coordinates[segmentIndex - 1];
  const currentPoint = coordinates[segmentIndex];
  const nextPoint = coordinates[segmentIndex + 1];
  return angleBetweenSegments(previousPoint, currentPoint, nextPoint) >= minAngleDegrees;
}

function buildSuggestedPlacementsForSegments(
  group: RiverGroup,
  targetCount: number,
  spacingKm: number,
) {
  if (targetCount <= 0) {
    return [];
  }

  const segments = [...group.segments].sort((left, right) => right.lengthKm - left.lengthKm);
  const placements: Array<{
    id: string;
    label: string;
    coordinates: [number, number];
  }> = [];

  for (const segment of segments) {
    if (placements.length >= targetCount) {
      break;
    }

    if (segment.coordinates.length < 2 || segment.lengthKm < spacingKm * 0.6) {
      continue;
    }

    const countForSegment = Math.max(1, Math.floor(segment.lengthKm / spacingKm));
    for (let step = 1; step <= countForSegment; step += 1) {
      if (placements.length >= targetCount) {
        break;
      }

      const chainageKm = Math.min(step * spacingKm, Math.max(segment.lengthKm - 0.5, 0));
      const candidate = pointAtChainageWithIndex(segment.coordinates, chainageKm);

      if (!isStraightEnoughAtSegment(segment.coordinates, candidate.segmentIndex)) {
        continue;
      }

      placements.push({
        id: `${group.key}-suggested-${placements.length + 1}`,
        label: `${group.name} · рекоменд. пост ${placements.length + 1}`,
        coordinates: candidate.point,
      });
    }
  }

  return placements;
}

function handleNearestHydropostDistance(): MechanismResult {
  if (hydroposts.length < 2) {
    const fallbackPost = hydroposts[0] ?? pickLocalResult("гидропосты").bestMatch;
    return {
      mechanism: "spatial",
      operation: "spatial_nearest_posts",
      answer: "Для расчёта расстояния между гидропостами недостаточно данных.",
      bestMatch: fallbackPost,
      markers: fallbackPost ? [fallbackPost] : [],
      spatialOverlay: {
        highlightedWaterIds: [],
        suggestedPlacements: [],
      },
    };
  }

  let nearestPair: [Hydropost, Hydropost] | null = null;
  let nearestDistanceKm = Number.POSITIVE_INFINITY;

  for (let leftIndex = 0; leftIndex < hydroposts.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < hydroposts.length; rightIndex += 1) {
      const left = hydroposts[leftIndex];
      const right = hydroposts[rightIndex];
      const distanceBetweenPosts = distanceKm(left.coordinates, right.coordinates);

      if (distanceBetweenPosts < nearestDistanceKm) {
        nearestDistanceKm = distanceBetweenPosts;
        nearestPair = [left, right];
      }
    }
  }

  const bestMatch = nearestPair?.[0] ?? hydroposts[0];
  const markers = nearestPair ? [nearestPair[0], nearestPair[1]] : [bestMatch];
  const pairLabel = nearestPair
    ? `${nearestPair[0].label} и ${nearestPair[1].label}`
    : bestMatch.label;

  return {
    mechanism: "spatial",
    operation: "spatial_nearest_posts",
    answer: [
      `Минимальное расстояние между гидропостами по прямой составляет примерно ${nearestDistanceKm.toFixed(1)} км.`,
      `Ближайшая пара: ${pairLabel}.`,
      "Это расчёт по координатам гидропостов, без учёта длины русла между ними.",
    ].join(" "),
    bestMatch,
    markers,
    spatialOverlay: {
      highlightedWaterIds: [],
      suggestedPlacements: [],
    },
  };
}

function handleSpatial(query: string): MechanismResult {
  const normalizedQuery = normalize(query);

  if (
    ["минимальное расстояние", "минимальное растояние", "минимальная дистанция"].some((token) =>
      normalizedQuery.includes(token),
    ) &&
    ["между гидропостами", "гидропостами", "гидропостов"].some((token) =>
      normalizedQuery.includes(token),
    )
  ) {
    return handleNearestHydropostDistance();
  }

  const mainRiverPreference = resolveMainRiverPreference(query);
  if (mainRiverPreference === null) {
    const fallback = pickLocalResult(query);
    return {
      mechanism: "spatial",
      operation: "spatial_spacing_coverage",
      answer:
        "Для такого расчёта нужно уточнение, чтобы не завысить результат по мелким водотокам.",
      bestMatch: fallback.bestMatch,
      markers: fallback.markers,
      clarification: {
        kind: "main_rivers_only",
        question: "Считать только основные реки?",
      },
      spatialOverlay: {
        highlightedWaterIds: [],
        suggestedPlacements: [],
      },
    };
  }

  const spacingMatch = normalizedQuery.match(/(\d+)\s*км/);
  const spacingKm = spacingMatch ? Number(spacingMatch[1]) : 10;
  const existingRiverPosts = hydroposts.filter(
    (post) =>
      post.waterBody.toLowerCase().includes("р.") ||
      post.waterBody.toLowerCase().includes("река"),
  );
  const riverGroups = getRiverGroups().filter((group) =>
    mainRiverPreference ? isMainRiver(group) : true,
  );
  const groupsByKey = new Map(riverGroups.map((group) => [group.key, group]));
  const postsByGroup = new Map<string, Hydropost[]>();

  for (const post of existingRiverPosts) {
    const postKey = normalizeWaterBodyName(post.waterBody);
    if (!postKey) {
      continue;
    }

    const directGroup = groupsByKey.get(postKey);
    if (directGroup) {
      postsByGroup.set(directGroup.key, [...(postsByGroup.get(directGroup.key) ?? []), post]);
      continue;
    }

    const nearestGroup = riverGroups
      .map((group) => {
        const nearestDistance = Math.min(
          ...group.segments.map((segment) => {
            const projection = projectPostToRiver(post, segment.coordinates);
            return projection?.distanceToRiverKm ?? Number.POSITIVE_INFINITY;
          }),
        );
        return { group, nearestDistance };
      })
      .sort((left, right) => left.nearestDistance - right.nearestDistance)[0];

    if (nearestGroup && nearestGroup.nearestDistance <= 3) {
      postsByGroup.set(nearestGroup.group.key, [
        ...(postsByGroup.get(nearestGroup.group.key) ?? []),
        post,
      ]);
    }
  }

  const coverage: RiverCoverage[] = riverGroups
    .map((group) => {
      const lengthKm = group.segments.reduce((sum, segment) => sum + segment.lengthKm, 0);
      const posts = postsByGroup.get(group.key) ?? [];
      const requiredPosts = Math.ceil(lengthKm / spacingKm);
      const missingPosts = Math.max(requiredPosts - posts.length, 0);
      const maxGapKm = posts.length > 0 ? lengthKm / (posts.length + 1) : lengthKm;
      const suggestedPlacements = buildSuggestedPlacementsForSegments(
        group,
        Math.min(missingPosts, 6),
        spacingKm,
      );

      return {
        id: group.key,
        name: group.name,
        lengthKm,
        posts,
        missingPosts,
        maxGapKm,
        requiredPosts,
        suggestedPlacements,
        highlightedWaterIds: group.segments.map((segment) => segment.id),
      };
    })
    .filter((river) => river.lengthKm > 0)
    .sort(
      (left, right) =>
        right.missingPosts - left.missingPosts || right.lengthKm - left.lengthKm,
    );

  const totalRiverKm = coverage.reduce((sum, river) => sum + river.lengthKm, 0);
  const requiredPosts = coverage.reduce((sum, river) => sum + river.requiredPosts, 0);
  const missingPosts = coverage.reduce((sum, river) => sum + river.missingPosts, 0);
  const matchedPosts = new Set<number>();
  coverage.forEach((river) => {
    river.posts.forEach((post) => matchedPosts.add(post.code));
  });

  const topDeficitRivers = coverage
    .filter((river) => river.missingPosts > 0)
    .slice(0, 3)
    .map((river) => `${river.name}: дефицит ${river.missingPosts}, максимальный разрыв ${Math.round(river.maxGapKm)} км`);
  const highlightedCoverage = coverage.filter((river) => river.missingPosts > 0).slice(0, 6);
  const suggestedPlacements = highlightedCoverage.flatMap((river) => river.suggestedPlacements).slice(0, 24);
  const bestMatch =
    [...existingRiverPosts].sort((left, right) => right.waterLevel - left.waterLevel)[0] ??
    hydroposts[0];

  return {
    mechanism: "spatial",
    operation: "spatial_spacing_coverage",
    answer: [
      `По текущему речному слою Акмолинской области суммарная длина русел составляет примерно ${Math.round(totalRiverKm)} км.`,
      mainRiverPreference
        ? "Расчёт выполнен только по основным рекам."
        : "Расчёт выполнен по всей доступной именованной речной сети.",
      `При шаге размещения ${spacingKm} км требуется ориентировочно ${requiredPosts} гидропост(а/ов).`,
      `К именованным руслам удалось привязать ${matchedPosts.size} существующих речных пост(а/ов).`,
      `Ориентировочный дефицит по интервалам вдоль рек составляет ${missingPosts} пост(а/ов).`,
      topDeficitRivers.length > 0
        ? `Наиболее дефицитные участки: ${topDeficitRivers.join("; ")}.`
        : "Крупных дефицитных участков по заданному шагу не выявлено.",
      "Это укрупнённый расчёт по именованным руслам: длина считается по сегментам одной реки, а существующие посты сначала привязываются по названию водного объекта.",
    ].join(" "),
    bestMatch,
    markers: existingRiverPosts,
    spatialOverlay: {
      highlightedWaterIds: highlightedCoverage.flatMap((river) => river.highlightedWaterIds),
      suggestedPlacements,
    },
  };
}

export function runLocalMechanism(query: string): MechanismResult | null {
  const mechanism = classifyQuery(query);
  const operation = resolveOperation(query, mechanism);

  switch (operation) {
    case "reference_post_info":
      return handleReference(query);
    case "operational_filter_posts":
      return handleOperational(query);
    case "operational_count_posts_by_district":
      return handleOperationalCountByDistrict(query);
    case "operational_count_posts_by_river":
      return handleOperationalCountByRiver(query);
    case "operational_extreme_levels":
      return handleOperationalExtremes(query);
    case "historical_summary":
      return handleHistorical(query);
    case "historical_missing":
      return handleHistoricalMissing(query);
    case "spatial_nearest_posts":
      return handleNearestHydropostDistance();
    case "spatial_spacing_coverage":
      return handleSpatial(query);
    default:
      return null;
  }
}

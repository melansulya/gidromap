import type { Region } from "./types";

export type HydropostHistoryEntry = {
  year: number;
  highestYearCm: number | null;
  openWaterHighCm: number | null;
  openWaterLowCm: number | null;
  rangeCm: number | null;
};

export type HydropostHistoryStats = {
  years: number;
  peakOpenWaterCm: number | null;
  peakYearCm: number | null;
  lowestOpenWaterCm: number | null;
};

export type HydropostHistoryDataset = {
  title: string;
  history: HydropostHistoryEntry[];
  stats: HydropostHistoryStats;
};

export type Hydropost = {
  code: number;
  label: string;
  district: string;
  waterBody: string;
  status: "normal" | "warning" | "danger";
  waterLevel: number;
  hasLevelData: boolean;
  updatedAt: string;
  coordinates: [number, number];
  topics: string[];
  region: Region;
};

export function hydropostsFor(region: Region): Hydropost[] {
  return hydroposts.filter((p) => p.region === region);
}

export const hydroposts: Hydropost[] = [
  {
    code: 11242,
    label: "с. Новомарковка",
    district: "Аккольский район",
    waterBody: "р. Селеты",
    status: "warning",
    waterLevel: 168,
    hasLevelData: true,
    updatedAt: "XLSX: код 11242",
    coordinates: [72.305, 51.7369],
    topics: ["новомарковка", "селеты", "11242", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11253,
    label: "Бестогай",
    district: "Селетинский узел",
    waterBody: "р. Селеты",
    status: "normal",
    waterLevel: 142,
    hasLevelData: true,
    updatedAt: "XLSX: код 11253",
    coordinates: [72.6856, 52.0006],
    topics: ["бестогай", "селеты", "11253", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11262,
    label: "с. Журавлевка",
    district: "Буландынский район",
    waterBody: "р. Боксук",
    status: "normal",
    waterLevel: 151,
    hasLevelData: true,
    updatedAt: "XLSX: код 11262",
    coordinates: [69.9772, 51.9567],
    topics: ["журавлевка", "боксук", "11262", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11272,
    label: "с. Приречное",
    district: "Ерейментауский район",
    waterBody: "р. Силеты",
    status: "warning",
    waterLevel: 176,
    hasLevelData: true,
    updatedAt: "XLSX: код 11272",
    coordinates: [71.9378, 51.5372],
    topics: ["приречное", "силеты", "11272", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11275,
    label: "с. Изобильное",
    district: "Сандыктауский район",
    waterBody: "р. Силеты",
    status: "danger",
    waterLevel: 214,
    hasLevelData: true,
    updatedAt: "XLSX: код 11275",
    coordinates: [73.285, 52.4944],
    topics: ["изобильное", "силеты", "11275", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11291,
    label: "с. Павловка",
    district: "Зерендинский район",
    waterBody: "р. Шагалалы",
    status: "normal",
    waterLevel: 149,
    hasLevelData: true,
    updatedAt: "XLSX: код 11291",
    coordinates: [69.0122, 53.0994],
    topics: ["павловка", "шагалалы", "11291", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11398,
    label: "г. Астана",
    district: "Астана",
    waterBody: "р. Есиль",
    status: "warning",
    waterLevel: 183,
    hasLevelData: true,
    updatedAt: "XLSX: код 11398",
    coordinates: [71.4142, 51.1578],
    topics: ["астана", "есиль", "11398", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11404,
    label: "г. Есиль",
    district: "Есильский район",
    waterBody: "р. Есиль",
    status: "danger",
    waterLevel: 227,
    hasLevelData: true,
    updatedAt: "XLSX: код 11404",
    coordinates: [66.2686, 52.0203],
    topics: ["есиль", "каменный карьер", "11404", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11411,
    label: "пос. Тельмана",
    district: "Астана",
    waterBody: "р. Есиль",
    status: "warning",
    waterLevel: 191,
    hasLevelData: true,
    updatedAt: "XLSX: код 11411",
    coordinates: [71.4908, 51.0994],
    topics: ["тельмана", "есиль", "11411", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11413,
    label: "с. Коктал",
    district: "Астана",
    waterBody: "р. Есиль",
    status: "normal",
    waterLevel: 145,
    hasLevelData: true,
    updatedAt: "XLSX: код 11413",
    coordinates: [71.3431, 51.1736],
    topics: ["коктал", "есиль", "11413", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11415,
    label: "пос. Аршалы",
    district: "Аршалынский район",
    waterBody: "р. Есиль",
    status: "warning",
    waterLevel: 174,
    hasLevelData: true,
    updatedAt: "XLSX: код 11415",
    coordinates: [72.1841, 50.8427],
    topics: ["аршалы", "есиль", "11415", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11421,
    label: "с. Николаевка",
    district: "Аршалынский район",
    waterBody: "р. Мойылды",
    status: "normal",
    waterLevel: 154,
    hasLevelData: true,
    updatedAt: "XLSX: код 11421",
    coordinates: [72.4417, 51.0892],
    topics: ["николаевка", "мойылды", "11421", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11424,
    label: "с. Калкутан",
    district: "Астраханский район",
    waterBody: "р. Калкутан",
    status: "warning",
    waterLevel: 187,
    hasLevelData: true,
    updatedAt: "XLSX: код 11424",
    coordinates: [69.4639, 51.7858],
    topics: ["калкутан", "11424", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11425,
    label: "п. Новокубанка",
    district: "Шортандинский район",
    waterBody: "р. Калкутан",
    status: "danger",
    waterLevel: 221,
    hasLevelData: true,
    updatedAt: "XLSX: код 11425",
    coordinates: [70.7459, 51.6787],
    topics: ["новокубанка", "калкутан", "11425", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11426,
    label: "с. Терисаккан",
    district: "Жаркаинский район",
    waterBody: "р. Терисаккан",
    status: "normal",
    waterLevel: 147,
    hasLevelData: true,
    updatedAt: "XLSX: код 11426",
    coordinates: [67.2103, 51.2618],
    topics: ["терисаккан", "11426", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11432,
    label: "с. Балкашино",
    district: "Сандыктауский район",
    waterBody: "р. Жабай",
    status: "warning",
    waterLevel: 179,
    hasLevelData: true,
    updatedAt: "XLSX: код 11432",
    coordinates: [68.7892, 52.5369],
    topics: ["балкашино", "жабай", "11432", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11433,
    label: "г. Атбасар",
    district: "Атбасарский район",
    waterBody: "р. Жабай",
    status: "danger",
    waterLevel: 233,
    hasLevelData: true,
    updatedAt: "XLSX: код 11433",
    coordinates: [68.3689, 51.7978],
    topics: ["атбасар", "жабай", "11433", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11472,
    label: "с. Шуйское",
    district: "Атбасарский район",
    waterBody: "р. Жыланды",
    status: "warning",
    waterLevel: 182,
    hasLevelData: true,
    updatedAt: "XLSX: код 11472",
    coordinates: [68.3127, 52.0954],
    topics: ["шуйское", "жыланды", "11472", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11485,
    label: "с. Буденовка",
    district: "Буландынский район",
    waterBody: "р. Аршалы",
    status: "normal",
    waterLevel: 153,
    hasLevelData: true,
    updatedAt: "XLSX: код 11485",
    coordinates: [69.6349, 52.1],
    topics: ["буденовка", "аршалы", "11485", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11908,
    label: "с. Зеренды",
    district: "Зерендинский район",
    waterBody: "оз. Зеренды",
    status: "normal",
    waterLevel: 141,
    hasLevelData: true,
    updatedAt: "XLSX: код 11908",
    coordinates: [69.1425, 52.9156],
    topics: ["зеренды", "озеро зеренды", "11908", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11909,
    label: "г. Щучинск",
    district: "Бурабайский район",
    waterBody: "оз. Шортан",
    status: "warning",
    waterLevel: 173,
    hasLevelData: true,
    updatedAt: "XLSX: код 11909",
    coordinates: [70.19, 53.0089],
    topics: ["щучинск", "шортан", "11909", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11917,
    label: "с. Боровое",
    district: "Бурабайский район",
    waterBody: "Оз. Бурабай",
    status: "normal",
    waterLevel: 148,
    hasLevelData: true,
    updatedAt: "XLSX: код 11917",
    coordinates: [70.3022, 53.0775],
    topics: ["боровое", "бурабай", "11917", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11919,
    label: "г. Кокшетау",
    district: "Кокшетау",
    waterBody: "оз. Копа",
    status: "warning",
    waterLevel: 171,
    hasLevelData: true,
    updatedAt: "XLSX: код 11919",
    coordinates: [69.38, 53.3003],
    topics: ["кокшетау", "копа", "11919", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11966,
    label: "с. Михайловка",
    district: "Аршалынский район",
    waterBody: "Вдхр. Астанинское",
    status: "danger",
    waterLevel: 219,
    hasLevelData: true,
    updatedAt: "XLSX: код 11966",
    coordinates: [72.2539, 51.0052],
    topics: ["михайловка", "астанинское", "11966", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 11974,
    label: "с. Арнасай",
    district: "Аршалынский район",
    waterBody: "Вдхр. Астанинское",
    status: "warning",
    waterLevel: 181,
    hasLevelData: true,
    updatedAt: "XLSX: код 11974",
    coordinates: [72.1178, 50.9917],
    topics: ["арнасай", "астанинское", "11974", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 13076,
    label: "с. Кошкарбаева",
    district: "Коргалжынский район",
    waterBody: "р. Нура",
    status: "normal",
    waterLevel: 157,
    hasLevelData: true,
    updatedAt: "XLSX: код 13076",
    coordinates: [71.336863, 50.829268],
    topics: ["кошкарбаева", "нура", "13076", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 13077,
    label: "с. Коргалжын",
    district: "Коргалжынский район",
    waterBody: "р. Нура",
    status: "warning",
    waterLevel: 189,
    hasLevelData: true,
    updatedAt: "XLSX: код 13077",
    coordinates: [70.0081, 50.5931],
    topics: ["коргалжын", "нура", "13077", "вода", "гидропост"],
    region: "akmola",
  },
  {
    code: 13078,
    label: "пос. Бірлік",
    district: "Целиноградский район",
    waterBody: "р. Нура",
    status: "danger",
    waterLevel: 226,
    hasLevelData: true,
    updatedAt: "XLSX: код 13078",
    coordinates: [70.8678, 50.9563],
    topics: ["бірлік", "нура", "13078", "вода", "гидропост"],
    region: "akmola",
  },
  // Kyzylorda region posts: waterLevel/status are honest placeholders (0 / "normal"),
  // no entry in hydropostHistoryByCode yet — historical data to be added later.
  {
    code: 16035,
    label: "с. Коктюбе",
    district: "Жанакорганский район",
    waterBody: "р. Сырдарья",
    status: "normal",
    waterLevel: 0,
    hasLevelData: false,
    updatedAt: "Нет данных",
    coordinates: [67.7869, 43.2228],
    topics: ["коктюбе", "сырдарья", "16035", "вода", "гидропост"],
    region: "kyzylorda",
  },
  {
    code: 16037,
    label: "ж.д. ст. Томенарык",
    district: "Жанакорганский район",
    waterBody: "р. Сырдарья",
    status: "normal",
    waterLevel: 0,
    hasLevelData: false,
    updatedAt: "Нет данных",
    coordinates: [67.0208, 44.0167],
    topics: ["томенарык", "сырдарья", "16037", "вода", "гидропост"],
    region: "kyzylorda",
  },
  {
    code: 16039,
    label: "рзд. Керкельмес",
    district: "Шиелийский район",
    waterBody: "р. Сырдарья",
    status: "normal",
    waterLevel: 0,
    hasLevelData: false,
    updatedAt: "Нет данных",
    coordinates: [65.9067, 44.6294],
    topics: ["керкельмес", "сырдарья", "16039", "вода", "гидропост"],
    region: "kyzylorda",
  },
  {
    code: 16042,
    label: "ж.д. ст. Караозек",
    district: "Сырдарьинский район",
    waterBody: "р. Сырдарья",
    status: "normal",
    waterLevel: 0,
    hasLevelData: false,
    updatedAt: "Нет данных",
    coordinates: [65.2608, 44.9856],
    topics: ["караозек", "сырдарья", "16042", "вода", "гидропост"],
    region: "kyzylorda",
  },
  {
    code: 16044,
    label: "пгт. Жосалы",
    district: "Кармакшинский район",
    waterBody: "р. Сырдарья",
    status: "normal",
    waterLevel: 0,
    hasLevelData: false,
    updatedAt: "Нет данных",
    coordinates: [64.0872, 45.4756],
    topics: ["жосалы", "сырдарья", "16044", "вода", "гидропост"],
    region: "kyzylorda",
  },
  {
    code: 16047,
    label: "г. Казалы (Казалинск)",
    district: "Казалинский район",
    waterBody: "р. Сырдарья",
    status: "normal",
    waterLevel: 0,
    hasLevelData: false,
    updatedAt: "Нет данных",
    coordinates: [62.1392, 45.7383],
    topics: ["казалы", "казалинск", "сырдарья", "16047", "вода", "гидропост"],
    region: "kyzylorda",
  },
  {
    code: 16052,
    label: "ж.д. ст. Караозек (протока)",
    district: "Кызылординская городская администрация",
    waterBody: "р. Сырдарья, протока Караозек",
    status: "normal",
    waterLevel: 0,
    hasLevelData: false,
    updatedAt: "Нет данных",
    coordinates: [65.2667, 45.0003],
    topics: ["караозек", "протока", "сырдарья", "16052", "вода", "гидропост"],
    region: "kyzylorda",
  },
  {
    code: 16053,
    label: "пгт. Жосалы (протока)",
    district: "Кармакшинский район",
    waterBody: "р. Сырдарья, протока Караозек",
    status: "normal",
    waterLevel: 0,
    hasLevelData: false,
    updatedAt: "Нет данных",
    coordinates: [64.0997, 45.4767],
    topics: ["жосалы", "протока", "сырдарья", "16053", "вода", "гидропост"],
    region: "kyzylorda",
  },
  {
    code: 16659,
    label: "п.г.т. Тасбугет",
    district: "Кызылординская городская администрация",
    waterBody: "р. Сырдарья",
    status: "normal",
    waterLevel: 0,
    hasLevelData: false,
    updatedAt: "Нет данных",
    coordinates: [65.5308, 44.7686],
    topics: ["тасбугет", "сырдарья", "16659", "вода", "гидропост"],
    region: "kyzylorda",
  },
  {
    code: 16676,
    label: "с. Каратерень",
    district: "Аральский район",
    waterBody: "р. Сырдарья",
    status: "normal",
    waterLevel: 0,
    hasLevelData: false,
    updatedAt: "Нет данных",
    coordinates: [61.0528, 46.0244],
    topics: ["каратерень", "сырдарья", "16676", "вода", "гидропост"],
    region: "kyzylorda",
  },
  {
    code: 96009,
    label: "берег Малого моря (п. Тастубек)",
    district: "Аральский район",
    waterBody: "Аральское море",
    status: "normal",
    waterLevel: 0,
    hasLevelData: false,
    updatedAt: "Нет данных",
    coordinates: [60.7767, 46.5914],
    topics: ["тастубек", "малое море", "аральское море", "арал", "96009", "вода", "гидропост"],
    region: "kyzylorda",
  },
  {
    code: 96010,
    label: "верх. бьеф Кокаральской плотины",
    district: "Аральский район",
    waterBody: "Малое Аральское море",
    status: "normal",
    waterLevel: 0,
    hasLevelData: false,
    updatedAt: "Нет данных",
    coordinates: [60.7633, 46.1089],
    topics: ["кокаральская плотина", "малое море", "аральское море", "арал", "96010", "вода", "гидропост"],
    region: "kyzylorda",
  },
  // Not from the "8 ВХБ" national registry (no code there) — added directly from
  // user-supplied coordinates. Confirmed by the coordinates: (a) inside Kyzylorda
  // oblast, Жанакорганский район; (b) ~2.4 km from the "Бесарык" waterway already
  // in kyzylorda-waterways.json (OSM). Code 90001 is an out-of-band placeholder
  // (real Kazgidromet codes here are 11xxx-16xxx / 96xxx), not an official code.
  {
    code: 90001,
    label: "Бесарык",
    district: "Жанакорганский район",
    waterBody: "р. Бесарык",
    status: "normal",
    waterLevel: 0,
    hasLevelData: false,
    updatedAt: "Нет данных",
    coordinates: [67.780044, 43.743278],
    topics: ["бесарык", "жанакорган", "90001", "вода", "гидропост"],
    region: "kyzylorda",
  },
];

export const hydropostHistoryByCode: Record<number, HydropostHistoryDataset> = {
  11242: {
    title:
      "1. 11242. р. Селеты - с.Новомарковка. Отметка нуля поста: с 2017г. - 258.15 м усл. 2017-2022 гг.",
    history: [
      { year: 2017, highestYearCm: null, openWaterHighCm: 893, openWaterLowCm: 395, rangeCm: null },
      { year: 2018, highestYearCm: 735, openWaterHighCm: 434, openWaterLowCm: 406, rangeCm: 329 },
      { year: 2019, highestYearCm: 932, openWaterHighCm: 430, openWaterLowCm: 388, rangeCm: 544 },
      { year: 2020, highestYearCm: null, openWaterHighCm: 423, openWaterLowCm: 391, rangeCm: null },
      { year: 2021, highestYearCm: null, openWaterHighCm: 442, openWaterLowCm: 401, rangeCm: null },
      { year: 2022, highestYearCm: null, openWaterHighCm: 705, openWaterLowCm: null, rangeCm: null },
    ],
    stats: { years: 6, peakOpenWaterCm: 893, peakYearCm: 932, lowestOpenWaterCm: 388 },
  },
  11253: {
    title:
      "2. 11253. р. Селеты - выше Селетинского водохранилища. Отметка нуля поста: с 2016г. - 216.50 м усл. 2016-2022 гг.",
    history: [
      { year: 2016, highestYearCm: 769, openWaterHighCm: 769, openWaterLowCm: 700, rangeCm: 120 },
      { year: 2017, highestYearCm: 1097, openWaterHighCm: 1097, openWaterLowCm: 728, rangeCm: 450 },
      { year: 2018, highestYearCm: 987, openWaterHighCm: 958, openWaterLowCm: 784, rangeCm: 321 },
      { year: 2019, highestYearCm: 1200, openWaterHighCm: 958, openWaterLowCm: 738, rangeCm: 480 },
      { year: 2020, highestYearCm: 970, openWaterHighCm: 970, openWaterLowCm: 778, rangeCm: 293 },
      { year: 2021, highestYearCm: 1298, openWaterHighCm: 973, openWaterLowCm: 788, rangeCm: 537 },
      { year: 2022, highestYearCm: null, openWaterHighCm: 982, openWaterLowCm: null, rangeCm: null },
    ],
    stats: { years: 7, peakOpenWaterCm: 1097, peakYearCm: 1298, lowestOpenWaterCm: 700 },
  },
  11262: {
    title:
      "3. 11262. р. Боксук - с. Журавлевка. Отметка нуля поста: с 2020г. - 296.50 м усл. 2020-2022 гг.",
    history: [
      { year: 2020, highestYearCm: 608, openWaterHighCm: 419, openWaterLowCm: 310, rangeCm: 298 },
      { year: 2021, highestYearCm: 473, openWaterHighCm: 367, openWaterLowCm: 340, rangeCm: 157 },
      { year: 2022, highestYearCm: null, openWaterHighCm: 407, openWaterLowCm: null, rangeCm: null },
    ],
    stats: { years: 3, peakOpenWaterCm: 419, peakYearCm: 608, lowestOpenWaterCm: 310 },
  },
  11272: {
    title:
      "4. 11272. р. Силеты - с. Приречное. Отметка нуля поста: с 1961г. - 299.49 м БС. 1961-2022 гг.",
    history: [
      { year: 2016, highestYearCm: 305, openWaterHighCm: 224, openWaterLowCm: 189, rangeCm: 121 },
      { year: 2017, highestYearCm: 446, openWaterHighCm: 189, openWaterLowCm: 144, rangeCm: 302 },
      { year: 2018, highestYearCm: 416, openWaterHighCm: 220, openWaterLowCm: 145, rangeCm: 271 },
      { year: 2019, highestYearCm: 495, openWaterHighCm: 179, openWaterLowCm: 163, rangeCm: 332 },
      { year: 2020, highestYearCm: 314, openWaterHighCm: 219, openWaterLowCm: 159, rangeCm: 155 },
      { year: 2021, highestYearCm: 469, openWaterHighCm: 193, openWaterLowCm: 134, rangeCm: 335 },
      { year: 2022, highestYearCm: null, openWaterHighCm: 281, openWaterLowCm: 143, rangeCm: null },
    ],
    stats: { years: 61, peakOpenWaterCm: 281, peakYearCm: 528, lowestOpenWaterCm: 104 },
  },
  11275: {
    title:
      "5. 11275. р. Силеты - с. Изобильное. Отметка нуля поста: с 1965г. - 108.43 м БС. 1965-2022 гг.",
    history: [
      { year: 2016, highestYearCm: 298, openWaterHighCm: 298, openWaterLowCm: 263, rangeCm: 35 },
      { year: 2017, highestYearCm: 690, openWaterHighCm: 372, openWaterLowCm: 273, rangeCm: 423 },
      { year: 2018, highestYearCm: 479, openWaterHighCm: 305, openWaterLowCm: 269, rangeCm: 210 },
      { year: 2019, highestYearCm: 786, openWaterHighCm: 313, openWaterLowCm: 294, rangeCm: 497 },
      { year: 2020, highestYearCm: 299, openWaterHighCm: 299, openWaterLowCm: 246, rangeCm: 53 },
      { year: 2021, highestYearCm: 715, openWaterHighCm: 408, openWaterLowCm: 280, rangeCm: 435 },
      { year: 2022, highestYearCm: 564, openWaterHighCm: 560, openWaterLowCm: 251, rangeCm: 313 },
    ],
    stats: { years: 57, peakOpenWaterCm: 638, peakYearCm: 927, lowestOpenWaterCm: 202 },
  },
  11291: {
    title:
      "7. 11291. р. Шагалалы - с. Павловка. Отметка нуля поста: с 1940г. - 274.25 м БС. 1940-2022 гг.",
    history: [
      { year: 2016, highestYearCm: 247, openWaterHighCm: 96, openWaterLowCm: 3, rangeCm: 244 },
      { year: 2017, highestYearCm: 294, openWaterHighCm: 67, openWaterLowCm: -8, rangeCm: 302 },
      { year: 2018, highestYearCm: 157, openWaterHighCm: 52, openWaterLowCm: -3, rangeCm: 160 },
      { year: 2019, highestYearCm: 228, openWaterHighCm: 33, openWaterLowCm: -14, rangeCm: 242 },
      { year: 2020, highestYearCm: 225, openWaterHighCm: 57, openWaterLowCm: -16, rangeCm: 241 },
      { year: 2021, highestYearCm: 187, openWaterHighCm: 4, openWaterLowCm: -20, rangeCm: 207 },
      { year: 2022, highestYearCm: null, openWaterHighCm: 62, openWaterLowCm: -20, rangeCm: null },
    ],
    stats: { years: 83, peakOpenWaterCm: 217, peakYearCm: 356, lowestOpenWaterCm: -20 },
  },
  11398: {
    title: "11. 11398. р. Есиль - г. Астана. Отметка нуля поста:  337.19 м БС.  2010-2022 гг.",
    history: [
      { year: 2016, highestYearCm: 699, openWaterHighCm: 699, openWaterLowCm: 659, rangeCm: 71 },
      { year: 2017, highestYearCm: 728, openWaterHighCm: 728, openWaterLowCm: 658, rangeCm: 70 },
      { year: 2018, highestYearCm: 696, openWaterHighCm: 696, openWaterLowCm: 662, rangeCm: 37 },
      { year: 2019, highestYearCm: 715, openWaterHighCm: 715, openWaterLowCm: 641, rangeCm: 93 },
      { year: 2020, highestYearCm: 697, openWaterHighCm: 697, openWaterLowCm: 628, rangeCm: 83 },
      { year: 2021, highestYearCm: 742, openWaterHighCm: 741, openWaterLowCm: 637, rangeCm: 108 },
      { year: 2022, highestYearCm: 682, openWaterHighCm: 682, openWaterLowCm: 632, rangeCm: 50 },
    ],
    stats: { years: 13, peakOpenWaterCm: 741, peakYearCm: 742, lowestOpenWaterCm: 628 },
  },
  11404: {
    title:
      "13. 11404. р. Есиль - с. Каменный карьер. Отметка нуля поста: с 1970г. - 201.97 м БС. 1970-1997,2003-2022 гг.",
    history: [
      { year: 2016, highestYearCm: 554, openWaterHighCm: 323, openWaterLowCm: 165, rangeCm: 396 },
      { year: 2017, highestYearCm: 933, openWaterHighCm: 378, openWaterLowCm: 159, rangeCm: 776 },
      { year: 2018, highestYearCm: 734, openWaterHighCm: 381, openWaterLowCm: 174, rangeCm: 567 },
      { year: 2019, highestYearCm: 649, openWaterHighCm: 323, openWaterLowCm: 162, rangeCm: 487 },
      { year: 2020, highestYearCm: 747, openWaterHighCm: 354, openWaterLowCm: 150, rangeCm: 600 },
      { year: 2021, highestYearCm: 619, openWaterHighCm: 326, openWaterLowCm: 149, rangeCm: 474 },
      { year: 2022, highestYearCm: 449, openWaterHighCm: 345, openWaterLowCm: 139, rangeCm: 310 },
    ],
    stats: { years: 48, peakOpenWaterCm: 647, peakYearCm: 999, lowestOpenWaterCm: 120 },
  },
  11411: {
    title:
      "18. 11411. р. Есиль - п.Тельмана. Отметка нуля поста: с 2016г. - 338.68 м БС. 2016-2022 гг.",
    history: [
      { year: 2016, highestYearCm: 672, openWaterHighCm: 672, openWaterLowCm: 605, rangeCm: 67 },
      { year: 2017, highestYearCm: 653, openWaterHighCm: 653, openWaterLowCm: 620, rangeCm: 41 },
      { year: 2018, highestYearCm: 686, openWaterHighCm: 686, openWaterLowCm: 619, rangeCm: 67 },
      { year: 2019, highestYearCm: 716, openWaterHighCm: 716, openWaterLowCm: 603, rangeCm: 140 },
      { year: 2020, highestYearCm: 660, openWaterHighCm: 656, openWaterLowCm: 583, rangeCm: 88 },
      { year: 2021, highestYearCm: 728, openWaterHighCm: 728, openWaterLowCm: 582, rangeCm: 150 },
      { year: 2022, highestYearCm: null, openWaterHighCm: 678, openWaterLowCm: null, rangeCm: null },
    ],
    stats: { years: 7, peakOpenWaterCm: 728, peakYearCm: 728, lowestOpenWaterCm: 582 },
  },
  11413: {
    title:
      "17. 11413. р. Есиль - с. Коктал. Отметка нуля поста: с 2016г. - 335.50 м усл. 2016-2022 гг.",
    history: [
      { year: 2016, highestYearCm: 637, openWaterHighCm: 637, openWaterLowCm: 483, rangeCm: 154 },
      { year: 2017, highestYearCm: 664, openWaterHighCm: 664, openWaterLowCm: 464, rangeCm: 200 },
      { year: 2018, highestYearCm: 584, openWaterHighCm: 584, openWaterLowCm: 473, rangeCm: 112 },
      { year: 2019, highestYearCm: 636, openWaterHighCm: 607, openWaterLowCm: 441, rangeCm: 196 },
      { year: 2020, highestYearCm: 596, openWaterHighCm: 543, openWaterLowCm: 430, rangeCm: 193 },
      { year: 2021, highestYearCm: 555, openWaterHighCm: 555, openWaterLowCm: 420, rangeCm: 135 },
      { year: 2022, highestYearCm: 530, openWaterHighCm: 530, openWaterLowCm: 410, rangeCm: 125 },
    ],
    stats: { years: 7, peakOpenWaterCm: 664, peakYearCm: 664, lowestOpenWaterCm: 410 },
  },
  11415: {
    title:
      "19. 11415. р. Есиль - пос. Аршалы. Отметка нуля поста: с 2020г. - 400.25 м БС. 2020-2022 гг.",
    history: [
      { year: 2020, highestYearCm: 375, openWaterHighCm: 327, openWaterLowCm: 180, rangeCm: 215 },
      { year: 2021, highestYearCm: 541, openWaterHighCm: 341, openWaterLowCm: 208, rangeCm: 368 },
      { year: 2022, highestYearCm: null, openWaterHighCm: 392, openWaterLowCm: null, rangeCm: null },
    ],
    stats: { years: 3, peakOpenWaterCm: 392, peakYearCm: 541, lowestOpenWaterCm: 180 },
  },
  11421: {
    title:
      "23. 11421. р. Мойылды - с. Николаевка. Отметка нуля поста: с 2012г. - 419.31м БС; с 2013г. - 419.30м БС;  1995-1997,2011-2022 гг.",
    history: [
      { year: 2016, highestYearCm: 267, openWaterHighCm: 150, openWaterLowCm: 105, rangeCm: 162 },
      { year: 2017, highestYearCm: 536, openWaterHighCm: 206, openWaterLowCm: null, rangeCm: 446 },
      { year: 2018, highestYearCm: 367, openWaterHighCm: 159, openWaterLowCm: 101, rangeCm: 266 },
      { year: 2019, highestYearCm: 384, openWaterHighCm: 143, openWaterLowCm: null, rangeCm: 299 },
      { year: 2020, highestYearCm: 358, openWaterHighCm: 171, openWaterLowCm: 96, rangeCm: 262 },
      { year: 2021, highestYearCm: 408, openWaterHighCm: 186, openWaterLowCm: null, rangeCm: 320 },
      { year: 2022, highestYearCm: 345, openWaterHighCm: 171, openWaterLowCm: 87, rangeCm: 258 },
    ],
    stats: { years: 15, peakOpenWaterCm: 206, peakYearCm: 536, lowestOpenWaterCm: 87 },
  },
  11424: {
    title: "24. 11424. р.Калкутан - с. Калкутан. Отметка нуля поста: 279.96 м БС. 1984-2022 гг.",
    history: [
      { year: 2016, highestYearCm: 620, openWaterHighCm: 439, openWaterLowCm: 255, rangeCm: 365 },
      { year: 2017, highestYearCm: 675, openWaterHighCm: 359, openWaterLowCm: 252, rangeCm: 425 },
      { year: 2018, highestYearCm: 529, openWaterHighCm: 385, openWaterLowCm: 254, rangeCm: 287 },
      { year: 2019, highestYearCm: 626, openWaterHighCm: 403, openWaterLowCm: 252, rangeCm: 374 },
      { year: 2020, highestYearCm: 627, openWaterHighCm: 355, openWaterLowCm: 254, rangeCm: 373 },
      { year: 2021, highestYearCm: 559, openWaterHighCm: 384, openWaterLowCm: 243, rangeCm: 316 },
      { year: 2022, highestYearCm: 436, openWaterHighCm: 432, openWaterLowCm: 224, rangeCm: 212 },
    ],
    stats: { years: 39, peakOpenWaterCm: 448, peakYearCm: 714, lowestOpenWaterCm: 175 },
  },
  11425: {
    title:
      "25. 11425. р. Калкутан - с. Новокубанка. Отметка нуля поста: с 2020г. - 318.00 м усл. 2020-2022 гг.",
    history: [
      { year: 2020, highestYearCm: 813, openWaterHighCm: 684, openWaterLowCm: 508, rangeCm: 305 },
      { year: 2021, highestYearCm: 802, openWaterHighCm: 575, openWaterLowCm: 515, rangeCm: 292 },
      { year: 2022, highestYearCm: null, openWaterHighCm: 619, openWaterLowCm: null, rangeCm: null },
    ],
    stats: { years: 3, peakOpenWaterCm: 684, peakYearCm: 813, lowestOpenWaterCm: 508 },
  },
  11426: {
    title:
      "26. 11426. р. Терисаккан - с. Терисаккан. Отметка нуля поста: с 2020г. - 244.40 м БС. 2020-2022 гг.",
    history: [
      { year: 2020, highestYearCm: 766, openWaterHighCm: 757, openWaterLowCm: 603, rangeCm: 163 },
      { year: 2021, highestYearCm: 740, openWaterHighCm: 724, openWaterLowCm: 559, rangeCm: 181 },
      { year: 2022, highestYearCm: null, openWaterHighCm: 739, openWaterLowCm: null, rangeCm: null },
    ],
    stats: { years: 3, peakOpenWaterCm: 757, peakYearCm: 766, lowestOpenWaterCm: 559 },
  },
  11432: {
    title:
      "28. 11432. р. Жабай - с. Балкашино. Отметка нуля поста: с 1960г. - 356.98 м БС. 1960-2022 гг.",
    history: [
      { year: 2016, highestYearCm: 458, openWaterHighCm: 21, openWaterLowCm: -36, rangeCm: 503 },
      { year: 2017, highestYearCm: 552, openWaterHighCm: 8, openWaterLowCm: -43, rangeCm: 595 },
      { year: 2018, highestYearCm: 455, openWaterHighCm: 61, openWaterLowCm: -32, rangeCm: 487 },
      { year: 2019, highestYearCm: 454, openWaterHighCm: 23, openWaterLowCm: -35, rangeCm: 489 },
      { year: 2020, highestYearCm: 490, openWaterHighCm: 72, openWaterLowCm: -39, rangeCm: 533 },
      { year: 2021, highestYearCm: 399, openWaterHighCm: 7, openWaterLowCm: -42, rangeCm: 441 },
      { year: 2022, highestYearCm: 184, openWaterHighCm: 123, openWaterLowCm: -39, rangeCm: 223 },
    ],
    stats: { years: 63, peakOpenWaterCm: 265, peakYearCm: 568, lowestOpenWaterCm: -43 },
  },
  11433: {
    title:
      "29. 11433. р. Жабай - г. Атбасар. Отметка нуля поста: с 1942г. - 270.48 м БС. 1942-2022 гг.",
    history: [
      { year: 2016, highestYearCm: 768, openWaterHighCm: 302, openWaterLowCm: 170, rangeCm: 598 },
      { year: 2017, highestYearCm: 912, openWaterHighCm: 310, openWaterLowCm: 169, rangeCm: 743 },
      { year: 2018, highestYearCm: 683, openWaterHighCm: 347, openWaterLowCm: 174, rangeCm: 520 },
      { year: 2019, highestYearCm: 715, openWaterHighCm: 469, openWaterLowCm: 174, rangeCm: 544 },
      { year: 2020, highestYearCm: 690, openWaterHighCm: 237, openWaterLowCm: 172, rangeCm: 518 },
      { year: 2021, highestYearCm: 728, openWaterHighCm: 310, openWaterLowCm: 157, rangeCm: 571 },
      { year: 2022, highestYearCm: 556, openWaterHighCm: 549, openWaterLowCm: 130, rangeCm: 426 },
    ],
    stats: { years: 81, peakOpenWaterCm: 549, peakYearCm: 912, lowestOpenWaterCm: 98 },
  },
  11472: {
    title:
      "34. 11472. р. Жыланды - с.Шуйское. Отметка нуля поста: с 2020г. - 292.15 м БС. 2020-2022 гг.",
    history: [
      { year: 2020, highestYearCm: 686, openWaterHighCm: 455, openWaterLowCm: 421, rangeCm: 266 },
      { year: 2021, highestYearCm: 745, openWaterHighCm: 556, openWaterLowCm: 426, rangeCm: 321 },
      { year: 2022, highestYearCm: null, openWaterHighCm: 560, openWaterLowCm: null, rangeCm: null },
    ],
    stats: { years: 3, peakOpenWaterCm: 560, peakYearCm: 745, lowestOpenWaterCm: 421 },
  },
  11485: {
    title:
      "38. 11485. р. Аршалы - с. Буденовка. Отметка нуля поста: с 2020г. - 296.50 м усл. 2020-2022 гг.",
    history: [
      { year: 2020, highestYearCm: 885, openWaterHighCm: 539, openWaterLowCm: 473, rangeCm: 420 },
      { year: 2021, highestYearCm: 885, openWaterHighCm: 539, openWaterLowCm: 466, rangeCm: 420 },
      { year: 2022, highestYearCm: null, openWaterHighCm: 527, openWaterLowCm: null, rangeCm: null },
    ],
    stats: { years: 3, peakOpenWaterCm: 539, peakYearCm: 885, lowestOpenWaterCm: 466 },
  },
  13076: {
    title:
      "13076. р. Нура - с.Р.Кошкарбаева (с. Романовка). Отметка нуля поста: с 1974г. - 349.65м БС. 1974-2015,2017-2022 гг.",
    history: [
      { year: 1974, highestYearCm: 629, openWaterHighCm: 330, openWaterLowCm: 271, rangeCm: 358 },
      { year: 1975, highestYearCm: 439, openWaterHighCm: 315, openWaterLowCm: 266, rangeCm: 173 },
      { year: 1976, highestYearCm: 745, openWaterHighCm: 325, openWaterLowCm: 292, rangeCm: 453 },
      { year: 1977, highestYearCm: 787, openWaterHighCm: 327, openWaterLowCm: 283, rangeCm: 504 },
      { year: 1978, highestYearCm: 511, openWaterHighCm: 319, openWaterLowCm: 283, rangeCm: 228 },
      { year: 1979, highestYearCm: 780, openWaterHighCm: 334, openWaterLowCm: 306, rangeCm: 474 },
      { year: 1980, highestYearCm: 529, openWaterHighCm: 318, openWaterLowCm: 278, rangeCm: 251 },
      { year: 1981, highestYearCm: 591, openWaterHighCm: 308, openWaterLowCm: 278, rangeCm: 313 },
      { year: 1982, highestYearCm: 519, openWaterHighCm: 307, openWaterLowCm: 280, rangeCm: 239 },
      { year: 1983, highestYearCm: 779, openWaterHighCm: 338, openWaterLowCm: 298, rangeCm: 481 },
      { year: 1984, highestYearCm: 678, openWaterHighCm: 329, openWaterLowCm: 301, rangeCm: 377 },
      { year: 1985, highestYearCm: 797, openWaterHighCm: 350, openWaterLowCm: 312, rangeCm: 485 },
      { year: 1986, highestYearCm: 767, openWaterHighCm: 350, openWaterLowCm: 316, rangeCm: 451 },
      { year: 1987, highestYearCm: 752, openWaterHighCm: 347, openWaterLowCm: 312, rangeCm: 440 },
      { year: 1988, highestYearCm: 823, openWaterHighCm: 343, openWaterLowCm: 316, rangeCm: 507 },
      { year: 1989, highestYearCm: 670, openWaterHighCm: 327, openWaterLowCm: 307, rangeCm: 363 },
      { year: 1990, highestYearCm: 782, openWaterHighCm: 370, openWaterLowCm: 314, rangeCm: 468 },
      { year: 1991, highestYearCm: 835, openWaterHighCm: 324, openWaterLowCm: 311, rangeCm: 524 },
      { year: 1992, highestYearCm: 550, openWaterHighCm: 328, openWaterLowCm: 300, rangeCm: 250 },
      { year: 1993, highestYearCm: 875, openWaterHighCm: 327, openWaterLowCm: 295, rangeCm: 580 },
      { year: 1994, highestYearCm: 489, openWaterHighCm: null, openWaterLowCm: null, rangeCm: 198 },
      { year: 1995, highestYearCm: 733, openWaterHighCm: 290, openWaterLowCm: 283, rangeCm: 450 },
      { year: 1996, highestYearCm: 763, openWaterHighCm: 289, openWaterLowCm: 276, rangeCm: 488 },
      { year: 1997, highestYearCm: 727, openWaterHighCm: 283, openWaterLowCm: 273, rangeCm: 454 },
      { year: 1998, highestYearCm: 385, openWaterHighCm: 296, openWaterLowCm: 262, rangeCm: 132 },
      { year: 1999, highestYearCm: 411, openWaterHighCm: 306, openWaterLowCm: 250, rangeCm: 161 },
      { year: 2000, highestYearCm: 344, openWaterHighCm: 258, openWaterLowCm: 254, rangeCm: 90 },
      { year: 2001, highestYearCm: 558, openWaterHighCm: 273, openWaterLowCm: 267, rangeCm: 297 },
      { year: 2002, highestYearCm: 759, openWaterHighCm: 326, openWaterLowCm: 274, rangeCm: 501 },
      { year: 2003, highestYearCm: 398, openWaterHighCm: 265, openWaterLowCm: 250, rangeCm: 156 },
      { year: 2004, highestYearCm: 756, openWaterHighCm: 282, openWaterLowCm: 263, rangeCm: 493 },
      { year: 2005, highestYearCm: 536, openWaterHighCm: 266, openWaterLowCm: 254, rangeCm: 298 },
      { year: 2006, highestYearCm: 290, openWaterHighCm: 246, openWaterLowCm: 226, rangeCm: 64 },
      { year: 2007, highestYearCm: 560, openWaterHighCm: 272, openWaterLowCm: 241, rangeCm: 341 },
      { year: 2008, highestYearCm: 507, openWaterHighCm: 315, openWaterLowCm: 226, rangeCm: 281 },
      { year: 2009, highestYearCm: 363, openWaterHighCm: 207, openWaterLowCm: 204, rangeCm: 160 },
      { year: 2010, highestYearCm: 565, openWaterHighCm: 264, openWaterLowCm: 217, rangeCm: 348 },
      { year: 2011, highestYearCm: 480, openWaterHighCm: 279, openWaterLowCm: 225, rangeCm: 255 },
      { year: 2012, highestYearCm: 438, openWaterHighCm: 241, openWaterLowCm: 216, rangeCm: 229 },
      { year: 2013, highestYearCm: 692, openWaterHighCm: 306, openWaterLowCm: 232, rangeCm: 466 },
      { year: 2014, highestYearCm: 662, openWaterHighCm: 487, openWaterLowCm: 231, rangeCm: 431 },
      { year: 2015, highestYearCm: 886, openWaterHighCm: 369, openWaterLowCm: 222, rangeCm: 666 },
      { year: 2017, highestYearCm: null, openWaterHighCm: 834, openWaterLowCm: 229, rangeCm: null },
      { year: 2018, highestYearCm: 578, openWaterHighCm: 284, openWaterLowCm: 179, rangeCm: 405 },
      { year: 2019, highestYearCm: 752, openWaterHighCm: 408, openWaterLowCm: 194, rangeCm: 572 },
      { year: 2020, highestYearCm: 570, openWaterHighCm: 300, openWaterLowCm: 174, rangeCm: 415 },
      { year: 2021, highestYearCm: 570, openWaterHighCm: 286, openWaterLowCm: 156, rangeCm: 418 },
      { year: 2022, highestYearCm: null, openWaterHighCm: 438, openWaterLowCm: null, rangeCm: null },
    ],
    stats: { years: 48, peakOpenWaterCm: 834, peakYearCm: 886, lowestOpenWaterCm: 156 },
  },
  13077: {
    title:
      "13077. р. Нура - с. Коргалжын. Отметка нуля поста: с 2010г. - 318.50м БС. 2010-2022 гг.",
    history: [
      { year: 2010, highestYearCm: 567, openWaterHighCm: 400, openWaterLowCm: 368, rangeCm: 199 },
      { year: 2011, highestYearCm: 479, openWaterHighCm: 410, openWaterLowCm: 372, rangeCm: 109 },
      { year: 2012, highestYearCm: 485, openWaterHighCm: 410, openWaterLowCm: 322, rangeCm: 163 },
      { year: 2013, highestYearCm: 622, openWaterHighCm: 454, openWaterLowCm: 404, rangeCm: 283 },
      { year: 2014, highestYearCm: 695, openWaterHighCm: 695, openWaterLowCm: 409, rangeCm: 286 },
      { year: 2015, highestYearCm: 824, openWaterHighCm: 585, openWaterLowCm: 453, rangeCm: 401 },
      { year: 2016, highestYearCm: 706, openWaterHighCm: 674, openWaterLowCm: 449, rangeCm: 283 },
      { year: 2017, highestYearCm: 811, openWaterHighCm: 811, openWaterLowCm: 436, rangeCm: 397 },
      { year: 2018, highestYearCm: 742, openWaterHighCm: 699, openWaterLowCm: 382, rangeCm: 360 },
      { year: 2019, highestYearCm: 783, openWaterHighCm: 758, openWaterLowCm: 416, rangeCm: 378 },
      { year: 2020, highestYearCm: 732, openWaterHighCm: 732, openWaterLowCm: 426, rangeCm: 316 },
      { year: 2021, highestYearCm: 659, openWaterHighCm: 501, openWaterLowCm: 379, rangeCm: 280 },
      { year: 2022, highestYearCm: null, openWaterHighCm: 589, openWaterLowCm: null, rangeCm: null },
    ],
    stats: { years: 13, peakOpenWaterCm: 811, peakYearCm: 824, lowestOpenWaterCm: 322 },
  },
  13078: {
    title:
      "13078. р. Нура – с. Бирлик. Отметка нуля поста: с 2020г. - 340.50м БС. 2020-2022 гг.",
    history: [
      { year: 2020, highestYearCm: 925, openWaterHighCm: 910, openWaterLowCm: 688, rangeCm: 244 },
      { year: 2021, highestYearCm: 995, openWaterHighCm: 803, openWaterLowCm: 697, rangeCm: 315 },
      { year: 2022, highestYearCm: null, openWaterHighCm: 956, openWaterLowCm: 676, rangeCm: null },
    ],
    stats: { years: 3, peakOpenWaterCm: 956, peakYearCm: 995, lowestOpenWaterCm: 676 },
  },
};

// ─── Low water risk analysis ──────────────────────────────────────────────────

export type LowWaterRisk = "normal" | "moderate" | "high";

export type LowWaterRiskEntry = {
  year: number;
  lowCm: number;
  norm: number;
  deviationPct: number;
  risk: LowWaterRisk;
};

export type LowWaterAnalysis = {
  norm: number;
  entries: LowWaterRiskEntry[];
  lastRisk: LowWaterRisk | null;
  highRiskYears: number[];
  hasSufficientData: boolean;
};

export function analyzeLowWaterRisk(postCode: number): LowWaterAnalysis | null {
  const hist = getHydropostHistory(postCode);
  if (!hist) return null;

  const valid = hist.history.filter((h) => h.openWaterLowCm != null) as Array<
    HydropostHistoryEntry & { openWaterLowCm: number }
  >;

  if (valid.length < 2) {
    return { norm: 0, entries: [], lastRisk: null, highRiskYears: [], hasSufficientData: false };
  }

  const sorted = [...valid.map((h) => h.openWaterLowCm)].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const norm = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const normAbs = Math.abs(norm) || 1;

  const entries: LowWaterRiskEntry[] = valid.map((h) => {
    const deviationPct = ((h.openWaterLowCm - norm) / normAbs) * 100;
    const risk: LowWaterRisk =
      deviationPct < -15 ? "high" : deviationPct < -7 ? "moderate" : "normal";
    return { year: h.year, lowCm: h.openWaterLowCm, norm, deviationPct, risk };
  });

  return {
    norm,
    entries,
    lastRisk: entries[entries.length - 1]?.risk ?? null,
    highRiskYears: entries.filter((e) => e.risk === "high").map((e) => e.year),
    hasSufficientData: valid.length >= 3,
  };
}

const districtAliases: Record<string, string[]> = {
  Кокшетау: ["кокшетау"],
  Зеренда: ["зеренда"],
  Бурабай: ["бурабай"],
  Щучинск: ["щучинск", "щучье"],
  Шортанды: ["шортанды"],
  Акколь: ["акколь"],
  Степногорск: ["степногорск"],
  Аршалы: ["аршалы", "нура"],
  Атбасар: ["атбасар", "жабай"],
  Ерейментау: ["ерейментау", "оленты"],
  Есиль: ["есиль"],
  Сандыктау: ["сандыктау", "шагылалы"],
  "Кызылординская городская администрация": ["кызылорда", "кызылординская гор"],
  "Байконыр Г.А.": ["байконур", "байконыр"],
  "Аральский район": ["арал", "аральск"],
  "Жалагашский район": ["жалагаш"],
  "Жанакорганский район": ["жанакорган"],
  "Казалинский район": ["казалы", "казалинск"],
  "Кармакшинский район": ["кармакшы", "кармакшинский", "жосалы"],
  "Сырдарьинский район": ["сырдарьинский", "тереньозек", "теренозек"],
  "Шиелийский район": ["шиели"],
};

function detectDistrict(query: string) {
  for (const [district, aliases] of Object.entries(districtAliases)) {
    if (aliases.some((alias) => query.includes(alias))) {
      return district;
    }
  }

  return null;
}

function detectStatus(query: string) {
  if (["красн", "опас", "critical", "danger", "авар"].some((token) => query.includes(token))) {
    return "danger";
  }

  if (["warning", "желт", "предупр", "повыш"].some((token) => query.includes(token))) {
    return "warning";
  }

  return null;
}

export function getHydropostHistory(code: number) {
  return hydropostHistoryByCode[code] ?? null;
}

export function pickLocalResult(query: string, region: Region = "akmola") {
  const text = query.toLowerCase().trim();
  const district = detectDistrict(text);
  const status = detectStatus(text);

  const regionalPosts = hydroposts.filter((post) => post.region === region);
  let matches = regionalPosts;

  if (district) {
    matches = matches.filter((post) => post.district === district);
  }

  if (status) {
    matches = matches.filter((post) => post.status === status);
  }

  const bestMatch =
    [...matches].sort((a, b) => b.waterLevel - a.waterLevel)[0] ?? regionalPosts[0] ?? hydroposts[0];
  const avgLevel =
    matches.length > 0
      ? Math.round(matches.reduce((sum, post) => sum + post.waterLevel, 0) / matches.length)
      : bestMatch.waterLevel;

  return {
    answer:
      matches.length > 0
        ? `Показываю ${matches.length} гидропост(а/ов)${
            district ? ` по району ${district}` : ""
          }. Средний уровень ${avgLevel} см, максимум на ${bestMatch.label} (${bestMatch.waterLevel} см).`
        : `Совпадений не нашёл, показываю базовый гидропост ${bestMatch.label}.`,
    bestMatch,
    markers: matches.length > 0 ? matches : [bestMatch],
  };
}

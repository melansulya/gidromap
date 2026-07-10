
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
  updatedAt: string;
  coordinates: [number, number];
  topics: string[];
};

export type WaterObject = {
  id: string;
  name: string;
  kind: "river" | "lake" | "reservoir";
  geometry: "polyline" | "polygon";
  coordinates: [number, number][] | [number, number][][];
};

export const hydroposts: Hydropost[] = [
  {
    code: 11242,
    label: "с. Новомарковка",
    district: "Аккольский район",
    waterBody: "р. Селеты",
    status: "warning",
    waterLevel: 168,
    updatedAt: "XLSX: код 11242",
    coordinates: [72.305, 51.7369],
    topics: ["новомарковка", "селеты", "11242", "вода", "гидропост"],
  },
  {
    code: 11253,
    label: "Бестогай",
    district: "Селетинский узел",
    waterBody: "р. Селеты",
    status: "normal",
    waterLevel: 142,
    updatedAt: "XLSX: код 11253",
    coordinates: [72.6856, 52.0006],
    topics: ["бестогай", "селеты", "11253", "вода", "гидропост"],
  },
  {
    code: 11262,
    label: "с. Журавлевка",
    district: "Буландынский район",
    waterBody: "р. Боксук",
    status: "normal",
    waterLevel: 151,
    updatedAt: "XLSX: код 11262",
    coordinates: [69.9772, 51.9567],
    topics: ["журавлевка", "боксук", "11262", "вода", "гидропост"],
  },
  {
    code: 11272,
    label: "с. Приречное",
    district: "Ерейментауский район",
    waterBody: "р. Силеты",
    status: "warning",
    waterLevel: 176,
    updatedAt: "XLSX: код 11272",
    coordinates: [71.9378, 51.5372],
    topics: ["приречное", "силеты", "11272", "вода", "гидропост"],
  },
  {
    code: 11275,
    label: "с. Изобильное",
    district: "Сандыктауский район",
    waterBody: "р. Силеты",
    status: "danger",
    waterLevel: 214,
    updatedAt: "XLSX: код 11275",
    coordinates: [73.285, 52.4944],
    topics: ["изобильное", "силеты", "11275", "вода", "гидропост"],
  },
  {
    code: 11291,
    label: "с. Павловка",
    district: "Зерендинский район",
    waterBody: "р. Шагалалы",
    status: "normal",
    waterLevel: 149,
    updatedAt: "XLSX: код 11291",
    coordinates: [69.0122, 53.0994],
    topics: ["павловка", "шагалалы", "11291", "вода", "гидропост"],
  },
  {
    code: 11398,
    label: "г. Астана",
    district: "Астана",
    waterBody: "р. Есиль",
    status: "warning",
    waterLevel: 183,
    updatedAt: "XLSX: код 11398",
    coordinates: [71.4142, 51.1578],
    topics: ["астана", "есиль", "11398", "вода", "гидропост"],
  },
  {
    code: 11404,
    label: "г. Есиль",
    district: "Есильский район",
    waterBody: "р. Есиль",
    status: "danger",
    waterLevel: 227,
    updatedAt: "XLSX: код 11404",
    coordinates: [66.2686, 52.0203],
    topics: ["есиль", "каменный карьер", "11404", "вода", "гидропост"],
  },
  {
    code: 11411,
    label: "пос. Тельмана",
    district: "Астана",
    waterBody: "р. Есиль",
    status: "warning",
    waterLevel: 191,
    updatedAt: "XLSX: код 11411",
    coordinates: [71.4908, 51.0994],
    topics: ["тельмана", "есиль", "11411", "вода", "гидропост"],
  },
  {
    code: 11413,
    label: "с. Коктал",
    district: "Астана",
    waterBody: "р. Есиль",
    status: "normal",
    waterLevel: 145,
    updatedAt: "XLSX: код 11413",
    coordinates: [71.3431, 51.1736],
    topics: ["коктал", "есиль", "11413", "вода", "гидропост"],
  },
  {
    code: 11415,
    label: "пос. Аршалы",
    district: "Аршалынский район",
    waterBody: "р. Есиль",
    status: "warning",
    waterLevel: 174,
    updatedAt: "XLSX: код 11415",
    coordinates: [72.1841, 50.8427],
    topics: ["аршалы", "есиль", "11415", "вода", "гидропост"],
  },
  {
    code: 11421,
    label: "с. Николаевка",
    district: "Аршалынский район",
    waterBody: "р. Мойылды",
    status: "normal",
    waterLevel: 154,
    updatedAt: "XLSX: код 11421",
    coordinates: [72.4417, 51.0892],
    topics: ["николаевка", "мойылды", "11421", "вода", "гидропост"],
  },
  {
    code: 11424,
    label: "с. Калкутан",
    district: "Астраханский район",
    waterBody: "р. Калкутан",
    status: "warning",
    waterLevel: 187,
    updatedAt: "XLSX: код 11424",
    coordinates: [69.4639, 51.7858],
    topics: ["калкутан", "11424", "вода", "гидропост"],
  },
  {
    code: 11425,
    label: "п. Новокубанка",
    district: "Шортандинский район",
    waterBody: "р. Калкутан",
    status: "danger",
    waterLevel: 221,
    updatedAt: "XLSX: код 11425",
    coordinates: [70.7459, 51.6787],
    topics: ["новокубанка", "калкутан", "11425", "вода", "гидропост"],
  },
  {
    code: 11426,
    label: "с. Терисаккан",
    district: "Жаркаинский район",
    waterBody: "р. Терисаккан",
    status: "normal",
    waterLevel: 147,
    updatedAt: "XLSX: код 11426",
    coordinates: [67.2103, 51.2618],
    topics: ["терисаккан", "11426", "вода", "гидропост"],
  },
  {
    code: 11432,
    label: "с. Балкашино",
    district: "Сандыктауский район",
    waterBody: "р. Жабай",
    status: "warning",
    waterLevel: 179,
    updatedAt: "XLSX: код 11432",
    coordinates: [68.7892, 52.5369],
    topics: ["балкашино", "жабай", "11432", "вода", "гидропост"],
  },
  {
    code: 11433,
    label: "г. Атбасар",
    district: "Атбасарский район",
    waterBody: "р. Жабай",
    status: "danger",
    waterLevel: 233,
    updatedAt: "XLSX: код 11433",
    coordinates: [68.3689, 51.7978],
    topics: ["атбасар", "жабай", "11433", "вода", "гидропост"],
  },
  {
    code: 11472,
    label: "с. Шуйское",
    district: "Атбасарский район",
    waterBody: "р. Жыланды",
    status: "warning",
    waterLevel: 182,
    updatedAt: "XLSX: код 11472",
    coordinates: [68.3127, 52.0954],
    topics: ["шуйское", "жыланды", "11472", "вода", "гидропост"],
  },
  {
    code: 11485,
    label: "с. Буденовка",
    district: "Буландынский район",
    waterBody: "р. Аршалы",
    status: "normal",
    waterLevel: 153,
    updatedAt: "XLSX: код 11485",
    coordinates: [69.6349, 52.1],
    topics: ["буденовка", "аршалы", "11485", "вода", "гидропост"],
  },
  {
    code: 11908,
    label: "с. Зеренды",
    district: "Зерендинский район",
    waterBody: "оз. Зеренды",
    status: "normal",
    waterLevel: 141,
    updatedAt: "XLSX: код 11908",
    coordinates: [69.1425, 52.9156],
    topics: ["зеренды", "озеро зеренды", "11908", "вода", "гидропост"],
  },
  {
    code: 11909,
    label: "г. Щучинск",
    district: "Бурабайский район",
    waterBody: "оз. Шортан",
    status: "warning",
    waterLevel: 173,
    updatedAt: "XLSX: код 11909",
    coordinates: [70.19, 53.0089],
    topics: ["щучинск", "шортан", "11909", "вода", "гидропост"],
  },
  {
    code: 11917,
    label: "с. Боровое",
    district: "Бурабайский район",
    waterBody: "Оз. Бурабай",
    status: "normal",
    waterLevel: 148,
    updatedAt: "XLSX: код 11917",
    coordinates: [70.3022, 53.0775],
    topics: ["боровое", "бурабай", "11917", "вода", "гидропост"],
  },
  {
    code: 11919,
    label: "г. Кокшетау",
    district: "Кокшетау",
    waterBody: "оз. Копа",
    status: "warning",
    waterLevel: 171,
    updatedAt: "XLSX: код 11919",
    coordinates: [69.38, 53.3003],
    topics: ["кокшетау", "копа", "11919", "вода", "гидропост"],
  },
  {
    code: 11966,
    label: "с. Михайловка",
    district: "Аршалынский район",
    waterBody: "Вдхр. Астанинское",
    status: "danger",
    waterLevel: 219,
    updatedAt: "XLSX: код 11966",
    coordinates: [72.2539, 51.0052],
    topics: ["михайловка", "астанинское", "11966", "вода", "гидропост"],
  },
  {
    code: 11974,
    label: "с. Арнасай",
    district: "Аршалынский район",
    waterBody: "Вдхр. Астанинское",
    status: "warning",
    waterLevel: 181,
    updatedAt: "XLSX: код 11974",
    coordinates: [72.1178, 50.9917],
    topics: ["арнасай", "астанинское", "11974", "вода", "гидропост"],
  },
  {
    code: 13076,
    label: "с. Кошкарбаева",
    district: "Коргалжынский район",
    waterBody: "р. Нура",
    status: "normal",
    waterLevel: 157,
    updatedAt: "XLSX: код 13076",
    coordinates: [71.3356, 50.8289],
    topics: ["кошкарбаева", "нура", "13076", "вода", "гидропост"],
  },
  {
    code: 13077,
    label: "с. Коргалжын",
    district: "Коргалжынский район",
    waterBody: "р. Нура",
    status: "warning",
    waterLevel: 189,
    updatedAt: "XLSX: код 13077",
    coordinates: [70.0081, 50.5931],
    topics: ["коргалжын", "нура", "13077", "вода", "гидропост"],
  },
  {
    code: 13078,
    label: "пос. Бірлік",
    district: "Целиноградский район",
    waterBody: "р. Нура",
    status: "danger",
    waterLevel: 226,
    updatedAt: "XLSX: код 13078",
    coordinates: [70.8678, 50.9563],
    topics: ["бірлік", "нура", "13078", "вода", "гидропост"],
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
};

export const waterObjects: WaterObject[] = [];

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

export function pickLocalResult(query: string) {
  const text = query.toLowerCase().trim();
  const district = detectDistrict(text);
  const status = detectStatus(text);

  let matches = hydroposts;

  if (district) {
    matches = matches.filter((post) => post.district === district);
  }

  if (status) {
    matches = matches.filter((post) => post.status === status);
  }

  const bestMatch = [...matches].sort((a, b) => b.waterLevel - a.waterLevel)[0] ?? hydroposts[0];
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

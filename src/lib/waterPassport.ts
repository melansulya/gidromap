export type WaterPassportEntry = {
  displayName: string;
  totalLengthKm?: number;
  source?: string;
  mouth?: string;
  basin?: string;
  tributaries?: string[];
  notes?: string;
};

const PASSPORTS: Record<string, WaterPassportEntry> = {
  "есиль": {
    displayName: "Есиль (Ишим)",
    totalLengthKm: 2450,
    source: "Нияз-Тас, Казахский мелкосопочник",
    mouth: "р. Иртыш (Россия, Тюменская область)",
    basin: "Иртышский бассейн",
    tributaries: ["Нура", "Жабай", "Силеты", "Терисаккан", "Иманбурлук"],
    notes: "Главная река Акмолинской области. Протекает через Астану. По территории Казахстана длина около 1400 км.",
  },
  "нура": {
    displayName: "Нура",
    totalLengthKm: 978,
    source: "Жезказганский район, Карагандинская область",
    mouth: "оз. Тенгиз",
    basin: "Бассейн озера Тенгиз",
    tributaries: ["Шерубай-Нура", "Кара-Кенгир", "Жарлы"],
    notes: "Бессточная река, впадает в соляное озеро Тенгиз. Важный источник водоснабжения Астаны.",
  },
  "жабай": {
    displayName: "Жабай",
    totalLengthKm: 359,
    source: "Кокчетавская возвышенность",
    mouth: "р. Есиль",
    basin: "Бассейн Есиля / Иртыша",
    tributaries: ["Кылшакты", "Арыктысай"],
    notes: "Правый приток р. Есиль. Протекает через Атбасар.",
  },
  "силеты": {
    displayName: "Силеты",
    totalLengthKm: 779,
    source: "Северо-Казахстанская область",
    mouth: "оз. Силеты-Тениз",
    basin: "Бассейн оз. Силеты-Тениз",
    tributaries: ["Карасу", "Чаглинка"],
    notes: "Протекает по северу Акмолинской области. Бессточная — впадает в оз. Силеты-Тениз.",
  },
  "селеты": {
    displayName: "Селеты (Силеты)",
    totalLengthKm: 779,
    source: "Северо-Казахстанская область",
    mouth: "оз. Селеты-Тениз",
    basin: "Бассейн оз. Селеты-Тениз",
    tributaries: ["Карасу"],
    notes: "Протекает по северу Акмолинской области.",
  },
  "калкутан": {
    displayName: "Калкутан",
    totalLengthKm: 115,
    source: "Аршалынский район",
    mouth: "р. Есиль",
    basin: "Бассейн Есиля / Иртыша",
  },
  "терисаккан": {
    displayName: "Терисаккан",
    totalLengthKm: 284,
    source: "Степная Акмолинская область",
    mouth: "р. Есиль",
    basin: "Бассейн Есиля / Иртыша",
    tributaries: ["Шолак"],
    notes: "Левый приток Есиля в среднем течении.",
  },
  "жыланды": {
    displayName: "Жыланды",
    totalLengthKm: 112,
    source: "Степная Акмолинская область",
    mouth: "р. Нура",
    basin: "Бассейн оз. Тенгиз",
    notes: "Небольшая река, правый приток Нуры.",
  },
  "аршалы": {
    displayName: "Аршалы",
    totalLengthKm: 95,
    source: "Аршалынский район",
    mouth: "р. Есиль",
    basin: "Бассейн Есиля / Иртыша",
  },
  "мойылды": {
    displayName: "Мойылды",
    totalLengthKm: 130,
    source: "Акмолинская область",
    mouth: "р. Есиль",
    basin: "Бассейн Есиля / Иртыша",
  },
  "боксук": {
    displayName: "Боксук",
    totalLengthKm: 90,
    source: "Акмолинская область",
    mouth: "р. Силеты",
    basin: "Бассейн оз. Силеты-Тениз",
  },
  "боксык": {
    displayName: "Боксук (Боқсық)",
    totalLengthKm: 90,
    source: "Акмолинская область",
    mouth: "р. Силеты",
    basin: "Бассейн оз. Силеты-Тениз",
  },
  "шагалалы": {
    displayName: "Шагалалы",
    totalLengthKm: 75,
    source: "Ерейментауский район",
    mouth: "р. Нура",
    basin: "Бассейн оз. Тенгиз",
  },
  "бурабай": {
    displayName: "оз. Бурабай (Боровое)",
    notes: "Горное озеро в Бурабайском районе. Часть системы Щучинско-Боровской курортной зоны. Высота над уровнем моря ~310 м.",
  },
  "копа": {
    displayName: "оз. Копа",
    notes: "Озеро вблизи Кокшетау. Используется для рекреации и водоснабжения.",
  },
  "зеренды": {
    displayName: "оз. Зеренды",
    notes: "Озеро в Зерендинском районе. Входит в Щучинско-Боровскую курортную зону.",
  },
  "шортан": {
    displayName: "оз. Шортан (Шортанды)",
    notes: "Озеро в Шортандинском районе.",
  },
  "астанинское": {
    displayName: "Астанинское водохранилище",
    notes: "Водохранилище на р. Есиль у Астаны. Главный источник водоснабжения столицы.",
  },
  "вячеслава": {
    displayName: "вдхр. Вячеслава",
    notes: "Водохранилище на р. Есиль. Резервный источник водоснабжения.",
  },
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(р\.|оз\.|вдхр\.)\s*/i, "")
    // Kazakh-specific letters → Russian equivalents for matching
    .replace(/і/g, "и")
    .replace(/ұ/g, "у")
    .replace(/ү/g, "у")
    .replace(/қ/g, "к")
    .replace(/ғ/g, "г")
    .replace(/ң/g, "н")
    .replace(/ө/g, "о")
    .replace(/ә/g, "а")
    .replace(/һ/g, "х")
    .replace(/\s+/g, " ")
    .trim();
}

export function getWaterPassport(name: string): WaterPassportEntry | null {
  const norm = normalizeName(name);
  // Exact match
  if (PASSPORTS[norm]) return PASSPORTS[norm];
  // Partial match — check if any key is a substring of norm or vice versa
  for (const [key, entry] of Object.entries(PASSPORTS)) {
    if (norm.includes(key) || key.includes(norm)) return entry;
  }
  return null;
}

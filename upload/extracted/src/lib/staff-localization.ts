import type { Locale } from "./i18n";

const CYRILLIC: Record<string, string> = {
  А: "A", а: "a", Б: "B", б: "b", В: "V", в: "v", Г: "G", г: "g",
  Д: "D", д: "d", Е: "E", е: "e", Ё: "Yo", ё: "yo", Ж: "J", ж: "j",
  З: "Z", з: "z", И: "I", и: "i", Й: "Y", й: "y", К: "K", к: "k",
  Л: "L", л: "l", М: "M", м: "m", Н: "N", н: "n", О: "O", о: "o",
  П: "P", п: "p", Р: "R", р: "r", С: "S", с: "s", Т: "T", т: "t",
  У: "U", у: "u", Ф: "F", ф: "f", Х: "X", х: "x", Ц: "Ts", ц: "ts",
  Ч: "Ch", ч: "ch", Ш: "Sh", ш: "sh", Щ: "Sh", щ: "sh", Ъ: "", ъ: "",
  Ы: "I", ы: "i", Ь: "", ь: "", Э: "E", э: "e", Ю: "Yu", ю: "yu",
  Я: "Ya", я: "ya", Қ: "Q", қ: "q", Ғ: "Gʻ", ғ: "gʻ", Ў: "Oʻ", ў: "oʻ",
  Ҳ: "H", ҳ: "h",
};

export function transliterateName(value: string) {
  return [...value].map((ch) => CYRILLIC[ch] ?? ch).join("");
}

const DEPARTMENT_TRANSLATIONS: Record<
  string,
  { uz: string; en: string }
> = {
  "AKELA GROUP": { uz: "AKELA GROUP", en: "AKELA GROUP" },
  "Департамент управления": {
    uz: "Boshqaruv departamenti",
    en: "Management Department",
  },
  "Отдел управления": { uz: "Boshqaruv bo‘limi", en: "Management Office" },
  "Отдел офиса": { uz: "Ofis bo‘limi", en: "Office Department" },
  "Отдел корпоративной безопасности": {
    uz: "Korporativ xavfsizlik bo‘limi",
    en: "Corporate Security Department",
  },
  "Административно-хозяйственный отдел (АХО)": {
    uz: "Ma’muriy-xo‘jalik bo‘limi",
    en: "Administration and Facilities Department",
  },
  "Колл-центр": { uz: "Koll-markaz", en: "Call Center" },
  "Департамент по работе с персоналом": {
    uz: "Xodimlar bilan ishlash departamenti",
    en: "Human Resources Department",
  },
  "Департамент Маркетинга и продаж": {
    uz: "Marketing va savdo departamenti",
    en: "Marketing and Sales Department",
  },
  "Отдел проектных продаж": {
    uz: "Loyiha savdolari bo‘limi",
    en: "Project Sales Department",
  },
  "Отдел продуктных продаж": {
    uz: "Mahsulot savdosi bo‘limi",
    en: "Product Sales Department",
  },
  "Отдел продаж запасных частей": {
    uz: "Ehtiyot qismlar savdosi bo‘limi",
    en: "Spare Parts Sales Department",
  },
  "Отдел продаж услуг логистики и контрактации": {
    uz: "Logistika va kontraktatsiya xizmatlari savdosi bo‘limi",
    en: "Logistics and Contracting Services Sales",
  },
  "Отдел продаж услуг технической поддержки": {
    uz: "Texnik yordam xizmatlari savdosi bo‘limi",
    en: "Technical Support Services Sales",
  },
  "Отдел продаж услуг Mice": {
    uz: "MICE xizmatlari savdosi bo‘limi",
    en: "MICE Services Sales",
  },
  "Отдел продаж услуг IT": {
    uz: "IT xizmatlari savdosi bo‘limi",
    en: "IT Services Sales",
  },
  "Отдел Маркетинга": { uz: "Marketing bo‘limi", en: "Marketing Department" },
  "Финансовый департамент": {
    uz: "Moliya departamenti",
    en: "Finance Department",
  },
  "Отдел бухгалтерии и финансового учёта": {
    uz: "Buxgalteriya va moliyaviy hisob bo‘limi",
    en: "Accounting and Financial Reporting Department",
  },
  "Операционный департамент": {
    uz: "Operatsion departament",
    en: "Operations Department",
  },
  "Отдел закупа": { uz: "Xarid bo‘limi", en: "Procurement Department" },
  "Отдел логистики и контрактации": {
    uz: "Logistika va kontraktatsiya bo‘limi",
    en: "Logistics and Contracting Department",
  },
  "Отдел склада": { uz: "Ombor bo‘limi", en: "Warehouse Department" },
  "Oтдел технической поддержки": {
    uz: "Texnik yordam bo‘limi",
    en: "Technical Support Department",
  },
};

const ROLE_REPLACEMENTS: Record<"uz" | "en", [string, string][]> = {
  uz: [
    ["Начальник отдела", "Bo‘lim boshlig‘i"],
    ["Управляющий директор", "Boshqaruvchi direktor"],
    ["Генеральный директор", "Bosh direktor"],
    ["Исполнительный директор", "Ijrochi direktor"],
    ["Коммерческий директор", "Tijorat direktori"],
    ["Финансовый директор", "Moliya direktori"],
    ["Операционный директор", "Operatsion direktor"],
    ["Директор по персоналу", "Xodimlar bo‘yicha direktor"],
    ["Главный бухгалтер", "Bosh buxgalter"],
    ["Системный администратор", "Tizim administratori"],
    ["Персональный ассистент директора", "Direktor shaxsiy assistenti"],
    ["Специалист по кибербезопасности", "Kiberxavfsizlik mutaxassisi"],
    ["Менеджер по продажам", "Savdo menejeri"],
    ["Менеджер проектных продаж", "Loyiha savdolari menejeri"],
    ["Менеджер продуктных продаж", "Mahsulot savdosi menejeri"],
    ["Менеджер по закупу", "Xarid menejeri"],
    ["Менеджер логистики", "Logistika menejeri"],
    ["Менеджер ВЭД", "Tashqi iqtisodiy faoliyat menejeri"],
    ["Менеджер по кадровому администрированию", "Kadrlar ma’muriyati menejeri"],
    ["стажер", "stajyor"],
    ["Стажер", "Stajyor"],
    ["Бухгалтер", "Buxgalter"],
    ["Финансист-экономист", "Moliyachi-iqtisodchi"],
    ["Экономист", "Iqtisodchi"],
    ["Юрист", "Yurist"],
    ["Водитель", "Haydovchi"],
    ["Уборщица", "Farrosh"],
    ["Сотрудник охраны", "Qo‘riqlash xodimi"],
    ["Инженер", "Muhandis"],
    ["Технолог", "Texnolog"],
    ["Кассир", "Kassir"],
    ["Аудитор", "Auditor"],
    ["Аналитик", "Tahlilchi"],
    ["Графический дизайнер", "Grafik dizayner"],
    ["Мобилограф", "Mobilograf"],
    ["Маркетолог", "Marketolog"],
    ["Менеджер", "Menejer"],
  ],
  en: [
    ["Начальник отдела", "Head of Department"],
    ["Управляющий директор", "Managing Director"],
    ["Генеральный директор", "Chief Executive Officer"],
    ["Исполнительный директор", "Executive Director"],
    ["Коммерческий директор", "Commercial Director"],
    ["Финансовый директор", "Chief Financial Officer"],
    ["Операционный директор", "Chief Operating Officer"],
    ["Директор по персоналу", "HR Director"],
    ["Главный бухгалтер", "Chief Accountant"],
    ["Системный администратор", "System Administrator"],
    ["Персональный ассистент директора", "Director’s Personal Assistant"],
    ["Специалист по кибербезопасности", "Cybersecurity Specialist"],
    ["Менеджер по продажам", "Sales Manager"],
    ["Менеджер проектных продаж", "Project Sales Manager"],
    ["Менеджер продуктных продаж", "Product Sales Manager"],
    ["Менеджер по закупу", "Procurement Manager"],
    ["Менеджер логистики", "Logistics Manager"],
    ["Менеджер ВЭД", "Foreign Trade Manager"],
    ["Менеджер по кадровому администрированию", "HR Administration Manager"],
    ["стажер", "intern"],
    ["Стажер", "Intern"],
    ["Бухгалтер", "Accountant"],
    ["Финансист-экономист", "Financial Economist"],
    ["Экономист", "Economist"],
    ["Юрист", "Lawyer"],
    ["Водитель", "Driver"],
    ["Уборщица", "Cleaner"],
    ["Сотрудник охраны", "Security Officer"],
    ["Инженер", "Engineer"],
    ["Технолог", "Technologist"],
    ["Кассир", "Cashier"],
    ["Аудитор", "Auditor"],
    ["Аналитик", "Analyst"],
    ["Графический дизайнер", "Graphic Designer"],
    ["Мобилограф", "Mobile Content Creator"],
    ["Маркетолог", "Marketing Specialist"],
    ["Менеджер", "Manager"],
  ],
};

function translateDepartment(value: string, locale: "uz" | "en") {
  const entry = Object.entries(DEPARTMENT_TRANSLATIONS)
    .sort(([a], [b]) => b.length - a.length)
    .find(([source]) => value.startsWith(source));
  if (!entry) return transliterateName(value);
  const [source, translated] = entry;
  return `${translated[locale]}${value.slice(source.length)}`;
}

function translateRole(value: string, locale: "uz" | "en") {
  let translated = value;
  for (const [source, target] of ROLE_REPLACEMENTS[locale]) {
    translated = translated.replaceAll(source, target);
  }
  return transliterateName(translated);
}

export function localizeStaffText(
  value: string,
  locale: Locale,
  kind: "name" | "role" | "department",
) {
  if (!value || locale === "ru") return value;
  if (kind === "name") return transliterateName(value);
  if (kind === "department") return translateDepartment(value, locale);
  return translateRole(value, locale);
}

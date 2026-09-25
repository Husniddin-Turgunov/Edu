import * as XLSX from "xlsx";
import {
  normalizeKind,
  normalizeSection,
  type SectionKind,
} from "./scoring";

export type ImportedQuestion = {
  prompt: string;
  type: "single" | "multiple" | "text";
  options: string[];
  correctIndexes: number[];
  keywords: string[];
  weight: number;
  difficulty: string;
  knowledgeKind: SectionKind;
  section: string;
};

const TYPE_MAP: Record<string, "single" | "multiple" | "text"> = {
  single: "single",
  one: "single",
  один: "single",
  "один вариант": "single",
  multiple: "multiple",
  multi: "multiple",
  несколько: "multiple",
  "несколько вариантов": "multiple",
  text: "text",
  written: "text",
  письменно: "text",
  письменный: "text",
  yozma: "text",
};

function normHeader(h: unknown) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function cell(row: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
      return String(row[k]).trim();
    }
  }
  return "";
}

function parseType(raw: string): "single" | "multiple" | "text" {
  const key = raw.trim().toLowerCase();
  return TYPE_MAP[key] ?? "single";
}

/** 1-based indexes from Excel → 0-based */
function parseCorrectIndexes(raw: string, optionCount: number): number[] {
  if (!raw.trim()) return optionCount > 0 ? [0] : [];
  return raw
    .split(/[,;|/]+/)
    .map((p) => Number(String(p).trim()))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= optionCount)
    .map((n) => n - 1);
}

function parseKeywords(raw: string): string[] {
  return raw
    .split(/[,;|]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

export function buildTestImportTemplate(): Buffer {
  const rows = [
    {
      Раздел: "Продажи",
      Измерение: "knowledge",
      Вопрос: "Клиент недоволен сроком. Лучший первый шаг?",
      Тип: "single",
      Вариант1: "Сразу предложить скидку",
      Вариант2: "Выяснить факт и признать эмоцию",
      Вариант3: "Передать тикет без комментария",
      Вариант4: "Обещать без проверки",
      Правильные: "2",
      Ключевые_слова: "",
      Вес: 1,
    },
    {
      Раздел: "Продажи",
      Измерение: "knowledge",
      Вопрос: "Что важно при постановке задачи? (несколько ответов)",
      Тип: "multiple",
      Вариант1: "Срок",
      Вариант2: "Критерий результата",
      Вариант3: "Случайный исполнитель без контекста",
      Вариант4: "Ответственный",
      Правильные: "1,2,4",
      Ключевые_слова: "",
      Вес: 1,
    },
    {
      Раздел: "Рост",
      Измерение: "aspiration",
      Вопрос: "Готовы ли брать сложные задачи сверх текущих обязанностей?",
      Тип: "single",
      Вариант1: "Нет, только то что в должностной",
      Вариант2: "Да, если есть поддержка и понятная цель",
      Вариант3: "Только за доплату без интереса к росту",
      Вариант4: "Избегаю новой ответственности",
      Правильные: "2",
      Ключевые_слова: "",
      Вес: 1,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Вопросы");
  const instr = XLSX.utils.aoa_to_sheet([
    ["Шаблон импорта теста AKELA Assess"],
    [""],
    ["Логика: ~50 вопросов, группы по ~10 = раздел (колонка «Раздел»)."],
    ["Часть разделов — знания (knowledge), часть — стремление (aspiration)."],
    ["После теста видно: сколько из 10 закрыл в каждом разделе и подходит ли человек."],
    [""],
    ["Колонки листа «Вопросы»:"],
    ["Раздел — название блока (Продажи, Сервис, Рост…)"],
    ["Измерение — knowledge / aspiration (знание / стремление)"],
    ["Вопрос — текст вопроса (обязательно)"],
    ["Тип — single / multiple / text (или: один / несколько / письменно)"],
    ["Вариант1…Вариант4 — варианты ответа (для single/multiple)"],
    ["Правильные — номера верных вариантов с 1, через запятую (пример: 2 или 1,3)"],
    ["Ключевые_слова — для type=text, через запятую"],
    ["Вес — число, по умолчанию 1"],
    [""],
    ["Название, описание и длительность теста задаются в форме загрузки."],
  ]);
  XLSX.utils.book_append_sheet(wb, instr, "Инструкция");
  return Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer,
  );
}

export type TestAudience = "employees" | "interns" | "candidates";

export type ImportedTestPack = {
  title: string;
  roleTitle: string;
  audience: TestAudience;
  questions: ImportedQuestion[];
  sourceSheet: string;
  roleKey: string;
  kind: "role" | "legacy";
};

const SKIP_SHEETS =
  /инструкц|сводк|ключ|instruction|summary|answer.?key|hr.?key/i;

function cellStr(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slugRole(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я]+/gi, "_")
    .replace(/^_+|_+$/g, "");
  return slug.slice(0, 64) || "test";
}

export function audienceFromFileName(fileName: string): TestAudience {
  const n = fileName.toLowerCase();
  if (/кандидат|candidate|вакант|пробн|испытан|trial/.test(n)) {
    return "candidates";
  }
  if (/стаж|intern/.test(n)) return "interns";
  if (/сотрудник|employee|staff/.test(n)) return "employees";
  return "employees";
}

function audienceFromRole(roleTitle: string, fallback: TestAudience): TestAudience {
  if (fallback === "candidates") return "candidates";
  if (/стаж|intern/.test(roleTitle.toLowerCase())) return "interns";
  return fallback;
}

function mapDifficulty(raw: string) {
  const v = raw.trim().toLowerCase();
  if (/база|base|стаж|intern/.test(v)) return "junior";
  if (/middle|мидл/.test(v)) return "middle";
  if (/senior|синьор|lead|эксперт/.test(v)) return "senior";
  if (/практик|case|кейс/.test(v)) return "junior";
  if (/junior|джун/.test(v)) return "junior";
  return v || "junior";
}

function letterToIndexes(raw: string, optionCount: number): number[] {
  const value = raw.trim().toUpperCase().replace(/Ё/g, "Е");
  if (!value) return [];

  const letters: Record<string, number> = {
    A: 0,
    B: 1,
    C: 2,
    D: 3,
    E: 4,
    F: 5,
    А: 0,
    В: 1,
    С: 2,
    Д: 3,
    Е: 4,
  };

  const fromLetters = value
    .split(/[,;|/+\s]+/)
    .map((p) => letters[p])
    .filter((n) => Number.isFinite(n) && n >= 0 && n < optionCount);

  if (fromLetters.length) return [...new Set(fromLetters)];
  return parseCorrectIndexes(raw, optionCount);
}

function sheetRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
}

function findRoleHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = (rows[i] ?? []).map((c) => cellStr(c).toLowerCase());
    const hasQuestion = cells.some((c) => c === "вопрос" || c === "question");
    const hasA = cells.includes("a") || cells.includes("а");
    const hasB = cells.includes("b") || cells.includes("в");
    const hasKey = cells.some(
      (c) =>
        c.includes("ключ") || c === "correct" || c === "правильные",
    );
    /** 5-day trial / practical packs: Question + Day/Competence/Deliverable, no A–D */
    const hasPractical = cells.some(
      (c) =>
        c === "день" ||
        c === "day" ||
        c === "компетенция" ||
        c.includes("что сдаёт") ||
        c.includes("что сдает") ||
        c.includes("самостоятельн"),
    );
    if (hasQuestion && ((hasA && hasB) || hasKey || hasPractical)) return i;
  }
  return -1;
}

function colIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((h) => aliases.includes(h));
}

function vacancyFromRows(rows: unknown[][], sheetName: string) {
  for (const row of rows.slice(0, 10)) {
    const cells = (row ?? []).map((c) => cellStr(c));
    for (let i = 0; i < cells.length; i++) {
      if (/^вакансия$|^должность$|^vacancy$|^role$/i.test(cells[i])) {
        const next = cells.slice(i + 1).find((c) => c);
        if (next) return next;
      }
    }
  }

  const heading = cellStr(rows[0]?.[0]);
  return heading.replace(/^тест\s*[:\-–]\s*/i, "").trim() || sheetName;
}

function parseRoleSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
): Omit<ImportedTestPack, "audience" | "roleKey" | "kind"> | null {
  const rows = sheetRows(sheet);
  const headerIdx = findRoleHeaderRow(rows);
  if (headerIdx < 0) return null;

  const headers = (rows[headerIdx] ?? []).map((c) => cellStr(c).toLowerCase());
  const promptCol = colIndex(headers, ["вопрос", "question"]);
  const levelCol = colIndex(headers, ["уровень", "level", "блок"]);
  const dayCol = colIndex(headers, ["день", "day"]);
  const competenceCol = colIndex(headers, [
    "компетенция",
    "competence",
    "skill",
  ]);
  const deliverableCol = headers.findIndex(
    (h) =>
      h.includes("что сдаёт") ||
      h.includes("что сдает") ||
      h.includes("deliverable") ||
      h.includes("результат"),
  );
  const independenceCol = headers.findIndex((h) =>
    h.includes("самостоятельн"),
  );
  const maxSkillCol = headers.findIndex(
    (h) => h.includes("макс") && h.includes("навык"),
  );
  const keyCol = headers.findIndex(
    (h) => h.includes("ключ") || h === "correct" || h === "правильные",
  );
  const optionCols = ["a", "b", "c", "d", "e", "f"]
    .map((letter) => headers.findIndex((h) => h === letter))
    .filter((i) => i >= 0);
  const isPracticalSheet =
    optionCols.length < 2 &&
    (dayCol >= 0 ||
      competenceCol >= 0 ||
      deliverableCol >= 0 ||
      independenceCol >= 0);

  if (promptCol < 0) return null;

  const roleTitle = vacancyFromRows(rows, sheetName);
  const questions: ImportedQuestion[] = [];

  for (const raw of rows.slice(headerIdx + 1)) {
    const row = raw ?? [];
    const prompt = cellStr(row[promptCol]);
    if (!prompt) continue;

    const marker = cellStr(row[0]).toLowerCase();
    if (
      /уровень по баллам|рекомендуемый|интерпретация|не соответствует/.test(
        marker,
      ) ||
      /уровень по баллам|рекомендуемый/.test(prompt.toLowerCase())
    ) {
      break;
    }

    const levelRaw = levelCol >= 0 ? cellStr(row[levelCol]) : "";
    const dayRaw = dayCol >= 0 ? cellStr(row[dayCol]) : "";
    const competence = competenceCol >= 0 ? cellStr(row[competenceCol]) : "";
    const deliverable =
      deliverableCol >= 0 ? cellStr(row[deliverableCol]) : "";
    const independence =
      independenceCol >= 0 ? cellStr(row[independenceCol]) : "";
    const maxSkillRaw =
      maxSkillCol >= 0 ? Number(cellStr(row[maxSkillCol])) : NaN;
    const isCase =
      /^кейс\b|^case\b/i.test(cellStr(row[0])) ||
      /практик/.test(levelRaw.toLowerCase());

    if (isCase || isPracticalSheet) {
      const fullPrompt = [
        competence ? `[${competence}] ${prompt}` : prompt,
        deliverable ? `Что сдать: ${deliverable}` : "",
        independence ? `Проверка самостоятельности: ${independence}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      const weight =
        Number.isFinite(maxSkillRaw) && maxSkillRaw > 0
          ? maxSkillRaw
          : isCase
            ? 10
            : 2;
      questions.push({
        prompt: fullPrompt,
        type: "text",
        options: [],
        correctIndexes: [],
        keywords: [],
        weight,
        difficulty: mapDifficulty(dayRaw || levelRaw || "практика"),
        knowledgeKind: "knowledge",
        section: normalizeSection(
          dayRaw || competence || levelRaw || "Практика",
        ),
      });
      continue;
    }

    const options = optionCols
      .map((i) => cellStr(row[i]))
      .filter(Boolean);
    if (options.length < 2) continue;

    const keyRaw = keyCol >= 0 ? cellStr(row[keyCol]) : "";
    const correctIndexes = letterToIndexes(keyRaw, options.length);
    if (!correctIndexes.length) {
      throw new Error(
        `${sheetName}: для вопроса «${prompt}» нет ключа (A–D)`,
      );
    }

    questions.push({
      prompt,
      type: correctIndexes.length > 1 ? "multiple" : "single",
      options,
      correctIndexes,
      keywords: [],
      weight: 2,
      difficulty: mapDifficulty(levelRaw),
      knowledgeKind: "knowledge",
      section: normalizeSection(levelRaw || "Общий"),
    });
  }

  if (!questions.length) return null;

  return {
    title: roleTitle,
    roleTitle,
    questions,
    sourceSheet: sheetName,
  };
}

function parseLegacySheet(sheet: XLSX.WorkSheet): ImportedQuestion[] {
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  const questions: ImportedQuestion[] = [];

  for (const raw of rawRows) {
    const row: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      row[normHeader(k)] = v;
    }

    const prompt = cell(row, [
      "вопрос",
      "question",
      "prompt",
      "текст_вопроса",
    ]);
    if (!prompt) continue;

    const type = parseType(
      cell(row, ["тип", "type", "тип_ответа", "answer_type"]),
    );

    const options = [
      cell(row, ["вариант1", "option1", "вариант_1"]),
      cell(row, ["вариант2", "option2", "вариант_2"]),
      cell(row, ["вариант3", "option3", "вариант_3"]),
      cell(row, ["вариант4", "option4", "вариант_4"]),
      cell(row, ["вариант5", "option5", "вариант_5"]),
      cell(row, ["вариант6", "option6", "вариант_6"]),
    ].filter(Boolean);

    const weightRaw = Number(cell(row, ["вес", "weight"]) || 1);
    const weight = Number.isFinite(weightRaw) && weightRaw > 0 ? weightRaw : 1;
    const section = normalizeSection(
      cell(row, ["раздел", "section", "блок", "тема", "category"]),
    );
    const knowledgeKind = normalizeKind(
      cell(row, [
        "измерение",
        "dimension",
        "знание",
        "knowledge",
        "knowledge_kind",
        "вид",
        "тип_раздела",
      ]),
    );

    if (type === "text") {
      const keywords = parseKeywords(
        cell(row, ["ключевые_слова", "keywords", "ключ"]),
      );
      questions.push({
        prompt,
        type,
        options: [],
        correctIndexes: [],
        keywords,
        weight,
        difficulty: "junior",
        knowledgeKind,
        section,
      });
      continue;
    }

    if (options.length < 2) {
      throw new Error(`Для вопроса «${prompt}» нужно минимум 2 варианта`);
    }

    const correctIndexes = parseCorrectIndexes(
      cell(row, ["правильные", "correct", "верно", "ответы"]),
      options.length,
    );
    if (!correctIndexes.length) {
      throw new Error(`Для вопроса «${prompt}» укажите правильные варианты`);
    }
    if (type === "single" && correctIndexes.length !== 1) {
      throw new Error(
        `Для одиночного вопроса «${prompt}» укажите ровно один правильный номер`,
      );
    }

    questions.push({
      prompt,
      type,
      options,
      correctIndexes,
      keywords: [],
      weight,
      difficulty: "junior",
      knowledgeKind,
      section,
    });
  }

  return questions;
}

function withRoleKeys(
  tests: Omit<ImportedTestPack, "roleKey">[],
): ImportedTestPack[] {
  const used = new Set<string>();
  return tests.map((test) => {
    let roleKey = slugRole(test.roleTitle || test.title || test.sourceSheet);
    if (used.has(roleKey)) {
      roleKey = slugRole(`${roleKey}_${test.sourceSheet}`);
    }
    used.add(roleKey);
    return { ...test, roleKey };
  });
}

/**
 * One Excel may be:
 * - a pack of job tests (SMM / Маркетолог / … — one sheet per role)
 * - a single test in the AKELA column template
 */
export function parseWorkbookTests(
  buffer: ArrayBuffer | Buffer,
  hints?: { fileName?: string },
): ImportedTestPack[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  if (!wb.SheetNames.length) throw new Error("В файле нет листов");

  const fileName = hints?.fileName ?? "";
  const namedAudience = audienceFromFileName(fileName);
  const fileNamesAudience = /кандидат|candidate|вакант|стаж|intern|сотрудник|employee|staff/i.test(
    fileName,
  );
  const roleTests: Omit<ImportedTestPack, "roleKey">[] = [];

  for (const sheetName of wb.SheetNames) {
    if (SKIP_SHEETS.test(sheetName)) continue;
    const parsed = parseRoleSheet(wb.Sheets[sheetName], sheetName);
    if (!parsed) continue;
    roleTests.push({
      ...parsed,
      audience: namedAudience,
      kind: "role",
    });
  }

  if (roleTests.length > 0) {
    const fallback: TestAudience = fileNamesAudience
      ? namedAudience
      : "candidates";
    return withRoleKeys(
      roleTests.map((test) => ({
        ...test,
        audience: audienceFromRole(test.roleTitle, fallback),
      })),
    );
  }

  const sheetName =
    wb.SheetNames.find((n) => /вопрос/i.test(n)) ?? wb.SheetNames[0];
  const questions = parseLegacySheet(wb.Sheets[sheetName]);
  if (!questions.length) {
    throw new Error("Не найдено ни одного вопроса с заполненным текстом");
  }

  const title = (hints?.fileName ?? "")
    .replace(/\.(xlsx|xls)$/i, "")
    .trim();

  return withRoleKeys([
    {
      title,
      roleTitle: title,
      audience: namedAudience,
      questions,
      sourceSheet: sheetName,
      kind: "legacy",
    },
  ]);
}

export function parseTestWorkbook(
  buffer: ArrayBuffer | Buffer,
  hints?: { fileName?: string },
): ImportedQuestion[] {
  const tests = parseWorkbookTests(buffer, hints);
  if (tests.length !== 1) {
    throw new Error(
      `В файле ${tests.length} тестов по должностям — используйте parseWorkbookTests`,
    );
  }
  return tests[0].questions;
}

import * as XLSX from "xlsx";

export type ImportedLessonPlan = {
  title: string;
  summary: string;
  contentHtml: string;
  contentText: string;
  slug: string;
  durationMin: number;
  /** Staffing role title for role_families_json */
  roleTitle: string;
  roleKey: string;
  dayNumber: number;
  dayLabel: string;
  topics: string[];
  sourceSheet: string;
  sortOrder: number;
  programMonth?: number;
  goal?: string;
  material?: string;
  instruction?: string;
  practice?: string;
  criteria?: string;
};

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function estimateDurationMin(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(10, Math.min(90, Math.round(words / 160) * 5 || 15));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cellStr(value: unknown) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim();
}

function slugRole(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 48) || "role";
}

function paragraphsToHtml(text: string) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return "";
  const looksNumbered = lines.every((line) => /^\d+[).]\s*/.test(line));
  if (looksNumbered) {
    return `<ol>${lines
      .map((line) => `<li>${escapeHtml(line.replace(/^\d+[).]\s*/, ""))}</li>`)
      .join("")}</ol>`;
  }
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function sectionHtml(title: string, body: string) {
  if (!body.trim()) return "";
  return `<h3>${escapeHtml(title)}</h3>${paragraphsToHtml(body)}`;
}

function dayNumberFromLabel(label: string) {
  const match = label.match(/день\s*(\d+)/i) || label.match(/\bday\s*(\d+)/i);
  if (match) return Number(match[1]);
  const bare = label.match(/^(\d+)\b/);
  return bare ? Number(bare[1]) : 0;
}

function roleTitleFromSheet(rows: unknown[][], sheetName: string) {
  const heading = cellStr(rows[0]?.[0]);
  const cleaned = heading
    .replace(/^план\s+уроков?\s*[:\-–—]\s*/i, "")
    .replace(/^учебник\s+стаж[её]ра\s*[:\-–—]\s*/i, "")
    .replace(/^\d+\s*дн[а-яё]*\s*[:\-–—]\s*/i, "")
    .replace(/^уроки?\s*[:\-–—]\s*/i, "")
    .trim();
  return cleaned || sheetName;
}

function skipLessonSheetName(sheetName: string) {
  return /инструкц|сводк|instruction|summary|ключ|как\s+учиться|штатн|календар|аттестац|кто\s+проверяет|позици/i.test(
    sheetName,
  );
}

export function looksLikeReportWorkbookName(fileName: string) {
  return /пробн[а-яё]*[\s_.-]*период|проверочн[а-яё]*[\s_.-]*отч[её]т|отч[её]т[а-яё]*[\s_.-]*стаж[её]р|trial.?period|intern.?report/i.test(
    fileName,
  );
}

/** Vertical intern textbook: «ПОЛНЫЙ УРОК — ДЕНЬ N: темы» + label/value rows. */
function parseDayHeader(label: string): { dayNumber: number; topics: string } | null {
  const match =
    label.match(/день\s*(\d+)\s*:\s*(.+)$/i) ||
    label.match(/полный\s+урок.*?день\s*(\d+)\s*:\s*(.+)$/i);
  if (!match) return null;
  return { dayNumber: Number(match[1]), topics: cellStr(match[2]) };
}

function sheetLooksLikeTextbook(rows: unknown[][]) {
  let dayHeaders = 0;
  let sectionHits = 0;
  for (const row of rows.slice(0, 120)) {
    const a = cellStr(row?.[0]);
    if (parseDayHeader(a)) dayHeaders += 1;
    if (
      /^(цель урока|словарь урока|основной учебный текст|пошаговый метод|итоговая практика)$/i.test(
        a,
      )
    ) {
      sectionHits += 1;
    }
  }
  return dayHeaders >= 1 && sectionHits >= 2;
}

function buildTextbookHtml(
  dayLabel: string,
  topics: string,
  sections: { title: string; body: string }[],
) {
  const topicLine = topics
    ? `<p><strong>Темы:</strong> ${escapeHtml(topics)}</p>`
    : "";
  return [
    `<h2>${escapeHtml(dayLabel)}${topics ? ` · ${escapeHtml(topics)}` : ""}</h2>`,
    topicLine,
    ...sections.map((s) => sectionHtml(s.title, s.body)),
  ]
    .filter(Boolean)
    .join("\n");
}

function parseTextbookSheet(
  rows: unknown[][],
  sheetName: string,
  roleOrder: number,
  usedSlugs: Set<string>,
): ImportedLessonPlan[] {
  const roleTitle = roleTitleFromSheet(rows, sheetName);
  const roleKey = slugRole(roleTitle || sheetName);
  const starts: { index: number; dayNumber: number; topics: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const parsed = parseDayHeader(cellStr(rows[i]?.[0]));
    if (!parsed) continue;
    starts.push({ index: i, ...parsed });
  }
  if (!starts.length) return [];

  const lessons: ImportedLessonPlan[] = [];
  for (let s = 0; s < starts.length; s++) {
    const start = starts[s]!;
    const end = starts[s + 1]?.index ?? rows.length;
    const sections: { title: string; body: string }[] = [];
    let goal = "";

    for (let i = start.index + 1; i < end; i++) {
      const title = cellStr(rows[i]?.[0]);
      const body = cellStr(rows[i]?.[1]);
      if (!title || !body) continue;
      if (parseDayHeader(title)) continue;
      if (/^мои записи$/i.test(title)) continue;
      sections.push({ title, body });
      if (/^цель урока$/i.test(title)) goal = body;
    }
    if (!sections.length) continue;

    const topics = start.topics;
    const topicList = topics
      .split(/[;|]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const displayDay = `День ${start.dayNumber}`;
    const contentHtml = buildTextbookHtml(displayDay, topics, sections);
    const contentText = stripHtml(contentHtml);
    const summarySource = goal || topics || contentText;
    const summary =
      summarySource.slice(0, 220) + (summarySource.length > 220 ? "…" : "");
    const title = `${roleTitle} · ${displayDay}${
      topics ? ` · ${topics}` : ""
    }`.slice(0, 180);

    let slug = `${roleKey}-day-${start.dayNumber}`;
    if (usedSlugs.has(slug)) slug = `${slug}-${slugRole(sheetName)}`;
    usedSlugs.add(slug);

    lessons.push({
      title,
      summary: summary || title,
      contentHtml,
      contentText,
      slug,
      durationMin: Math.max(
        60,
        Math.min(180, estimateDurationMin(contentText) * 2 || 120),
      ),
      roleTitle,
      roleKey,
      dayNumber: start.dayNumber,
      dayLabel: displayDay,
      topics: topicList,
      sourceSheet: sheetName,
      sortOrder: roleOrder * 10 + start.dayNumber,
    });
  }
  return lessons;
}

function findLessonPlanHeaderRow(rows: unknown[][]) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = (rows[i] ?? []).map((c) => cellStr(c).toLowerCase());
    const hasDay = cells.some((c) => c === "день" || c === "day");
    const hasTopics = cells.some(
      (c) => c.includes("тем") || c === "topics" || c.includes("topic"),
    );
    const hasPlan = cells.some(
      (c) =>
        c.includes("пошагов") ||
        c.includes("план") ||
        c.includes("наставник"),
    );
    if (hasDay && (hasTopics || hasPlan)) return i;
  }
  return -1;
}

function colIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((h) =>
    aliases.some((alias) => h === alias || h.includes(alias)),
  );
}

function buildLessonHtml(input: {
  dayLabel: string;
  topics: string;
  goal: string;
  plan: string;
  mentor: string;
  employee: string;
  prepare: string;
  result: string;
  check: string;
}) {
  const topicLine = input.topics
    ? `<p><strong>Темы:</strong> ${escapeHtml(input.topics)}</p>`
    : "";
  return [
    `<h2>${escapeHtml(input.dayLabel)}${
      input.topics ? ` · ${escapeHtml(input.topics)}` : ""
    }</h2>`,
    topicLine,
    sectionHtml("Цель", input.goal),
    sectionHtml("Пошаговый план", input.plan),
    sectionHtml("Что делает наставник", input.mentor),
    sectionHtml("Что делает сотрудник", input.employee),
    sectionHtml("Что подготовить", input.prepare),
    sectionHtml("Результат урока", input.result),
    sectionHtml("Как проверить усвоение", input.check),
  ]
    .filter(Boolean)
    .join("\n");
}

function findRoleDayHeaderRow(rows: unknown[][]) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = (rows[i] ?? []).map((cell) => cellStr(cell).toLowerCase());
    const hasRole = cells.some((cell) => cell === "должность");
    const hasTopic = cells.some((cell) => cell.includes("тема урока"));
    const hasMaterial = cells.some((cell) => cell.includes("учебный материал"));
    if (hasRole && hasTopic && hasMaterial) return i;
  }
  return -1;
}

function workbookLooksLikeRoleDayLessons(wb: XLSX.WorkBook) {
  return wb.SheetNames.some((sheetName) => {
    if (!/^день\s*\d+$/i.test(sheetName.trim())) return false;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
    });
    return findRoleDayHeaderRow(rows) >= 0;
  });
}

/**
 * Matrix workbook: one sheet per day, one row per staffing role.
 * Columns: «Должность», «Тема урока», «Учебный материал», etc.
 */
function parseRoleDayWorkbook(
  wb: XLSX.WorkBook,
  usedSlugs: Set<string>,
): ImportedLessonPlan[] {
  const lessons: ImportedLessonPlan[] = [];

  for (const sheetName of wb.SheetNames) {
    const dayNumber = dayNumberFromLabel(sheetName);
    if (!dayNumber || !/^день\s*\d+$/i.test(sheetName.trim())) continue;

    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
    });
    const headerIdx = findRoleDayHeaderRow(rows);
    if (headerIdx < 0) continue;

    const headers = (rows[headerIdx] ?? []).map((cell) =>
      cellStr(cell).toLowerCase(),
    );
    const roleCol = headers.findIndex((header) => header === "должность");
    const directionCol = headers.findIndex((header) =>
      header.includes("направление"),
    );
    const topicCol = headers.findIndex((header) =>
      header.includes("тема урока"),
    );
    const materialCol = headers.findIndex((header) =>
      header.includes("учебный материал"),
    );
    const exampleCol = headers.findIndex((header) =>
      header.includes("рабочий пример"),
    );
    const practiceCol = headers.findIndex((header) =>
      header.includes("практическая работа"),
    );
    const methodCol = headers.findIndex((header) =>
      header.includes("как выполнить"),
    );
    const checkCol = headers.findIndex((header) =>
      header.includes("самопровер"),
    );
    const resultCol = headers.findIndex((header) =>
      header.includes("результат дня"),
    );
    if (roleCol < 0 || topicCol < 0 || materialCol < 0) continue;

    for (let index = headerIdx + 1; index < rows.length; index++) {
      const row = rows[index] ?? [];
      const roleTitle = cellStr(row[roleCol]);
      const topic = cellStr(row[topicCol]);
      const material = cellStr(row[materialCol]);
      if (!roleTitle || !topic || !material) continue;

      const direction =
        directionCol >= 0 ? cellStr(row[directionCol]) : "";
      const sections = [
        { title: "Учебный материал", body: material },
        {
          title: "Рабочий пример",
          body: exampleCol >= 0 ? cellStr(row[exampleCol]) : "",
        },
        {
          title: "Практическая работа",
          body: practiceCol >= 0 ? cellStr(row[practiceCol]) : "",
        },
        {
          title: "Как выполнить",
          body: methodCol >= 0 ? cellStr(row[methodCol]) : "",
        },
        {
          title: "Самопроверка",
          body: checkCol >= 0 ? cellStr(row[checkCol]) : "",
        },
        {
          title: "Результат дня",
          body: resultCol >= 0 ? cellStr(row[resultCol]) : "",
        },
      ].filter((section) => section.body);
      const displayDay = `День ${dayNumber}`;
      const contentHtml = [
        `<h2>${escapeHtml(displayDay)} · ${escapeHtml(topic)}</h2>`,
        direction
          ? `<p><strong>Направление:</strong> ${escapeHtml(direction)}</p>`
          : "",
        ...sections.map((section) => sectionHtml(section.title, section.body)),
      ]
        .filter(Boolean)
        .join("\n");
      const contentText = stripHtml(contentHtml);
      const roleKey = slugRole(roleTitle);
      // «staff» keeps these apart from per-role textbook workbooks that cover
      // the same role and day with different content.
      let slug = `${roleKey}-staff-day-${dayNumber}`;
      if (usedSlugs.has(slug)) {
        slug = `${slug}-${index - headerIdx}`;
      }
      usedSlugs.add(slug);

      lessons.push({
        title: `${roleTitle} · ${displayDay} · ${topic}`.slice(0, 180),
        summary:
          material.slice(0, 220) + (material.length > 220 ? "…" : ""),
        contentHtml,
        contentText,
        slug,
        durationMin: 150,
        roleTitle,
        roleKey,
        dayNumber,
        dayLabel: displayDay,
        topics: [topic],
        sourceSheet: sheetName,
        sortOrder: (index - headerIdx) * 10 + dayNumber,
      });
    }
  }

  return lessons;
}

function findJuniorMiddleHeaderRow(rows: unknown[][]) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = (rows[i] ?? []).map((cell) => cellStr(cell).toLowerCase());
    const hasRole = cells.some((cell) => cell === "должность");
    const hasWeek = cells.some((cell) => cell === "неделя" || cell === "week");
    const hasDay = cells.some((cell) => cell === "день" || cell === "day");
    const hasTitle = cells.some(
      (cell) =>
        cell.includes("название урока") || cell.includes("название"),
    );
    const hasMaterial = cells.some((cell) =>
      cell.includes("учебный материал"),
    );
    if (hasRole && hasWeek && hasDay && hasTitle && hasMaterial) return i;
  }
  return -1;
}

function workbookLooksLikeJuniorMiddle(wb: XLSX.WorkBook) {
  return wb.SheetNames.some((sheetName) => {
    if (skipLessonSheetName(sheetName)) return false;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
    });
    return findJuniorMiddleHeaderRow(rows) >= 0;
  });
}

/**
 * Junior→Middle 12-week program: one sheet «Все 60 уроков»,
 * one row = one role × week × weekday.
 */
function parseJuniorMiddleWorkbook(
  wb: XLSX.WorkBook,
  usedSlugs: Set<string>,
): ImportedLessonPlan[] {
  const lessons: ImportedLessonPlan[] = [];

  for (const sheetName of wb.SheetNames) {
    if (skipLessonSheetName(sheetName)) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
    });
    const headerIdx = findJuniorMiddleHeaderRow(rows);
    if (headerIdx < 0) continue;

    const headers = (rows[headerIdx] ?? []).map((cell) =>
      cellStr(cell).toLowerCase(),
    );
    const roleCol = headers.findIndex((header) => header === "должность");
    const directionCol = headers.findIndex((header) =>
      header.includes("направление"),
    );
    const monthCol = headers.findIndex((header) => header === "месяц");
    const weekCol = headers.findIndex(
      (header) => header === "неделя" || header === "week",
    );
    const dayCol = headers.findIndex(
      (header) => header === "день" || header === "day",
    );
    const stageCol = headers.findIndex((header) => header === "этап");
    const titleCol = headers.findIndex(
      (header) =>
        header.includes("название урока") || header === "название",
    );
    const materialCol = headers.findIndex((header) =>
      header.includes("учебный материал"),
    );
    const employeeCol = headers.findIndex((header) =>
      header.includes("что делает сотрудник"),
    );
    const practiceCol = headers.findIndex((header) =>
      header.includes("практическая работа"),
    );
    const proofCol = headers.findIndex((header) =>
      header.includes("доказательство"),
    );
    const checkCol = headers.findIndex((header) => header === "проверка");
    const reviewerCol = headers.findIndex((header) =>
      header.includes("кто проверяет"),
    );
    const passCol = headers.findIndex((header) =>
      header.includes("критерий прохождения"),
    );
    if (roleCol < 0 || weekCol < 0 || dayCol < 0 || titleCol < 0 || materialCol < 0) {
      continue;
    }

    for (let index = headerIdx + 1; index < rows.length; index++) {
      const row = rows[index] ?? [];
      const roleTitle = cellStr(row[roleCol]);
      const week = Number(cellStr(row[weekCol])) || 0;
      const dayInWeek = Number(cellStr(row[dayCol])) || 0;
      const lessonTitle = cellStr(row[titleCol]);
      const material = cellStr(row[materialCol]);
      if (!roleTitle || !week || !dayInWeek || !lessonTitle || !material) {
        continue;
      }

      const month = monthCol >= 0 ? Number(cellStr(row[monthCol])) || 0 : 0;
      const stage = stageCol >= 0 ? cellStr(row[stageCol]) : "";
      const direction =
        directionCol >= 0 ? cellStr(row[directionCol]) : "";
      // Stable 1..60 across the 12-week program.
      const dayNumber = (week - 1) * 5 + dayInWeek;
      const displayDay = `Неделя ${week} · День ${dayInWeek}`;
      const sections = [
        { title: "Учебный материал", body: material },
        {
          title: "Что делает сотрудник",
          body: employeeCol >= 0 ? cellStr(row[employeeCol]) : "",
        },
        {
          title: "Практическая работа",
          body: practiceCol >= 0 ? cellStr(row[practiceCol]) : "",
        },
        {
          title: "Доказательство",
          body: proofCol >= 0 ? cellStr(row[proofCol]) : "",
        },
        {
          title: "Проверка",
          body: checkCol >= 0 ? cellStr(row[checkCol]) : "",
        },
        {
          title: "Кто проверяет",
          body: reviewerCol >= 0 ? cellStr(row[reviewerCol]) : "",
        },
        {
          title: "Критерий прохождения",
          body: passCol >= 0 ? cellStr(row[passCol]) : "",
        },
      ].filter((section) => section.body);

      const meta = [
        month ? `Месяц ${month}` : "",
        stage,
        direction ? `Направление: ${direction}` : "",
      ]
        .filter(Boolean)
        .join(" · ");

      const contentHtml = [
        `<h2>${escapeHtml(displayDay)} · ${escapeHtml(lessonTitle)}</h2>`,
        meta ? `<p><strong>${escapeHtml(meta)}</strong></p>` : "",
        ...sections.map((section) => sectionHtml(section.title, section.body)),
      ]
        .filter(Boolean)
        .join("\n");
      const contentText = stripHtml(contentHtml);
      const roleKey = slugRole(roleTitle);
      let slug = `${roleKey}-j2m-day-${dayNumber}`;
      if (usedSlugs.has(slug)) slug = `${slug}-${index - headerIdx}`;
      usedSlugs.add(slug);

      lessons.push({
        title: `${roleTitle} · ${displayDay} · ${lessonTitle}`.slice(0, 180),
        summary:
          material.slice(0, 220) + (material.length > 220 ? "…" : ""),
        contentHtml,
        contentText,
        slug,
        durationMin: 120,
        roleTitle,
        roleKey,
        dayNumber,
        dayLabel: displayDay,
        topics: [lessonTitle, stage].filter(Boolean),
        sourceSheet: sheetName,
        sortOrder: dayNumber * 1000 + (index - headerIdx),
        programMonth:
          month ||
          (dayNumber <= 20 ? 1 : dayNumber <= 40 ? 2 : 3),
        goal: direction || stage || lessonTitle,
        material,
        instruction:
          employeeCol >= 0 ? cellStr(row[employeeCol]) : "",
        practice: practiceCol >= 0 ? cellStr(row[practiceCol]) : "",
        criteria: passCol >= 0 ? cellStr(row[passCol]) : "",
      });
    }
  }

  return lessons;
}

/** True when workbook is a 5-day lesson plan / intern textbook (not MCQ tests). */
export function looksLikeLessonPlanWorkbook(
  buffer: ArrayBuffer | Buffer,
  fileName = "",
): boolean {
  if (looksLikeReportWorkbookName(fileName)) return false;
  if (
    /план.*урок|урок.*план|готовые.?уроки|учебник|lesson.?plan|intern.?lesson/i.test(
      fileName,
    )
  ) {
    return true;
  }
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    if (workbookLooksLikeJuniorMiddle(wb)) return true;
    if (workbookLooksLikeRoleDayLessons(wb)) return true;
    for (const sheetName of wb.SheetNames.slice(0, 8)) {
      if (skipLessonSheetName(sheetName)) continue;
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
        header: 1,
        defval: "",
        raw: false,
      });
      if (findLessonPlanHeaderRow(rows) >= 0) return true;
      if (sheetLooksLikeTextbook(rows)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

function parseTabularSheet(
  rows: unknown[][],
  sheetName: string,
  roleOrder: number,
  usedSlugs: Set<string>,
): ImportedLessonPlan[] {
  const headerIdx = findLessonPlanHeaderRow(rows);
  if (headerIdx < 0) return [];

  const headers = (rows[headerIdx] ?? []).map((c) => cellStr(c).toLowerCase());
  const dayCol = colIndex(headers, ["день", "day"]);
  const topicsCol = colIndex(headers, [
    "темы урока",
    "темы",
    "topics",
    "тема",
  ]);
  const goalCol = colIndex(headers, ["цель", "goal"]);
  const planCol = headers.findIndex(
    (h) => h.includes("пошагов") || h.includes("план"),
  );
  const mentorCol = headers.findIndex((h) => h.includes("наставник"));
  const employeeCol = headers.findIndex(
    (h) =>
      h.includes("сотрудник") ||
      h.includes("стажёр") ||
      h.includes("стажер"),
  );
  const prepareCol = headers.findIndex(
    (h) => h.includes("подготовить") || h.includes("материалы"),
  );
  const resultCol = headers.findIndex(
    (h) => h.includes("результат") || h.includes("итог"),
  );
  const checkCol = headers.findIndex(
    (h) =>
      h.includes("проверить") ||
      h.includes("усвоение") ||
      h.includes("проверка"),
  );

  if (dayCol < 0 && topicsCol < 0 && planCol < 0) return [];

  const roleTitle = roleTitleFromSheet(rows, sheetName);
  const roleKey = slugRole(roleTitle || sheetName);
  const lessons: ImportedLessonPlan[] = [];
  let dayFallback = 0;

  for (const raw of rows.slice(headerIdx + 1)) {
    const row = raw ?? [];
    const dayLabel = dayCol >= 0 ? cellStr(row[dayCol]) : "";
    const topics = topicsCol >= 0 ? cellStr(row[topicsCol]) : "";
    const goal = goalCol >= 0 ? cellStr(row[goalCol]) : "";
    const plan = planCol >= 0 ? cellStr(row[planCol]) : "";
    const mentor = mentorCol >= 0 ? cellStr(row[mentorCol]) : "";
    const employee = employeeCol >= 0 ? cellStr(row[employeeCol]) : "";
    const prepare = prepareCol >= 0 ? cellStr(row[prepareCol]) : "";
    const result = resultCol >= 0 ? cellStr(row[resultCol]) : "";
    const check = checkCol >= 0 ? cellStr(row[checkCol]) : "";

    if (!dayLabel && !topics && !goal && !plan) continue;
    if (!topics && !goal && !plan) continue;

    dayFallback += 1;
    const dayNumber = dayNumberFromLabel(dayLabel) || dayFallback;
    const topicList = topics
      .split(/[;|]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const displayDay = dayLabel || `День ${dayNumber}`;
    const title = `${roleTitle} · ${displayDay}${
      topics ? ` · ${topics}` : ""
    }`.slice(0, 180);
    const contentHtml = buildLessonHtml({
      dayLabel: displayDay,
      topics,
      goal,
      plan,
      mentor,
      employee,
      prepare,
      result,
      check,
    });
    const contentText = stripHtml(contentHtml);
    const summarySource = goal || topics || contentText;
    const summary =
      summarySource.slice(0, 220) + (summarySource.length > 220 ? "…" : "");

    let slug = `${roleKey}-day-${dayNumber}`;
    if (usedSlugs.has(slug)) {
      slug = `${slug}-${slugRole(sheetName)}`;
    }
    usedSlugs.add(slug);

    const durationFromPlan = /2\s*ч|150\s*мин|2\.5/i.test(
      `${headers[planCol] || ""} ${plan}`,
    )
      ? 150
      : estimateDurationMin(contentText);

    lessons.push({
      title,
      summary: summary || title,
      contentHtml,
      contentText,
      slug,
      durationMin: Math.max(30, Math.min(180, durationFromPlan)),
      roleTitle,
      roleKey,
      dayNumber,
      dayLabel: displayDay,
      topics: topicList,
      sourceSheet: sheetName,
      sortOrder: roleOrder * 10 + dayNumber,
    });
  }
  return lessons;
}

/**
 * Excel lessons: tabular 5-day plans OR vertical intern textbooks.
 * One sheet per role × one lesson per day.
 */
export function parseWorkbookLessons(
  buffer: ArrayBuffer | Buffer,
  hints?: { fileName?: string },
): ImportedLessonPlan[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  if (!wb.SheetNames.length) throw new Error("В файле нет листов");

  const lessons: ImportedLessonPlan[] = [];
  const usedSlugs = new Set<string>();
  let roleOrder = 0;

  if (workbookLooksLikeJuniorMiddle(wb)) {
    const programLessons = parseJuniorMiddleWorkbook(wb, usedSlugs);
    if (programLessons.length) return programLessons;
  }

  if (workbookLooksLikeRoleDayLessons(wb)) {
    const roleDayLessons = parseRoleDayWorkbook(wb, usedSlugs);
    if (roleDayLessons.length) return roleDayLessons;
  }

  for (const sheetName of wb.SheetNames) {
    if (skipLessonSheetName(sheetName)) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
    });

    let sheetLessons = parseTabularSheet(rows, sheetName, roleOrder + 1, usedSlugs);
    if (!sheetLessons.length && sheetLooksLikeTextbook(rows)) {
      sheetLessons = parseTextbookSheet(
        rows,
        sheetName,
        roleOrder + 1,
        usedSlugs,
      );
    }
    if (!sheetLessons.length) continue;
    roleOrder += 1;
    lessons.push(...sheetLessons);
  }

  if (!lessons.length) {
    throw new Error(
      "Не найдено уроков. Нужна таблица («День», «Темы», «Цель»), учебник («ПОЛНЫЙ УРОК — ДЕНЬ N») или программа Junior→Middle («Все 60 уроков»).",
    );
  }

  void hints;
  return lessons;
}

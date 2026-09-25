import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "./index";
import {
  employees,
  internDailyReports,
  internDailySchedules,
  internDailyTests,
} from "./schema";
import {
  createNotification,
  ensureInternMentorship,
  findDepartmentManagers,
  getActiveMentorship,
  managerCanReviewIntern,
} from "./mentorship";

async function ready() {
  const { ensureDb } = await import("./queries");
  await ensureDb();
}

export type DailyReportQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
};

export type DailyReportAnswers = Record<string, number>;

/** Structured daily check report matching the Excel intern form. */
export type InternDailyReportFields = {
  studiedToday: string;
  didIndependently: string;
  proofUrl: string;
  errorText: string;
  fixText: string;
  canDoWithoutHelp: string;
  mentorQuestion?: string;
  mentorMiniTask?: string;
  scoreKnowledge?: number | null;
  scorePractice?: number | null;
  scoreIndependence?: number | null;
  conclusion?: string;
  planTomorrow?: string;
};

export function emptyReportFields(): InternDailyReportFields {
  return {
    studiedToday: "",
    didIndependently: "",
    proofUrl: "",
    errorText: "",
    fixText: "",
    canDoWithoutHelp: "",
  };
}

export function parseReportFields(raw: string): InternDailyReportFields {
  const base = emptyReportFields();
  try {
    const parsed = JSON.parse(raw || "{}") as Partial<InternDailyReportFields>;
    if (!parsed || typeof parsed !== "object") return base;
    return {
      studiedToday: String(parsed.studiedToday ?? ""),
      didIndependently: String(parsed.didIndependently ?? ""),
      proofUrl: String(parsed.proofUrl ?? ""),
      errorText: String(parsed.errorText ?? ""),
      fixText: String(parsed.fixText ?? ""),
      canDoWithoutHelp: String(parsed.canDoWithoutHelp ?? ""),
      mentorQuestion: String(parsed.mentorQuestion ?? ""),
      mentorMiniTask: String(parsed.mentorMiniTask ?? ""),
      scoreKnowledge:
        parsed.scoreKnowledge == null ? null : Number(parsed.scoreKnowledge),
      scorePractice:
        parsed.scorePractice == null ? null : Number(parsed.scorePractice),
      scoreIndependence:
        parsed.scoreIndependence == null
          ? null
          : Number(parsed.scoreIndependence),
      conclusion: String(parsed.conclusion ?? ""),
      planTomorrow: String(parsed.planTomorrow ?? ""),
    };
  } catch {
    return base;
  }
}

function clampScore02(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(2, Math.round(n)));
}

export function totalReportScore(fields: InternDailyReportFields) {
  const parts = [
    clampScore02(fields.scoreKnowledge),
    clampScore02(fields.scorePractice),
    clampScore02(fields.scoreIndependence),
  ];
  if (parts.some((p) => p == null)) return null;
  return (parts[0] ?? 0) + (parts[1] ?? 0) + (parts[2] ?? 0);
}

export function conclusionFromTotal(total: number | null) {
  if (total == null) return "";
  if (total >= 5) return "усвоил";
  if (total >= 3) return "повторить";
  return "не усвоил";
}

export function dayNumberFromMentorship(
  trialStartsAt: string | null | undefined,
  reportDate: string,
) {
  if (!trialStartsAt) return 1;
  const start = new Date(trialStartsAt);
  const day = new Date(`${reportDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(day.getTime())) return 1;
  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);
  const diff = Math.floor(
    (day.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000),
  );
  return Math.max(1, diff + 1);
}

/** Calendar date YYYY-MM-DD in Asia/Tashkent. */
export function tashkentDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parseDailyQuestions(raw: string): DailyReportQuestion[] {
  try {
    const parsed = JSON.parse(raw) as DailyReportQuestion[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (q) =>
          q &&
          typeof q.prompt === "string" &&
          Array.isArray(q.options) &&
          q.options.length >= 2 &&
          typeof q.correctIndex === "number",
      )
      .map((q, index) => ({
        id: String(q.id || `q${index + 1}`),
        prompt: q.prompt.trim(),
        options: q.options.map((o) => String(o)),
        correctIndex: Math.max(
          0,
          Math.min(q.options.length - 1, Math.round(q.correctIndex)),
        ),
      }));
  } catch {
    return [];
  }
}

export function scoreDailyAnswers(
  questions: DailyReportQuestion[],
  answers: DailyReportAnswers,
): number {
  if (questions.length === 0) return 0;
  let correct = 0;
  for (const q of questions) {
    if (answers[q.id] === q.correctIndex) correct += 1;
  }
  return Math.round((correct / questions.length) * 1000) / 10;
}

function publicQuestions(questions: DailyReportQuestion[]) {
  return questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    options: q.options,
  }));
}

export async function listInternDailyTests(includeInactive = false) {
  await ready();
  const rows = await db
    .select()
    .from(internDailyTests)
    .orderBy(desc(internDailyTests.updatedAt), desc(internDailyTests.id));
  return rows
    .filter((row) => includeInactive || row.isActive)
    .map((row) => ({
      ...row,
      questions: parseDailyQuestions(row.questionsJson),
    }));
}

export async function getInternDailyTestById(id: number) {
  await ready();
  const [row] = await db
    .select()
    .from(internDailyTests)
    .where(eq(internDailyTests.id, id))
    .limit(1);
  if (!row) return null;
  return { ...row, questions: parseDailyQuestions(row.questionsJson) };
}

export async function createInternDailyTest(input: {
  title: string;
  summary?: string;
  questions: DailyReportQuestion[];
}) {
  await ready();
  const title = input.title.trim();
  if (!title) throw new Error("Укажите название теста");
  const questions = input.questions.filter((q) => q.prompt.trim());
  if (questions.length < 1) throw new Error("Добавьте хотя бы один вопрос");
  const now = new Date().toISOString();
  const [row] = await db
    .insert(internDailyTests)
    .values({
      title,
      summary: (input.summary ?? "").trim(),
      questionsJson: JSON.stringify(
        questions.map((q, index) => ({
          id: q.id || `q${index + 1}`,
          prompt: q.prompt.trim(),
          options: q.options.map((o) => String(o).trim()).filter(Boolean),
          correctIndex: q.correctIndex,
        })),
      ),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

export async function updateInternDailyTest(input: {
  id: number;
  title: string;
  summary?: string;
  questions: DailyReportQuestion[];
  isActive?: boolean;
}) {
  await ready();
  const title = input.title.trim();
  if (!title) throw new Error("Укажите название теста");
  const questions = input.questions.filter((q) => q.prompt.trim());
  if (questions.length < 1) throw new Error("Добавьте хотя бы один вопрос");
  await db
    .update(internDailyTests)
    .set({
      title,
      summary: (input.summary ?? "").trim(),
      questionsJson: JSON.stringify(
        questions.map((q, index) => ({
          id: q.id || `q${index + 1}`,
          prompt: q.prompt.trim(),
          options: q.options.map((o) => String(o).trim()).filter(Boolean),
          correctIndex: q.correctIndex,
        })),
      ),
      isActive: input.isActive ?? true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(internDailyTests.id, input.id));
}

export async function setInternDailyTestActive(id: number, isActive: boolean) {
  await ready();
  await db
    .update(internDailyTests)
    .set({ isActive, updatedAt: new Date().toISOString() })
    .where(eq(internDailyTests.id, id));
}

export async function listInternDailySchedules(limit = 60) {
  await ready();
  const rows = await db
    .select({
      schedule: internDailySchedules,
      testTitle: internDailyTests.title,
      internName: employees.name,
    })
    .from(internDailySchedules)
    .innerJoin(
      internDailyTests,
      eq(internDailySchedules.testId, internDailyTests.id),
    )
    .leftJoin(
      employees,
      eq(internDailySchedules.internEmployeeId, employees.id),
    )
    .orderBy(
      desc(internDailySchedules.reportDate),
      desc(internDailySchedules.id),
    )
    .limit(limit);

  return rows.map((row) => ({
    ...row.schedule,
    testTitle: row.testTitle,
    internName: row.internName,
  }));
}

export async function createInternDailySchedule(input: {
  reportDate: string;
  testId: number;
  department?: string;
  internEmployeeId?: number | null;
  createdByUserId: number;
}) {
  await ready();
  const reportDate = input.reportDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    throw new Error("Некорректная дата");
  }
  const test = await getInternDailyTestById(input.testId);
  if (!test || !test.isActive) throw new Error("Тест не найден");

  const internEmployeeId =
    input.internEmployeeId && !Number.isNaN(input.internEmployeeId)
      ? input.internEmployeeId
      : null;
  let department = (input.department ?? "").trim();

  if (internEmployeeId) {
    const [intern] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, internEmployeeId))
      .limit(1);
    if (!intern) throw new Error("Стажёр не найден");
    department = intern.department;

    const [dup] = await db
      .select({ id: internDailySchedules.id })
      .from(internDailySchedules)
      .where(
        and(
          eq(internDailySchedules.reportDate, reportDate),
          eq(internDailySchedules.internEmployeeId, internEmployeeId),
        ),
      )
      .limit(1);
    if (dup) {
      throw new Error("На эту дату для стажёра уже есть назначение");
    }
  } else {
    if (!department) throw new Error("Укажите отдел или стажёра");
    const [dup] = await db
      .select({ id: internDailySchedules.id })
      .from(internDailySchedules)
      .where(
        and(
          eq(internDailySchedules.reportDate, reportDate),
          eq(internDailySchedules.department, department),
          isNull(internDailySchedules.internEmployeeId),
        ),
      )
      .limit(1);
    if (dup) {
      throw new Error("На эту дату для отдела уже есть назначение");
    }
  }

  const [row] = await db
    .insert(internDailySchedules)
    .values({
      reportDate,
      testId: input.testId,
      department,
      internEmployeeId,
      createdByUserId: input.createdByUserId,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

export async function deleteInternDailySchedule(id: number) {
  await ready();
  await db
    .delete(internDailySchedules)
    .where(eq(internDailySchedules.id, id));
}

export async function resolveScheduleForIntern(input: {
  internEmployeeId: number;
  department: string;
  reportDate: string;
}) {
  await ready();
  const personal = await db
    .select({
      schedule: internDailySchedules,
      test: internDailyTests,
    })
    .from(internDailySchedules)
    .innerJoin(
      internDailyTests,
      eq(internDailySchedules.testId, internDailyTests.id),
    )
    .where(
      and(
        eq(internDailySchedules.reportDate, input.reportDate),
        eq(internDailySchedules.internEmployeeId, input.internEmployeeId),
        eq(internDailyTests.isActive, true),
      ),
    )
    .limit(1);
  if (personal[0]) return personal[0];

  const dept = await db
    .select({
      schedule: internDailySchedules,
      test: internDailyTests,
    })
    .from(internDailySchedules)
    .innerJoin(
      internDailyTests,
      eq(internDailySchedules.testId, internDailyTests.id),
    )
    .where(
      and(
        eq(internDailySchedules.reportDate, input.reportDate),
        eq(internDailySchedules.department, input.department),
        isNull(internDailySchedules.internEmployeeId),
        eq(internDailyTests.isActive, true),
      ),
    )
    .limit(1);
  return dept[0] ?? null;
}

export async function getReportByDate(
  internEmployeeId: number,
  reportDate: string,
) {
  await ready();
  const [row] = await db
    .select()
    .from(internDailyReports)
    .where(
      and(
        eq(internDailyReports.internEmployeeId, internEmployeeId),
        eq(internDailyReports.reportDate, reportDate),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listReportsForIntern(internEmployeeId: number, limit = 30) {
  await ready();
  return db
    .select({
      report: internDailyReports,
      testTitle: internDailyTests.title,
    })
    .from(internDailyReports)
    .leftJoin(
      internDailyTests,
      eq(internDailyReports.testId, internDailyTests.id),
    )
    .where(eq(internDailyReports.internEmployeeId, internEmployeeId))
    .orderBy(desc(internDailyReports.reportDate))
    .limit(limit);
}

export async function listReportsForMentee(
  mentorUserId: number,
  internEmployeeId: number,
  limit = 40,
) {
  await ready();
  const mentorship = await getActiveMentorship(internEmployeeId);
  if (!(await managerCanReviewIntern(mentorUserId, internEmployeeId))) {
    return [];
  }

  const rows = await db
    .select()
    .from(internDailyReports)
    .where(eq(internDailyReports.internEmployeeId, internEmployeeId))
    .orderBy(desc(internDailyReports.reportDate))
    .limit(limit);

  return rows.map((row) => {
    const fields = parseReportFields(row.answersJson);
    if (!fields.studiedToday && row.bodyText) {
      fields.studiedToday = row.bodyText;
    }
    const total =
      row.score != null && row.score <= 6
        ? Math.round(row.score)
        : totalReportScore(fields);
    return {
      id: row.id,
      reportDate: row.reportDate,
      status: row.status,
      submittedAt: row.submittedAt,
      reviewedAt: row.reviewedAt,
      mentorComment: row.mentorComment,
      score: total,
      dayNumber: dayNumberFromMentorship(
        mentorship?.trialStartsAt,
        row.reportDate,
      ),
      fields,
    };
  });
}

export async function getInternDailyReportPage(internEmployeeId: number) {
  await ready();
  const [intern] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, internEmployeeId))
    .limit(1);
  if (!intern) return null;

  const mentorship = await getActiveMentorship(internEmployeeId);
  const today = tashkentDate();
  const todayReport = await getReportByDate(internEmployeeId, today);
  const history = await listReportsForIntern(internEmployeeId);
  const dayNumber = dayNumberFromMentorship(
    mentorship?.trialStartsAt,
    today,
  );

  const mapReport = (row: typeof todayReport) => {
    if (!row) return null;
    const fields = parseReportFields(row.answersJson);
    if (!fields.studiedToday && row.bodyText) {
      fields.studiedToday = row.bodyText;
    }
    const total =
      row.score != null && row.score <= 6
        ? Math.round(row.score)
        : totalReportScore(fields);
    return {
      id: row.id,
      reportDate: row.reportDate,
      status: row.status,
      submittedAt: row.submittedAt,
      mentorComment: row.mentorComment,
      score: total,
      fields,
      dayNumber: dayNumberFromMentorship(
        mentorship?.trialStartsAt,
        row.reportDate,
      ),
    };
  };

  const historyRows = history.map((row) => {
    const fields = parseReportFields(row.report.answersJson);
    if (!fields.studiedToday && row.report.bodyText) {
      fields.studiedToday = row.report.bodyText;
    }
    const total =
      row.report.score != null && row.report.score <= 6
        ? Math.round(row.report.score)
        : totalReportScore(fields);
    return {
      id: row.report.id,
      reportDate: row.report.reportDate,
      status: row.report.status,
      submittedAt: row.report.submittedAt,
      mentorComment: row.report.mentorComment,
      score: total,
      fields,
      dayNumber: dayNumberFromMentorship(
        mentorship?.trialStartsAt,
        row.report.reportDate,
      ),
    };
  });

  return {
    intern,
    mentorship,
    today,
    dayNumber,
    todayReport: mapReport(todayReport),
    history: historyRows,
  };
}

export async function submitInternDailyReport(input: {
  internEmployeeId: number;
  fields: Pick<
    InternDailyReportFields,
    | "studiedToday"
    | "didIndependently"
    | "proofUrl"
    | "errorText"
    | "fixText"
    | "canDoWithoutHelp"
  >;
}) {
  await ready();
  const mentorship =
    (await getActiveMentorship(input.internEmployeeId)) ??
    (await ensureInternMentorship({
      internEmployeeId: input.internEmployeeId,
    }));
  if (!mentorship) {
    throw new Error("Нет активной стажировки");
  }

  const [intern] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, input.internEmployeeId))
    .limit(1);
  if (!intern) throw new Error("Стажёр не найден");

  const today = tashkentDate();
  const existing = await getReportByDate(input.internEmployeeId, today);
  if (existing) throw new Error("Отчёт за сегодня уже сдан");

  const studiedToday = input.fields.studiedToday.trim();
  const didIndependently = input.fields.didIndependently.trim();
  const proofUrl = input.fields.proofUrl.trim();
  const errorText = input.fields.errorText.trim();
  const fixText = input.fields.fixText.trim();
  const canDoWithoutHelp = input.fields.canDoWithoutHelp.trim();

  if (studiedToday.length < 10) {
    throw new Error("Кратко объясните, что это такое");
  }
  if (didIndependently.length < 10) {
    throw new Error("Кратко объясните, как это работает");
  }
  if (!["yes", "partly", "no"].includes(canDoWithoutHelp)) {
    throw new Error("Укажите, поняли ли вы сегодняшнее обучение");
  }

  const fields: InternDailyReportFields = {
    studiedToday,
    didIndependently,
    proofUrl,
    errorText,
    fixText,
    canDoWithoutHelp,
  };

  const now = new Date().toISOString();
  const [report] = await db
    .insert(internDailyReports)
    .values({
      mentorshipId: mentorship.id,
      internEmployeeId: input.internEmployeeId,
      reportDate: today,
      scheduleId: null,
      testId: null,
      bodyText: studiedToday,
      answersJson: JSON.stringify(fields),
      score: null,
      status: "submitted",
      submittedAt: now,
      createdAt: now,
    })
    .returning();

  const dayNumber = dayNumberFromMentorship(mentorship.trialStartsAt, today);
  const departmentManagers = await findDepartmentManagers(intern.department);
  const recipients = new Set<number>(departmentManagers.map((m) => m.id));
  if (mentorship.mentorUserId) recipients.add(mentorship.mentorUserId);

  for (const userId of recipients) {
    await createNotification({
      userId,
      type: "daily_report_submitted",
      title: `Отчёт стажёра: ${intern.name}`,
      body: `${intern.department} · ${today} · День ${dayNumber}`,
      href: `/observer/mentees/${intern.id}?report=${report.id}`,
      payload: {
        reportId: report.id,
        internEmployeeId: intern.id,
        reportDate: today,
        dayNumber,
      },
    });
  }

  return report;
}

export async function reviewInternDailyReport(input: {
  reportId: number;
  mentorUserId: number;
  mentorQuestion?: string;
  mentorMiniTask?: string;
  scoreKnowledge?: number;
  scorePractice?: number;
  scoreIndependence?: number;
  conclusion?: string;
  planTomorrow?: string;
  comment?: string;
}) {
  await ready();
  const [report] = await db
    .select()
    .from(internDailyReports)
    .where(eq(internDailyReports.id, input.reportId))
    .limit(1);
  if (!report) throw new Error("Отчёт не найден");

  const allowed = await managerCanReviewIntern(
    input.mentorUserId,
    report.internEmployeeId,
  );
  if (!allowed) {
    throw new Error("Этот стажёр не из вашего отдела");
  }

  const scoreKnowledge = clampScore02(input.scoreKnowledge);
  const scorePractice = clampScore02(input.scorePractice);
  const scoreIndependence = clampScore02(input.scoreIndependence);
  if (
    scoreKnowledge == null ||
    scorePractice == null ||
    scoreIndependence == null
  ) {
    throw new Error("Поставьте оценки 0–2 за знания, практику и самостоятельность");
  }

  const mentorQuestion = (input.mentorQuestion ?? "").trim();
  const mentorMiniTask = (input.mentorMiniTask ?? "").trim();
  if (!mentorQuestion) {
    throw new Error("Задайте один уточняющий вопрос стажёру");
  }
  if (!mentorMiniTask) {
    throw new Error("Дайте короткое мини-задание на новых данных");
  }

  const fields = parseReportFields(report.answersJson);
  fields.mentorQuestion = mentorQuestion;
  fields.mentorMiniTask = mentorMiniTask;
  fields.scoreKnowledge = scoreKnowledge;
  fields.scorePractice = scorePractice;
  fields.scoreIndependence = scoreIndependence;
  const total = scoreKnowledge + scorePractice + scoreIndependence;
  fields.conclusion =
    (input.conclusion ?? "").trim() || conclusionFromTotal(total);
  fields.planTomorrow = (input.planTomorrow ?? "").trim();

  const mentorComment =
    (input.comment ?? "").trim() ||
    [
      fields.conclusion ? `Вывод: ${fields.conclusion}` : "",
      fields.planTomorrow ? `План: ${fields.planTomorrow}` : "",
    ]
      .filter(Boolean)
      .join(" · ") ||
    null;

  await db
    .update(internDailyReports)
    .set({
      status: "reviewed",
      answersJson: JSON.stringify(fields),
      score: total,
      mentorComment,
      reviewedByUserId: input.mentorUserId,
      reviewedAt: new Date().toISOString(),
    })
    .where(eq(internDailyReports.id, input.reportId));
}

export async function listInternEmployeesForSchedule() {
  await ready();
  const { platformUsers } = await import("./schema");
  const rows = await db
    .select({
      id: employees.id,
      name: employees.name,
      department: employees.department,
      roleTitle: employees.roleTitle,
    })
    .from(employees)
    .innerJoin(
      platformUsers,
      eq(platformUsers.employeeId, employees.id),
    )
    .where(
      and(
        eq(platformUsers.role, "participant"),
        eq(platformUsers.participantKind, "intern"),
        eq(platformUsers.isActive, true),
      ),
    )
    .orderBy(asc(employees.department), asc(employees.name));
  return rows;
}

/** HR journal of daily checks: one row per submitted report. */
export async function listDailyReportsJournal(limit = 200) {
  await ready();
  const { internMentorships, platformUsers } = await import("./schema");
  const rows = await db
    .select({
      report: internDailyReports,
      internName: employees.name,
      roleTitle: employees.roleTitle,
      department: employees.department,
      trialStartsAt: internMentorships.trialStartsAt,
      mentorName: platformUsers.displayName,
    })
    .from(internDailyReports)
    .innerJoin(employees, eq(internDailyReports.internEmployeeId, employees.id))
    .leftJoin(
      internMentorships,
      eq(internDailyReports.mentorshipId, internMentorships.id),
    )
    .leftJoin(
      platformUsers,
      eq(internMentorships.mentorUserId, platformUsers.id),
    )
    .orderBy(desc(internDailyReports.reportDate), desc(internDailyReports.id))
    .limit(limit);

  const departmentsNeedingHead = [
    ...new Set(
      rows.filter((row) => !row.mentorName).map((row) => row.department),
    ),
  ];
  const departmentHeads = new Map<string, string | null>(
    await Promise.all(
      departmentsNeedingHead.map(async (department) => {
        const heads = await findDepartmentManagers(department);
        return [department, heads[0]?.displayName ?? null] as const;
      }),
    ),
  );

  return rows.map((row) => {
    const fields = parseReportFields(row.report.answersJson);
    if (!fields.studiedToday && row.report.bodyText) {
      fields.studiedToday = row.report.bodyText;
    }
    const total =
      row.report.score != null && row.report.score <= 6
        ? Math.round(row.report.score)
        : totalReportScore(fields);
    return {
      id: row.report.id,
      reportDate: row.report.reportDate,
      internEmployeeId: row.report.internEmployeeId,
      internName: row.internName,
      roleTitle: row.roleTitle,
      department: row.department,
      mentorName:
        row.mentorName ?? departmentHeads.get(row.department) ?? null,
      status: row.report.status,
      dayNumber: dayNumberFromMentorship(
        row.trialStartsAt,
        row.report.reportDate,
      ),
      scoreKnowledge: fields.scoreKnowledge ?? null,
      scorePractice: fields.scorePractice ?? null,
      scoreIndependence: fields.scoreIndependence ?? null,
      total,
      conclusion: fields.conclusion ?? "",
      weakSpot: fields.errorText ?? "",
      planTomorrow: fields.planTomorrow ?? "",
    };
  });
}

export async function listDepartmentsForSchedule() {
  await ready();
  const rows = await db
    .select({ department: employees.department })
    .from(employees)
    .orderBy(asc(employees.department));
  const set = new Set<string>();
  for (const row of rows) {
    const dept = row.department.trim();
    if (dept) set.add(dept);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

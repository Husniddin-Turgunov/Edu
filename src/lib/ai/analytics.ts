/**
 * lib/ai/analytics.ts
 *
 * Analitika hisob-kitoblari. Barchasi real bazadagi ma'lumotlardan kelib
 * chiqadi: TestResult.answers JSON'idagi har bir javob savol bilan solishtiriladi
 * va savol qiyinligi, xato qilingan joylar, topshirishlar soni hisoblanadi.
 *
 * Bu ma'lumotlar AI'ga ham beriladi — masalan "qaysi savollar o'zlashtirilmagan"
 * degan savolga aniq javob topish uchun.
 */

import { db } from "@/lib/db";

export type QuestionType = "single" | "multiple" | "truefalse" | "written";

export type QuestionStat = {
  questionId: string;
  testId: string;
  testTitle: string;
  text: string;
  type: QuestionType;
  answered: number;
  correct: number;
  /** 0..1 — 1 juda oson, 0 juda qiyin */
  difficulty: number;
  correctRate: number;
};

export type TestAnalytics = {
  testId: string;
  title: string;
  status: string;
  visibility: string;
  questionCount: number;
  servedQuestionCount: number;
  passScore: number;
  timeLimit: number;
  maxAttempts: number;
  attempts: number;
  uniqueTakers: number;
  passed: number;
  failed: number;
  passRate: number;
  avgScore: number;
  bestScore: number;
  worstScore: number;
  avgDurationSec: number;
  pendingGrading: number;
  lastAttemptAt: string | null;
  scoreBuckets: { label: string; count: number }[];
  questions: QuestionStat[];
  /** "hamma xodimda noto'g'ri chiqqan" savollar */
  hardest: QuestionStat[];
};

export type UserAnalytics = {
  userId: string;
  fullName: string;
  email: string;
  department: string | null;
  position: string | null;
  status: string;
  isActive: boolean;
  attempts: number;
  testsTouched: number;
  passed: number;
  failed: number;
  passRate: number;
  avgScore: number;
  bestScore: number;
  pendingGrading: number;
  lessonProgress: { completed: number; total: number; percent: number };
  jobProgress: { completed: number; total: number; percent: number };
  coursesEnrolled: number;
  lastActivityAt: string | null;
  weakTests: { testId: string; title: string; attempts: number; avgScore: number }[];
  weakQuestions: QuestionStat[];
  accessNotes: { resourceType: string; resourceId: string; effect: string; allowRetake: boolean }[];
};

export type OverviewAnalytics = {
  generatedAt: string;
  users: { total: number; active: number; approved: number; pending: number; admins: number };
  tests: { total: number; active: number; draft: number; archived: number; questions: number };
  attempts: { total: number; last7days: number; last30days: number };
  performance: { avgScore: number; passRate: number; passed: number; failed: number };
  daily: { date: string; attempts: number; avgScore: number }[];
  departments: {
    department: string;
    users: number;
    attempts: number;
    avgScore: number;
    passRate: number;
  }[];
  topFailingTests: { testId: string; title: string; attempts: number; passRate: number; avgScore: number }[];
  weakestQuestions: QuestionStat[];
  accessRules: number;
  aiUsage: { requests: number; cost: number; tokens: number };
};

type ResultRow = {
  id: string;
  userId: string;
  testId: string;
  score: number;
  passed: boolean;
  answers: string;
  gradingStatus: string;
  startedAt: Date;
  completedAt: Date | null;
};

type QuestionRow = {
  id: string;
  testId: string;
  text: string;
  type: string;
  correctAnswer: string | null;
  test: { title: string };
  choices: { id: string; isCorrect: boolean }[];
};

// ============================================================================
//  Javobni tekshirish
// ============================================================================

export function isAnswerCorrect(
  question: { type: string; correctAnswer: string | null; choices: { id: string; isCorrect: boolean }[] },
  selected: unknown,
): boolean | null {
  if (question.type === "written") {
    if (selected == null || selected === "") return null;
    const a = String(selected).trim().toLowerCase();
    const b = String(question.correctAnswer || "").trim().toLowerCase();
    if (!b) return null;
    return a === b;
  }
  const correctIds = question.choices.filter((c) => c.isCorrect).map((c) => c.id);
  if (selected == null || selected === "" || (Array.isArray(selected) && selected.length === 0)) return null;
  if (Array.isArray(selected)) {
    return selected.length === correctIds.length && selected.every((s) => correctIds.includes(String(s)));
  }
  return correctIds.includes(String(selected));
}

function parseAnswers(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw || "{}");
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function durationSec(row: ResultRow) {
  if (!row.completedAt) return 0;
  const ms = row.completedAt.getTime() - row.startedAt.getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : 0;
}

// ============================================================================
//  Savol statistikasi
// ============================================================================

/** Testlar bo'yicha savol statistikasi. `testIds` bo'sa — barcha testlar. */
export async function questionStats(testIds?: string[]): Promise<QuestionStat[]> {
  const questions = await db.question.findMany({
    where: testIds?.length ? { testId: { in: testIds } } : undefined,
    select: {
      id: true,
      testId: true,
      text: true,
      type: true,
      correctAnswer: true,
      test: { select: { title: true } },
      choices: { select: { id: true, isCorrect: true } },
    },
  });

  const index = new Map(questions.map((q) => [q.id, q]));
  if (questions.length === 0) return [];

  const results = await db.testResult.findMany({
    where: { testId: { in: [...new Set(questions.map((q) => q.testId))] } },
    select: {
      id: true,
      userId: true,
      testId: true,
      score: true,
      passed: true,
      answers: true,
      gradingStatus: true,
      startedAt: true,
      completedAt: true,
    },
  });

  const counters = new Map<string, { answered: number; correct: number }>();
  for (const result of results) {
    const answers = parseAnswers(result.answers);
    for (const [questionId, selected] of Object.entries(answers)) {
      const question = index.get(questionId);
      if (!question) continue;
      const correct = isAnswerCorrect(question, selected);
      const slot = counters.get(questionId) || { answered: 0, correct: 0 };
      slot.answered++;
      if (correct === true) slot.correct++;
      counters.set(questionId, slot);
    }
  }

  const stats: QuestionStat[] = questions.map((q: QuestionRow) => {
    const slot = counters.get(q.id) || { answered: 0, correct: 0 };
    const rate = slot.answered > 0 ? slot.correct / slot.answered : 0;
    return {
      questionId: q.id,
      testId: q.testId,
      testTitle: q.test.title,
      text: q.text,
      type: q.type as QuestionType,
      answered: slot.answered,
      correct: slot.correct,
      difficulty: Number(rate.toFixed(3)),
      correctRate: Number((rate * 100).toFixed(1)),
    };
  });

  return stats;
}

// ============================================================================
//  Test bo'yicha
// ============================================================================

export async function testAnalytics(testId: string): Promise<TestAnalytics | null> {
  const test = await db.test.findUnique({
    where: { id: testId },
    include: { _count: { select: { questions: true } } },
  });
  if (!test) return null;

  const results = await db.testResult.findMany({
    where: { testId },
    select: {
      id: true,
      userId: true,
      testId: true,
      score: true,
      passed: true,
      answers: true,
      gradingStatus: true,
      startedAt: true,
      completedAt: true,
    },
    orderBy: { startedAt: "desc" },
  });

  const scored = results.filter((r) => r.gradingStatus !== "pending");
  const scores = scored.map((r) => Number(r.score) || 0);
  const passed = scored.filter((r) => r.passed).length;
  const durations = results.map(durationSec).filter((d) => d > 0);

  const questions = await questionStats([testId]);
  const answeredOnce = questions.filter((q) => q.answered > 0);

  return {
    testId: test.id,
    title: test.title,
    status: test.status,
    visibility: test.visibility,
    questionCount: test.questionCount,
    servedQuestionCount:
      test.questionCount > 0 ? Math.min(test.questionCount, questions.length) : questions.length,
    passScore: test.passScore,
    timeLimit: test.timeLimit,
    maxAttempts: test.maxAttempts,
    attempts: results.length,
    uniqueTakers: new Set(results.map((r) => r.userId)).size,
    passed,
    failed: scored.length - passed,
    passRate: scored.length ? Math.round((passed / scored.length) * 100) : 0,
    avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    bestScore: scores.length ? Math.max(...scores) : 0,
    worstScore: scores.length ? Math.min(...scores) : 0,
    avgDurationSec: durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0,
    pendingGrading: results.filter((r) => r.gradingStatus === "pending").length,
    lastAttemptAt: results[0]?.startedAt?.toISOString() || null,
    scoreBuckets: buildBuckets(scores),
    questions,
    hardest: [...answeredOnce].sort((a, b) => a.correctRate - b.correctRate).slice(0, 10),
  };
}

function buildBuckets(scores: number[]) {
  const defs = [
    { label: "0-20", min: 0, max: 20 },
    { label: "21-40", min: 21, max: 40 },
    { label: "41-60", min: 41, max: 60 },
    { label: "61-80", min: 61, max: 80 },
    { label: "81-100", min: 81, max: 100 },
  ];
  return defs.map((def) => ({
    label: def.label,
    count: scores.filter((s) => s >= def.min && s <= def.max).length,
  }));
}

// ============================================================================
//  Foydalanuvchi bo'yicha
// ============================================================================

export async function userAnalytics(userId: string): Promise<UserAnalytics | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      surname: true,
      department: true,
      position: true,
      status: true,
      isActive: true,
    },
  });
  if (!user) return null;

  const results = await db.testResult.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      testId: true,
      score: true,
      passed: true,
      answers: true,
      gradingStatus: true,
      startedAt: true,
      completedAt: true,
    },
    orderBy: { startedAt: "desc" },
  });

  const scored = results.filter((r) => r.gradingStatus !== "pending");
  const scores = scored.map((r) => Number(r.score) || 0);
  const passed = scored.filter((r) => r.passed).length;

  const byTest = new Map<string, { score: number[]; attempts: number }>();
  for (const result of results) {
    const slot = byTest.get(result.testId) || { score: [], attempts: 0 };
    slot.attempts++;
    if (result.gradingStatus !== "pending") slot.score.push(Number(result.score) || 0);
    byTest.set(result.testId, slot);
  }

  const testIds = [...byTest.keys()];
  const testTitles = testIds.length
    ? await db.test.findMany({ where: { id: { in: testIds } }, select: { id: true, title: true } })
    : [];
  const titleMap = new Map(testTitles.map((t) => [t.id, t.title]));

  const weakTests = [...byTest.entries()]
    .map(([id, slot]) => ({
      testId: id,
      title: titleMap.get(id) || "Noma'lum test",
      attempts: slot.attempts,
      avgScore: slot.score.length
        ? Math.round(slot.score.reduce((a, b) => a + b, 0) / slot.score.length)
        : 0,
    }))
    .filter((t) => t.avgScore < 70)
    .sort((a, b) => a.avgScore - b.avgScore);

  const [lessonDone, lessonTotal, jobDone, jobTotal, enrollments, rules, allStats] = await Promise.all([
    db.lessonProgress.count({ where: { userId, completed: true } }),
    db.lessonProgress.count({ where: { userId } }),
    db.jobDayProgress.count({ where: { userId, completed: true } }),
    db.jobDayProgress.count({ where: { userId } }),
    db.enrollment.count({ where: { userId } }),
    db.accessRule.findMany({
      where: { subjectType: "user", subjectValue: userId },
      select: { resourceType: true, resourceId: true, effect: true, allowRetake: true },
    }),
    testIds.length ? questionStats(testIds) : Promise.resolve([]),
  ]);

  // Faqat shu foydalanuvchi noto'g'ri javob bergan savollar
  const wrongCounts = new Map<string, number>();
  const answeredCounts = new Map<string, number>();
  const questionsById = await db.question.findMany({
    where: { id: { in: [...allStats.map((s) => s.questionId)] } },
    select: {
      id: true,
      testId: true,
      text: true,
      type: true,
      correctAnswer: true,
      test: { select: { title: true } },
      choices: { select: { id: true, isCorrect: true } },
    },
  });
  const qIndex = new Map(questionsById.map((q) => [q.id, q as QuestionRow]));

  for (const result of results) {
    const answers = parseAnswers(result.answers);
    for (const [questionId, selected] of Object.entries(answers)) {
      const question = qIndex.get(questionId);
      if (!question) continue;
      answeredCounts.set(questionId, (answeredCounts.get(questionId) || 0) + 1);
      const correct = isAnswerCorrect(question, selected);
      if (correct === false) {
        wrongCounts.set(questionId, (wrongCounts.get(questionId) || 0) + 1);
      }
    }
  }

  const weakQuestions: QuestionStat[] = [...wrongCounts.entries()]
    .map(([questionId, wrong]) => {
      const answered = answeredCounts.get(questionId) || wrong;
      const question = qIndex.get(questionId);
      return {
        questionId,
        testId: question?.testId || "",
        testTitle: question?.test.title || "",
        text: question?.text || "(savol topilmadi)",
        type: (question?.type || "single") as QuestionType,
        answered,
        correct: Math.max(0, answered - wrong),
        difficulty: Number((answered ? 1 - wrong / answered : 0).toFixed(3)),
        correctRate: Number(((answered ? 1 - wrong / answered : 0) * 100).toFixed(1)),
      } satisfies QuestionStat;
    })
    .sort((a, b) => a.correctRate - b.correctRate)
    .slice(0, 12);

  const percent = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

  return {
    userId: user.id,
    fullName: [user.surname, user.name].filter(Boolean).join(" ").trim() || user.email,
    email: user.email,
    department: user.department,
    position: user.position,
    status: user.status,
    isActive: user.isActive,
    attempts: results.length,
    testsTouched: byTest.size,
    passed,
    failed: scored.length - passed,
    passRate: scored.length ? Math.round((passed / scored.length) * 100) : 0,
    avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    bestScore: scores.length ? Math.max(...scores) : 0,
    pendingGrading: results.filter((r) => r.gradingStatus === "pending").length,
    lessonProgress: { completed: lessonDone, total: lessonTotal, percent: percent(lessonDone, lessonTotal) },
    jobProgress: { completed: jobDone, total: jobTotal, percent: percent(jobDone, jobTotal) },
    coursesEnrolled: enrollments,
    lastActivityAt: results[0]?.startedAt?.toISOString() || null,
    weakTests,
    weakQuestions,
    accessNotes: rules.map((r) => ({
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      effect: r.effect,
      allowRetake: r.allowRetake,
    })),
  };
}

// ============================================================================
//  Umumiy ko'rinish
// ============================================================================

export async function overviewAnalytics(): Promise<OverviewAnalytics> {
  const [
    totalUsers,
    activeUsers,
    approvedUsers,
    pendingUsers,
    adminUsers,
    totalTests,
    activeTests,
    draftTests,
    archivedTests,
    totalQuestions,
    results,
    accessRules,
    usage,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { isActive: true } }),
    db.user.count({ where: { status: "approved" } }),
    db.user.count({ where: { status: "pending" } }),
    db.user.count({ where: { role: "admin" } }),
    db.test.count(),
    db.test.count({ where: { status: "active" } }),
    db.test.count({ where: { status: "draft" } }),
    db.test.count({ where: { status: "archived" } }),
    db.question.count(),
    db.testResult.findMany({
      select: {
        id: true,
        userId: true,
        testId: true,
        score: true,
        passed: true,
        answers: true,
        gradingStatus: true,
        startedAt: true,
        completedAt: true,
      },
      orderBy: { startedAt: "desc" },
      take: 5000,
    }),
    db.accessRule.count(),
    db.aiUsage.findMany({ select: { requests: true, estimatedCost: true, promptTokens: true, completionTokens: true } }),
  ]);

  const usersById = new Map(
    (
      await db.user.findMany({
        select: { id: true, department: true, name: true, surname: true, email: true },
      })
    ).map((u) => [u.id, u]),
  );

  const testMeta = await db.test.findMany({ select: { id: true, title: true } });
  const testTitleMap = new Map(testMeta.map((t) => [t.id, t.title]));

  const scored = results.filter((r) => r.gradingStatus !== "pending");
  const scores = scored.map((r) => Number(r.score) || 0);
  const passed = scored.filter((r) => r.passed).length;

  const now = Date.now();
  const day = 86_400_000;
  const last7 = results.filter((r) => now - r.startedAt.getTime() <= 7 * day).length;
  const last30 = results.filter((r) => now - r.startedAt.getTime() <= 30 * day).length;

  // Kunlik ziddiyat
  const dailyMap = new Map<string, { attempts: number; sum: number; count: number }>();
  for (const result of results) {
    const key = result.startedAt.toISOString().slice(0, 10);
    const slot = dailyMap.get(key) || { attempts: 0, sum: 0, count: 0 };
    slot.attempts++;
    if (result.gradingStatus !== "pending") {
      slot.sum += Number(result.score) || 0;
      slot.count++;
    }
    dailyMap.set(key, slot);
  }
  const daily = [...dailyMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-30)
    .map(([date, slot]) => ({
      date,
      attempts: slot.attempts,
      avgScore: slot.count ? Math.round(slot.sum / slot.count) : 0,
    }));

  // Bo'limlar bo'yicha
  const deptMap = new Map<string, { users: Set<string>; attempts: number; sum: number; count: number; passed: number }>();
  for (const user of usersById.values()) {
    const key = (user.department || "Belgilanmagan").trim() || "Belgilanmagan";
    if (!deptMap.has(key)) deptMap.set(key, { users: new Set(), attempts: 0, sum: 0, count: 0, passed: 0 });
    deptMap.get(key)!.users.add(user.id);
  }
  for (const result of results) {
    const user = usersById.get(result.userId);
    const key = ((user?.department || "Belgilanmagan").trim() || "Belgilanmagan");
    const slot = deptMap.get(key);
    if (!slot) continue;
    slot.attempts++;
    if (result.gradingStatus !== "pending") {
      slot.sum += Number(result.score) || 0;
      slot.count++;
      if (result.passed) slot.passed++;
    }
  }
  const departments = [...deptMap.entries()]
    .map(([department, slot]) => ({
      department,
      users: slot.users.size,
      attempts: slot.attempts,
      avgScore: slot.count ? Math.round(slot.sum / slot.count) : 0,
      passRate: slot.count ? Math.round((slot.passed / slot.count) * 100) : 0,
    }))
    .sort((a, b) => b.users - a.users);

  // Ko'p yiqilayotgan testlar
  const testMap = new Map<string, { attempts: number; passed: number; sum: number; count: number }>();
  for (const result of results) {
    const slot = testMap.get(result.testId) || { attempts: 0, passed: 0, sum: 0, count: 0 };
    slot.attempts++;
    if (result.gradingStatus !== "pending") {
      slot.sum += Number(result.score) || 0;
      slot.count++;
      if (result.passed) slot.passed++;
    }
    testMap.set(result.testId, slot);
  }
  const topFailingTests = [...testMap.entries()]
    .filter(([, slot]) => slot.count > 0)
    .map(([testId, slot]) => ({
      testId,
      title: testTitleMap.get(testId) || "Noma'lum test",
      attempts: slot.attempts,
      passRate: Math.round((slot.passed / slot.count) * 100),
      avgScore: Math.round(slot.sum / slot.count),
    }))
    .sort((a, b) => a.passRate - b.passRate || b.attempts - a.attempts)
    .slice(0, 8);

  const allStats = await questionStats();
  const weakestQuestions = allStats
    .filter((s) => s.answered > 0)
    .sort((a, b) => a.correctRate - b.correctRate)
    .slice(0, 12);

  return {
    generatedAt: new Date().toISOString(),
    users: { total: totalUsers, active: activeUsers, approved: approvedUsers, pending: pendingUsers, admins: adminUsers },
    tests: {
      total: totalTests,
      active: activeTests,
      draft: draftTests,
      archived: archivedTests,
      questions: totalQuestions,
    },
    attempts: { total: results.length, last7days: last7, last30days: last30 },
    performance: {
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      passRate: scored.length ? Math.round((passed / scored.length) * 100) : 0,
      passed,
      failed: scored.length - passed,
    },
    daily,
    departments,
    topFailingTests,
    weakestQuestions,
    accessRules,
    aiUsage: {
      requests: usage.reduce((sum, u) => sum + u.requests, 0),
      cost: Number(usage.reduce((sum, u) => sum + u.estimatedCost, 0).toFixed(6)),
      tokens: usage.reduce((sum, u) => sum + u.promptTokens + u.completionTokens, 0),
    },
  };
}

/** Bo'limlar kesimidagi taqqoslash (admin analitikasi uchun). */
export async function departmentComparison() {
  const users = await db.user.findMany({ select: { id: true, department: true, status: true, isActive: true } });
  const results = await db.testResult.findMany({
    select: { userId: true, score: true, passed: true, gradingStatus: true },
    take: 10000,
  });
  const userDept = new Map(users.map((u) => [u.id, (u.department || "Belgilanmagan").trim() || "Belgilanmagan"]));
  const map = new Map<string, { users: number; activeUsers: number; pending: number; attempts: number; sum: number; count: number; passed: number }>();

  for (const user of users) {
    const key = (user.department || "Belgilanmagan").trim() || "Belgilanmagan";
    const slot = map.get(key) || { users: 0, activeUsers: 0, pending: 0, attempts: 0, sum: 0, count: 0, passed: 0 };
    slot.users++;
    if (user.isActive) slot.activeUsers++;
    if (user.status === "pending") slot.pending++;
    map.set(key, slot);
  }
  for (const result of results) {
    const key = userDept.get(result.userId) || "Belgilanmagan";
    const slot = map.get(key);
    if (!slot) continue;
    slot.attempts++;
    if (result.gradingStatus !== "pending") {
      slot.sum += Number(result.score) || 0;
      slot.count++;
      if (result.passed) slot.passed++;
    }
  }

  return [...map.entries()]
    .map(([department, slot]) => ({
      department,
      users: slot.users,
      activeUsers: slot.activeUsers,
      pending: slot.pending,
      attempts: slot.attempts,
      avgScore: slot.count ? Math.round(slot.sum / slot.count) : 0,
      passRate: slot.count ? Math.round((slot.passed / slot.count) * 100) : 0,
    }))
    .sort((a, b) => b.users - a.users);
}
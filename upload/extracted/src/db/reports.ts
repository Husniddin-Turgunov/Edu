import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "./index";
import {
  assignments,
  candidateAssignments,
  candidateResults,
  candidates,
  competencies,
  employeeCompetencies,
  employeeLearningPrograms,
  employeeProgramItems,
  employees,
  internDailyReports,
  internMentorships,
  learningLessons,
  lessonProgress,
  platformUsers,
  questions,
  results,
  vacancies,
} from "./schema";
import {
  normalizeCandidateStatus,
  type CandidateStatus,
} from "@/lib/candidate-funnel";
import { competencyLooksConfirmed } from "@/lib/learning-program";
import {
  inDateRange,
  pct,
  type ReportFilters,
} from "@/lib/report-filters";

async function ready() {
  const { ensureDb } = await import("./queries");
  await ensureDb();
}

function avg(nums: number[]) {
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}

function bump(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function mapToRows(map: Map<string, number>, labelKey = "label") {
  return [...map.entries()]
    .map(([label, count]) => ({ [labelKey]: label, count } as {
      label: string;
      count: number;
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"));
}

export async function getHiringReport(filters: ReportFilters) {
  await ready();
  const [candRows, vacRows] = await Promise.all([
    db
      .select({
        id: candidates.id,
        status: candidates.status,
        source: candidates.source,
        vacancyId: candidates.vacancyId,
        rejectionReason: candidates.rejectionReason,
        createdAt: candidates.createdAt,
        roleTitle: vacancies.roleTitle,
        department: vacancies.department,
      })
      .from(candidates)
      .innerJoin(vacancies, eq(candidates.vacancyId, vacancies.id)),
    db
      .select({
        id: vacancies.id,
        roleTitle: vacancies.roleTitle,
        department: vacancies.department,
        status: vacancies.status,
        createdAt: vacancies.createdAt,
        closedAt: vacancies.closedAt,
      })
      .from(vacancies),
  ]);

  const scoped = candRows.filter((row) => {
    if (filters.department && row.department !== filters.department) return false;
    return inDateRange(row.createdAt, filters);
  });

  const byVacancy = new Map<string, number>();
  const bySource = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const rejections = new Map<string, number>();

  for (const row of scoped) {
    const status = normalizeCandidateStatus(row.status);
    bump(byVacancy, `${row.department} · ${row.roleTitle}`);
    bump(bySource, row.source || "manual");
    bump(byStatus, status);
    if (status === "rejected") {
      bump(rejections, row.rejectionReason.trim() || "не указана");
    }
  }

  const total = scoped.length;
  const reached = (statuses: CandidateStatus[]) =>
    scoped.filter((row) =>
      statuses.includes(normalizeCandidateStatus(row.status)),
    ).length;

  const conversions = [
    {
      key: "telegram",
      count: scoped.filter((r) => r.source === "telegram").length,
      rate: pct(scoped.filter((r) => r.source === "telegram").length, total),
    },
    {
      key: "interview",
      count: reached([
        "interview_confirmed",
        "interview_passed",
        "test_assigned",
        "test_completed",
        "trial_admitted",
        "hired",
      ]),
      rate: 0,
    },
    {
      key: "test",
      count: reached([
        "test_assigned",
        "test_completed",
        "trial_admitted",
        "hired",
      ]),
      rate: 0,
    },
    {
      key: "trial",
      count: reached(["trial_admitted", "hired"]),
      rate: 0,
    },
    {
      key: "hired",
      count: reached(["hired"]),
      rate: 0,
    },
  ];
  for (const row of conversions) {
    if (row.key !== "telegram") row.rate = pct(row.count, total);
  }

  const closedVacancies = vacRows.filter((row) => {
    if (filters.department && row.department !== filters.department) return false;
    return Boolean(row.closedAt) && inDateRange(row.closedAt, filters);
  });
  const closeDays = closedVacancies
    .map((row) => {
      const a = new Date(row.createdAt).getTime();
      const b = new Date(row.closedAt!).getTime();
      if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
      return (b - a) / 86400000;
    })
    .filter((v): v is number => v != null);

  return {
    total,
    byVacancy: mapToRows(byVacancy),
    bySource: mapToRows(bySource),
    byStatus: mapToRows(byStatus),
    rejections: mapToRows(rejections),
    conversions,
    avgDaysToClose:
      closeDays.length === 0
        ? null
        : Math.round((closeDays.reduce((s, n) => s + n, 0) / closeDays.length) * 10) /
          10,
    closedVacancies: closedVacancies.length,
  };
}

export async function getTestingReport(filters: ReportFilters) {
  await ready();
  const [empResults, candResults, pendingEmp, pendingCand, questionRows, matrix] =
    await Promise.all([
      db
        .select({
          score: results.score,
          levelCode: results.levelCode,
          completedAt: results.completedAt,
          profileJson: results.profileJson,
          answersJson: results.answersJson,
          roleTitle: employees.roleTitle,
          department: employees.department,
          employeeId: employees.id,
          claimedLevel: employees.startingLevel,
          currentLevel: employees.currentLevel,
          assessmentId: results.assessmentId,
        })
        .from(results)
        .innerJoin(employees, eq(results.employeeId, employees.id)),
      db
        .select({
          score: candidateResults.score,
          levelCode: candidateResults.levelCode,
          completedAt: candidateResults.completedAt,
          profileJson: candidateResults.profileJson,
          answersJson: candidateResults.answersJson,
          roleTitle: vacancies.roleTitle,
          department: vacancies.department,
          claimedLevel: candidates.claimedLevel,
          currentLevel: candidates.currentLevel,
          startedAt: candidateAssignments.startedAt,
          assessmentId: candidateResults.assessmentId,
        })
        .from(candidateResults)
        .innerJoin(candidates, eq(candidateResults.candidateId, candidates.id))
        .innerJoin(vacancies, eq(candidates.vacancyId, vacancies.id))
        .leftJoin(
          candidateAssignments,
          and(
            eq(candidateAssignments.candidateId, candidates.id),
            eq(candidateAssignments.assessmentId, candidateResults.assessmentId),
          ),
        ),
      db
        .select({ id: assignments.id })
        .from(assignments)
        .where(
          sql`${assignments.status} IN ('pending', 'in_progress')`,
        ),
      db
        .select({ id: candidateAssignments.id })
        .from(candidateAssignments)
        .where(
          sql`${candidateAssignments.status} IN ('pending', 'in_progress')`,
        ),
      db
        .select({
          id: questions.id,
          assessmentId: questions.assessmentId,
          prompt: questions.prompt,
          difficulty: questions.difficulty,
        })
        .from(questions)
        .where(eq(questions.isActive, true)),
      db
        .select({
          status: employeeCompetencies.status,
          name: competencies.name,
        })
        .from(employeeCompetencies)
        .innerJoin(
          competencies,
          eq(employeeCompetencies.competencyId, competencies.id),
        )
        .where(eq(competencies.kind, "skill")),
    ]);

  const empScoped = empResults.filter((row) => {
    if (filters.department && row.department !== filters.department) return false;
    if (filters.employeeId && row.employeeId !== filters.employeeId) return false;
    return inDateRange(row.completedAt, filters);
  });
  const candScoped = candResults.filter((row) => {
    if (filters.department && row.department !== filters.department) return false;
    return inDateRange(row.completedAt, filters);
  });

  const scores = [...empScoped, ...candScoped].map((r) => r.score);
  const byRole = new Map<string, number[]>();
  for (const row of [...empScoped, ...candScoped]) {
    const list = byRole.get(row.roleTitle) ?? [];
    list.push(row.score);
    byRole.set(row.roleTitle, list);
  }

  const hardMisses = new Map<string, number>();
  const qById = new Map(questionRows.map((q) => [q.id, q]));
  for (const row of [...empScoped, ...candScoped]) {
    try {
      const answers = JSON.parse(row.answersJson || "{}") as Record<
        string,
        unknown
      >;
      for (const [qid, value] of Object.entries(answers)) {
        const q = qById.get(Number(qid));
        if (!q) continue;
        const hard =
          String(q.difficulty || "").toLowerCase().includes("hard") ||
          String(q.difficulty || "").toLowerCase().includes("слож");
        if (!hard) continue;
        // Count answered hard questions as exposure; wrong ones when value is clearly wrong is hard without keys — track by prompt frequency from profile gaps instead below.
        if (value === null || value === "" || value === undefined) {
          bump(hardMisses, q.prompt.slice(0, 120));
        }
      }
    } catch {
      /* ignore */
    }
    try {
      const profile = JSON.parse(row.profileJson || "{}") as {
        gaps?: string[];
        sections?: { name: string; score: number }[];
      };
      for (const gap of profile.gaps ?? []) bump(hardMisses, gap.slice(0, 120));
      for (const section of profile.sections ?? []) {
        if (section.score < 50) bump(hardMisses, section.name.slice(0, 120));
      }
    } catch {
      /* ignore */
    }
  }

  const unconfirmed = new Map<string, number>();
  for (const row of matrix) {
    if (!competencyLooksConfirmed(row.status)) bump(unconfirmed, row.name);
  }

  let claimedVsActual = 0;
  for (const row of [...empScoped, ...candScoped]) {
    const claimed = (row.claimedLevel || "").trim().toLowerCase();
    const actual = (row.levelCode || row.currentLevel || "").trim().toLowerCase();
    if (claimed && actual && claimed !== actual) claimedVsActual += 1;
  }

  const durationsMin: number[] = [];
  for (const row of candScoped) {
    if (!row.startedAt || !row.completedAt) continue;
    const a = new Date(row.startedAt).getTime();
    const b = new Date(row.completedAt).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
      durationsMin.push((b - a) / 60000);
    }
  }

  return {
    averageScore: avg(scores),
    completedCount: scores.length,
    unfinishedCount: pendingEmp.length + pendingCand.length,
    byRole: [...byRole.entries()]
      .map(([label, list]) => ({
        label,
        count: list.length,
        average: avg(list),
      }))
      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0)),
    hardTopics: mapToRows(hardMisses).slice(0, 15),
    unconfirmedSkills: mapToRows(unconfirmed).slice(0, 15),
    claimedVsActualCount: claimedVsActual,
    avgDurationMin:
      durationsMin.length === 0
        ? null
        : Math.round(avg(durationsMin.map((n) => Math.round(n))) ?? 0),
  };
}

export async function getTrialReport(filters: ReportFilters) {
  await ready();
  const [mentorships, reports, mentorUsers, empRows] = await Promise.all([
    db.select().from(internMentorships),
    db
      .select({
        internEmployeeId: internDailyReports.internEmployeeId,
        reportDate: internDailyReports.reportDate,
        status: internDailyReports.status,
        score: internDailyReports.score,
      })
      .from(internDailyReports),
    db
      .select({ id: platformUsers.id, displayName: platformUsers.displayName })
      .from(platformUsers),
    db
      .select({
        id: employees.id,
        department: employees.department,
        name: employees.name,
      })
      .from(employees),
  ]);

  const empById = new Map(empRows.map((e) => [e.id, e]));
  const mentorName = new Map(mentorUsers.map((m) => [m.id, m.displayName]));

  const scopedMentorships = mentorships.filter((row) => {
    const emp = empById.get(row.internEmployeeId);
    if (filters.department && emp?.department !== filters.department) return false;
    if (filters.employeeId && row.internEmployeeId !== filters.employeeId)
      return false;
    return inDateRange(row.createdAt, filters);
  });

  const started = scopedMentorships.length;
  const finished = scopedMentorships.filter((m) =>
    ["hired", "ended", "other_role"].includes(m.status),
  ).length;
  const hired = scopedMentorships.filter((m) => m.status === "hired").length;
  const rejected = scopedMentorships.filter((m) =>
    ["ended", "other_role"].includes(m.status),
  ).length;

  const byDay = new Map<string, { count: number; scores: number[] }>();
  const internIds = new Set(scopedMentorships.map((m) => m.internEmployeeId));
  for (const row of reports) {
    if (!internIds.has(row.internEmployeeId)) continue;
    if (!inDateRange(row.reportDate, filters)) continue;
    const day = row.reportDate.slice(0, 10);
    const bucket = byDay.get(day) ?? { count: 0, scores: [] };
    bucket.count += 1;
    if (row.score != null) bucket.scores.push(row.score);
    byDay.set(day, bucket);
  }

  const mentorStats = new Map<
    string,
    { active: number; hired: number; ended: number }
  >();
  for (const row of scopedMentorships) {
    const name =
      (row.mentorUserId && mentorName.get(row.mentorUserId)) || "Без наставника";
    const bucket = mentorStats.get(name) ?? {
      active: 0,
      hired: 0,
      ended: 0,
    };
    if (row.status === "active" || row.status === "extended") bucket.active += 1;
    if (row.status === "hired") bucket.hired += 1;
    if (row.status === "ended" || row.status === "other_role") bucket.ended += 1;
    mentorStats.set(name, bucket);
  }

  // Weak lessons approximated via entrance snapshot weak topics.
  const weakLessons = new Map<string, number>();
  for (const row of scopedMentorships) {
    try {
      const snap = JSON.parse(row.entranceSnapshotJson || "{}") as {
        weakTopics?: string[];
      };
      for (const topic of snap.weakTopics ?? []) bump(weakLessons, topic);
    } catch {
      /* ignore */
    }
  }

  return {
    started,
    finished,
    hired,
    rejected,
    byDay: [...byDay.entries()]
      .map(([label, bucket]) => ({
        label,
        count: bucket.count,
        averageScore: avg(bucket.scores),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru", { numeric: true })),
    weakLessons: mapToRows(weakLessons).slice(0, 15),
    mentors: [...mentorStats.entries()]
      .map(([label, bucket]) => ({
        label,
        ...bucket,
        hireRate: pct(bucket.hired, (bucket.hired + bucket.ended) || 1),
      }))
      .sort((a, b) => b.hired - a.hired || a.label.localeCompare(b.label, "ru")),
  };
}

export async function getLearningReport(filters: ReportFilters) {
  await ready();
  const [
    programs,
    items,
    progress,
    empRows,
    matrix,
    lessonMeta,
  ] = await Promise.all([
    db.select().from(employeeLearningPrograms).where(eq(employeeLearningPrograms.status, "active")),
    db.select().from(employeeProgramItems),
    db
      .select({
        employeeId: lessonProgress.employeeId,
        lessonId: lessonProgress.lessonId,
        status: lessonProgress.status,
      })
      .from(lessonProgress),
    db
      .select({
        id: employees.id,
        name: employees.name,
        department: employees.department,
        roleTitle: employees.roleTitle,
        currentLevel: employees.currentLevel,
        status: employees.status,
      })
      .from(employees),
    db
      .select({
        employeeId: employeeCompetencies.employeeId,
        status: employeeCompetencies.status,
        name: competencies.name,
      })
      .from(employeeCompetencies)
      .innerJoin(
        competencies,
        eq(employeeCompetencies.competencyId, competencies.id),
      )
      .where(eq(competencies.kind, "skill")),
    db
      .select({
        id: learningLessons.id,
        programMonth: learningLessons.programMonth,
        title: learningLessons.title,
      })
      .from(learningLessons),
  ]);

  const empById = new Map(empRows.map((e) => [e.id, e]));
  const lessonById = new Map(lessonMeta.map((l) => [l.id, l]));
  const completed = new Set(
    progress
      .filter((p) => p.status === "credited" || p.status === "accepted")
      .map((p) => `${p.employeeId}:${p.lessonId}`),
  );

  const itemsByProgram = new Map<number, typeof items>();
  for (const item of items) {
    const list = itemsByProgram.get(item.programId) ?? [];
    list.push(item);
    itemsByProgram.set(item.programId, list);
  }

  const employeeProgress: {
    employeeId: number;
    name: string;
    department: string;
    percent: number;
    credited: number;
    total: number;
  }[] = [];

  let readyForAttestation = 0;
  let reachedMiddle = 0;
  const byMonth = new Map<string, { total: number; credited: number }>();

  for (const program of programs) {
    const emp = empById.get(program.employeeId);
    if (!emp) continue;
    if (filters.department && emp.department !== filters.department) continue;
    if (filters.employeeId && emp.id !== filters.employeeId) continue;
    if (!inDateRange(program.generatedAt, filters) && filters.from) {
      // keep programs active in period even if generated earlier
    }

    const programItems = itemsByProgram.get(program.id) ?? [];
    let credited = 0;
    for (const item of programItems) {
      const month = String(item.month || lessonById.get(item.lessonId)?.programMonth || 1);
      const bucket = byMonth.get(month) ?? { total: 0, credited: 0 };
      bucket.total += 1;
      const done = completed.has(`${emp.id}:${item.lessonId}`);
      if (done) {
        credited += 1;
        bucket.credited += 1;
      }
      byMonth.set(month, bucket);
    }
    const total = programItems.length || 1;
    const percent = Math.round((credited / total) * 100);
    employeeProgress.push({
      employeeId: emp.id,
      name: emp.name,
      department: emp.department,
      percent,
      credited,
      total: programItems.length,
    });
    if (percent >= 80) readyForAttestation += 1;
    if (emp.currentLevel === "middle" || emp.currentLevel === "senior") {
      reachedMiddle += 1;
    }
  }

  const overall =
    employeeProgress.length === 0
      ? 0
      : Math.round(
          employeeProgress.reduce((s, row) => s + row.percent, 0) /
            employeeProgress.length,
        );

  const lagging = employeeProgress
    .filter((row) => row.percent < 40)
    .sort((a, b) => a.percent - b.percent)
    .slice(0, 20);

  const weakCompetencies = new Map<string, number>();
  for (const row of matrix) {
    const emp = empById.get(row.employeeId);
    if (!emp) continue;
    if (filters.department && emp.department !== filters.department) continue;
    if (filters.employeeId && emp.id !== filters.employeeId) continue;
    if (!competencyLooksConfirmed(row.status)) bump(weakCompetencies, row.name);
  }

  return {
    overallProgress: overall,
    employeeCount: employeeProgress.length,
    completedLessons: employeeProgress.reduce((s, r) => s + r.credited, 0),
    lagging,
    weakCompetencies: mapToRows(weakCompetencies).slice(0, 15),
    byMonth: [...byMonth.entries()]
      .map(([label, bucket]) => ({
        label: `Месяц ${label}`,
        total: bucket.total,
        credited: bucket.credited,
        percent: pct(bucket.credited, bucket.total),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru", { numeric: true })),
    readyForAttestation,
    reachedMiddle,
  };
}

export async function getReportDepartments() {
  await ready();
  const rows = await db
    .select({ department: employees.department })
    .from(employees)
    .orderBy(asc(employees.department));
  return [...new Set(rows.map((r) => r.department).filter(Boolean))];
}

export async function getReportEmployees(department?: string | null) {
  await ready();
  const rows = await db
    .select({
      id: employees.id,
      name: employees.name,
      department: employees.department,
      roleTitle: employees.roleTitle,
    })
    .from(employees)
    .orderBy(asc(employees.name));
  return department
    ? rows.filter((r) => r.department === department)
    : rows;
}

export async function getMentorsReport(filters: ReportFilters) {
  const trial = await getTrialReport(filters);
  return {
    activeInterns: trial.started,
    finished: trial.finished,
    hired: trial.hired,
    rejected: trial.rejected,
    mentors: trial.mentors,
    weakLessons: trial.weakLessons,
  };
}

export async function getAttestationsReport(filters: ReportFilters) {
  await ready();
  const { attestationReviews, attestations } = await import("./schema");
  const [rows, reviews] = await Promise.all([
    db.select().from(attestations),
    db.select().from(attestationReviews),
  ]);
  const scoped = rows.filter((row) => {
    const day = (row.startsAt || row.scheduledAt || "").slice(0, 10);
    return inDateRange(day || null, filters);
  });
  const byStatus = new Map<string, number>();
  for (const row of scoped) {
    bump(byStatus, row.isActive ? "active" : "inactive");
  }
  const reviewByResult = new Map<string, number>();
  for (const row of reviews) {
    if (!inDateRange(row.createdAt, filters)) continue;
    bump(reviewByResult, row.decision || row.status || "pending");
  }
  return {
    total: scoped.length,
    byStatus: mapToRows(byStatus),
    reviews: reviews.length,
    byDecision: mapToRows(reviewByResult),
  };
}

export async function getReportBundle(
  section: import("@/lib/report-filters").ReportSection,
  filters: ReportFilters,
) {
  if (section === "hiring") return { section, data: await getHiringReport(filters) };
  if (section === "testing") return { section, data: await getTestingReport(filters) };
  if (section === "trial") return { section, data: await getTrialReport(filters) };
  if (section === "mentors") return { section, data: await getMentorsReport(filters) };
  if (section === "attestations")
    return { section, data: await getAttestationsReport(filters) };
  return { section, data: await getLearningReport(filters) };
}

import "server-only";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "./index";
import {
  attestations,
  attestationReviews,
  employeeCompetencies,
  employeeLearningPrograms,
  employeeProgramItems,
  employees,
  internDailyReports,
  internMentorships,
  learningLessons,
  lessonProgress,
  mentorRatings,
  platformUsers,
} from "./schema";
import { createNotification } from "./mentorship";
import { statusIsDone } from "@/lib/learning-program";

async function ready() {
  const { ensureDb } = await import("./queries");
  await ensureDb();
}

function parseList(raw: string | null | undefined) {
  try {
    const value = JSON.parse(raw || "[]") as unknown;
    return Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function hoursBetween(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return (b - a) / 3600000;
}

function clampRating(value: number) {
  return Math.round(Math.min(5, Math.max(1, value)) * 10) / 10;
}

export async function listMentorsDirectory() {
  await ready();
  const mentors = await db
    .select({
      id: platformUsers.id,
      displayName: platformUsers.displayName,
      roleTitle: platformUsers.profileJobTitle,
      department: platformUsers.profileDepartment,
      competenciesJson: platformUsers.mentorCompetenciesJson,
      employeeId: platformUsers.employeeId,
      login: platformUsers.login,
      isActive: platformUsers.isActive,
    })
    .from(platformUsers)
    .where(
      and(eq(platformUsers.role, "manager"), eq(platformUsers.isActive, true)),
    )
    .orderBy(asc(platformUsers.displayName));

  if (mentors.length === 0) return [];

  const mentorIds = mentors.map((m) => m.id);
  const [
    mentorshipRows,
    staff,
    submittedLessons,
    overdueLessons,
    reviews,
    ratings,
    reports,
  ] = await Promise.all([
    db
      .select({
        mentorUserId: internMentorships.mentorUserId,
        internEmployeeId: internMentorships.internEmployeeId,
      })
      .from(internMentorships)
      .where(inArray(internMentorships.status, ["active", "extended"])),
    db
      .select({
        id: employees.id,
        mentorUserId: employees.mentorUserId,
        roleTitle: employees.roleTitle,
      })
      .from(employees)
      .where(ne(employees.status, "left")),
    db
      .select({
        employeeId: lessonProgress.employeeId,
        status: lessonProgress.status,
      })
      .from(lessonProgress)
      .where(eq(lessonProgress.status, "submitted")),
    db
      .select({
        employeeId: lessonProgress.employeeId,
        deadlineAt: lessonProgress.deadlineAt,
        status: lessonProgress.status,
      })
      .from(lessonProgress),
    db
      .select({
        employeeId: lessonProgress.employeeId,
        submittedAt: lessonProgress.submittedAt,
        reviewedAt: lessonProgress.reviewedAt,
        mentorComment: lessonProgress.mentorComment,
        status: lessonProgress.status,
      })
      .from(lessonProgress)
      .where(
        inArray(lessonProgress.status, [
          "accepted",
          "returned",
          "credited",
          "fixing",
        ]),
      ),
    db
      .select({
        mentorUserId: mentorRatings.mentorUserId,
        score: mentorRatings.score,
      })
      .from(mentorRatings)
      .where(inArray(mentorRatings.mentorUserId, mentorIds)),
    db
      .select({
        internEmployeeId: internDailyReports.internEmployeeId,
        submittedAt: internDailyReports.submittedAt,
        reviewedAt: internDailyReports.reviewedAt,
        mentorComment: internDailyReports.mentorComment,
        status: internDailyReports.status,
      })
      .from(internDailyReports),
  ]);

  const now = Date.now();
  const internIdsByMentor = new Map<number, Set<number>>();
  for (const row of mentorshipRows) {
    if (row.mentorUserId == null) continue;
    const set = internIdsByMentor.get(row.mentorUserId) ?? new Set();
    set.add(row.internEmployeeId);
    internIdsByMentor.set(row.mentorUserId, set);
  }

  const employeeIdsByMentor = new Map<number, Set<number>>();
  for (const row of staff) {
    if (row.mentorUserId == null) continue;
    if (/стаж|intern/i.test(row.roleTitle)) continue;
    const set = employeeIdsByMentor.get(row.mentorUserId) ?? new Set();
    set.add(row.id);
    employeeIdsByMentor.set(row.mentorUserId, set);
  }

  const menteeIdsFor = (mentorId: number) => {
    const ids = new Set<number>();
    for (const id of internIdsByMentor.get(mentorId) ?? []) ids.add(id);
    for (const id of employeeIdsByMentor.get(mentorId) ?? []) ids.add(id);
    return ids;
  };

  const feedbackByMentor = new Map<number, number[]>();
  for (const row of ratings) {
    const list = feedbackByMentor.get(row.mentorUserId) ?? [];
    list.push(row.score);
    feedbackByMentor.set(row.mentorUserId, list);
  }

  return mentors.map((mentor) => {
    const menteeIds = menteeIdsFor(mentor.id);
    const activeReviews = submittedLessons.filter((row) =>
      menteeIds.has(row.employeeId),
    ).length;
    const overdueReviews = overdueLessons.filter((row) => {
      if (!menteeIds.has(row.employeeId)) return false;
      if (statusIsDone(row.status)) return false;
      if (!row.deadlineAt) return false;
      return new Date(row.deadlineAt).getTime() < now;
    }).length;

    const lessonReviews = reviews.filter((row) => menteeIds.has(row.employeeId));
    const reportReviews = reports.filter((row) => menteeIds.has(row.internEmployeeId));
    const speedSamples = [
      ...lessonReviews.map((row) => hoursBetween(row.submittedAt, row.reviewedAt)),
      ...reportReviews.map((row) => hoursBetween(row.submittedAt, row.reviewedAt)),
    ].filter((value): value is number => value != null);
    const avgSpeedHours =
      speedSamples.length === 0
        ? null
        : speedSamples.reduce((sum, value) => sum + value, 0) / speedSamples.length;

    const comments = [
      ...lessonReviews.map((row) => row.mentorComment?.trim()),
      ...reportReviews.map((row) => row.mentorComment?.trim()),
    ];
    const commentQuality =
      comments.length === 0
        ? null
        : Math.round(
            (comments.filter((text) => Boolean(text)).length / comments.length) *
              100,
          );

    const returned = lessonReviews.filter((row) =>
      ["returned", "fixing"].includes(row.status),
    ).length;

    const feedback = feedbackByMentor.get(mentor.id) ?? [];
    const feedbackAvg =
      feedback.length === 0
        ? null
        : feedback.reduce((sum, value) => sum + value, 0) / feedback.length;

    const speedScore =
      avgSpeedHours == null ? 3.5 : avgSpeedHours <= 12 ? 5 : avgSpeedHours <= 36 ? 4 : avgSpeedHours <= 72 ? 3 : 2;
    const commentScore =
      commentQuality == null ? 3.5 : commentQuality >= 80 ? 5 : commentQuality >= 50 ? 4 : 3;
    const feedbackScore = feedbackAvg ?? 3.5;
    const returnPenalty = Math.min(1.5, returned * 0.15);
    const rating = clampRating(
      (speedScore + commentScore + feedbackScore) / 3 - returnPenalty,
    );

    return {
      id: mentor.id,
      name: mentor.displayName,
      roleTitle: mentor.roleTitle || "Наставник",
      department: mentor.department || "",
      competencies: parseList(mentor.competenciesJson),
      internCount: internIdsByMentor.get(mentor.id)?.size ?? 0,
      employeeCount: employeeIdsByMentor.get(mentor.id)?.size ?? 0,
      activeReviews,
      overdueReviews,
      rating,
      metrics: {
        avgReviewHours: avgSpeedHours == null ? null : Math.round(avgSpeedHours * 10) / 10,
        commentQuality,
        returnedCount: returned,
        feedbackCount: feedback.length,
        feedbackAvg: feedbackAvg == null ? null : Math.round(feedbackAvg * 10) / 10,
      },
      login: mentor.login,
      employeeId: mentor.employeeId,
    };
  });
}

export async function updateMentorCompetencies(
  mentorUserId: number,
  competencies: string[],
) {
  await ready();
  await db
    .update(platformUsers)
    .set({
      mentorCompetenciesJson: JSON.stringify(
        [...new Set(competencies.map((item) => item.trim()).filter(Boolean))],
      ),
    })
    .where(eq(platformUsers.id, mentorUserId));
}

export async function getMentorCabinet(mentorUserId: number) {
  await ready();
  const [mentor] = await db
    .select()
    .from(platformUsers)
    .where(eq(platformUsers.id, mentorUserId))
    .limit(1);
  if (!mentor) return null;

  const [internRows, employeeRows] = await Promise.all([
    db
      .select({
        mentorship: internMentorships,
        intern: employees,
      })
      .from(internMentorships)
      .innerJoin(employees, eq(internMentorships.internEmployeeId, employees.id))
      .where(
        and(
          eq(internMentorships.mentorUserId, mentorUserId),
          inArray(internMentorships.status, ["active", "extended"]),
        ),
      )
      .orderBy(asc(employees.name)),
    db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.mentorUserId, mentorUserId),
          ne(employees.status, "left"),
        ),
      )
      .orderBy(asc(employees.name)),
  ]);

  const employeesOnly = employeeRows.filter(
    (row) => !/стаж|intern/i.test(row.roleTitle),
  );
  const menteeIds = [
    ...internRows.map((row) => row.intern.id),
    ...employeesOnly.map((row) => row.id),
  ];

  if (menteeIds.length === 0) {
    return {
      mentor: {
        id: mentor.id,
        name: mentor.displayName,
        department: mentor.profileDepartment || "",
        competencies: parseList(mentor.mentorCompetenciesJson),
      },
      interns: internRows.map(({ mentorship, intern }) => ({
        id: intern.id,
        name: intern.name,
        roleTitle: intern.roleTitle,
        department: intern.department,
        currentLevel: intern.currentLevel,
        trialStartsAt: mentorship.trialStartsAt,
        trialEndsAt: mentorship.trialEndsAt,
        status: mentorship.status,
      })),
      employees: [],
      queue: [] as Awaited<ReturnType<typeof buildReviewQueue>>,
      overdue: [] as Awaited<ReturnType<typeof buildReviewQueue>>,
      lessonsToday: [] as {
        employeeId: number;
        employeeName: string;
        lessonId: number;
        title: string;
        status: string;
      }[],
      upcomingAttestations: [] as {
        id: number;
        employeeId: number;
        employeeName: string;
        title: string;
        scheduledAt: string;
        type: string;
      }[],
      weakCompetencies: [] as {
        employeeId: number;
        employeeName: string;
        competencyId: number;
        competency: string;
        status: string;
      }[],
      metrics: {
        avgReviewHours: null as number | null,
        commentQuality: null as number | null,
        returnedCount: 0,
        programFinishedPercent: null as number | null,
        feedbackAvg: null as number | null,
        rating: 3.5,
      },
    };
  }

  const [
    progressRows,
    lessons,
    reviews,
    programs,
    programItems,
    competencyRows,
    attestRows,
    feedback,
    dailyReports,
  ] = await Promise.all([
    db
      .select({
        id: lessonProgress.id,
        employeeId: lessonProgress.employeeId,
        lessonId: lessonProgress.lessonId,
        status: lessonProgress.status,
        deadlineAt: lessonProgress.deadlineAt,
        submittedAt: lessonProgress.submittedAt,
        reviewedAt: lessonProgress.reviewedAt,
        mentorComment: lessonProgress.mentorComment,
        answerText: lessonProgress.answerText,
        answerFileUrl: lessonProgress.answerFileUrl,
      })
      .from(lessonProgress)
      .where(inArray(lessonProgress.employeeId, menteeIds)),
    db
      .select({
        id: learningLessons.id,
        title: learningLessons.title,
        slug: learningLessons.slug,
      })
      .from(learningLessons),
    db
      .select({
        id: attestationReviews.id,
        employeeId: attestationReviews.employeeId,
        type: attestationReviews.type,
        scheduledAt: attestationReviews.scheduledAt,
        status: attestationReviews.status,
        attestationTitle: attestations.title,
      })
      .from(attestationReviews)
      .innerJoin(attestations, eq(attestationReviews.attestationId, attestations.id))
      .where(inArray(attestationReviews.employeeId, menteeIds))
      .orderBy(asc(attestationReviews.scheduledAt)),
    db
      .select({
        employeeId: employeeLearningPrograms.employeeId,
        id: employeeLearningPrograms.id,
        status: employeeLearningPrograms.status,
      })
      .from(employeeLearningPrograms)
      .where(
        and(
          inArray(employeeLearningPrograms.employeeId, menteeIds),
          eq(employeeLearningPrograms.status, "active"),
        ),
      ),
    db.select().from(employeeProgramItems),
    db
      .select({
        employeeId: employeeCompetencies.employeeId,
        status: employeeCompetencies.status,
        note: employeeCompetencies.note,
        competencyId: employeeCompetencies.competencyId,
      })
      .from(employeeCompetencies)
      .where(inArray(employeeCompetencies.employeeId, menteeIds)),
    db
      .select({
        id: attestationReviews.id,
        employeeId: attestationReviews.employeeId,
        type: attestationReviews.type,
        scheduledAt: attestationReviews.scheduledAt,
        status: attestationReviews.status,
        title: attestations.title,
      })
      .from(attestationReviews)
      .innerJoin(attestations, eq(attestationReviews.attestationId, attestations.id))
      .where(
        and(
          inArray(attestationReviews.employeeId, menteeIds),
          ne(attestationReviews.status, "completed"),
        ),
      )
      .orderBy(asc(attestationReviews.scheduledAt))
      .limit(20),
    db
      .select({ score: mentorRatings.score })
      .from(mentorRatings)
      .where(eq(mentorRatings.mentorUserId, mentorUserId)),
    db
      .select({
        internEmployeeId: internDailyReports.internEmployeeId,
        submittedAt: internDailyReports.submittedAt,
        reviewedAt: internDailyReports.reviewedAt,
        mentorComment: internDailyReports.mentorComment,
        status: internDailyReports.status,
      })
      .from(internDailyReports)
      .where(inArray(internDailyReports.internEmployeeId, menteeIds)),
  ]);

  const nameById = new Map<number, string>();
  for (const row of internRows) nameById.set(row.intern.id, row.intern.name);
  for (const row of employeesOnly) nameById.set(row.id, row.name);
  const lessonById = new Map(lessons.map((row) => [row.id, row]));

  const queue = buildReviewQueue(progressRows, nameById, lessonById, "queue");
  const overdue = buildReviewQueue(progressRows, nameById, lessonById, "overdue");

  const today = new Date().toISOString().slice(0, 10);
  const lessonsToday = progressRows
    .filter((row) => {
      if (["credited", "accepted", "skip"].includes(row.status)) return false;
      return (
        (row.deadlineAt || "").startsWith(today) ||
        (row.submittedAt || "").startsWith(today) ||
        row.status === "studying"
      );
    })
    .map((row) => ({
      employeeId: row.employeeId,
      employeeName: nameById.get(row.employeeId) || `#${row.employeeId}`,
      lessonId: row.lessonId,
      title: lessonById.get(row.lessonId)?.title || `Lesson ${row.lessonId}`,
      status: row.status,
    }))
    .slice(0, 30);

  const { listSkillCompetencies } = await import("./roles-catalog");
  const catalog = await listSkillCompetencies();
  const competencyName = new Map(catalog.map((item) => [item.id, item.name]));
  const weakCompetencies = competencyRows
    .filter((row) =>
      ["not_checked", "doesnt_know", "partial", "needs_recheck"].includes(
        row.status,
      ),
    )
    .map((row) => ({
      employeeId: row.employeeId,
      employeeName: nameById.get(row.employeeId) || `#${row.employeeId}`,
      competencyId: row.competencyId,
      competency: competencyName.get(row.competencyId) || `#${row.competencyId}`,
      status: row.status,
    }))
    .slice(0, 40);

  const finishedEmployees = programs.filter((program) => {
    const items = programItems.filter((item) => item.programId === program.id);
    if (items.length === 0) return false;
    const doneItems = items.filter((item) =>
      progressRows.some(
        (row) =>
          row.employeeId === program.employeeId &&
          row.lessonId === item.lessonId &&
          statusIsDone(row.status),
      ),
    ).length;
    return doneItems >= items.length;
  }).length;
  const programFinishedPercent =
    programs.length === 0
      ? null
      : Math.round((finishedEmployees / programs.length) * 100);

  const speedSamples = [
    ...progressRows.map((row) => hoursBetween(row.submittedAt, row.reviewedAt)),
    ...dailyReports.map((row) => hoursBetween(row.submittedAt, row.reviewedAt)),
  ].filter((value): value is number => value != null);
  const avgReviewHours =
    speedSamples.length === 0
      ? null
      : Math.round(
          (speedSamples.reduce((sum, value) => sum + value, 0) /
            speedSamples.length) *
            10,
        ) / 10;
  const lessonCommentPool = progressRows.filter((row) => row.reviewedAt);
  const reportCommentPool = dailyReports.filter((row) => row.reviewedAt);
  const reviewedComments = [
    ...lessonCommentPool.map((row) => row.mentorComment?.trim()),
    ...reportCommentPool.map((row) => row.mentorComment?.trim()),
  ];
  const commentQuality =
    reviewedComments.length === 0
      ? null
      : Math.round(
          (reviewedComments.filter(Boolean).length / reviewedComments.length) *
            100,
        );
  const returnedCount = progressRows.filter((row) =>
    ["returned", "fixing"].includes(row.status),
  ).length;
  const feedbackAvg =
    feedback.length === 0
      ? null
      : Math.round(
          (feedback.reduce((sum, row) => sum + row.score, 0) / feedback.length) *
            10,
        ) / 10;
  const speedScore =
    avgReviewHours == null
      ? 3.5
      : avgReviewHours <= 12
        ? 5
        : avgReviewHours <= 36
          ? 4
          : avgReviewHours <= 72
            ? 3
            : 2;
  const commentScore =
    commentQuality == null ? 3.5 : commentQuality >= 80 ? 5 : commentQuality >= 50 ? 4 : 3;
  const rating = clampRating(
    (speedScore + commentScore + (feedbackAvg ?? 3.5)) / 3 -
      Math.min(1.5, returnedCount * 0.15),
  );

  return {
    mentor: {
      id: mentor.id,
      name: mentor.displayName,
      department: mentor.profileDepartment || "",
      competencies: parseList(mentor.mentorCompetenciesJson),
    },
    interns: internRows.map(({ mentorship, intern }) => ({
      id: intern.id,
      name: intern.name,
      roleTitle: intern.roleTitle,
      department: intern.department,
      currentLevel: intern.currentLevel,
      trialStartsAt: mentorship.trialStartsAt,
      trialEndsAt: mentorship.trialEndsAt,
      status: mentorship.status,
    })),
    employees: employeesOnly.map((row) => ({
      id: row.id,
      name: row.name,
      roleTitle: row.roleTitle,
      department: row.department,
      currentLevel: row.currentLevel,
      targetLevel: row.targetLevel,
      status: row.status,
      nextCheckAt: row.nextCheckAt,
    })),
    queue,
    overdue,
    lessonsToday,
    upcomingAttestations: (attestRows.length ? attestRows : reviews)
      .filter((row) => row.status !== "completed")
      .slice(0, 12)
      .map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: nameById.get(row.employeeId) || `#${row.employeeId}`,
        title: "attestationTitle" in row ? row.attestationTitle : row.title,
        scheduledAt: row.scheduledAt,
        type: row.type,
      })),
    weakCompetencies,
    metrics: {
      avgReviewHours,
      commentQuality,
      returnedCount,
      programFinishedPercent,
      feedbackAvg,
      rating,
    },
  };
}

function buildReviewQueue(
  progressRows: {
    id: number;
    employeeId: number;
    lessonId: number;
    status: string;
    deadlineAt: string | null;
    submittedAt: string | null;
    answerText: string;
    answerFileUrl: string;
    mentorComment: string;
  }[],
  nameById: Map<number, string>,
  lessonById: Map<number, { id: number; title: string; slug: string }>,
  mode: "queue" | "overdue",
) {
  const now = Date.now();
  return progressRows
    .filter((row) => {
      if (mode === "queue") return row.status === "submitted";
      if (statusIsDone(row.status)) return false;
      if (!row.deadlineAt) return false;
      return new Date(row.deadlineAt).getTime() < now;
    })
    .map((row) => ({
      progressId: row.id,
      employeeId: row.employeeId,
      employeeName: nameById.get(row.employeeId) || `#${row.employeeId}`,
      lessonId: row.lessonId,
      lessonTitle: lessonById.get(row.lessonId)?.title || `Lesson ${row.lessonId}`,
      lessonSlug: lessonById.get(row.lessonId)?.slug || String(row.lessonId),
      status: row.status,
      deadlineAt: row.deadlineAt,
      submittedAt: row.submittedAt,
      answerText: row.answerText,
      answerFileUrl: row.answerFileUrl,
      mentorComment: row.mentorComment,
    }))
    .sort((a, b) =>
      String(a.submittedAt || a.deadlineAt || "").localeCompare(
        String(b.submittedAt || b.deadlineAt || ""),
      ),
    );
}

export async function mentorReportToHr(input: {
  mentorUserId: number;
  mentorName: string;
  employeeId: number;
  message: string;
}) {
  await ready();
  const [employee] = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(eq(employees.id, input.employeeId))
    .limit(1);
  if (!employee) throw new Error("Сотрудник не найден");

  const admins = await db
    .select({ id: platformUsers.id })
    .from(platformUsers)
    .where(and(eq(platformUsers.role, "admin"), eq(platformUsers.isActive, true)));

  const title = `Проблема от наставника: ${employee.name}`;
  const body = `${input.mentorName}: ${input.message.trim()}`;
  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      type: "mentor_hr_alert",
      title,
      body,
      href: `/employees/${employee.id}`,
      payload: {
        mentorUserId: input.mentorUserId,
        employeeId: employee.id,
      },
    });
  }
  return { notified: admins.length };
}

export async function recommendNextLevel(input: {
  mentorUserId: number;
  employeeId: number;
  toLevel: string;
  comment?: string;
}) {
  await ready();
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, input.employeeId))
    .limit(1);
  if (!employee) throw new Error("Сотрудник не найден");
  if (employee.mentorUserId !== input.mentorUserId) {
    throw new Error("Этот сотрудник не закреплён за вами");
  }

  await db
    .update(employees)
    .set({
      targetLevel: input.toLevel,
      notes: [
        employee.notes,
        `Рекомендация наставника (${new Date().toISOString().slice(0, 10)}): ${input.toLevel}${
          input.comment?.trim() ? ` — ${input.comment.trim()}` : ""
        }`,
      ]
        .filter(Boolean)
        .join("\n"),
    })
    .where(eq(employees.id, employee.id));

  const admins = await db
    .select({ id: platformUsers.id })
    .from(platformUsers)
    .where(and(eq(platformUsers.role, "admin"), eq(platformUsers.isActive, true)));
  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      type: "mentor_level_recommend",
      title: `Рекомендация уровня: ${employee.name}`,
      body: `Наставник рекомендует уровень ${input.toLevel}`,
      href: `/employees/${employee.id}`,
    });
  }
}

export async function upsertMentorRating(input: {
  mentorUserId: number;
  fromEmployeeId: number;
  score: number;
  comment?: string;
}) {
  await ready();
  const score = Math.min(5, Math.max(1, Math.round(input.score)));
  const [existing] = await db
    .select()
    .from(mentorRatings)
    .where(
      and(
        eq(mentorRatings.mentorUserId, input.mentorUserId),
        eq(mentorRatings.fromEmployeeId, input.fromEmployeeId),
      ),
    )
    .limit(1);
  if (existing) {
    await db
      .update(mentorRatings)
      .set({
        score,
        comment: input.comment?.trim() ?? existing.comment,
      })
      .where(eq(mentorRatings.id, existing.id));
    return existing.id;
  }
  const [row] = await db
    .insert(mentorRatings)
    .values({
      mentorUserId: input.mentorUserId,
      fromEmployeeId: input.fromEmployeeId,
      score,
      comment: input.comment?.trim() ?? "",
      createdAt: new Date().toISOString(),
    })
    .returning({ id: mentorRatings.id });
  return row.id;
}

import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import {
  competencies,
  employeeCompetencies,
  employeeLearningPrograms,
  employeeProgramItems,
  employees,
  learningLessons,
  lessonProgress,
} from "./schema";
import {
  competencyLooksConfirmed,
  inferProgramMonth,
  isLessonWorkflowStatus,
  pickPathMode,
  statusIsDone,
  type LessonWorkflowStatus,
  type ProgramPathMode,
} from "@/lib/learning-program";
import {
  isFiveDayInternProgramSlug,
  lessonAssignedToStaffRole,
} from "@/lib/role-match";

async function ready() {
  const { ensureDb } = await import("./queries");
  await ensureDb();
}

function topicHit(haystack: string[], needles: string[]) {
  const left = haystack.map((t) => t.toLowerCase());
  return needles.some((needle) => {
    const n = needle.toLowerCase().trim();
    if (!n) return false;
    return left.some((t) => t.includes(n) || n.includes(t));
  });
}

async function backfillProgramDeadlines(
  employeeId: number,
  startsAt: string,
  items: {
    lessonId: number;
    pathMode: string;
    status: string;
    deadlineAt: string | null;
  }[],
) {
  const need = items.filter(
    (item) =>
      item.pathMode !== "skip" &&
      !item.deadlineAt &&
      !statusIsDone(item.status),
  );
  if (need.length === 0) return;

  const { getSettingsSection } = await import("./system-settings");
  const learning = await getSettingsSection("learning");
  const days = Math.max(1, learning.deadlineDays || 1);
  const startMs = Date.parse(startsAt);
  const base = Number.isFinite(startMs) ? startMs : Date.now();
  const now = new Date().toISOString();

  let seq = 0;
  const writes: Promise<unknown>[] = [];
  for (const item of items) {
    if (item.pathMode === "skip") continue;
    seq += 1;
    if (item.deadlineAt || statusIsDone(item.status)) continue;
    const deadlineAt = new Date(base + seq * days * 86_400_000).toISOString();
    item.deadlineAt = deadlineAt;
    writes.push(
      (async () => {
        const [existing] = await db
          .select({
            id: lessonProgress.id,
            deadlineAt: lessonProgress.deadlineAt,
          })
          .from(lessonProgress)
          .where(
            and(
              eq(lessonProgress.employeeId, employeeId),
              eq(lessonProgress.lessonId, item.lessonId),
            ),
          )
          .limit(1);
        if (existing) {
          if (!existing.deadlineAt) {
            await db
              .update(lessonProgress)
              .set({ deadlineAt })
              .where(eq(lessonProgress.id, existing.id));
          }
          return;
        }
        await db.insert(lessonProgress).values({
          employeeId,
          lessonId: item.lessonId,
          status: "not_started",
          deadlineAt,
          completedAt: now,
        });
      })(),
    );
  }
  for (let i = 0; i < writes.length; i += 20) {
    await Promise.all(writes.slice(i, i + 20));
  }
}

/**
 * Build or refresh the individual Middle program:
 * role lessons − confirmed knowledge → path mode per item.
 */
export async function ensureEmployeeLearningProgram(employeeId: number) {
  await ready();
  const [employeeRows, existingRows, allLessons, matrixRows] =
    await Promise.all([
      db
        .select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1),
      db
        .select()
        .from(employeeLearningPrograms)
        .where(
          and(
            eq(employeeLearningPrograms.employeeId, employeeId),
            eq(employeeLearningPrograms.status, "active"),
          ),
        )
        .orderBy(desc(employeeLearningPrograms.generatedAt))
        .limit(1),
      db
        .select({
          id: learningLessons.id,
          slug: learningLessons.slug,
          title: learningLessons.title,
          roleFamiliesJson: learningLessons.roleFamiliesJson,
          topicsJson: learningLessons.topicsJson,
          programMonth: learningLessons.programMonth,
          sortOrder: learningLessons.sortOrder,
        })
        .from(learningLessons)
        .where(eq(learningLessons.isActive, true))
        .orderBy(asc(learningLessons.sortOrder), asc(learningLessons.id)),
      db
        .select({
          competencyId: employeeCompetencies.competencyId,
          status: employeeCompetencies.status,
          name: competencies.name,
        })
        .from(employeeCompetencies)
        .innerJoin(
          competencies,
          eq(employeeCompetencies.competencyId, competencies.id),
        )
        .where(eq(employeeCompetencies.employeeId, employeeId)),
    ]);

  const employee = employeeRows[0];
  if (!employee) return null;
  if (/стаж|intern/i.test(employee.roleTitle)) return null;
  const existing = existingRows[0];

  const roleLessons = allLessons.filter((lesson) => {
    if (isFiveDayInternProgramSlug(lesson.slug)) return false;
    let families: string[] = [];
    try {
      families = JSON.parse(lesson.roleFamiliesJson || "[]") as string[];
    } catch {
      families = [];
    }
    return lessonAssignedToStaffRole(families, employee.roleTitle);
  });

  // Cap program size for UX; prefer j2m days then others.
  const j2m = roleLessons.filter((l) => /-j2m-day-\d+/i.test(l.slug));
  const other = roleLessons.filter((l) => !/-j2m-day-\d+/i.test(l.slug));
  const selected = [...j2m, ...other].slice(0, 90);

  const confirmedTopics = matrixRows
    .filter((row) => competencyLooksConfirmed(row.status))
    .map((row) => row.name);
  const weakTopics = matrixRows
    .filter((row) => !competencyLooksConfirmed(row.status))
    .map((row) => row.name);

  const now = new Date().toISOString();
  let program = existing;
  if (!program) {
    const [created] = await db
      .insert(employeeLearningPrograms)
      .values({
        employeeId,
        targetLevel: employee.targetLevel || "middle",
        status: "active",
        startsAt: employee.hiredAt || now,
        generatedAt: now,
        month1Theme: "month_1",
        month2Theme: "month_2",
        month3Theme: "month_3",
      })
      .returning();
    program = created;
  } else {
    await Promise.all([
      db
        .update(employeeLearningPrograms)
        .set({ generatedAt: now })
        .where(eq(employeeLearningPrograms.id, program.id)),
      db
        .delete(employeeProgramItems)
        .where(eq(employeeProgramItems.programId, program.id)),
    ]);
  }

  const items = selected.map((lesson, index) => {
    let topics: string[] = [];
    try {
      topics = JSON.parse(lesson.topicsJson || "[]") as string[];
    } catch {
      topics = [];
    }
    const confirmed = topicHit(topics.concat(lesson.title), confirmedTopics);
    const weakTopic = topicHit(topics.concat(lesson.title), weakTopics);
    const pathMode = pickPathMode({ confirmed, weakTopic });
    const month = inferProgramMonth({
      programMonth: lesson.programMonth,
      slug: lesson.slug,
    });
    return {
      programId: program!.id,
      lessonId: lesson.id,
      competencyId: null as number | null,
      month,
      pathMode,
      sortOrder: lesson.sortOrder || index + 1,
    };
  });

  for (let i = 0; i < items.length; i += 100) {
    await db.insert(employeeProgramItems).values(items.slice(i, i + 100));
  }

  if (employee.status === "active" || employee.status === "probation") {
    await db
      .update(employees)
      .set({ status: "learning" })
      .where(eq(employees.id, employeeId));
  }

  return getEmployeeLearningProgram(employeeId);
}

export async function getEmployeeLearningProgram(employeeId: number) {
  await ready();
  const [program] = await db
    .select()
    .from(employeeLearningPrograms)
    .where(
      and(
        eq(employeeLearningPrograms.employeeId, employeeId),
        eq(employeeLearningPrograms.status, "active"),
      ),
    )
    .orderBy(desc(employeeLearningPrograms.generatedAt))
    .limit(1);
  if (!program) return null;

  const rows = await db
    .select({
      item: employeeProgramItems,
      lesson: {
        id: learningLessons.id,
        slug: learningLessons.slug,
        title: learningLessons.title,
        summary: learningLessons.summary,
        contentFormat: learningLessons.contentFormat,
        durationMin: learningLessons.durationMin,
        level: learningLessons.level,
        topicsJson: learningLessons.topicsJson,
      },
      progress: lessonProgress,
    })
    .from(employeeProgramItems)
    .innerJoin(
      learningLessons,
      eq(employeeProgramItems.lessonId, learningLessons.id),
    )
    .leftJoin(
      lessonProgress,
      and(
        eq(lessonProgress.lessonId, learningLessons.id),
        eq(lessonProgress.employeeId, employeeId),
      ),
    )
    .where(eq(employeeProgramItems.programId, program.id))
    .orderBy(
      asc(employeeProgramItems.month),
      asc(employeeProgramItems.sortOrder),
    );

  const items = rows.map(({ item, lesson, progress }) => {
    let topics: string[] = [];
    try {
      topics = JSON.parse(lesson.topicsJson || "[]") as string[];
    } catch {
      topics = [];
    }
    const status = (progress?.status ||
      (progress ? "credited" : "not_started")) as LessonWorkflowStatus;
    return {
      id: item.id,
      lessonId: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      summary: lesson.summary,
      contentFormat: lesson.contentFormat,
      durationMin: lesson.durationMin,
      level: lesson.level,
      topics,
      month: item.month as 1 | 2 | 3,
      pathMode: item.pathMode as ProgramPathMode,
      sortOrder: item.sortOrder,
      status,
      deadlineAt: progress?.deadlineAt ?? null,
      answerText: progress?.answerText ?? "",
      answerFileUrl: progress?.answerFileUrl ?? "",
      mentorComment: progress?.mentorComment ?? "",
      submittedAt: progress?.submittedAt ?? null,
      reviewedAt: progress?.reviewedAt ?? null,
      completedAt: progress?.completedAt ?? null,
      blockedByOverdue: false,
    };
  });

  await backfillProgramDeadlines(
    employeeId,
    program.startsAt || program.generatedAt,
    items,
  );

  {
    const { getSettingsSection } = await import("./system-settings");
    const learning = await getSettingsSection("learning");
    if (learning.overdueBlocksNext) {
      const now = Date.now();
      let overdueFound = false;
      for (const item of items) {
        item.blockedByOverdue = overdueFound;
        const overdue =
          Boolean(item.deadlineAt) &&
          new Date(item.deadlineAt as string).getTime() < now &&
          !statusIsDone(item.status) &&
          item.pathMode !== "skip";
        if (overdue) overdueFound = true;
      }
    }
  }

  const byMonth = {
    1: items.filter((i) => i.month === 1),
    2: items.filter((i) => i.month === 2),
    3: items.filter((i) => i.month === 3),
  };
  const credited = items.filter(
    (i) => i.status === "credited" || i.pathMode === "skip",
  ).length;
  const now = Date.now();
  const overdueCount = items.filter(
    (item) =>
      item.deadlineAt &&
      new Date(item.deadlineAt).getTime() < now &&
      !statusIsDone(item.status) &&
      item.pathMode !== "skip",
  ).length;
  const progressPercent =
    items.length === 0 ? 0 : Math.round((credited / items.length) * 100);

  return {
    program,
    items,
    byMonth,
    progressPercent,
    counts: {
      total: items.length,
      credited,
      submitted: items.filter((i) => i.status === "submitted").length,
      returned: items.filter((i) => i.status === "returned").length,
      overdue: overdueCount,
    },
  };
}

export async function listLearningProgramsAdmin(limit = 80) {
  await ready();
  const programs = await db
    .select({
      program: employeeLearningPrograms,
      employeeName: employees.name,
      roleTitle: employees.roleTitle,
      department: employees.department,
      currentLevel: employees.currentLevel,
      status: employees.status,
    })
    .from(employeeLearningPrograms)
    .innerJoin(
      employees,
      eq(employeeLearningPrograms.employeeId, employees.id),
    )
    .where(eq(employeeLearningPrograms.status, "active"))
    .orderBy(desc(employeeLearningPrograms.generatedAt))
    .limit(limit);

  const ids = programs.map((p) => p.program.id);
  if (ids.length === 0) return [];

  const items = await db
    .select()
    .from(employeeProgramItems)
    .where(inArray(employeeProgramItems.programId, ids));

  const progress = await db
    .select()
    .from(lessonProgress)
    .where(
      inArray(
        lessonProgress.employeeId,
        programs.map((p) => p.program.employeeId),
      ),
    );

  return programs.map((row) => {
    const programItems = items.filter((i) => i.programId === row.program.id);
    const lessonIds = new Set(programItems.map((i) => i.lessonId));
    const done = progress.filter(
      (p) =>
        p.employeeId === row.program.employeeId &&
        lessonIds.has(p.lessonId) &&
        (p.status === "credited" || !p.status),
    ).length;
    const total = programItems.length || 1;
    return {
      programId: row.program.id,
      employeeId: row.program.employeeId,
      employeeName: row.employeeName,
      roleTitle: row.roleTitle,
      department: row.department,
      currentLevel: row.currentLevel,
      hrStatus: row.status,
      targetLevel: row.program.targetLevel,
      startsAt: row.program.startsAt,
      generatedAt: row.program.generatedAt,
      totalItems: programItems.length,
      creditedItems: done,
      progressPercent: Math.round((done / total) * 100),
    };
  });
}

export async function upsertLessonWorkflow(input: {
  employeeId: number;
  lessonId: number;
  status: LessonWorkflowStatus;
  answerText?: string;
  answerFileUrl?: string;
  mentorComment?: string;
  reviewedByUserId?: number | null;
  deadlineAt?: string | null;
}) {
  await ready();
  if (!isLessonWorkflowStatus(input.status)) {
    throw new Error("Некорректный статус урока");
  }
  const now = new Date().toISOString();
  const [existing] = await db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.employeeId, input.employeeId),
        eq(lessonProgress.lessonId, input.lessonId),
      ),
    )
    .limit(1);

  const patch = {
    status: input.status,
    answerText:
      input.answerText !== undefined
        ? input.answerText
        : existing?.answerText ?? "",
    answerFileUrl:
      input.answerFileUrl !== undefined
        ? input.answerFileUrl
        : existing?.answerFileUrl ?? "",
    mentorComment:
      input.mentorComment !== undefined
        ? input.mentorComment
        : existing?.mentorComment ?? "",
    deadlineAt:
      input.deadlineAt !== undefined
        ? input.deadlineAt
        : existing?.deadlineAt ?? null,
    submittedAt:
      input.status === "submitted"
        ? now
        : existing?.submittedAt ?? null,
    reviewedAt: ["returned", "accepted", "credited", "recheck"].includes(
      input.status,
    )
      ? now
      : existing?.reviewedAt ?? null,
    reviewedByUserId:
      input.reviewedByUserId !== undefined
        ? input.reviewedByUserId
        : existing?.reviewedByUserId ?? null,
    completedAt:
      input.status === "credited" || input.status === "accepted"
        ? now
        : existing?.completedAt ?? now,
  };

  if (!existing && patch.deadlineAt == null) {
    const { getSettingsSection } = await import("./system-settings");
    const learning = await getSettingsSection("learning");
    const days = Math.max(1, learning.deadlineDays || 1);
    patch.deadlineAt = new Date(
      Date.now() + days * 24 * 60 * 60 * 1000,
    ).toISOString();
  }

  if (existing) {
    const [row] = await db
      .update(lessonProgress)
      .set(patch)
      .where(eq(lessonProgress.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(lessonProgress)
    .values({
      employeeId: input.employeeId,
      lessonId: input.lessonId,
      ...patch,
    })
    .returning();
  return row;
}

export async function getLessonWorkflow(
  employeeId: number,
  lessonId: number,
) {
  await ready();
  const [row] = await db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.employeeId, employeeId),
        eq(lessonProgress.lessonId, lessonId),
      ),
    )
    .limit(1);
  return row ?? null;
}

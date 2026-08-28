import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "./index";
import {
  employees,
  internContentAssignments,
  internMentorships,
  internStandardItems,
  learningLessons,
  learningTests,
  notifications,
  platformUsers,
  results,
  assessments,
  competencies,
} from "./schema";
import { managerOwnsDepartment } from "@/lib/attestation";
import type { EmployeeAccountType } from "@/lib/auth-core";
import {
  addDaysIso,
  defaultFiveDayTrialWindow,
  isTrialDecision,
  type TrialDecision,
} from "@/lib/trial-period";

async function ready() {
  const { ensureDb } = await import("./queries");
  await ensureDb();
}

export type MentorshipStatus =
  | "active"
  | "extended"
  | "hired"
  | "ended"
  | "other_role";

export function addMonthsIso(iso: string, months: number) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setMonth(fallback.getMonth() + months);
    return fallback.toISOString();
  }
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

export { addDaysIso };

export function defaultTrialWindow(startsAt?: string | null) {
  return defaultFiveDayTrialWindow(startsAt);
}

export async function createNotification(input: {
  userId: number;
  type: string;
  title: string;
  body?: string;
  href?: string | null;
  payload?: Record<string, unknown>;
}) {
  await ready();
  const { notificationEnabled } = await import("./system-settings");
  if (!(await notificationEnabled(input.type))) return null;
  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? "",
      href: input.href ?? null,
      payloadJson: JSON.stringify(input.payload ?? {}),
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

export async function listNotificationsForUser(userId: number, limit = 30) {
  await ready();
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function countUnreadNotifications(userId: number) {
  await ready();
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), isNull(notifications.readAt)),
    );
  return rows.length;
}

export async function markNotificationRead(notificationId: number, userId: number) {
  await ready();
  await db
    .update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
      ),
    );
}

export async function markAllNotificationsRead(userId: number) {
  await ready();
  await db
    .update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(
      and(eq(notifications.userId, userId), isNull(notifications.readAt)),
    );
}

export async function findDepartmentManagers(department: string) {
  await ready();
  if (!department.trim()) return [];
  const managers = await db
    .select()
    .from(platformUsers)
    .where(
      and(eq(platformUsers.role, "manager"), eq(platformUsers.isActive, true)),
    );

  const exact = managers.filter(
    (m) =>
      m.profileDepartment &&
      m.profileDepartment.trim().toLowerCase() === department.trim().toLowerCase(),
  );
  if (exact.length === 1) return exact;
  if (exact.length > 1) return exact;

  return managers.filter(
    (m) =>
      m.profileDepartment &&
      managerOwnsDepartment(m.profileDepartment, department),
  );
}

/**
 * A manager may work with an intern either as the assigned mentor or as head of
 * the intern's department, so daily reports never get stuck without a reviewer.
 */
export async function managerCanReviewIntern(
  managerUserId: number,
  internEmployeeId: number,
) {
  await ready();
  const mentorship = await getActiveMentorship(internEmployeeId);
  if (mentorship?.mentorUserId === managerUserId) return true;

  const [manager] = await db
    .select()
    .from(platformUsers)
    .where(
      and(
        eq(platformUsers.id, managerUserId),
        eq(platformUsers.role, "manager"),
        eq(platformUsers.isActive, true),
      ),
    )
    .limit(1);
  if (!manager?.profileDepartment) return false;

  const [intern] = await db
    .select({ department: employees.department })
    .from(employees)
    .where(eq(employees.id, internEmployeeId))
    .limit(1);
  if (!intern) return false;

  return managerOwnsDepartment(manager.profileDepartment, intern.department);
}

export async function getActiveMentorship(internEmployeeId: number) {
  await ready();
  const [row] = await db
    .select()
    .from(internMentorships)
    .where(
      and(
        eq(internMentorships.internEmployeeId, internEmployeeId),
        inArray(internMentorships.status, ["active", "extended"]),
      ),
    )
    .orderBy(desc(internMentorships.updatedAt))
    .limit(1);
  return row ?? null;
}

export async function ensureInternMentorship(input: {
  internEmployeeId: number;
  source?: "auto" | "admin_override";
  mentorUserId?: number | null;
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
  sourceCandidateId?: number | null;
  entranceSnapshot?: Record<string, unknown> | null;
  notify?: boolean;
}) {
  await ready();
  const [intern] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, input.internEmployeeId))
    .limit(1);
  if (!intern) return null;

  const existing = await getActiveMentorship(intern.id);
  const window = defaultTrialWindow(
    input.trialStartsAt || intern.hiredAt || intern.createdAt,
  );
  const trialStartsAt = input.trialStartsAt || window.trialStartsAt;
  const trialEndsAt =
    input.trialEndsAt || existing?.trialEndsAt || window.trialEndsAt;

  let mentorUserId =
    input.mentorUserId === undefined
      ? existing?.mentorUserId ?? null
      : input.mentorUserId;

  if (input.mentorUserId === undefined && mentorUserId == null) {
    const candidates = await findDepartmentManagers(intern.department);
    mentorUserId = candidates.length === 1 ? candidates[0].id : null;
  }

  const source = input.source ?? existing?.source ?? "auto";
  const now = new Date().toISOString();
  const entranceSnapshotJson =
    input.entranceSnapshot != null
      ? JSON.stringify(input.entranceSnapshot)
      : existing?.entranceSnapshotJson || "{}";
  const sourceCandidateId =
    input.sourceCandidateId === undefined
      ? existing?.sourceCandidateId ?? null
      : input.sourceCandidateId;

  if (existing) {
    const [updated] = await db
      .update(internMentorships)
      .set({
        mentorUserId,
        department: intern.department,
        source,
        sourceCandidateId,
        entranceSnapshotJson,
        trialStartsAt,
        trialEndsAt,
        status: existing.status === "extended" ? "extended" : "active",
        updatedAt: now,
      })
      .where(eq(internMentorships.id, existing.id))
      .returning();

    if (
      input.notify !== false &&
      mentorUserId &&
      mentorUserId !== existing.mentorUserId
    ) {
      await notifyMentorOfIntern({
        mentorUserId,
        intern,
        trialStartsAt,
        trialEndsAt,
      });
    }
    return updated ?? existing;
  }

  const [created] = await db
    .insert(internMentorships)
    .values({
      internEmployeeId: intern.id,
      mentorUserId,
      department: intern.department,
      source,
      sourceCandidateId,
      entranceSnapshotJson,
      trialStartsAt,
      trialEndsAt,
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (input.notify !== false && mentorUserId) {
    await notifyMentorOfIntern({
      mentorUserId,
      intern,
      trialStartsAt,
      trialEndsAt,
    });
  }

  return created ?? null;
}

async function notifyMentorOfIntern(input: {
  mentorUserId: number;
  intern: { id: number; name: string; roleTitle: string; department: string };
  trialStartsAt: string;
  trialEndsAt: string;
}) {
  const start = new Date(input.trialStartsAt).toLocaleDateString("ru-RU");
  const end = new Date(input.trialEndsAt).toLocaleDateString("ru-RU");
  await createNotification({
    userId: input.mentorUserId,
    type: "intern_assigned",
    title: "Новый стажёр в вашем отделе",
    body: `${input.intern.name} · ${input.intern.roleTitle}. Старт ${start}, испытательный срок до ${end}.`,
    href: `/observer/mentees/${input.intern.id}`,
    payload: { internEmployeeId: input.intern.id },
  });
}

export async function listMenteesForMentor(mentorUserId: number) {
  await ready();
  const rows = await db
    .select({
      mentorship: internMentorships,
      intern: employees,
    })
    .from(internMentorships)
    .innerJoin(
      employees,
      eq(internMentorships.internEmployeeId, employees.id),
    )
    .where(inArray(internMentorships.status, ["active", "extended"]))
    .orderBy(asc(employees.name));

  const [manager] = await db
    .select()
    .from(platformUsers)
    .where(eq(platformUsers.id, mentorUserId))
    .limit(1);
  const managerDept = manager?.profileDepartment ?? "";

  return rows.filter(
    (row) =>
      row.mentorship.mentorUserId === mentorUserId ||
      (managerDept
        ? managerOwnsDepartment(managerDept, row.intern.department)
        : false),
  );
}

export async function getMenteeDetail(mentorUserId: number, internEmployeeId: number) {
  await ready();
  const [row] = await db
    .select({
      mentorship: internMentorships,
      intern: employees,
    })
    .from(internMentorships)
    .innerJoin(
      employees,
      eq(internMentorships.internEmployeeId, employees.id),
    )
    .where(
      and(
        eq(internMentorships.internEmployeeId, internEmployeeId),
        inArray(internMentorships.status, ["active", "extended"]),
      ),
    )
    .limit(1);
  if (!row) return null;
  if (!(await managerCanReviewIntern(mentorUserId, internEmployeeId))) {
    return null;
  }

  const employeeResults = await db
    .select({
      id: results.id,
      score: results.score,
      levelCode: results.levelCode,
      completedAt: results.completedAt,
      assessmentTitle: assessments.title,
      competencyName: competencies.name,
      profileJson: results.profileJson,
    })
    .from(results)
    .innerJoin(assessments, eq(results.assessmentId, assessments.id))
    .innerJoin(competencies, eq(assessments.competencyId, competencies.id))
    .where(eq(results.employeeId, internEmployeeId))
    .orderBy(desc(results.completedAt))
    .limit(20);

  const assignments = await listInternContentAssignments(internEmployeeId);
  return { ...row, employeeResults, assignments };
}

export async function listActiveManagers() {
  await ready();
  return db
    .select({
      id: platformUsers.id,
      displayName: platformUsers.displayName,
      profileDepartment: platformUsers.profileDepartment,
      profileJobTitle: platformUsers.profileJobTitle,
      login: platformUsers.login,
    })
    .from(platformUsers)
    .where(
      and(eq(platformUsers.role, "manager"), eq(platformUsers.isActive, true)),
    )
    .orderBy(asc(platformUsers.displayName));
}

/** Lesson/test IDs visible to an active intern. */
export async function getInternAllowedContentIds(employeeId: number) {
  await ready();
  const standard = await db.select().from(internStandardItems);
  const personal = await db
    .select()
    .from(internContentAssignments)
    .where(eq(internContentAssignments.internEmployeeId, employeeId));

  const lessonIds = new Set<number>();
  const testIds = new Set<number>();

  for (const item of standard) {
    if (item.itemType === "lesson" && item.lessonId) lessonIds.add(item.lessonId);
    if (item.itemType === "test" && item.testId) testIds.add(item.testId);
  }
  for (const item of personal) {
    if (item.itemType === "lesson" && item.lessonId) lessonIds.add(item.lessonId);
    if (item.itemType === "test" && item.testId) testIds.add(item.testId);
  }

  // Tests linked to allowed lessons are also allowed once lesson is in set.
  if (lessonIds.size > 0) {
    const linked = await db
      .select({ id: learningTests.id, lessonId: learningTests.lessonId })
      .from(learningTests)
      .where(eq(learningTests.isActive, true));
    for (const t of linked) {
      if (lessonIds.has(t.lessonId)) testIds.add(t.id);
    }
  }

  return { lessonIds, testIds };
}

export async function listInternStandardItems() {
  await ready();
  const rows = await db
    .select()
    .from(internStandardItems)
    .orderBy(asc(internStandardItems.sortOrder), asc(internStandardItems.id));

  const lessonIds = rows
    .map((r) => r.lessonId)
    .filter((id): id is number => id != null);
  const testIds = rows
    .map((r) => r.testId)
    .filter((id): id is number => id != null);

  const lessons =
    lessonIds.length > 0
      ? await db
          .select()
          .from(learningLessons)
          .where(inArray(learningLessons.id, lessonIds))
      : [];
  const tests =
    testIds.length > 0
      ? await db
          .select()
          .from(learningTests)
          .where(inArray(learningTests.id, testIds))
      : [];

  const lessonMap = new Map(lessons.map((l) => [l.id, l]));
  const testMap = new Map(tests.map((t) => [t.id, t]));

  return rows.map((row) => ({
    ...row,
    lesson: row.lessonId ? lessonMap.get(row.lessonId) ?? null : null,
    test: row.testId ? testMap.get(row.testId) ?? null : null,
  }));
}

export async function addInternStandardItem(input: {
  itemType: "lesson" | "test";
  lessonId?: number | null;
  testId?: number | null;
}) {
  await ready();
  if (input.itemType === "lesson" && !input.lessonId) {
    throw new Error("Не указан урок");
  }
  if (input.itemType === "test" && !input.testId) {
    throw new Error("Не указан тест");
  }

  const existing = await db
    .select()
    .from(internStandardItems)
    .where(
      input.itemType === "lesson"
        ? and(
            eq(internStandardItems.itemType, "lesson"),
            eq(internStandardItems.lessonId, input.lessonId!),
          )
        : and(
            eq(internStandardItems.itemType, "test"),
            eq(internStandardItems.testId, input.testId!),
          ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const [row] = await db
    .insert(internStandardItems)
    .values({
      itemType: input.itemType,
      lessonId: input.itemType === "lesson" ? input.lessonId! : null,
      testId: input.itemType === "test" ? input.testId! : null,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

export async function removeInternStandardItem(id: number) {
  await ready();
  await db.delete(internStandardItems).where(eq(internStandardItems.id, id));
}

export async function listInternContentAssignments(internEmployeeId: number) {
  await ready();
  const rows = await db
    .select()
    .from(internContentAssignments)
    .where(eq(internContentAssignments.internEmployeeId, internEmployeeId))
    .orderBy(desc(internContentAssignments.assignedAt));

  const lessonIds = rows
    .map((r) => r.lessonId)
    .filter((id): id is number => id != null);
  const testIds = rows
    .map((r) => r.testId)
    .filter((id): id is number => id != null);

  const lessons =
    lessonIds.length > 0
      ? await db
          .select()
          .from(learningLessons)
          .where(inArray(learningLessons.id, lessonIds))
      : [];
  const tests =
    testIds.length > 0
      ? await db
          .select()
          .from(learningTests)
          .where(inArray(learningTests.id, testIds))
      : [];

  const lessonMap = new Map(lessons.map((l) => [l.id, l]));
  const testMap = new Map(tests.map((t) => [t.id, t]));

  return rows.map((row) => ({
    ...row,
    lesson: row.lessonId ? lessonMap.get(row.lessonId) ?? null : null,
    test: row.testId ? testMap.get(row.testId) ?? null : null,
  }));
}

export async function assignInternContent(input: {
  internEmployeeId: number;
  assignedByUserId: number;
  source: "mentor" | "admin";
  itemType: "lesson" | "test";
  lessonId?: number | null;
  testId?: number | null;
}) {
  await ready();
  if (input.itemType === "lesson" && !input.lessonId) {
    throw new Error("Не указан урок");
  }
  if (input.itemType === "test" && !input.testId) {
    throw new Error("Не указан тест");
  }

  const existing = await db
    .select()
    .from(internContentAssignments)
    .where(
      and(
        eq(internContentAssignments.internEmployeeId, input.internEmployeeId),
        input.itemType === "lesson"
          ? and(
              eq(internContentAssignments.itemType, "lesson"),
              eq(internContentAssignments.lessonId, input.lessonId!),
            )
          : and(
              eq(internContentAssignments.itemType, "test"),
              eq(internContentAssignments.testId, input.testId!),
            ),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const [row] = await db
    .insert(internContentAssignments)
    .values({
      internEmployeeId: input.internEmployeeId,
      itemType: input.itemType,
      lessonId: input.itemType === "lesson" ? input.lessonId! : null,
      testId: input.itemType === "test" ? input.testId! : null,
      assignedByUserId: input.assignedByUserId,
      source: input.source,
      assignedAt: new Date().toISOString(),
    })
    .returning();

  void (async () => {
    try {
      const { maybeCreateBitrixLearningTask } = await import("./integrations");
      await maybeCreateBitrixLearningTask({
        title: `AKELA: ${input.itemType === "lesson" ? "урок" : "тест"} #${
          input.lessonId ?? input.testId
        }`,
        description: `Назначено стажёру ${input.internEmployeeId}`,
      });
    } catch {
      /* journal */
    }
  })();

  return row;
}

export async function unassignInternContent(assignmentId: number) {
  await ready();
  await db
    .delete(internContentAssignments)
    .where(eq(internContentAssignments.id, assignmentId));
}

export async function decideMentorship(input: {
  mentorshipId: number;
  actorUserId: number;
  decision: TrialDecision;
  trialEndsAt?: string | null;
  comment?: string;
  /** When hiring into a staffing position */
  positionId?: number | null;
  /** Day to repeat when decision is repeat_day */
  repeatDay?: number | null;
}) {
  await ready();
  if (!isTrialDecision(input.decision)) {
    throw new Error("Некорректное решение");
  }
  const [mentorship] = await db
    .select()
    .from(internMentorships)
    .where(eq(internMentorships.id, input.mentorshipId))
    .limit(1);
  if (!mentorship) throw new Error("Стажировка не найдена");
  if (!["active", "extended"].includes(mentorship.status)) {
    throw new Error("Стажировка уже завершена");
  }

  const now = new Date().toISOString();

  if (input.decision === "repeat_day") {
    const day = Math.max(1, Math.min(5, Number(input.repeatDay) || 1));
    const note = [
      `Повторить день ${day}`,
      input.comment?.trim() || "",
    ]
      .filter(Boolean)
      .join(". ");
    const [updated] = await db
      .update(internMentorships)
      .set({
        status: "active",
        trialEndsAt: addDaysIso(mentorship.trialEndsAt, 1),
        decisionComment: note,
        decidedByUserId: input.actorUserId,
        decidedAt: now,
        updatedAt: now,
      })
      .where(eq(internMentorships.id, mentorship.id))
      .returning();
    return updated;
  }

  if (input.decision === "extended") {
    if (!input.trialEndsAt) throw new Error("Укажите новую дату окончания");
    const [updated] = await db
      .update(internMentorships)
      .set({
        status: "extended",
        trialEndsAt: input.trialEndsAt,
        decisionComment: input.comment?.trim() || null,
        decidedByUserId: input.actorUserId,
        decidedAt: now,
        updatedAt: now,
      })
      .where(eq(internMentorships.id, mentorship.id))
      .returning();
    return updated;
  }

  if (input.decision === "other_role") {
    const [updated] = await db
      .update(internMentorships)
      .set({
        status: "other_role",
        decisionComment: input.comment?.trim() || "Предложить другую должность",
        decidedByUserId: input.actorUserId,
        decidedAt: now,
        updatedAt: now,
      })
      .where(eq(internMentorships.id, mentorship.id))
      .returning();
    return updated;
  }

  if (input.decision === "hired") {
    if (input.positionId) {
      const { hireInternIntoPosition } = await import("./queries");
      await hireInternIntoPosition(mentorship.internEmployeeId, input.positionId);
    } else {
      const { setEmployeeAccountType } = await import("./queries");
      await setEmployeeAccountType(
        mentorship.internEmployeeId,
        "employee" as EmployeeAccountType,
      );
      // Strip intern prefix from title if present
      const [person] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, mentorship.internEmployeeId))
        .limit(1);
      if (person && /стаж|intern/i.test(person.roleTitle)) {
        const cleaned = person.roleTitle
          .replace(/^стаж[её]р\s*[·•\-:]?\s*/i, "")
          .replace(/^intern\s*[·•\-:]?\s*/i, "")
          .trim();
        if (cleaned && cleaned !== person.roleTitle) {
          await db
            .update(employees)
            .set({ roleTitle: cleaned })
            .where(eq(employees.id, person.id));
        }
      }
    }

    const [updated] = await db
      .update(internMentorships)
      .set({
        status: "hired",
        decisionComment: input.comment?.trim() || null,
        decidedByUserId: input.actorUserId,
        decidedAt: now,
        updatedAt: now,
      })
      .where(eq(internMentorships.id, mentorship.id))
      .returning();
    return updated;
  }

  // ended — deactivate portal access
  await db
    .update(platformUsers)
    .set({ isActive: false })
    .where(eq(platformUsers.employeeId, mentorship.internEmployeeId));

  const [updated] = await db
    .update(internMentorships)
    .set({
      status: "ended",
      decisionComment: input.comment?.trim() || null,
      decidedByUserId: input.actorUserId,
      decidedAt: now,
      updatedAt: now,
    })
    .where(eq(internMentorships.id, mentorship.id))
    .returning();
  return updated;
}

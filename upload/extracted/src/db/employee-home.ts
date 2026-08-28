import "server-only";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "./index";
import {
  assignments,
  assessments,
  employees,
  learningLessons,
  lessonProgress,
  mentorRatings,
  platformUsers,
  results,
} from "./schema";
import { statusIsDone } from "@/lib/learning-program";
import type { MessageKey } from "@/lib/i18n";

export type EmployeeHomeAction = {
  id: string;
  titleKey: MessageKey;
  href: string;
  count?: number;
  detail?: string;
};

export type EmployeeHomeDashboard = {
  person: {
    name: string;
    roleTitle: string;
    department: string;
    currentLevel: string;
    targetLevel: string;
  };
  kpis: {
    progressPercent: number;
    lessonsLeft: number;
    overdueCount: number;
    openAttestations: number;
    pendingTests: number;
    latestScore: number | null;
  };
  tasks: EmployeeHomeAction[];
  warnings: EmployeeHomeAction[];
  nextLesson: { lessonId: number; title: string; status: string } | null;
  nextAttestation: {
    title: string;
    windowStatus: "upcoming" | "open" | "closed";
    when: string | null;
  } | null;
};

async function ready() {
  const { ensureDb } = await import("./queries");
  await ensureDb();
}

function daysSince(iso: string | null | undefined) {
  if (!iso) return 0;
  const start = new Date(iso).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000));
}

export async function getEmployeeHomeDashboard(
  employeeId: number,
): Promise<EmployeeHomeDashboard | null> {
  await ready();
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  if (!employee) return null;

  const { getEmployeeLearningProgram } = await import("./learning-programs");
  const { listAttestationsForEmployee } = await import("./learning");
  const { getLatestPromotionForEmployee } = await import("./promotions");

  const [program, attestations, pendingTests, latestResult, promotion] =
    await Promise.all([
      getEmployeeLearningProgram(employeeId),
      listAttestationsForEmployee({
        department: employee.department,
        roleTitle: employee.roleTitle,
        employeeId,
      }),
      db
        .select({
          id: assignments.id,
          title: assessments.title,
          dueAt: assignments.dueAt,
        })
        .from(assignments)
        .innerJoin(assessments, eq(assignments.assessmentId, assessments.id))
        .where(
          and(
            eq(assignments.employeeId, employeeId),
            eq(assignments.status, "pending"),
            ne(assessments.source, "attestation"),
          ),
        )
        .orderBy(desc(assignments.assignedAt))
        .limit(5),
      db
        .select({ score: results.score, completedAt: results.completedAt })
        .from(results)
        .where(eq(results.employeeId, employeeId))
        .orderBy(desc(results.completedAt))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      getLatestPromotionForEmployee(employeeId),
    ]);

  const items = program?.items ?? [];
  const now = Date.now();
  const overdue = items.filter(
    (item) =>
      item.deadlineAt &&
      new Date(item.deadlineAt).getTime() < now &&
      !statusIsDone(item.status) &&
      item.pathMode !== "skip",
  );
  const returned = items.filter((item) => item.status === "returned");
  const nextLesson =
    items.find(
      (item) =>
        !item.blockedByOverdue &&
        item.pathMode !== "skip" &&
        !statusIsDone(item.status),
    ) ?? null;
  const lessonsLeft = items.filter(
    (item) => item.pathMode !== "skip" && !statusIsDone(item.status),
  ).length;
  const progressPercent = program?.progressPercent ?? 0;

  const openAttestations = attestations.filter((row) => row.canStart);
  const upcomingAttestations = attestations.filter(
    (row) => row.windowStatus === "upcoming",
  );
  const nextAttestation = openAttestations[0] ?? upcomingAttestations[0] ?? null;
  const attestDueSoon = attestations.filter((row) => {
    if (row.windowStatus === "closed" || row.result) return false;
    const end = new Date(row.endsAt || row.startsAt).getTime();
    if (!Number.isFinite(end)) return false;
    const days = (end - now) / 86_400_000;
    return days >= 0 && days <= 7;
  });

  const tenureDays = daysSince(employee.hiredAt);
  const behind =
    items.length > 0 &&
    ((tenureDays >= 90 && progressPercent < 50) ||
      (tenureDays >= 45 && progressPercent < 20));

  const tasks: EmployeeHomeAction[] = [];
  if (returned[0]) {
    tasks.push({
      id: "fix",
      titleKey: "eh_task_fix",
      href: `/my/learning/${returned[0].lessonId}`,
      detail: returned[0].title,
    });
  }
  if (overdue[0] && overdue[0].lessonId !== returned[0]?.lessonId) {
    tasks.push({
      id: "overdue",
      titleKey: "eh_task_overdue",
      href: `/my/learning/${overdue[0].lessonId}`,
      count: overdue.length,
      detail: overdue[0].title,
    });
  }
  if (
    nextLesson &&
    nextLesson.lessonId !== returned[0]?.lessonId &&
    nextLesson.lessonId !== overdue[0]?.lessonId
  ) {
    tasks.push({
      id: "continue",
      titleKey: "eh_task_continue",
      href: `/my/learning/${nextLesson.lessonId}`,
      detail: nextLesson.title,
    });
  }
  if (openAttestations[0]) {
    tasks.push({
      id: "attest",
      titleKey: "eh_task_attestation",
      href: "/my/attestation",
      count: openAttestations.length,
      detail: openAttestations[0].title,
    });
  }
  if (pendingTests[0]) {
    tasks.push({
      id: "test",
      titleKey: "eh_task_test",
      href: `/my/take/${pendingTests[0].id}`,
      count: pendingTests.length,
      detail: pendingTests[0].title,
    });
  }
  if (promotion?.status === "pending") {
    tasks.push({
      id: "promo",
      titleKey: "eh_task_promotion",
      href: "/my/statistics",
    });
  }
  if (tasks.length === 0 && items.length === 0) {
    tasks.push({
      id: "start-learn",
      titleKey: "eh_task_continue",
      href: "/my/learning",
    });
  }

  const warnings: EmployeeHomeAction[] = [];
  if (overdue.length > 0) {
    warnings.push({
      id: "warn-overdue",
      titleKey: "eh_warn_overdue",
      href: "/my/learning",
      count: overdue.length,
    });
  }
  if (returned.length > 0) {
    warnings.push({
      id: "warn-returned",
      titleKey: "eh_warn_returned",
      href: "/my/learning",
      count: returned.length,
    });
  }
  if (attestDueSoon.length > 0) {
    warnings.push({
      id: "warn-attest",
      titleKey: "eh_warn_attest_due",
      href: "/my/attestation",
      count: attestDueSoon.length,
    });
  }
  if (behind) {
    warnings.push({
      id: "warn-behind",
      titleKey: "eh_warn_behind",
      href: "/my/learning",
    });
  }

  return {
    person: {
      name: employee.name,
      roleTitle: employee.roleTitle,
      department: employee.department,
      currentLevel: employee.currentLevel || "junior",
      targetLevel: employee.targetLevel || "middle",
    },
    kpis: {
      progressPercent,
      lessonsLeft,
      overdueCount: overdue.length,
      openAttestations: openAttestations.length,
      pendingTests: pendingTests.length,
      latestScore: latestResult?.score ?? null,
    },
    tasks,
    warnings,
    nextLesson: nextLesson
      ? {
          lessonId: nextLesson.lessonId,
          title: nextLesson.title,
          status: nextLesson.status,
        }
      : null,
    nextAttestation: nextAttestation
      ? {
          title: nextAttestation.title,
          windowStatus: nextAttestation.windowStatus,
          when:
            nextAttestation.windowStatus === "open"
              ? nextAttestation.endsAt
              : nextAttestation.startsAt,
        }
      : null,
  };
}

export type EmployeeStartData = {
  person: {
    name: string;
    roleTitle: string;
    department: string;
    hiredAt: string | null;
    login: string;
  };
  managerName: string | null;
  mentorName: string | null;
  company: {
    name: string;
    address: string;
    phone: string;
    timezone: string;
    workDays: string;
    workStart: string;
    workEnd: string;
  };
  onboardingCompleted: boolean;
  hasProgram: boolean;
};

export async function getEmployeeStartData(input: {
  employeeId: number;
  login: string;
  onboardingCompleted: boolean;
}): Promise<EmployeeStartData | null> {
  await ready();
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, input.employeeId))
    .limit(1);
  if (!employee) return null;

  const { getPublicCompanySettings } = await import("./system-settings");
  const { getEmployeeLearningProgram } = await import("./learning-programs");

  const [manager, mentor, company, program] = await Promise.all([
    employee.managerEmployeeId
      ? db
          .select({ name: employees.name })
          .from(employees)
          .where(eq(employees.id, employee.managerEmployeeId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    employee.mentorUserId
      ? db
          .select({ displayName: platformUsers.displayName })
          .from(platformUsers)
          .where(eq(platformUsers.id, employee.mentorUserId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    getPublicCompanySettings(),
    getEmployeeLearningProgram(input.employeeId),
  ]);

  return {
    person: {
      name: employee.name,
      roleTitle: employee.roleTitle,
      department: employee.department,
      hiredAt: employee.hiredAt,
      login: input.login,
    },
    managerName: manager?.name ?? null,
    mentorName: mentor?.displayName ?? null,
    company,
    onboardingCompleted: input.onboardingCompleted,
    hasProgram: Boolean(program?.items.length),
  };
}

export type EmployeeTaskPriority = "high" | "medium" | "low";
export type EmployeeTaskKind = "lesson" | "test" | "attestation" | "promotion";

export type EmployeeTaskItem = {
  id: string;
  kind: EmployeeTaskKind;
  title: string;
  href: string;
  statusKey: MessageKey;
  priority: EmployeeTaskPriority;
  dueAt: string | null;
  comment: string | null;
  overdue: boolean;
};

export type EmployeeTasksBoard = {
  items: EmployeeTaskItem[];
  counts: {
    open: number;
    overdue: number;
    review: number;
    urgent: number;
  };
};

function lessonStatusKey(status: string): MessageKey {
  if (status === "studying") return "learn_status_studying";
  if (status === "submitted") return "learn_status_submitted";
  if (status === "returned") return "learn_status_returned";
  if (status === "fixing") return "learn_status_fixing";
  if (status === "recheck") return "learn_status_recheck";
  if (status === "accepted") return "learn_status_accepted";
  return "learn_status_not_started";
}

function isReviewStatus(status: string) {
  return status === "submitted" || status === "recheck";
}

function taskPriority(input: {
  overdue: boolean;
  returned: boolean;
  dueAt: string | null;
  now: number;
}): EmployeeTaskPriority {
  if (input.overdue || input.returned) return "high";
  if (input.dueAt) {
    const due = new Date(input.dueAt).getTime();
    if (Number.isFinite(due) && due - input.now <= 2 * 86_400_000) {
      return "medium";
    }
  }
  return "low";
}

export async function getEmployeeTasksBoard(
  employeeId: number,
): Promise<EmployeeTasksBoard> {
  await ready();
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  if (!employee) {
    return { items: [], counts: { open: 0, overdue: 0, review: 0, urgent: 0 } };
  }

  const { getEmployeeLearningProgram } = await import("./learning-programs");
  const { listAttestationsForEmployee } = await import("./learning");
  const { getLatestPromotionForEmployee } = await import("./promotions");

  const [program, attestations, pendingTests, promotion] = await Promise.all([
    getEmployeeLearningProgram(employeeId),
    listAttestationsForEmployee({
      department: employee.department,
      roleTitle: employee.roleTitle,
      employeeId,
    }),
    db
      .select({
        id: assignments.id,
        title: assessments.title,
        dueAt: assignments.dueAt,
      })
      .from(assignments)
      .innerJoin(assessments, eq(assignments.assessmentId, assessments.id))
      .where(
        and(
          eq(assignments.employeeId, employeeId),
          eq(assignments.status, "pending"),
          ne(assessments.source, "attestation"),
        ),
      )
      .orderBy(desc(assignments.assignedAt)),
    getLatestPromotionForEmployee(employeeId),
  ]);

  const now = Date.now();
  const items: EmployeeTaskItem[] = [];
  const programItems = program?.items ?? [];
  const nextLesson =
    programItems.find(
      (item) =>
        !item.blockedByOverdue &&
        item.pathMode !== "skip" &&
        !statusIsDone(item.status),
    ) ?? null;

  for (const item of programItems) {
    if (item.pathMode === "skip" || statusIsDone(item.status)) continue;
    const overdue = Boolean(
      item.deadlineAt &&
        new Date(item.deadlineAt).getTime() < now &&
        !statusIsDone(item.status),
    );
    const returned = item.status === "returned" || item.status === "fixing";
    const active =
      overdue ||
      returned ||
      item.status === "studying" ||
      isReviewStatus(item.status) ||
      nextLesson?.lessonId === item.lessonId;
    if (!active) continue;
    items.push({
      id: `lesson-${item.lessonId}`,
      kind: "lesson",
      title: item.title,
      href: `/my/learning/${item.lessonId}`,
      statusKey: overdue ? "eh_learn_overdue" : lessonStatusKey(item.status),
      priority: taskPriority({
        overdue,
        returned,
        dueAt: item.deadlineAt,
        now,
      }),
      dueAt: item.deadlineAt,
      comment: item.mentorComment?.trim() ? item.mentorComment : null,
      overdue,
    });
  }

  for (const test of pendingTests) {
    const overdue = Boolean(
      test.dueAt && new Date(test.dueAt).getTime() < now,
    );
    items.push({
      id: `test-${test.id}`,
      kind: "test",
      title: test.title,
      href: `/my/take/${test.id}`,
      statusKey: overdue ? "eh_learn_overdue" : "eh_task_status_assigned",
      priority: taskPriority({ overdue, returned: false, dueAt: test.dueAt, now }),
      dueAt: test.dueAt,
      comment: null,
      overdue,
    });
  }

  for (const row of attestations.filter((item) => item.canStart)) {
    const dueAt = row.endsAt || row.startsAt || null;
    const overdue = Boolean(dueAt && new Date(dueAt).getTime() < now);
    items.push({
      id: `attest-${row.id}`,
      kind: "attestation",
      title: row.title,
      href: "/my/attestation",
      statusKey: overdue ? "eh_learn_overdue" : "eh_task_status_open_window",
      priority: "medium",
      dueAt,
      comment: null,
      overdue,
    });
  }

  if (promotion?.status === "pending") {
    items.push({
      id: "promo",
      kind: "promotion",
      title: "",
      href: "/my/statistics",
      statusKey: "eh_task_promotion",
      priority: "low",
      dueAt: null,
      comment: null,
      overdue: false,
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.priority !== b.priority) return rank[a.priority] - rank[b.priority];
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue;
  });

  return {
    items,
    counts: {
      open: items.length,
      overdue: items.filter((item) => item.overdue).length,
      review: items.filter(
        (item) =>
          item.statusKey === "learn_status_submitted" ||
          item.statusKey === "learn_status_recheck",
      ).length,
      urgent: items.filter((item) => item.priority === "high").length,
    },
  };
}

export type EmployeeContactCard = {
  name: string;
  roleTitle: string;
  department: string;
  email: string | null;
  phone: string | null;
  telegram: string | null;
  avatarData: string | null;
  avatarHue: number;
  competencies: string[];
};

export type MentorWorkItem = {
  lessonId: number;
  title: string;
  status: string;
  comment: string;
  at: string | null;
  href: string;
};

export type EmployeeMentorPage = {
  mentor: EmployeeContactCard | null;
  manager: EmployeeContactCard | null;
  company: { phone: string; address: string };
  waitingReview: MentorWorkItem[];
  returned: MentorWorkItem[];
  feedback: MentorWorkItem[];
  rating: { mentorUserId: number; currentScore: number | null } | null;
  counts: { review: number; returned: number; comments: number };
};

function parseCompetencies(raw: string | null | undefined) {
  try {
    const value = JSON.parse(raw || "[]") as unknown;
    return Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function toWorkItem(row: {
  lessonId: number;
  title: string;
  status: string;
  comment: string;
  submittedAt: string | null;
  reviewedAt: string | null;
}): MentorWorkItem {
  return {
    lessonId: row.lessonId,
    title: row.title,
    status: row.status,
    comment: row.comment.trim(),
    at: row.reviewedAt || row.submittedAt,
    href: `/my/learning/${row.lessonId}`,
  };
}

export async function getEmployeeMentorPage(
  employeeId: number,
): Promise<EmployeeMentorPage | null> {
  await ready();
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  if (!employee) return null;

  const { getPublicCompanySettings } = await import("./system-settings");
  const [mentorUser, managerEmp, company, progress] = await Promise.all([
    employee.mentorUserId
      ? db
          .select()
          .from(platformUsers)
          .where(eq(platformUsers.id, employee.mentorUserId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    employee.managerEmployeeId
      ? db
          .select()
          .from(employees)
          .where(eq(employees.id, employee.managerEmployeeId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    getPublicCompanySettings(),
    db
      .select({
        lessonId: lessonProgress.lessonId,
        status: lessonProgress.status,
        comment: lessonProgress.mentorComment,
        submittedAt: lessonProgress.submittedAt,
        reviewedAt: lessonProgress.reviewedAt,
        title: learningLessons.title,
      })
      .from(lessonProgress)
      .innerJoin(
        learningLessons,
        eq(lessonProgress.lessonId, learningLessons.id),
      )
      .where(eq(lessonProgress.employeeId, employeeId))
      .orderBy(desc(lessonProgress.reviewedAt), desc(lessonProgress.submittedAt)),
  ]);

  const [mentorStaff, managerUser, ratingRow] = await Promise.all([
    mentorUser?.employeeId
      ? db
          .select()
          .from(employees)
          .where(eq(employees.id, mentorUser.employeeId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    managerEmp
      ? db
          .select({
            avatarData: platformUsers.avatarData,
            avatarHue: platformUsers.avatarHue,
          })
          .from(platformUsers)
          .where(eq(platformUsers.employeeId, managerEmp.id))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    mentorUser
      ? db
          .select({ score: mentorRatings.score })
          .from(mentorRatings)
          .where(
            and(
              eq(mentorRatings.mentorUserId, mentorUser.id),
              eq(mentorRatings.fromEmployeeId, employeeId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  const waitingReview = progress
    .filter((row) => row.status === "submitted" || row.status === "recheck")
    .map(toWorkItem);
  const returned = progress
    .filter((row) => row.status === "returned" || row.status === "fixing")
    .map(toWorkItem);
  const feedback = progress
    .filter(
      (row) =>
        row.comment.trim() &&
        (row.status === "accepted" ||
          row.status === "credited" ||
          row.status === "returned" ||
          row.status === "fixing"),
    )
    .map(toWorkItem);

  return {
    mentor: mentorUser
      ? {
          name: mentorUser.displayName,
          roleTitle:
            mentorStaff?.roleTitle || mentorUser.profileJobTitle || "",
          department:
            mentorStaff?.department || mentorUser.profileDepartment || "",
          email: mentorStaff?.email || null,
          phone: mentorStaff?.phone || null,
          telegram: mentorStaff?.telegram || null,
          avatarData: mentorUser.avatarData ?? null,
          avatarHue: mentorUser.avatarHue ?? mentorStaff?.avatarHue ?? 220,
          competencies: parseCompetencies(mentorUser.mentorCompetenciesJson),
        }
      : null,
    manager: managerEmp
      ? {
          name: managerEmp.name,
          roleTitle: managerEmp.roleTitle,
          department: managerEmp.department,
          email: managerEmp.email || null,
          phone: managerEmp.phone || null,
          telegram: managerEmp.telegram || null,
          avatarData: managerUser?.avatarData ?? null,
          avatarHue: managerUser?.avatarHue ?? managerEmp.avatarHue ?? 160,
          competencies: [],
        }
      : null,
    company: {
      phone: company.phone || "",
      address: company.address || "",
    },
    waitingReview,
    returned,
    feedback,
    rating: mentorUser
      ? {
          mentorUserId: mentorUser.id,
          currentScore: ratingRow?.score ?? null,
        }
      : null,
    counts: {
      review: waitingReview.length,
      returned: returned.length,
      comments: feedback.filter((item) => item.comment).length,
    },
  };
}

function parseJsonList(raw: string | null | undefined) {
  try {
    const value = JSON.parse(raw || "[]") as unknown;
    return Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export type EmployeeAttestationItem = {
  id: number;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  passingScore: number;
  questionCount: number;
  windowStatus: "upcoming" | "open" | "closed";
  canStart: boolean;
  result: { score: number; completedAt: string } | null;
  passed: boolean | null;
};

export type EmployeeAttestationReview = {
  id: number;
  type: string;
  status: string;
  scheduledAt: string;
  finalScore: number | null;
  testScore: number | null;
  decision: string;
  protocolNumber: string | null;
  completedAt: string | null;
  mentorComment: string;
  managerComment: string;
  commissionComment: string;
  weakCompetencies: string[];
  nextCheckAt: string | null;
  attestationTitle: string;
};

export type EmployeeAttestationPage = {
  person: {
    name: string;
    roleTitle: string;
    department: string;
    currentLevel: string;
    targetLevel: string;
  };
  kpis: {
    open: number;
    upcoming: number;
    completed: number;
    passed: number;
    awaitingCommission: number;
  };
  nextOpen: EmployeeAttestationItem | null;
  items: EmployeeAttestationItem[];
  reviews: EmployeeAttestationReview[];
  promotion: {
    fromLevel: string;
    toLevel: string;
    score: number;
    status: "pending" | "approved" | "rejected";
    reviewedAt: string | null;
  } | null;
  recommendations: string[];
};

export async function getEmployeeAttestationPage(
  employeeId: number,
): Promise<EmployeeAttestationPage | null> {
  await ready();
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  if (!employee) return null;

  const { listAttestationsForEmployee } = await import("./learning");
  const { listEmployeeAttestationReviews } = await import(
    "./attestation-reviews"
  );
  const { getLatestPromotionForEmployee } = await import("./promotions");

  const [items, reviewRows, promotion] = await Promise.all([
    listAttestationsForEmployee({
      department: employee.department,
      roleTitle: employee.roleTitle,
      employeeId,
    }),
    listEmployeeAttestationReviews(employeeId),
    getLatestPromotionForEmployee(employeeId),
  ]);

  const reviews: EmployeeAttestationReview[] = reviewRows.map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    scheduledAt: row.scheduledAt,
    finalScore: row.finalScore,
    testScore: row.testScore,
    decision: row.decision,
    protocolNumber: row.protocolNumber,
    completedAt: row.completedAt,
    mentorComment: row.mentorComment,
    managerComment: row.managerComment,
    commissionComment: row.commissionComment,
    weakCompetencies: parseJsonList(row.weakCompetenciesJson),
    nextCheckAt: row.nextCheckAt,
    attestationTitle: row.attestationTitle,
  }));

  const openItems = items.filter(
    (row) => row.windowStatus === "open" && !row.result,
  );
  const upcomingItems = items.filter((row) => row.windowStatus === "upcoming");
  const completedItems = items.filter((row) => row.result != null);
  const passedItems = items.filter((row) => row.passed === true);
  const awaitingCommission = reviews.filter(
    (row) => row.status === "awaiting_commission",
  ).length;

  const nextOpen =
    openItems.find((row) => row.canStart) ??
    openItems[0] ??
    upcomingItems[0] ??
    null;

  const latestCompleted = reviews.find(
    (row) => row.status === "completed" && row.decision,
  );
  const recommendations: string[] = [];
  if (latestCompleted) {
    for (const comment of [
      latestCompleted.commissionComment,
      latestCompleted.managerComment,
      latestCompleted.mentorComment,
    ]) {
      const trimmed = comment.trim();
      if (trimmed && !recommendations.includes(trimmed)) {
        recommendations.push(trimmed);
      }
    }
    for (const weak of latestCompleted.weakCompetencies) {
      if (!recommendations.includes(weak)) recommendations.push(weak);
    }
  }

  return {
    person: {
      name: employee.name,
      roleTitle: employee.roleTitle,
      department: employee.department,
      currentLevel: employee.currentLevel,
      targetLevel: employee.targetLevel || "middle",
    },
    kpis: {
      open: openItems.length,
      upcoming: upcomingItems.length,
      completed: completedItems.length,
      passed: passedItems.length,
      awaitingCommission,
    },
    nextOpen,
    items,
    reviews,
    promotion: promotion
      ? {
          fromLevel: promotion.fromLevel,
          toLevel: promotion.toLevel,
          score: promotion.score,
          status: promotion.status,
          reviewedAt: promotion.reviewedAt,
        }
      : null,
    recommendations,
  };
}

export type EmployeeCalendarKind = "lesson" | "test" | "attestation";

export type EmployeeCalendarEvent = {
  id: string;
  kind: EmployeeCalendarKind;
  title: string;
  href: string;
  at: string;
  until: string | null;
  days: string[];
  overdue: boolean;
  statusKey: MessageKey;
};

export type EmployeeCalendarPage = {
  company: {
    timezone: string;
    workDays: string;
    workStart: string;
    workEnd: string;
  };
  today: string;
  events: EmployeeCalendarEvent[];
  counts: {
    today: number;
    week: number;
    overdue: number;
    attestations: number;
  };
};

function ymdInTimeZone(iso: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function addYmd(ymd: string, days: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function ymdRange(startIso: string, endIso: string | null, timeZone: string) {
  const start = ymdInTimeZone(startIso, timeZone);
  const end = endIso ? ymdInTimeZone(endIso, timeZone) : start;
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end && days.length < 45) {
    days.push(cursor);
    cursor = addYmd(cursor, 1);
  }
  return days.length > 0 ? days : [start];
}

export async function getEmployeeCalendarPage(
  employeeId: number,
): Promise<EmployeeCalendarPage | null> {
  await ready();
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  if (!employee) return null;

  const { getPublicCompanySettings } = await import("./system-settings");
  const { getEmployeeLearningProgram } = await import("./learning-programs");
  const { listAttestationsForEmployee } = await import("./learning");

  const [company, program, attestations, pendingTests] = await Promise.all([
    getPublicCompanySettings(),
    getEmployeeLearningProgram(employeeId),
    listAttestationsForEmployee({
      department: employee.department,
      roleTitle: employee.roleTitle,
      employeeId,
    }),
    db
      .select({
        id: assignments.id,
        title: assessments.title,
        dueAt: assignments.dueAt,
      })
      .from(assignments)
      .innerJoin(assessments, eq(assignments.assessmentId, assessments.id))
      .where(
        and(
          eq(assignments.employeeId, employeeId),
          eq(assignments.status, "pending"),
          ne(assessments.source, "attestation"),
        ),
      )
      .orderBy(desc(assignments.assignedAt)),
  ]);

  const timeZone = company.timezone || "Asia/Tashkent";
  const now = Date.now();
  const today = ymdInTimeZone(new Date().toISOString(), timeZone);
  const weekEnd = addYmd(today, 6);
  const events: EmployeeCalendarEvent[] = [];

  for (const item of program?.items ?? []) {
    if (item.pathMode === "skip" || statusIsDone(item.status) || !item.deadlineAt) {
      continue;
    }
    const at = item.deadlineAt;
    const overdue = new Date(at).getTime() < now;
    events.push({
      id: `lesson-${item.lessonId}`,
      kind: "lesson",
      title: item.title,
      href: `/my/learning/${item.lessonId}`,
      at,
      until: null,
      days: ymdRange(at, null, timeZone),
      overdue,
      statusKey: overdue ? "eh_learn_overdue" : "eh_calendar_status_deadline",
    });
  }

  for (const test of pendingTests) {
    if (!test.dueAt) continue;
    const at = test.dueAt;
    const overdue = new Date(at).getTime() < now;
    events.push({
      id: `test-${test.id}`,
      kind: "test",
      title: test.title,
      href: `/my/take/${test.id}`,
      at,
      until: null,
      days: ymdRange(at, null, timeZone),
      overdue,
      statusKey: overdue ? "eh_learn_overdue" : "eh_calendar_status_test",
    });
  }

  for (const row of attestations) {
    if (row.result) continue;
    const at = row.startsAt || row.scheduledAt;
    if (!at) continue;
    const until = row.endsAt || null;
    const overdue =
      row.windowStatus === "open" &&
      Boolean(until && new Date(until).getTime() < now);
    events.push({
      id: `attest-${row.id}`,
      kind: "attestation",
      title: row.title,
      href: "/my/attestation",
      at,
      until,
      days: ymdRange(at, until, timeZone),
      overdue,
      statusKey:
        row.windowStatus === "open"
          ? "eh_task_status_open_window"
          : row.windowStatus === "upcoming"
            ? "attest_upcoming"
            : "eh_calendar_status_window",
    });
  }

  events.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return new Date(a.at).getTime() - new Date(b.at).getTime();
  });

  return {
    company: {
      timezone: timeZone,
      workDays: company.workDays || "mon-fri",
      workStart: company.workStart || "09:00",
      workEnd: company.workEnd || "18:00",
    },
    today,
    events,
    counts: {
      today: events.filter((event) => event.days.includes(today)).length,
      week: events.filter((event) =>
        event.days.some((day) => day >= today && day <= weekEnd),
      ).length,
      overdue: events.filter((event) => event.overdue).length,
      attestations: events.filter((event) => event.kind === "attestation").length,
    },
  };
}

export type EmployeeDocsContact = {
  name: string;
  roleTitle: string;
  phone: string | null;
  email: string | null;
  telegram: string | null;
};

export type EmployeeDocsPage = {
  person: {
    roleTitle: string;
    department: string;
  };
  company: {
    name: string;
    address: string;
    phone: string;
    timezone: string;
    workDays: string;
    workStart: string;
    workEnd: string;
  };
  role: {
    description: string;
    duties: string[];
    requirements: string[];
    programs: string[];
    tools: string[];
  } | null;
  manager: EmployeeDocsContact | null;
  mentor: EmployeeDocsContact | null;
  counts: {
    companyDocs: number;
    jobReady: boolean;
    tools: number;
    help: number;
  };
};

function splitDocLines(raw: string) {
  return raw
    .split(/\r?\n|[•·;]+/)
    .map((line) => line.replace(/^[-–—]\s*/, "").trim())
    .filter((line) => line.length > 1);
}

export async function getEmployeeDocsPage(
  employeeId: number,
): Promise<EmployeeDocsPage | null> {
  await ready();
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  if (!employee) return null;

  const { getPublicCompanySettings } = await import("./system-settings");
  const { getRoleProfileBriefForStaff } = await import("./roles-catalog");

  const [company, role, managerEmp, mentorUser] = await Promise.all([
    getPublicCompanySettings(),
    getRoleProfileBriefForStaff({
      department: employee.department,
      roleTitle: employee.roleTitle,
    }),
    employee.managerEmployeeId
      ? db
          .select()
          .from(employees)
          .where(eq(employees.id, employee.managerEmployeeId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    employee.mentorUserId
      ? db
          .select()
          .from(platformUsers)
          .where(eq(platformUsers.id, employee.mentorUserId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  const mentorStaff = mentorUser?.employeeId
    ? await db
        .select()
        .from(employees)
        .where(eq(employees.id, mentorUser.employeeId))
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;

  const duties = role ? splitDocLines(role.duties) : [];
  const requirements = role ? splitDocLines(role.requirements) : [];
  const tools = role ? [...role.programs, ...role.tools] : [];
  const jobReady = Boolean(
    role && (role.description || duties.length || requirements.length || tools.length),
  );

  return {
    person: {
      roleTitle: employee.roleTitle,
      department: employee.department,
    },
    company: {
      name: company.name,
      address: company.address,
      phone: company.phone,
      timezone: company.timezone,
      workDays: company.workDays,
      workStart: company.workStart,
      workEnd: company.workEnd,
    },
    role: role
      ? {
          description: role.description,
          duties,
          requirements,
          programs: role.programs,
          tools: role.tools,
        }
      : null,
    manager: managerEmp
      ? {
          name: managerEmp.name,
          roleTitle: managerEmp.roleTitle,
          phone: managerEmp.phone || null,
          email: managerEmp.email || null,
          telegram: managerEmp.telegram || null,
        }
      : null,
    mentor: mentorUser
      ? {
          name: mentorUser.displayName,
          roleTitle:
            mentorStaff?.roleTitle || mentorUser.profileJobTitle || "",
          phone: mentorStaff?.phone || null,
          email: mentorStaff?.email || null,
          telegram: mentorStaff?.telegram || null,
        }
      : null,
    counts: {
      companyDocs: 4,
      jobReady,
      tools: tools.length,
      help: 4,
    },
  };
}


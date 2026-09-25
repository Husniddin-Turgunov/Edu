import "server-only";
import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "./index";
import {
  assignments,
  assessments,
  attestationReviews,
  attestations,
  employeeCompetencies,
  employeeLearningPrograms,
  employeeProgramItems,
  employees,
  internContentAssignments,
  internDailyReports,
  internMentorships,
  kpiTargets,
  learningLessons,
  lessonProgress,
  levelPromotionRequests,
  managerTasks,
  mentorRatings,
  oneOnOneMeetings,
  platformUsers,
  results,
  trialDecisions,
} from "./schema";
import { managerOwnsDepartment } from "@/lib/attestation";
import { employeeProgressPercent } from "@/lib/employee-profile";
import { statusIsDone } from "@/lib/learning-program";
import type { MessageKey } from "@/lib/i18n";

async function ready() {
  const { ensureDb } = await import("./queries");
  await ensureDb();
}

export type ManagerTeamMember = {
  id: number;
  name: string;
  roleTitle: string;
  department: string;
  status: string;
  currentLevel: string;
  targetLevel: string;
  hiredAt: string | null;
  mentorUserId: number | null;
  mentorName: string | null;
  progressPercent: number;
  kpiPercent: number | null;
  openTasks: number;
  overdueTasks: number;
  isIntern: boolean;
  trialDay: number | null;
  trialTotalDays: number | null;
};

export type ManagerContext = {
  managerUserId: number;
  displayName: string;
  department: string;
  team: ManagerTeamMember[];
  teamIds: number[];
};

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(startIso: string, end = Date.now()) {
  const start = new Date(startIso).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

function trialDayNumber(trialStartsAt: string | null, total = 5) {
  if (!trialStartsAt) return null;
  const day = daysBetween(trialStartsAt) + 1;
  return Math.min(total, Math.max(1, day));
}

async function loadTeamMembers(
  managerUserId: number,
  department: string,
): Promise<ManagerTeamMember[]> {
  const allEmployees = await db
    .select()
    .from(employees)
    .where(ne(employees.status, "left"));
  const team = allEmployees.filter((row) =>
    managerOwnsDepartment(department, row.department),
  );
  if (team.length === 0) return [];

  const teamIds = team.map((row) => row.id);
  const mentorIds = [
    ...new Set(team.map((row) => row.mentorUserId).filter(Boolean)),
  ] as number[];

  const [
    progressRows,
    programRows,
    programItemCounts,
    competencyRows,
    testCounts,
    taskRows,
    kpiRows,
    mentorshipRows,
    mentorUsers,
  ] = await Promise.all([
    db
      .select({
        employeeId: lessonProgress.employeeId,
        status: lessonProgress.status,
        deadlineAt: lessonProgress.deadlineAt,
      })
      .from(lessonProgress)
      .where(inArray(lessonProgress.employeeId, teamIds)),
    db
      .select({
        employeeId: employeeLearningPrograms.employeeId,
        id: employeeLearningPrograms.id,
      })
      .from(employeeLearningPrograms)
      .where(inArray(employeeLearningPrograms.employeeId, teamIds)),
    db
      .select({
        programId: employeeProgramItems.programId,
        lessonId: employeeProgramItems.lessonId,
      })
      .from(employeeProgramItems),
    db
      .select({
        employeeId: employeeCompetencies.employeeId,
        status: employeeCompetencies.status,
      })
      .from(employeeCompetencies)
      .where(inArray(employeeCompetencies.employeeId, teamIds)),
    db
      .select({
        employeeId: assignments.employeeId,
        status: assignments.status,
      })
      .from(assignments)
      .where(inArray(assignments.employeeId, teamIds)),
    db
      .select({
        employeeId: managerTasks.employeeId,
        status: managerTasks.status,
        dueAt: managerTasks.dueAt,
      })
      .from(managerTasks)
      .where(
        and(
          inArray(managerTasks.employeeId, teamIds),
          ne(managerTasks.status, "done"),
        ),
      ),
    db
      .select({
        employeeId: kpiTargets.employeeId,
        planValue: kpiTargets.planValue,
        factValue: kpiTargets.factValue,
      })
      .from(kpiTargets)
      .where(
        and(
          inArray(kpiTargets.employeeId, teamIds),
          eq(kpiTargets.period, currentPeriod()),
        ),
      ),
    db
      .select({
        internEmployeeId: internMentorships.internEmployeeId,
        trialStartsAt: internMentorships.trialStartsAt,
        trialEndsAt: internMentorships.trialEndsAt,
        status: internMentorships.status,
      })
      .from(internMentorships)
      .where(
        and(
          inArray(internMentorships.internEmployeeId, teamIds),
          inArray(internMentorships.status, ["active", "extended"]),
        ),
      ),
    mentorIds.length
      ? db
          .select({ id: platformUsers.id, displayName: platformUsers.displayName })
          .from(platformUsers)
          .where(inArray(platformUsers.id, mentorIds))
      : Promise.resolve([]),
  ]);

  const programByEmployee = new Map(
    programRows.map((row) => [row.employeeId, row.id]),
  );
  const itemsByProgram = new Map<number, number>();
  for (const row of programItemCounts) {
    itemsByProgram.set(row.programId, (itemsByProgram.get(row.programId) ?? 0) + 1);
  }
  const mentorNameById = new Map(
    mentorUsers.map((row) => [row.id, row.displayName]),
  );
  const mentorshipByIntern = new Map(
    mentorshipRows.map((row) => [row.internEmployeeId, row]),
  );

  const now = Date.now();
  return team.map((employee) => {
    const empProgress = progressRows.filter((row) => row.employeeId === employee.id);
    const assignedLessons =
      itemsByProgram.get(programByEmployee.get(employee.id) ?? -1) ??
      empProgress.length;
    const completedLessons = empProgress.filter((row) =>
      statusIsDone(row.status),
    ).length;
    const pendingTests = testCounts.filter(
      (row) => row.employeeId === employee.id && row.status === "pending",
    ).length;
    const completedTests = testCounts.filter(
      (row) =>
        row.employeeId === employee.id &&
        (row.status === "completed" || row.status === "done"),
    ).length;
    const matrix = competencyRows.filter((row) => row.employeeId === employee.id);
    const matrixConfirmed = matrix.filter((row) =>
      ["junior", "junior_plus", "middle_minus", "middle"].includes(row.status),
    ).length;
    const progressPercent = employeeProgressPercent({
      assignedLessons,
      completedLessons,
      pendingTests,
      completedTests,
      matrixConfirmed,
      matrixTotal: Math.max(1, matrix.length),
    });
    const empTasks = taskRows.filter((row) => row.employeeId === employee.id);
    const overdueTasks = empTasks.filter((row) => {
      if (!row.dueAt) return false;
      return new Date(row.dueAt).getTime() < now;
    }).length;
    const kpi = kpiRows.filter((row) => row.employeeId === employee.id);
    const kpiPercent =
      kpi.length > 0
        ? Math.round(
            kpi.reduce((sum, row) => {
              const plan = row.planValue || 100;
              const fact = row.factValue ?? progressPercent;
              return sum + Math.min(100, (fact / plan) * 100);
            }, 0) / kpi.length,
          )
        : progressPercent;
    const mentorship = mentorshipByIntern.get(employee.id);
    const isIntern = Boolean(mentorship);
    const trialDay = mentorship
      ? trialDayNumber(mentorship.trialStartsAt)
      : null;
    const trialTotalDays = mentorship ? 5 : null;

    return {
      id: employee.id,
      name: employee.name,
      roleTitle: employee.roleTitle,
      department: employee.department,
      status: employee.status,
      currentLevel: employee.currentLevel,
      targetLevel: employee.targetLevel,
      hiredAt: employee.hiredAt,
      mentorUserId: employee.mentorUserId,
      mentorName: employee.mentorUserId
        ? mentorNameById.get(employee.mentorUserId) ?? null
        : null,
      progressPercent,
      kpiPercent,
      openTasks: empTasks.length,
      overdueTasks,
      isIntern,
      trialDay,
      trialTotalDays,
    };
  });
}

export async function getManagerContext(
  managerUserId: number,
): Promise<ManagerContext | null> {
  await ready();
  const [user] = await db
    .select()
    .from(platformUsers)
    .where(eq(platformUsers.id, managerUserId))
    .limit(1);
  if (!user || user.role !== "manager") return null;
  const department = user.profileDepartment || "";
  const team = await loadTeamMembers(managerUserId, department);
  return {
    managerUserId,
    displayName: user.displayName,
    department,
    team,
    teamIds: team.map((row) => row.id),
  };
}

export type ManagerActionItem = {
  id: string;
  title: string;
  detailKey: MessageKey;
  href: string;
  primaryLabelKey: MessageKey;
  secondaryHref?: string;
  secondaryLabelKey?: MessageKey;
};

export type ManagerHomeDashboard = {
  managerName: string;
  department: string;
  kpis: {
    teamSize: number;
    activeCount: number;
    newcomerCount: number;
    overdueTasks: number;
    learningCount: number;
    trialDecisions: number;
    meetingsToday: number;
  };
  actions: ManagerActionItem[];
};

export async function getManagerHomeDashboard(
  managerUserId: number,
): Promise<ManagerHomeDashboard | null> {
  const ctx = await getManagerContext(managerUserId);
  if (!ctx) return null;

  const today = todayKey();
  const weekAhead = new Date(Date.now() + 7 * 86_400_000).toISOString();

  const [meetingsToday, pendingTrials, pendingPromotions, pendingReviews] =
    await Promise.all([
      db
        .select({ id: oneOnOneMeetings.id })
        .from(oneOnOneMeetings)
        .where(
          and(
            eq(oneOnOneMeetings.managerUserId, managerUserId),
            eq(oneOnOneMeetings.status, "planned"),
            sql`substr(${oneOnOneMeetings.scheduledAt}, 1, 10) = ${today}`,
          ),
        ),
      db
        .select({
          internEmployeeId: internMentorships.internEmployeeId,
          trialEndsAt: internMentorships.trialEndsAt,
        })
        .from(internMentorships)
        .where(
          and(
            inArray(internMentorships.internEmployeeId, ctx.teamIds),
            inArray(internMentorships.status, ["active", "extended"]),
            sql`${internMentorships.trialEndsAt} <= ${weekAhead}`,
          ),
        ),
      db
        .select({
          id: levelPromotionRequests.id,
          employeeId: levelPromotionRequests.employeeId,
        })
        .from(levelPromotionRequests)
        .where(
          and(
            eq(levelPromotionRequests.status, "pending"),
            inArray(levelPromotionRequests.employeeId, ctx.teamIds),
          ),
        ),
      db
        .select({
          employeeId: lessonProgress.employeeId,
          lessonId: lessonProgress.lessonId,
        })
        .from(lessonProgress)
        .where(
          and(
            inArray(lessonProgress.employeeId, ctx.teamIds),
            eq(lessonProgress.status, "submitted"),
          ),
        ),
    ]);

  const teamSize = ctx.team.length;
  const activeCount = ctx.team.filter((row) =>
    ["active", "learning"].includes(row.status),
  ).length;
  const newcomerCount = ctx.team.filter(
    (row) => row.isIntern || row.status === "probation",
  ).length;
  const overdueTasks = ctx.team.reduce((sum, row) => sum + row.overdueTasks, 0);
  const learningCount = ctx.team.filter(
    (row) => row.progressPercent > 0 && row.progressPercent < 100,
  ).length;

  const actions: ManagerActionItem[] = [];
  const employeeName = (id: number) =>
    ctx.team.find((row) => row.id === id)?.name ?? `#${id}`;

  for (const trial of pendingTrials) {
    actions.push({
      id: `trial-${trial.internEmployeeId}`,
      title: employeeName(trial.internEmployeeId),
      detailKey: "mgr_action_trial_detail",
      href: `/observer/trial/${trial.internEmployeeId}`,
      primaryLabelKey: "mgr_action_decide",
      secondaryHref: `/observer/trial/${trial.internEmployeeId}`,
      secondaryLabelKey: "mgr_action_view",
    });
  }

  for (const promo of pendingPromotions) {
    actions.push({
      id: `promo-${promo.id}`,
      title: employeeName(promo.employeeId),
      detailKey: "mgr_action_attest_detail",
      href: "/observer/approvals",
      primaryLabelKey: "mgr_action_view",
    });
  }

  if (pendingReviews.length > 0) {
    actions.push({
      id: "reviews-queue",
      title: `${pendingReviews.length}`,
      detailKey: "mgr_action_reviews_detail",
      href: "/observer/mentees",
      primaryLabelKey: "mgr_action_open",
    });
  }

  if (overdueTasks > 0) {
    actions.push({
      id: "overdue-tasks",
      title: `${overdueTasks}`,
      detailKey: "mgr_action_overdue_detail",
      href: "/observer/tasks?filter=overdue",
      primaryLabelKey: "mgr_action_open",
    });
  }

  return {
    managerName: ctx.displayName,
    department: ctx.department,
    kpis: {
      teamSize,
      activeCount,
      newcomerCount,
      overdueTasks,
      learningCount,
      trialDecisions: pendingTrials.length,
      meetingsToday: meetingsToday.length,
    },
    actions: actions.slice(0, 8),
  };
}

export type ManagerTaskRow = {
  id: number;
  employeeId: number;
  employeeName: string;
  title: string;
  description: string;
  dueAt: string | null;
  priority: string;
  status: string;
  resultNote: string;
  completedAt: string | null;
  overdue: boolean;
};

export async function getManagerTasksBoard(managerUserId: number) {
  const ctx = await getManagerContext(managerUserId);
  if (!ctx) return null;
  const rows = await db
    .select()
    .from(managerTasks)
    .where(
      or(
        eq(managerTasks.assignedByUserId, managerUserId),
        inArray(managerTasks.employeeId, ctx.teamIds),
      ),
    )
    .orderBy(desc(managerTasks.createdAt));
  const now = Date.now();
  const items: ManagerTaskRow[] = rows.map((row) => ({
    id: row.id,
    employeeId: row.employeeId,
    employeeName:
      ctx.team.find((member) => member.id === row.employeeId)?.name ??
      `#${row.employeeId}`,
    title: row.title,
    description: row.description,
    dueAt: row.dueAt,
    priority: row.priority,
    status: row.status,
    resultNote: row.resultNote,
    completedAt: row.completedAt,
    overdue: Boolean(
      row.dueAt &&
        new Date(row.dueAt).getTime() < now &&
        row.status !== "done",
    ),
  }));
  const open = items.filter((row) => row.status !== "done");
  return {
    team: ctx.team.map((row) => ({ id: row.id, name: row.name })),
    items,
    counts: {
      open: open.length,
      overdue: open.filter((row) => row.overdue).length,
      doneToday: items.filter(
        (row) =>
          row.status === "done" &&
          row.completedAt?.slice(0, 10) === todayKey(),
      ).length,
      inProgress: open.filter((row) => row.status === "in_progress").length,
    },
  };
}

export type ManagerMeetingRow = {
  id: number;
  employeeId: number;
  employeeName: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  notes: string;
  agreements: string;
  nextGoals: string;
  context: {
    lastMeetingAt: string | null;
    kpiPercent: number | null;
    openTasks: number;
    progressPercent: number;
    issues: string[];
  };
};

export async function getManagerMeetingsPage(managerUserId: number) {
  const ctx = await getManagerContext(managerUserId);
  if (!ctx) return null;
  const rows = await db
    .select()
    .from(oneOnOneMeetings)
    .where(eq(oneOnOneMeetings.managerUserId, managerUserId))
    .orderBy(desc(oneOnOneMeetings.scheduledAt))
    .limit(50);

  const meetings: ManagerMeetingRow[] = [];
  for (const row of rows) {
    const member = ctx.team.find((item) => item.id === row.employeeId);
    const [lastDone] = await db
      .select({ scheduledAt: oneOnOneMeetings.scheduledAt })
      .from(oneOnOneMeetings)
      .where(
        and(
          eq(oneOnOneMeetings.managerUserId, managerUserId),
          eq(oneOnOneMeetings.employeeId, row.employeeId),
          eq(oneOnOneMeetings.status, "done"),
          sql`${oneOnOneMeetings.id} != ${row.id}`,
        ),
      )
      .orderBy(desc(oneOnOneMeetings.scheduledAt))
      .limit(1);
    const issues: string[] = [];
    if ((member?.overdueTasks ?? 0) > 0) issues.push("overdue_tasks");
    if ((member?.progressPercent ?? 0) < 50) issues.push("learning_behind");
    meetings.push({
      id: row.id,
      employeeId: row.employeeId,
      employeeName: member?.name ?? `#${row.employeeId}`,
      scheduledAt: row.scheduledAt,
      durationMinutes: row.durationMinutes,
      status: row.status,
      notes: row.notes,
      agreements: row.agreements,
      nextGoals: row.nextGoals,
      context: {
        lastMeetingAt: lastDone?.scheduledAt ?? null,
        kpiPercent: member?.kpiPercent ?? null,
        openTasks: member?.openTasks ?? 0,
        progressPercent: member?.progressPercent ?? 0,
        issues,
      },
    });
  }

  const today = todayKey();
  return {
    team: ctx.team.map((row) => ({ id: row.id, name: row.name })),
    meetings,
    counts: {
      today: meetings.filter(
        (row) =>
          row.status === "planned" && row.scheduledAt.slice(0, 10) === today,
      ).length,
      upcoming: meetings.filter((row) => row.status === "planned").length,
      done: meetings.filter((row) => row.status === "done").length,
    },
  };
}

export type ManagerNewcomerRow = {
  employeeId: number;
  name: string;
  roleTitle: string;
  department: string;
  hiredAt: string | null;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  trialDay: number | null;
  mentorName: string | null;
  checklist: {
    mentorAssigned: boolean;
    planReady: boolean;
    firstTask: boolean;
    contentAssigned: boolean;
  };
  dailyScores: { day: number; score: number | null; status: string }[];
  needsDecision: boolean;
};

export async function getManagerNewcomersPage(managerUserId: number) {
  const ctx = await getManagerContext(managerUserId);
  if (!ctx) return null;

  const newcomers = ctx.team.filter(
    (row) => row.isIntern || row.status === "probation",
  );
  const newcomerIds = newcomers.map((row) => row.id);
  if (newcomerIds.length === 0) {
    return { newcomers: [], team: ctx.team };
  }

  const [mentorships, contentCounts, taskCounts, reports, decisions] =
    await Promise.all([
      db
        .select()
        .from(internMentorships)
        .where(inArray(internMentorships.internEmployeeId, newcomerIds)),
      db
        .select({
          internEmployeeId: internContentAssignments.internEmployeeId,
        })
        .from(internContentAssignments)
        .where(inArray(internContentAssignments.internEmployeeId, newcomerIds)),
      db
        .select({ employeeId: managerTasks.employeeId })
        .from(managerTasks)
        .where(inArray(managerTasks.employeeId, newcomerIds)),
      db
        .select({
          internEmployeeId: internDailyReports.internEmployeeId,
          reportDate: internDailyReports.reportDate,
          score: internDailyReports.score,
          status: internDailyReports.status,
        })
        .from(internDailyReports)
        .where(inArray(internDailyReports.internEmployeeId, newcomerIds)),
      db
        .select({ internEmployeeId: trialDecisions.internEmployeeId })
        .from(trialDecisions)
        .where(inArray(trialDecisions.internEmployeeId, newcomerIds)),
    ]);

  const decided = new Set(decisions.map((row) => row.internEmployeeId));
  const rows: ManagerNewcomerRow[] = newcomers.map((member) => {
    const mentorship = mentorships.find(
      (row) => row.internEmployeeId === member.id,
    );
    const contentCount = contentCounts.filter(
      (row) => row.internEmployeeId === member.id,
    ).length;
    const taskCount = taskCounts.filter(
      (row) => row.employeeId === member.id,
    ).length;
    const memberReports = reports.filter(
      (row) => row.internEmployeeId === member.id,
    );
    const trialDay = mentorship
      ? trialDayNumber(mentorship.trialStartsAt)
      : null;
    const dailyScores = [1, 2, 3, 4, 5].map((day) => {
      const report = memberReports[memberReports.length - day] ?? null;
      return {
        day,
        score: report?.score ?? null,
        status: report?.status ?? "pending",
      };
    });
    const trialEnded =
      mentorship &&
      new Date(mentorship.trialEndsAt).getTime() <= Date.now();
    return {
      employeeId: member.id,
      name: member.name,
      roleTitle: member.roleTitle,
      department: member.department,
      hiredAt: member.hiredAt,
      trialStartsAt: mentorship?.trialStartsAt ?? member.hiredAt,
      trialEndsAt: mentorship?.trialEndsAt ?? null,
      trialDay,
      mentorName: member.mentorName,
      checklist: {
        mentorAssigned: Boolean(member.mentorUserId || mentorship?.mentorUserId),
        planReady: contentCount > 0,
        firstTask: taskCount > 0,
        contentAssigned: contentCount > 0,
      },
      dailyScores,
      needsDecision: Boolean(trialEnded && !decided.has(member.id)),
    };
  });

  return { newcomers: rows, team: ctx.team };
}

export async function getManagerTrialPage(
  managerUserId: number,
  internEmployeeId: number,
) {
  const ctx = await getManagerContext(managerUserId);
  if (!ctx || !ctx.teamIds.includes(internEmployeeId)) return null;
  const page = await getManagerNewcomersPage(managerUserId);
  const newcomer = page?.newcomers.find(
    (row) => row.employeeId === internEmployeeId,
  );
  if (!newcomer) return null;
  const [decision] = await db
    .select()
    .from(trialDecisions)
    .where(eq(trialDecisions.internEmployeeId, internEmployeeId))
    .orderBy(desc(trialDecisions.createdAt))
    .limit(1);
  return { newcomer, decision: decision ?? null, team: ctx.team };
}

export type ManagerTrainingRow = {
  employeeId: number;
  name: string;
  roleTitle: string;
  progressPercent: number;
  months: { month: number; done: number; total: number; percent: number }[];
  problems: string[];
};

export async function getManagerTrainingPage(managerUserId: number) {
  const ctx = await getManagerContext(managerUserId);
  if (!ctx) return null;
  const teamIds = ctx.teamIds;
  if (teamIds.length === 0) return { rows: [], team: ctx.team };

  const [programs, items, progress] = await Promise.all([
    db
      .select()
      .from(employeeLearningPrograms)
      .where(inArray(employeeLearningPrograms.employeeId, teamIds)),
    db.select().from(employeeProgramItems),
    db
      .select({
        employeeId: lessonProgress.employeeId,
        lessonId: lessonProgress.lessonId,
        status: lessonProgress.status,
        deadlineAt: lessonProgress.deadlineAt,
      })
      .from(lessonProgress)
      .where(inArray(lessonProgress.employeeId, teamIds)),
  ]);

  const now = Date.now();
  const rows: ManagerTrainingRow[] = ctx.team.map((member) => {
    const program = programs.find((row) => row.employeeId === member.id);
    const programItems = program
      ? items.filter((row) => row.programId === program.id)
      : [];
    const empProgress = progress.filter((row) => row.employeeId === member.id);
    const months = [1, 2, 3].map((month) => {
      const monthItems = programItems.filter((row) => row.month === month);
      const done = monthItems.filter((item) => {
        const row = empProgress.find((p) => p.lessonId === item.lessonId);
        return row ? statusIsDone(row.status) : false;
      }).length;
      const total = monthItems.length;
      return {
        month,
        done,
        total,
        percent: total ? Math.round((done / total) * 100) : 0,
      };
    });
    const problems: string[] = [];
    const overdue = empProgress.filter(
      (row) =>
        row.deadlineAt &&
        new Date(row.deadlineAt).getTime() < now &&
        !statusIsDone(row.status),
    ).length;
    if (overdue > 0) problems.push("overdue");
    if (member.progressPercent < 50 && member.progressPercent > 0) {
      problems.push("behind");
    }
    return {
      employeeId: member.id,
      name: member.name,
      roleTitle: member.roleTitle,
      progressPercent: member.progressPercent,
      months,
      problems,
    };
  });

  return { rows, team: ctx.team };
}

export type ManagerKpiRow = {
  employeeId: number;
  name: string;
  plan: number;
  fact: number;
  forecast: number;
  reasons: string[];
};

export async function getManagerKpiPage(managerUserId: number) {
  const ctx = await getManagerContext(managerUserId);
  if (!ctx) return null;
  const period = currentPeriod();
  const targets = await db
    .select()
    .from(kpiTargets)
    .where(
      and(
        inArray(kpiTargets.employeeId, ctx.teamIds),
        eq(kpiTargets.period, period),
      ),
    );

  const rows: ManagerKpiRow[] = ctx.team.map((member) => {
    const memberTargets = targets.filter((row) => row.employeeId === member.id);
    const plan =
      memberTargets.length > 0
        ? Math.round(
            memberTargets.reduce((sum, row) => sum + row.planValue, 0) /
              memberTargets.length,
          )
        : 100;
    const fact = member.kpiPercent ?? member.progressPercent;
    const forecast = Math.round(fact * 1.05);
    const reasons: string[] = [];
    if (member.overdueTasks > 0) reasons.push("overdue_tasks");
    if (member.progressPercent < 70) reasons.push("learning");
    if (fact < plan) reasons.push("below_plan");
    return {
      employeeId: member.id,
      name: member.name,
      plan,
      fact,
      forecast: Math.min(100, forecast),
      reasons,
    };
  });

  const teamPlan = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.plan, 0) / rows.length)
    : 100;
  const teamFact = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.fact, 0) / rows.length)
    : 0;
  const teamForecast = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.forecast, 0) / rows.length)
    : 0;

  return {
    period,
    team: ctx.team,
    rows,
    summary: { plan: teamPlan, fact: teamFact, forecast: teamForecast },
  };
}

export type ManagerAttestationRow = {
  employeeId: number;
  employeeName: string;
  attestationId: number;
  title: string;
  scheduledAt: string;
  windowStatus: string;
  reviewStatus: string | null;
  finalScore: number | null;
  decision: string | null;
};

export async function getManagerAttestationsPage(managerUserId: number) {
  const ctx = await getManagerContext(managerUserId);
  if (!ctx) return null;

  const deptAttestations = await db
    .select()
    .from(attestations)
    .orderBy(desc(attestations.scheduledAt))
    .limit(30);
  const relevant = deptAttestations.filter((row) =>
    managerOwnsDepartment(ctx.department, row.department),
  );

  const reviews = await db
    .select()
    .from(attestationReviews)
    .where(inArray(attestationReviews.employeeId, ctx.teamIds))
    .orderBy(desc(attestationReviews.updatedAt))
    .limit(100);

  const rows: ManagerAttestationRow[] = [];
  for (const review of reviews) {
    const att = relevant.find((row) => row.id === review.attestationId);
    const employee = ctx.team.find((row) => row.id === review.employeeId);
    if (!att || !employee) continue;
    rows.push({
      employeeId: review.employeeId,
      employeeName: employee.name,
      attestationId: review.attestationId,
      title: att.title,
      scheduledAt: att.scheduledAt,
      windowStatus: "closed",
      reviewStatus: review.status,
      finalScore: review.finalScore,
      decision: review.decision,
    });
  }

  const pendingPromotions = await db
    .select()
    .from(levelPromotionRequests)
    .where(
      and(
        eq(levelPromotionRequests.status, "pending"),
        inArray(levelPromotionRequests.employeeId, ctx.teamIds),
      ),
    );

  return {
    rows: rows.slice(0, 30),
    pendingPromotions: pendingPromotions.map((row) => ({
      id: row.id,
      employeeId: row.employeeId,
      employeeName:
        ctx.team.find((member) => member.id === row.employeeId)?.name ??
        `#${row.employeeId}`,
      fromLevel: row.fromLevel,
      toLevel: row.toLevel,
      score: row.score,
    })),
    upcoming: relevant
      .filter((row) => {
        const when = row.endsAt || row.startsAt || row.scheduledAt;
        return when ? new Date(when).getTime() > Date.now() : false;
      })
      .slice(0, 10)
      .map((row) => ({
        id: row.id,
        title: row.title,
        scheduledAt: row.scheduledAt,
        department: row.department,
      })),
  };
}

export type ManagerGrowthRow = {
  employeeId: number;
  name: string;
  currentLevel: string;
  targetLevel: string;
  gaps: { name: string; current: string; required: string }[];
  readyPercent: number;
};

export async function getManagerGrowthPage(managerUserId: number) {
  const ctx = await getManagerContext(managerUserId);
  if (!ctx) return null;

  const { getRoleProfileBriefForStaff } = await import("./roles-catalog");
  const competencyRows = await db
    .select({
      employeeId: employeeCompetencies.employeeId,
      status: employeeCompetencies.status,
    })
    .from(employeeCompetencies)
    .where(inArray(employeeCompetencies.employeeId, ctx.teamIds));

  const rows: ManagerGrowthRow[] = [];
  for (const member of ctx.team) {
    const profile = await getRoleProfileBriefForStaff({
      roleTitle: member.roleTitle,
      department: member.department,
    });
    const matrix = competencyRows.filter((row) => row.employeeId === member.id);
    const gaps: ManagerGrowthRow["gaps"] = [];
    const required = profile?.requirements
      ? profile.requirements.split("\n").filter(Boolean).slice(0, 4)
      : [];
    for (const req of required) {
      const confirmed = matrix.some((row) =>
        ["junior_plus", "middle_minus", "middle"].includes(row.status),
      );
      gaps.push({
        name: req.slice(0, 80),
        current: confirmed ? "ok" : "gap",
        required: "required",
      });
    }
    const readyPercent =
      gaps.length > 0
        ? Math.round(
            (gaps.filter((gap) => gap.current === "ok").length / gaps.length) *
              100,
          )
        : member.progressPercent;
    rows.push({
      employeeId: member.id,
      name: member.name,
      currentLevel: member.currentLevel,
      targetLevel: member.targetLevel,
      gaps,
      readyPercent,
    });
  }

  return { rows, team: ctx.team };
}

export type ManagerMentorLoadRow = {
  mentorUserId: number;
  mentorName: string;
  menteeCount: number;
  load: "low" | "normal" | "high";
  rating: number | null;
};

export async function getManagerMentorLoad(managerUserId: number) {
  const ctx = await getManagerContext(managerUserId);
  if (!ctx) return null;

  const mentors = await db
    .select({
      id: platformUsers.id,
      displayName: platformUsers.displayName,
    })
    .from(platformUsers)
    .where(
      and(eq(platformUsers.role, "manager"), eq(platformUsers.isActive, true)),
    );

  const mentorships = await db
    .select({
      mentorUserId: internMentorships.mentorUserId,
    })
    .from(internMentorships)
    .where(inArray(internMentorships.status, ["active", "extended"]));

  const ratings = await db.select().from(mentorRatings);
  const employeeMentors = await db
    .select({
      mentorUserId: employees.mentorUserId,
    })
    .from(employees)
    .where(inArray(employees.id, ctx.teamIds));

  const rows: ManagerMentorLoadRow[] = mentors
    .filter((mentor) =>
      ctx.team.some((member) => member.mentorUserId === mentor.id),
    )
    .map((mentor) => {
      const menteeCount =
        mentorships.filter((row) => row.mentorUserId === mentor.id).length +
        employeeMentors.filter((row) => row.mentorUserId === mentor.id).length;
      const mentorRatings = ratings.filter(
        (row) => row.mentorUserId === mentor.id,
      );
      const rating =
        mentorRatings.length > 0
          ? Math.round(
              (mentorRatings.reduce((sum, row) => sum + row.score, 0) /
                mentorRatings.length) *
                10,
            ) / 10
          : null;
      const load: ManagerMentorLoadRow["load"] =
        menteeCount >= 4 ? "high" : menteeCount <= 1 ? "low" : "normal";
      return {
        mentorUserId: mentor.id,
        mentorName: mentor.displayName,
        menteeCount,
        load,
        rating,
      };
    });

  return { rows, team: ctx.team };
}

export type ManagerReportSummary = {
  teamSize: number;
  turnoverRisk: number;
  adaptationOnTrack: number;
  tasksDone: number;
  learningAvg: number;
  kpiAvg: number;
};

export async function getManagerReportsPage(managerUserId: number) {
  const ctx = await getManagerContext(managerUserId);
  if (!ctx) return null;
  const kpi = await getManagerKpiPage(managerUserId);
  const tasks = await getManagerTasksBoard(managerUserId);
  const training = await getManagerTrainingPage(managerUserId);

  const learningAvg = ctx.team.length
    ? Math.round(
        ctx.team.reduce((sum, row) => sum + row.progressPercent, 0) /
          ctx.team.length,
      )
    : 0;
  const turnoverRisk = ctx.team.filter(
    (row) => row.overdueTasks > 2 || row.progressPercent < 40,
  ).length;
  const adaptationOnTrack = ctx.team.filter(
    (row) => !row.isIntern || (row.trialDay ?? 0) <= 5,
  ).length;

  const summary: ManagerReportSummary = {
    teamSize: ctx.team.length,
    turnoverRisk,
    adaptationOnTrack,
    tasksDone: tasks?.counts.doneToday ?? 0,
    learningAvg,
    kpiAvg: kpi?.summary.fact ?? learningAvg,
  };

  return { summary, team: ctx.team, kpi: kpi?.summary, tasks: tasks?.counts };
}

const MANAGER_NOTIFICATION_TYPES = new Set([
  "trial_decision",
  "task_overdue",
  "new_employee",
  "meeting_today",
  "attestation_done",
  "promotion_pending",
  "lesson_review",
]);

export async function getManagerNotificationsPage(managerUserId: number) {
  const { listNotificationsForUser } = await import("./mentorship");
  const all = await listNotificationsForUser(managerUserId, 80);
  const filtered = all.filter(
    (row) =>
      MANAGER_NOTIFICATION_TYPES.has(row.type) ||
      row.title.toLowerCase().includes("аттест") ||
      row.title.toLowerCase().includes("задач") ||
      row.title.toLowerCase().includes("стаж"),
  );
  return {
    items: filtered.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      href: row.href,
      createdAt: row.createdAt,
      readAt: row.readAt,
    })),
    unread: filtered.filter((row) => !row.readAt).length,
  };
}

export async function getManagerEmployeeDetail(
  managerUserId: number,
  employeeId: number,
) {
  const ctx = await getManagerContext(managerUserId);
  if (!ctx || !ctx.teamIds.includes(employeeId)) return null;
  const member = ctx.team.find((row) => row.id === employeeId);
  if (!member) return null;

  const [employee, latestResults, openTasks] = await Promise.all([
    db.select().from(employees).where(eq(employees.id, employeeId)).limit(1),
    db
      .select({ score: results.score, completedAt: results.completedAt })
      .from(results)
      .where(eq(results.employeeId, employeeId))
      .orderBy(desc(results.completedAt))
      .limit(5),
    db
      .select()
      .from(managerTasks)
      .where(
        and(
          eq(managerTasks.employeeId, employeeId),
          ne(managerTasks.status, "done"),
        ),
      )
      .limit(10),
  ]);

  return {
    member,
    employee: employee[0] ?? null,
    latestResults,
    openTasks,
  };
}

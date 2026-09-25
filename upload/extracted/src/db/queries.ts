import "server-only";
import { cache } from "react";
import { asc, desc, eq, and, ne, sql } from "drizzle-orm";
import { client, db } from "./index";
import { seedIfEmpty, ensureSchema } from "./seed";
import { syncStaffingIfNeeded } from "./sync-staffing";
import { syncStaffingPositionsIfNeeded } from "./sync-staffing-positions";
import {
  assessments,
  assignments,
  candidateAssignments,
  candidateResults,
  candidates,
  competencies,
  employees,
  levelDefinitions,
  platformUsers,
  questions,
  results,
  roleHomePages,
  visualContentPages,
  staffingPositions,
  vacancies,
  internMentorships,
  attestations,
  internDailyReports,
  lessonProgress,
  candidateEvents,
  interviews,
  employeeCompetencies,
} from "./schema";
import {
  countByCanonicalStatus,
  FUNNEL_STAGES,
  isCandidateStatus,
  normalizeCandidateStatus,
  type CandidateStatus,
  type FunnelStageId,
} from "../lib/candidate-funnel";
import { pickBestRoleMatch, roleMatchScore } from "../lib/role-match";
import { scoreAnswers, type AnswerValue } from "../lib/scoring";
import {
  entranceLevelForScore,
  selectEntranceQuestions,
  type EntranceTestProfile,
  type EntranceTestTelemetry,
} from "../lib/entrance-test";
import { HR_RECRUITER_TEST } from "../data/hr-recruiter-test";
import type { ResultsGroup } from "../lib/results-groups";
import {
  employeeAccountTypeForRoleTitle,
  hashPassword,
  participantKindForRoleTitle,
  verifyPassword,
  type EmployeeAccountType,
  type ParticipantKind,
  type SessionUser,
  type UserRole,
} from "../lib/auth-core";
import {
  emptyRoleHomeDocument,
  emptyRoleHomePages,
  isRoleHomeAudience,
  parseRoleHomeDocument,
  type PermanentViewAudience,
  type RoleHomeAudience,
  type RoleHomeDocument,
  type RoleHomePagesMap,
  type VisibilityPerson,
} from "../lib/role-home";
import {
  emptyOnboardingVisualPages,
  INTERN_ONBOARDING_SECTIONS,
  onboardingStepsForAudience,
  onboardingVisualPageKey,
  preferredLocaleFromUser,
  visualAudienceForSession,
  type OnboardingVisualPageKey,
} from "../lib/onboarding-visual";
import type { Locale } from "../lib/i18n";

let initializing: Promise<void> | null = null;

declare global {
  // Persist across warm serverless invocations in the same isolate.
  // eslint-disable-next-line no-var
  var __akelaDbReady: Promise<void> | undefined;
}

/**
 * Cheap marker queries — never use cartesian JOINs (ON 1=1). Those can take
 * tens of seconds on Turso even with LIMIT 1 and force ensureSchema fallback.
 */
async function schemaMarkersReady() {
  const checks = [
    "SELECT id FROM employees LIMIT 1",
    "SELECT phone FROM employees LIMIT 1",
    "SELECT status FROM lesson_progress LIMIT 1",
    "SELECT goal FROM learning_lessons LIMIT 1",
    "SELECT id FROM employee_learning_programs LIMIT 1",
    "SELECT id FROM attestation_reviews LIMIT 1",
    "SELECT id FROM mentor_ratings LIMIT 1",
    "SELECT id FROM interviews LIMIT 1",
    "SELECT id FROM staffing_positions LIMIT 1",
    "SELECT id FROM role_profiles LIMIT 1",
    "SELECT id FROM role_competencies LIMIT 1",
    "SELECT kind FROM competencies LIMIT 1",
    "SELECT rejection_reason FROM candidates LIMIT 1",
    "SELECT closed_at FROM vacancies LIMIT 1",
    "SELECT id FROM integration_settings LIMIT 1",
    "SELECT id FROM system_settings LIMIT 1",
    "SELECT id FROM manager_tasks LIMIT 1",
  ];
  const results = await Promise.all(
    checks.map(async (sql) => {
      try {
        await client.execute(sql);
        return true;
      } catch {
        return false;
      }
    }),
  );
  return results.every(Boolean);
}

export async function ensureDb() {
  if (!globalThis.__akelaDbReady) {
    globalThis.__akelaDbReady = (async () => {
      if (await schemaMarkersReady()) {
        // Schema already present (e.g. local SQLite) — still guarantee admin.
        await ensureDefaultAdminOnce();
        return;
      }

      // Missing tables/columns — migrate once for this isolate.
      await ensureSchema();

      try {
        const admin = await db
          .select({ id: platformUsers.id })
          .from(platformUsers)
          .where(eq(platformUsers.role, "admin"))
          .limit(1);
        if (admin.length === 0) {
          await seedIfEmpty();
          await syncStaffingIfNeeded();
          await syncStaffingPositionsIfNeeded();
          await ensureDefaultAdminOnce();
        }
        const { syncDepartmentManagersIfNeeded } = await import(
          "./sync-department-managers"
        );
        await syncDepartmentManagersIfNeeded();
      } catch {
        await seedIfEmpty();
        await syncStaffingIfNeeded();
        await syncStaffingPositionsIfNeeded();
        await ensureDefaultAdminOnce();
        const { syncDepartmentManagersIfNeeded } = await import(
          "./sync-department-managers"
        );
        await syncDepartmentManagersIfNeeded();
      }
    })().catch((error) => {
      // Allow retry on next request if bootstrap failed.
      globalThis.__akelaDbReady = undefined;
      throw error;
    });
  }
  initializing = globalThis.__akelaDbReady;
  await initializing;
}

async function ensureDefaultAdminOnce() {
  const login = (
    process.env.AKELA_ADMIN_LOGIN ||
    process.env.ADMIN_LOGIN ||
    "admin"
  )
    .trim()
    .toLowerCase();
  const password =
    process.env.AKELA_ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    "akela-admin";

  const existing = await db
    .select()
    .from(platformUsers)
    .where(eq(platformUsers.role, "admin"));

  if (existing.length > 0) {
    const admin = existing[0];
    if (!admin.passwordPlain && password === "akela-admin") {
      await db
        .update(platformUsers)
        .set({ passwordPlain: password })
        .where(eq(platformUsers.id, admin.id));
    }
    return admin;
  }

  const [row] = await db
    .insert(platformUsers)
    .values({
      login,
      passwordHash: hashPassword(password),
      passwordPlain: password,
      role: "admin",
      participantKind: null,
      displayName: "Администратор",
      employeeId: null,
      candidateId: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

export async function ensureDefaultAdmin() {
  await ensureDb();
}

export async function getPlatformUserByLogin(login: string) {
  await ensureDb();
  const [row] = await db
    .select()
    .from(platformUsers)
    .where(eq(platformUsers.login, login.trim().toLowerCase()));
  return row ?? null;
}

export async function authenticatePlatformUser(
  login: string,
  password: string,
): Promise<SessionUser | null> {
  await ensureDb();

  let user = await getPlatformUserByLogin(login);
  if (
    user?.isActive &&
    verifyPassword(password, user.passwordHash)
  ) {
    return {
      userId: user.id,
      role: user.role as UserRole,
      participantKind: (user.participantKind as ParticipantKind) ?? null,
      employeeId: user.employeeId,
      candidateId: user.candidateId,
      name: user.displayName,
    };
  }

  // Legacy: candidate portal credentials on candidates table
  const cand = await getCandidateByPortalLogin(login);
  if (
    cand?.portalEnabled &&
    cand.portalPasswordHash &&
    verifyPassword(password, cand.portalPasswordHash)
  ) {
    user = await upsertParticipantUserForCandidate({
      candidateId: cand.id,
      name: cand.name,
      login: cand.portalLogin ?? login,
      passwordHash: cand.portalPasswordHash,
    });
    return {
      userId: user.id,
      role: "participant",
      participantKind: "candidate",
      employeeId: null,
      candidateId: cand.id,
      name: cand.name,
    };
  }

  return null;
}

export async function upsertParticipantUserForCandidate(input: {
  candidateId: number;
  name: string;
  login: string;
  passwordHash: string;
  passwordPlain?: string | null;
}) {
  await ensureDb();
  const login = input.login.trim().toLowerCase();

  const [existingByCandidate] = await db
    .select()
    .from(platformUsers)
    .where(eq(platformUsers.candidateId, input.candidateId));

  if (existingByCandidate) {
    const [row] = await db
      .update(platformUsers)
      .set({
        login,
        passwordHash: input.passwordHash,
        passwordPlain:
          input.passwordPlain ?? existingByCandidate.passwordPlain ?? null,
        displayName: input.name,
        role: "participant",
        participantKind: "candidate",
        isActive: true,
      })
      .where(eq(platformUsers.id, existingByCandidate.id))
      .returning();
    return row!;
  }

  const [row] = await db
    .insert(platformUsers)
    .values({
      login,
      passwordHash: input.passwordHash,
      passwordPlain: input.passwordPlain ?? null,
      role: "participant",
      participantKind: "candidate",
      displayName: input.name,
      employeeId: null,
      candidateId: input.candidateId,
      isActive: true,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row!;
}

export async function upsertParticipantUserForEmployee(input: {
  employeeId: number;
  name: string;
  roleTitle: string;
  department?: string;
  login: string;
  passwordHash: string;
  passwordPlain?: string | null;
}) {
  await ensureDb();
  const login = input.login.trim().toLowerCase();
  const accountType = employeeAccountTypeForRoleTitle(input.roleTitle);
  const participantKind =
    accountType === "manager" ? null : participantKindForRoleTitle(input.roleTitle);

  const [existingByEmployee] = await db
    .select()
    .from(platformUsers)
    .where(eq(platformUsers.employeeId, input.employeeId));

  if (existingByEmployee) {
    const [row] = await db
      .update(platformUsers)
      .set({
        login,
        passwordHash: input.passwordHash,
        passwordPlain:
          input.passwordPlain ?? existingByEmployee.passwordPlain ?? null,
        displayName: input.name,
        profileJobTitle: input.roleTitle,
        profileDepartment:
          input.department ?? existingByEmployee.profileDepartment ?? null,
        isActive: true,
      })
      .where(eq(platformUsers.id, existingByEmployee.id))
      .returning();
    return row!;
  }

  const [row] = await db
    .insert(platformUsers)
    .values({
      login,
      passwordHash: input.passwordHash,
      passwordPlain: input.passwordPlain ?? null,
      role: accountType === "manager" ? "manager" : "participant",
      participantKind,
      displayName: input.name,
      profileJobTitle: input.roleTitle,
      profileDepartment: input.department ?? null,
      employeeId: input.employeeId,
      candidateId: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row!;
}

export async function getPlatformUserById(id: number) {
  await ensureDb();
  const [row] = await db
    .select({
      id: platformUsers.id,
      login: platformUsers.login,
      displayName: platformUsers.displayName,
      role: platformUsers.role,
      participantKind: platformUsers.participantKind,
      profileJobTitle: platformUsers.profileJobTitle,
      profileDepartment: platformUsers.profileDepartment,
      avatarData: platformUsers.avatarData,
      avatarHue: platformUsers.avatarHue,
      passwordPlain: platformUsers.passwordPlain,
      isActive: platformUsers.isActive,
      onboardingStep: platformUsers.onboardingStep,
      onboardingCompletedAt: platformUsers.onboardingCompletedAt,
      preferredLocale: platformUsers.preferredLocale,
      uiPreferencesJson: platformUsers.uiPreferencesJson,
      createdAt: platformUsers.createdAt,
    })
    .from(platformUsers)
    .where(eq(platformUsers.id, id));
  return row ?? null;
}

export async function advanceInternOnboarding(
  userId: number,
  expectedStep: number,
) {
  await ensureDb();
  const [user] = await db
    .select({
      role: platformUsers.role,
      participantKind: platformUsers.participantKind,
      preferredLocale: platformUsers.preferredLocale,
      onboardingStep: platformUsers.onboardingStep,
      onboardingCompletedAt: platformUsers.onboardingCompletedAt,
    })
    .from(platformUsers)
    .where(eq(platformUsers.id, userId));

  if (!user) {
    throw new Error("Пользователь не найден");
  }

  const audience = visualAudienceForSession({
    role: user.role as UserRole,
    participantKind: user.participantKind as ParticipantKind | null,
  });
  if (!audience) {
    throw new Error("Онбординг недоступен для этой роли");
  }

  if (user.onboardingCompletedAt) {
    return { completed: true, step: INTERN_ONBOARDING_SECTIONS.length };
  }
  if (user.onboardingStep !== expectedStep) {
    return { completed: false, step: user.onboardingStep };
  }

  const plan = await getVisualOnboardingPlan(
    audience,
    user.preferredLocale,
    userId,
  );
  const nextApplicable = plan.steps.find((step) => step > expectedStep);
  if (nextApplicable == null) {
    await db
      .update(platformUsers)
      .set({
        onboardingStep: INTERN_ONBOARDING_SECTIONS.length,
        onboardingCompletedAt: new Date().toISOString(),
      })
      .where(eq(platformUsers.id, userId));
    return { completed: true, step: INTERN_ONBOARDING_SECTIONS.length };
  }

  await db
    .update(platformUsers)
    .set({
      onboardingStep: nextApplicable,
      onboardingCompletedAt: null,
    })
    .where(eq(platformUsers.id, userId));

  return { completed: false, step: nextApplicable };
}

export async function getVisualOnboardingPlan(
  audience: PermanentViewAudience,
  preferredLocale: string | null | undefined,
  userId?: number,
) {
  const locale = preferredLocaleFromUser(preferredLocale);
  const pages = await getAllOnboardingVisualPages();
  const steps = onboardingStepsForAudience(
    pages,
    locale,
    audience,
    userId,
  );
  return { locale, steps, pages };
}

export type { VisibilityPerson } from "../lib/role-home";

export async function getVisibilityPeople(): Promise<VisibilityPerson[]> {
  await ensureDb();
  const rows = await db
    .select({
      id: platformUsers.id,
      displayName: platformUsers.displayName,
      role: platformUsers.role,
      participantKind: platformUsers.participantKind,
      profileJobTitle: platformUsers.profileJobTitle,
      profileDepartment: platformUsers.profileDepartment,
      isActive: platformUsers.isActive,
      employeeName: employees.name,
      employeeRole: employees.roleTitle,
      employeeDepartment: employees.department,
    })
    .from(platformUsers)
    .leftJoin(employees, eq(platformUsers.employeeId, employees.id))
    .where(eq(platformUsers.isActive, true))
    .orderBy(asc(platformUsers.displayName));

  return rows
    .map((row) => {
      const audience = visualAudienceForSession({
        role: row.role as UserRole,
        participantKind: row.participantKind as ParticipantKind | null,
      });
      if (!audience) return null;
      const name = row.employeeName || row.displayName || `User #${row.id}`;
      const job = row.employeeRole || row.profileJobTitle || "";
      const department =
        row.employeeDepartment || row.profileDepartment || "";
      return {
        id: row.id,
        name,
        meta: [job, department].filter(Boolean).join(" · "),
        audience,
      } satisfies VisibilityPerson;
    })
    .filter((row): row is VisibilityPerson => row != null)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export async function userNeedsVisualOnboarding(input: {
  role: UserRole;
  participantKind?: ParticipantKind | null;
  preferredLocale?: string | null;
  onboardingCompletedAt?: string | null;
  onboardingStep?: number;
  userId: number;
}) {
  if (input.onboardingCompletedAt) return false;
  const audience = visualAudienceForSession(input);
  if (!audience) return false;
  const plan = await getVisualOnboardingPlan(
    audience,
    input.preferredLocale,
    input.userId,
  );
  if (plan.steps.length === 0) return false;
  const current = input.onboardingStep ?? 0;
  return plan.steps.some((step) => step >= current);
}

export async function resolveVisualOnboardingStep(input: {
  role: UserRole;
  participantKind?: ParticipantKind | null;
  preferredLocale?: string | null;
  onboardingCompletedAt?: string | null;
  onboardingStep?: number;
  userId: number;
}) {
  const audience = visualAudienceForSession(input);
  if (!audience) return null;
  if (input.onboardingCompletedAt) return null;

  const plan = await getVisualOnboardingPlan(
    audience,
    input.preferredLocale,
    input.userId,
  );
  if (plan.steps.length === 0) return null;

  const current = input.onboardingStep ?? 0;
  const step = plan.steps.find((value) => value >= current) ?? null;
  if (step == null) {
    await db
      .update(platformUsers)
      .set({
        onboardingStep: INTERN_ONBOARDING_SECTIONS.length,
        onboardingCompletedAt: new Date().toISOString(),
      })
      .where(eq(platformUsers.id, input.userId));
    return null;
  }

  if (step !== current) {
    await db
      .update(platformUsers)
      .set({ onboardingStep: step })
      .where(eq(platformUsers.id, input.userId));
  }

  return {
    audience,
    locale: plan.locale,
    step,
    total: plan.steps.length,
    progressIndex: plan.steps.indexOf(step),
    document: plan.pages[onboardingVisualPageKey(
      INTERN_ONBOARDING_SECTIONS[step],
      plan.locale,
    )],
  };
}

export async function updatePlatformUserProfile(
  id: number,
  input: {
    displayName: string;
    profileJobTitle: string;
    profileDepartment: string;
    login?: string;
    passwordHash?: string;
    passwordPlain?: string | null;
    avatarHue?: number;
    avatarData?: string | null;
    preferredLocale?: string;
    uiPreferencesJson?: string;
  },
) {
  await ensureDb();
  const values: {
    displayName: string;
    profileJobTitle: string;
    profileDepartment: string;
    login?: string;
    passwordHash?: string;
    passwordPlain?: string | null;
    avatarHue?: number;
    avatarData?: string | null;
    preferredLocale?: string;
    uiPreferencesJson?: string;
  } = {
    displayName: input.displayName,
    profileJobTitle: input.profileJobTitle,
    profileDepartment: input.profileDepartment,
  };
  if (input.login !== undefined) values.login = input.login;
  if (input.passwordHash !== undefined) values.passwordHash = input.passwordHash;
  if (input.passwordPlain !== undefined) {
    values.passwordPlain = input.passwordPlain;
  }
  if (input.avatarHue !== undefined) values.avatarHue = input.avatarHue;
  if (input.avatarData !== undefined) values.avatarData = input.avatarData;
  if (input.preferredLocale !== undefined) {
    values.preferredLocale = input.preferredLocale;
  }
  if (input.uiPreferencesJson !== undefined) {
    values.uiPreferencesJson = input.uiPreferencesJson;
  }

  const [row] = await db
    .update(platformUsers)
    .set(values)
    .where(eq(platformUsers.id, id))
    .returning();
  return row ?? null;
}

export async function getPlatformUserByEmployeeId(employeeId: number) {
  await ensureDb();
  const [row] = await db
    .select({
      id: platformUsers.id,
      login: platformUsers.login,
      role: platformUsers.role,
      isActive: platformUsers.isActive,
      participantKind: platformUsers.participantKind,
      profileDepartment: platformUsers.profileDepartment,
    })
    .from(platformUsers)
    .where(eq(platformUsers.employeeId, employeeId));
  return row ?? null;
}

function accountValues(
  accountType: EmployeeAccountType,
  employee: { roleTitle: string; department: string },
) {
  return {
    role: accountType === "manager" ? "manager" : "participant",
    participantKind: accountType === "manager" ? null : accountType,
    profileJobTitle: employee.roleTitle,
    profileDepartment: employee.department,
    isActive: true,
  };
}

export async function setEmployeeAccountType(
  employeeId: number,
  accountType: EmployeeAccountType,
) {
  await ensureDb();
  const [employee] = await db
    .select({
      roleTitle: employees.roleTitle,
      department: employees.department,
      currentLevel: employees.currentLevel,
    })
    .from(employees)
    .where(eq(employees.id, employeeId));
  if (!employee) return null;

  const [account] = await db
    .select()
    .from(platformUsers)
    .where(eq(platformUsers.employeeId, employeeId));
  if (!account) return null;

  const [updated] = await db
    .update(platformUsers)
    .set(accountValues(accountType, employee))
    .where(eq(platformUsers.id, account.id))
    .returning();

  if (accountType === "intern") {
    await db
      .update(employees)
      .set({ currentLevel: "intern" })
      .where(eq(employees.id, employeeId));
    const { ensureInternMentorship } = await import("./mentorship");
    await ensureInternMentorship({ internEmployeeId: employeeId });
  } else if (
    accountType === "employee" &&
    (employee.currentLevel === "intern" ||
      account.participantKind === "intern")
  ) {
    await db
      .update(employees)
      .set({ currentLevel: "junior" })
      .where(eq(employees.id, employeeId));
  }

  return updated ?? null;
}

export async function syncEmployeeAccountType(employeeId: number) {
  await ensureDb();
  const [employee] = await db
    .select({
      roleTitle: employees.roleTitle,
      department: employees.department,
    })
    .from(employees)
    .where(eq(employees.id, employeeId));
  if (!employee) return null;

  const [account] = await db
    .select()
    .from(platformUsers)
    .where(eq(platformUsers.employeeId, employeeId));
  if (!account || account.role === "admin" || account.role === "observer") {
    return account ?? null;
  }

  const accountType = employeeAccountTypeForRoleTitle(employee.roleTitle);
  const [updated] = await db
    .update(platformUsers)
    .set(accountValues(accountType, employee))
    .where(eq(platformUsers.id, account.id))
    .returning();
  return updated ?? null;
}

export async function createObserverUser(input: {
  displayName: string;
  login: string;
  passwordHash: string;
  passwordPlain?: string | null;
}) {
  await ensureDb();
  const login = input.login.trim().toLowerCase();
  const [row] = await db
    .insert(platformUsers)
    .values({
      login,
      passwordHash: input.passwordHash,
      passwordPlain: input.passwordPlain ?? null,
      role: "observer",
      participantKind: null,
      displayName: input.displayName,
      employeeId: null,
      candidateId: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row!;
}

export async function createManagerUser(input: {
  displayName: string;
  login: string;
  passwordHash: string;
  passwordPlain?: string | null;
}) {
  await ensureDb();
  const login = input.login.trim().toLowerCase();
  const [row] = await db
    .insert(platformUsers)
    .values({
      login,
      passwordHash: input.passwordHash,
      passwordPlain: input.passwordPlain ?? null,
      role: "manager",
      participantKind: null,
      displayName: input.displayName,
      employeeId: null,
      candidateId: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row!;
}

export async function createAdminUser(input: {
  displayName: string;
  login: string;
  passwordHash: string;
  passwordPlain?: string | null;
}) {
  await ensureDb();
  const login = input.login.trim().toLowerCase();
  const [row] = await db
    .insert(platformUsers)
    .values({
      login,
      passwordHash: input.passwordHash,
      passwordPlain: input.passwordPlain ?? null,
      role: "admin",
      participantKind: null,
      displayName: input.displayName,
      employeeId: null,
      candidateId: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row!;
}

export async function getAllPlatformUsers() {
  await ensureDb();
  const rows = await db
    .select({
      id: platformUsers.id,
      login: platformUsers.login,
      passwordPlain: platformUsers.passwordPlain,
      displayName: platformUsers.displayName,
      role: platformUsers.role,
      participantKind: platformUsers.participantKind,
      isActive: platformUsers.isActive,
      createdAt: platformUsers.createdAt,
    })
    .from(platformUsers)
    .orderBy(asc(platformUsers.role), asc(platformUsers.displayName));

  const adminDefaults = getDefaultAdminCredentials();
  return rows.map((row) => {
    if (row.passwordPlain) return row;
    if (
      row.role === "admin" &&
      row.login === adminDefaults.login &&
      adminDefaults.password
    ) {
      return { ...row, passwordPlain: adminDefaults.password };
    }
    return row;
  });
}

export function getDefaultAdminCredentials() {
  const login = (
    process.env.AKELA_ADMIN_LOGIN ||
    process.env.ADMIN_LOGIN ||
    "admin"
  )
    .trim()
    .toLowerCase();
  const customPassword =
    process.env.AKELA_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  return {
    login,
    password: customPassword ? null : "akela-admin",
    passwordIsCustom: Boolean(customPassword),
  };
}

export async function getObserverUsers() {
  await ensureDb();
  return db
    .select({
      id: platformUsers.id,
      login: platformUsers.login,
      displayName: platformUsers.displayName,
      isActive: platformUsers.isActive,
      createdAt: platformUsers.createdAt,
    })
    .from(platformUsers)
    .where(eq(platformUsers.role, "observer"))
    .orderBy(asc(platformUsers.displayName));
}

export async function getParticipantHome(session: SessionUser) {
  if (session.role !== "participant") return null;

  if (session.participantKind === "candidate" && session.candidateId) {
    return getCandidatePortalHome(session.candidateId);
  }

  if (
    (session.participantKind === "employee" ||
      session.participantKind === "intern") &&
    session.employeeId
  ) {
    const pending = await db
      .select({
        id: assignments.id,
        assessmentTitle: assessments.title,
        dueAt: assignments.dueAt,
      })
      .from(assignments)
      .innerJoin(assessments, eq(assignments.assessmentId, assessments.id))
      .where(
        and(
          eq(assignments.employeeId, session.employeeId),
          eq(assignments.status, "pending"),
        ),
      )
      .orderBy(desc(assignments.assignedAt))
      .limit(1);

    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, session.employeeId));

    return {
      person: {
        name: employee?.name ?? session.name,
        roleTitle: employee?.roleTitle ?? "",
        department: employee?.department ?? "",
        status: "testing",
        currentLevel: employee?.currentLevel ?? "junior",
      },
      pending: pending[0]
        ? {
            id: pending[0].id,
            assessmentTitle: pending[0].assessmentTitle,
            dueAt: pending[0].dueAt,
          }
        : null,
      latestDone: null,
      assignments: [],
      participantKind: session.participantKind as "employee" | "intern",
    };
  }

  return {
    person: {
      name: session.name,
      roleTitle: "",
      department: "",
      status: "new",
      currentLevel: "unassessed",
    },
    pending: null,
    latestDone: null,
    assignments: [],
    participantKind: session.participantKind ?? "intern",
  };
}

export async function getParticipantStatistics(session: SessionUser) {
  await ensureDb();
  if (session.role !== "participant" || !session.employeeId) return null;
  if (
    session.participantKind !== "employee" &&
    session.participantKind !== "intern"
  ) {
    return null;
  }

  const detail = await getEmployeeById(session.employeeId);
  if (!detail) return null;

  const platformUser = await getPlatformUserById(session.userId);
  const { getLatestPromotionForEmployee } = await import("./promotions");
  const promotion = await getLatestPromotionForEmployee(session.employeeId);
  const scores = detail.employeeResults.map((r) => r.score);
  const avgScore =
    scores.length > 0
      ? Math.round(
          (scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10,
        ) / 10
      : null;
  const bestScore = scores.length > 0 ? Math.max(...scores) : null;

  const { competencyLooksConfirmed } = await import("../lib/learning-program");
  const { employeeProgressPercent } = await import("../lib/employee-profile");
  const mastered = (detail.matrix ?? []).filter((row) =>
    competencyLooksConfirmed(row.status),
  );
  const improve = (detail.matrix ?? []).filter(
    (row) =>
      row.status !== "not_checked" && !competencyLooksConfirmed(row.status),
  );

  let learning = null as {
    progressPercent: number;
    credited: number;
    total: number;
    overdue: number;
  } | null;
  if (session.participantKind === "employee") {
    const { getEmployeeLearningProgram } = await import("./learning-programs");
    const program = await getEmployeeLearningProgram(session.employeeId);
    if (program) {
      learning = {
        progressPercent: program.progressPercent,
        credited: program.counts.credited,
        total: program.counts.total,
        overdue: program.counts.overdue ?? 0,
      };
    }
  }

  const matrixChecked = mastered.length + improve.length;
  const overallPercent = employeeProgressPercent({
    completedLessons: learning?.credited ?? detail.completedLessonsCount ?? 0,
    assignedLessons: learning?.total ?? detail.completedLessonsCount ?? 0,
    completedTests: scores.length,
    pendingTests: detail.pending.length,
    matrixConfirmed: mastered.length,
    matrixTotal: matrixChecked,
  });

  return {
    person: {
      name: detail.employee.name,
      roleTitle: detail.employee.roleTitle,
      department: detail.employee.department,
      currentLevel: detail.employee.currentLevel,
      targetLevel: detail.employee.targetLevel || "middle",
      startedAt:
        detail.employee.hiredAt ||
        detail.employee.createdAt ||
        platformUser?.createdAt ||
        null,
    },
    participantKind: session.participantKind as "employee" | "intern",
    promotion,
    overallPercent,
    learning,
    competencies: {
      mastered: mastered.map((row) => ({
        name: row.name,
        category: row.category,
        status: row.status,
      })),
      improve: improve.map((row) => ({
        name: row.name,
        category: row.category,
        status: row.status,
      })),
    },
    level: detail.level
      ? {
          code: detail.level.code,
          name: detail.level.name,
          description: detail.level.description,
          nextSteps: detail.level.nextSteps,
          minScore: detail.level.minScore,
          maxScore: detail.level.maxScore,
        }
      : null,
    tests: {
      completedCount: detail.employeeResults.length,
      pendingCount: detail.pending.length,
      avgScore,
      bestScore,
      results: detail.employeeResults,
      pending: detail.pending.map((p) => ({
        id: p.id,
        assessmentTitle: p.assessmentTitle,
        dueAt: p.dueAt,
      })),
    },
  };
}

/**
 * Participant pages only need basic employee data and recent test activity.
 * Using getEmployeeById here also loaded the admin competency matrix, peers,
 * mentorship reports and assignment catalogs on every portal navigation.
 */
async function getParticipantStaffSnapshot(employeeId: number) {
  const [employee] = await db
    .select({
      id: employees.id,
      name: employees.name,
      roleTitle: employees.roleTitle,
      department: employees.department,
      currentLevel: employees.currentLevel,
      targetLevel: employees.targetLevel,
    })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  if (!employee) return null;

  const [employeeResults, pending] = await Promise.all([
    db
      .select({
        id: results.id,
        score: results.score,
        profileJson: results.profileJson,
        completedAt: results.completedAt,
        assessmentTitle: assessments.title,
      })
      .from(results)
      .innerJoin(assessments, eq(results.assessmentId, assessments.id))
      .where(eq(results.employeeId, employeeId))
      .orderBy(desc(results.completedAt))
      .limit(1),
    db
      .select({
        id: assignments.id,
        dueAt: assignments.dueAt,
        assessmentTitle: assessments.title,
        assessmentSource: assessments.source,
      })
      .from(assignments)
      .innerJoin(assessments, eq(assignments.assessmentId, assessments.id))
      .where(
        and(
          eq(assignments.employeeId, employeeId),
          eq(assignments.status, "pending"),
        ),
      )
      .orderBy(desc(assignments.id))
      .limit(1),
  ]);

  return { employee, employeeResults, pending };
}

export async function getParticipantLearning(session: SessionUser) {
  await ensureDb();
  if (session.role !== "participant" || !session.employeeId) return null;
  if (
    session.participantKind !== "employee" &&
    session.participantKind !== "intern"
  ) {
    return null;
  }

  const { extractLearningSignals, recommendLessons } =
    await import("../lib/lessons");
  const {
    getActiveLessonsForCatalog,
    getCompletedLessonIds,
  } = await import("./learning");

  const detail = await getParticipantStaffSnapshot(session.employeeId);
  if (!detail) return null;

  let profile: import("../lib/scoring").KnowledgeProfile | null = null;
  const rawProfile = detail.employeeResults[0]?.profileJson;
  if (rawProfile && rawProfile !== "{}") {
    try {
      const p = JSON.parse(rawProfile) as import("../lib/scoring").KnowledgeProfile;
      if (p && typeof p.overallScore === "number" && p.levelCode) {
        profile = {
          ...p,
          strengths: Array.isArray(p.strengths) ? p.strengths : [],
          gaps: Array.isArray(p.gaps) ? p.gaps : [],
          sections: Array.isArray(p.sections) ? p.sections : [],
        };
      }
    } catch {
      profile = null;
    }
  }

  const latest = detail.employeeResults[0] ?? null;
  const signals = extractLearningSignals(profile);
  const completedIds = await getCompletedLessonIds(session.employeeId);
  let scope: import("./learning").CatalogScope = {
    roleTitle: detail.employee.roleTitle,
  };
  if (session.participantKind === "intern") {
    const { getInternAllowedContentIds } = await import("./mentorship");
    const allowed = await getInternAllowedContentIds(session.employeeId);
    scope = { ids: allowed.lessonIds };
  }
  const library = (await getActiveLessonsForCatalog(scope)).map((lesson) => ({
    ...lesson,
    completed: completedIds.has(lesson.dbId),
  }));

  const recommendations = recommendLessons({
    roleTitle: detail.employee.roleTitle,
    currentLevel: detail.employee.currentLevel,
    gaps: signals.gaps,
    weakSections: signals.weakSections,
    limit: 8,
    catalog: library,
  }).map(({ lesson, reasons }) => ({
    lesson: library.find((l) => l.id === lesson.id) ?? lesson,
    reasons,
  }));

  let program = null as Awaited<
    ReturnType<
      typeof import("./learning-programs").getEmployeeLearningProgram
    >
  >;
  if (session.participantKind === "employee") {
    const {
      ensureEmployeeLearningProgram,
      getEmployeeLearningProgram,
    } = await import("./learning-programs");
    program = await getEmployeeLearningProgram(session.employeeId);
    if (!program || program.items.length === 0) {
      const { getSettingsSection } = await import("./system-settings");
      const learning = await getSettingsSection("learning");
      if (learning.autoAssignLessons) {
        program = await ensureEmployeeLearningProgram(session.employeeId);
      }
    }
  }

  return {
    person: {
      name: detail.employee.name,
      roleTitle: detail.employee.roleTitle,
      department: detail.employee.department,
      currentLevel: detail.employee.currentLevel,
      targetLevel: detail.employee.targetLevel || "middle",
    },
    participantKind: session.participantKind as "employee" | "intern",
    analysis: {
      summary: signals.summary,
      gaps: signals.gaps,
      weakSections: signals.weakSections,
      latestTestTitle: latest?.assessmentTitle ?? null,
      latestScore: latest?.score ?? null,
      hasTests: detail.employeeResults.length > 0,
    },
    roleFamilies: [],
    roleFamilyLabel: detail.employee.roleTitle,
    recommendations,
    library,
    program,
  };
}

export async function getParticipantVerificationTests(session: SessionUser) {
  await ensureDb();
  if (session.role !== "participant" || !session.employeeId) return null;
  if (
    session.participantKind !== "employee" &&
    session.participantKind !== "intern"
  ) {
    return null;
  }

  const { extractLearningSignals } = await import("../lib/lessons");
  const { recommendVerificationTests, isLevelAccessible } = await import(
    "../lib/verification-tests"
  );
  const {
    getActiveTestsForCatalog,
    getCompletedLessonIds,
  } = await import("./learning");

  const detail = await getParticipantStaffSnapshot(session.employeeId);
  if (!detail) return null;

  let profile: import("../lib/scoring").KnowledgeProfile | null = null;
  const rawProfile = detail.employeeResults[0]?.profileJson;
  if (rawProfile && rawProfile !== "{}") {
    try {
      const p = JSON.parse(rawProfile) as import("../lib/scoring").KnowledgeProfile;
      if (p && typeof p.overallScore === "number" && p.levelCode) {
        profile = {
          ...p,
          strengths: Array.isArray(p.strengths) ? p.strengths : [],
          gaps: Array.isArray(p.gaps) ? p.gaps : [],
          sections: Array.isArray(p.sections) ? p.sections : [],
        };
      }
    } catch {
      profile = null;
    }
  }

  const signals = extractLearningSignals(profile);
  const completedIds = await getCompletedLessonIds(session.employeeId);
  let scope: import("./learning").CatalogScope = {
    roleTitle: detail.employee.roleTitle,
  };
  if (session.participantKind === "intern") {
    const { getInternAllowedContentIds } = await import("./mentorship");
    const allowed = await getInternAllowedContentIds(session.employeeId);
    scope = { ids: allowed.testIds };
  }
  const library = (await getActiveTestsForCatalog(scope)).map((test) => {
    const lessonCompleted = completedIds.has(test.lessonDbId);
    const levelOk = isLevelAccessible(
      test.level,
      detail.employee.currentLevel,
    );
    return {
      ...test,
      lessonCompleted,
      unlocked: lessonCompleted && levelOk,
    };
  });
  const recommendations = recommendVerificationTests({
    roleTitle: detail.employee.roleTitle,
    currentLevel: detail.employee.currentLevel,
    gaps: signals.gaps,
    weakSections: signals.weakSections,
    limit: 8,
    catalog: library.filter((t) => t.unlocked),
  });

  const pendingLibrary = detail.pending.filter(
    (item) => item.assessmentSource !== "attestation",
  );
  const { getLatestPromotionForEmployee } = await import("./promotions");
  const promotion = await getLatestPromotionForEmployee(session.employeeId);

  return {
    person: {
      name: detail.employee.name,
      roleTitle: detail.employee.roleTitle,
      department: detail.employee.department,
      currentLevel: detail.employee.currentLevel,
    },
    participantKind: session.participantKind as "employee" | "intern",
    promotion,
    analysis: {
      summary: signals.summary,
      gaps: signals.gaps,
      weakSections: signals.weakSections,
      hasTests: detail.employeeResults.length > 0,
      pendingAssignment: pendingLibrary[0]
        ? {
            id: pendingLibrary[0].id,
            assessmentTitle: pendingLibrary[0].assessmentTitle,
            dueAt: pendingLibrary[0].dueAt,
          }
        : null,
    },
    roleFamilyLabel: detail.employee.roleTitle,
    recommendations,
    library,
  };
}

export type TopExpert = {
  employeeId: number;
  employeeName: string;
  department: string;
  roleTitle: string;
  score: number;
  knowledgeScore: number | null;
  levelCode: string;
  testCount: number;
  bestAssessmentTitle: string;
};

export type DashboardKpis = {
  newCandidates: number;
  underReview: number;
  interviewsToday: number;
  awaitingTest: number;
  testsCompleted: number;
  onTrial5Days: number;
  onLearning3Months: number;
  upcomingAttestations: number;
  overdueAssignments: number;
  confirmedMiddle: number;
};

export type DashboardFunnelStage = {
  id: FunnelStageId;
  count: number;
};

export type DashboardActionItem = {
  id: string;
  titleKey:
    | "dash_task_review_candidate"
    | "dash_task_confirm_interview"
    | "dash_task_review_test"
    | "dash_task_trial_decision"
    | "dash_task_check_intern_work"
    | "dash_task_assign_mentor"
    | "dash_task_run_attestation"
    | "dash_task_check_lesson"
    | "dash_task_fix_overdue"
    | "dash_warn_interview_unconfirmed"
    | "dash_warn_test_incomplete"
    | "dash_warn_missed_learning_day"
    | "dash_warn_mentor_pending"
    | "dash_warn_behind_program"
    | "dash_warn_attestation_due"
    | "dash_warn_verifix_failed"
    | "dash_warn_intern_no_mentor"
    | "dash_warn_intern_no_end"
    | "dash_warn_no_program"
    | "dash_warn_lesson_unreviewed"
    | "dash_warn_test_unassigned"
    | "dash_warn_overdue"
    | "dash_warn_integration"
    | "dash_warn_inactive_login"
    | "dash_warn_role_no_comps"
    | "dash_dec_interview_wait"
    | "dash_dec_test_done"
    | "dash_dec_ready_trial"
    | "dash_dec_trial_done"
    | "dash_dec_ready_attest"
    | "dash_dec_confirm_middle"
    | "dash_dec_extend_deadline"
    | "dash_dec_behind";
  href: string;
  count: number;
  /** Optional per-entity label for admin desk (name/time). */
  detail?: string;
  actions?: {
    labelKey:
      | "dash_act_open"
      | "dash_act_reschedule"
      | "dash_act_start"
      | "dash_act_decide"
      | "dash_act_assign";
    href: string;
  }[];
};

export type HrDashboardStats = {
  kpis: DashboardKpis;
  funnel: DashboardFunnelStage[];
  decisions: DashboardActionItem[];
  tasks: DashboardActionItem[];
  warnings: DashboardActionItem[];
  hiringExtra: { rejected: number; reserve: number };
  trialBlock: {
    active: number;
    reportsPending: number;
    overdue: number;
    endingToday: number;
    hired: number;
    rejected: number;
    byDay: { day: number; count: number }[];
  };
  learningBlock: {
    onLearning: number;
    bucket025: number;
    bucket2650: number;
    bucket5175: number;
    bucket7699: number;
    readyAttestation: number;
    middle: number;
    lagging: number;
    noProgram: number;
  };
  events: {
    id: string;
    kind: string;
    title: string;
    when: string;
    href: string;
  }[];
  companyMetrics: {
    conversionHirePct: number;
    testPassPct: number;
    trialHirePct: number;
    overdueTasks: number;
    avgDaysToMiddle: number | null;
  };
  integrations: {
    id: string;
    labelKey:
      | "dash_int_telegram"
      | "dash_int_verifix"
      | "dash_int_bitrix"
      | "dash_int_drive"
      | "dash_int_smtp"
      | "dash_int_openai";
    status: "ok" | "error" | "unset";
    href: string;
  }[];
  departments: string[];
};

export async function getDashboardStats(): Promise<HrDashboardStats> {
  await ensureDb();

  const [
    allCandidates,
    candAssignments,
    candResults,
    allEmployees,
    activeMentorships,
    endedMentorships,
    progressRows,
    allAttestations,
    pendingEmployeeAssignments,
    submittedReports,
    todayInterviews,
  ] = await Promise.all([
    db
      .select({
        id: candidates.id,
        status: candidates.status,
        source: candidates.source,
      })
      .from(candidates),
    db
      .select({ status: candidateAssignments.status })
      .from(candidateAssignments),
    db
      .select({ candidateId: candidateResults.candidateId })
      .from(candidateResults),
    db
      .select({
        id: employees.id,
        name: employees.name,
        currentLevel: employees.currentLevel,
        hiredAt: employees.hiredAt,
        department: employees.department,
        roleTitle: employees.roleTitle,
        status: employees.status,
      })
      .from(employees),
    db
      .select({
        internEmployeeId: internMentorships.internEmployeeId,
        mentorUserId: internMentorships.mentorUserId,
        status: internMentorships.status,
        trialStartsAt: internMentorships.trialStartsAt,
        trialEndsAt: internMentorships.trialEndsAt,
      })
      .from(internMentorships)
      .where(
        sql`${internMentorships.status} IN ('active', 'extended')`,
      ),
    db
      .select({ status: internMentorships.status })
      .from(internMentorships)
      .where(
        sql`${internMentorships.status} IN ('ended', 'hired', 'other_role')`,
      ),
    db
      .select({ employeeId: lessonProgress.employeeId })
      .from(lessonProgress),
    db
      .select({
        isActive: attestations.isActive,
        startsAt: attestations.startsAt,
        scheduledAt: attestations.scheduledAt,
      })
      .from(attestations),
    db
      .select({ dueAt: assignments.dueAt })
      .from(assignments)
      .where(eq(assignments.status, "pending")),
    db
      .select({
        submittedAt: internDailyReports.submittedAt,
        createdAt: internDailyReports.createdAt,
      })
      .from(internDailyReports)
      .where(eq(internDailyReports.status, "submitted")),
    db
      .select({
        id: interviews.id,
        scheduledAt: interviews.scheduledAt,
        candidateName: candidates.name,
      })
      .from(interviews)
      .leftJoin(candidates, eq(interviews.candidateId, candidates.id))
      .where(ne(interviews.status, "cancelled")),
  ]);

  const statusCounts = countByCanonicalStatus(allCandidates);
  const telegramFormCount = allCandidates.filter(
    (c) => c.source === "telegram" && normalizeCandidateStatus(c.status) === "new",
  ).length;
  const verifixFormCount = allCandidates.filter(
    (c) => c.source === "verifix" && normalizeCandidateStatus(c.status) === "new",
  ).length;
  const now = Date.now();
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const in30Days = new Date(now + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const openTestAttempts = candAssignments.filter(
    (a) => a.status === "pending" || a.status === "in_progress",
  ).length;

  const completedCandidateIds = new Set<number>();
  for (const c of allCandidates) {
    const s = normalizeCandidateStatus(c.status);
    if (
      s === "test_completed" ||
      s === "trial_admitted" ||
      s === "hired"
    ) {
      completedCandidateIds.add(c.id);
    }
  }
  for (const r of candResults) completedCandidateIds.add(r.candidateId);

  const internEmployeeIds = new Set(
    activeMentorships.map((m) => m.internEmployeeId),
  );
  const learningEmployeeIds = new Set(
    progressRows
      .map((p) => p.employeeId)
      .filter((id) => !internEmployeeIds.has(id)),
  );

  const upcomingAttestations = allAttestations.filter((a) => {
    if (!a.isActive) return false;
    const day = (a.startsAt || a.scheduledAt || "").slice(0, 10);
    if (!day) return false;
    return day >= today && day <= in30Days;
  }).length;

  const overdueEmployeeAssignments = pendingEmployeeAssignments.filter((a) => {
    if (!a.dueAt) return false;
    return a.dueAt < nowIso;
  }).length;

  const overdueReports = submittedReports.filter((r) => {
    const submitted = r.submittedAt || r.createdAt;
    if (!submitted) return true;
    return now - new Date(submitted).getTime() > 2 * 24 * 60 * 60 * 1000;
  }).length;

  const confirmedMiddle = allEmployees.filter((e) =>
    ["middle", "senior", "lead", "expert"].includes(e.currentLevel),
  ).length;

  const assessedAwaitingDecision = allCandidates.filter(
    (c) => normalizeCandidateStatus(c.status) === "test_completed",
  ).length;
  const trialDecisionNeeded = allCandidates.filter(
    (c) => c.status === "internship_ready",
  ).length;

  const mentorshipsWithoutMentor = activeMentorships.filter(
    (m) => m.mentorUserId == null,
  ).length;

  const attestationDue = allAttestations.filter((a) => {
    if (!a.isActive) return false;
    const day = (a.startsAt || a.scheduledAt || "").slice(0, 10);
    return Boolean(day && day <= today);
  }).length;

  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const behindProgram = allEmployees.filter((e) => {
    if (internEmployeeIds.has(e.id)) return false;
    if (e.currentLevel !== "junior" && e.currentLevel !== "unassessed") {
      return false;
    }
    const hired = e.hiredAt ? new Date(e.hiredAt).getTime() : NaN;
    if (!Number.isFinite(hired) || now - hired > ninetyDaysMs) return false;
    return !learningEmployeeIds.has(e.id);
  }).length;

  const kpis: DashboardKpis = {
    newCandidates: statusCounts.new,
    underReview: statusCounts.reviewing + statusCounts.awaiting_invite,
    interviewsToday: todayInterviews.filter((i) =>
      i.scheduledAt.startsWith(today),
    ).length,
    awaitingTest: Math.max(statusCounts.test_assigned, openTestAttempts),
    testsCompleted: completedCandidateIds.size,
    onTrial5Days: activeMentorships.length,
    onLearning3Months: learningEmployeeIds.size,
    upcomingAttestations,
    overdueAssignments: overdueEmployeeAssignments + overdueReports,
    confirmedMiddle,
  };

  const funnel: DashboardFunnelStage[] = FUNNEL_STAGES.map((id) => {
    let count = 0;
    switch (id) {
      case "telegram_form":
        count = telegramFormCount;
        break;
      case "verifix":
        count = verifixFormCount;
        break;
      case "invited":
        count = statusCounts.invited;
        break;
      case "interview_confirmed":
        count = statusCounts.interview_confirmed;
        break;
      case "interview_passed":
        count = statusCounts.interview_passed;
        break;
      case "test_assigned":
        count = Math.max(statusCounts.test_assigned, openTestAttempts);
        break;
      case "test_completed":
        count = statusCounts.test_completed;
        break;
      case "trial_admitted":
        count = Math.max(statusCounts.trial_admitted, activeMentorships.length);
        break;
      case "trial_completed":
        count = endedMentorships.length;
        break;
      case "hired":
        count = statusCounts.hired;
        break;
      case "learning_3m":
        count = learningEmployeeIds.size;
        break;
      case "attestation_ready":
        count = Math.max(upcomingAttestations, attestationDue);
        break;
      case "middle_confirmed":
        count = confirmedMiddle;
        break;
    }
    return { id, count };
  });

  const decisions: DashboardActionItem[] = [];
  const tasks: DashboardActionItem[] = [];

  const interviewsToday = todayInterviews.filter((i) =>
    i.scheduledAt.startsWith(today),
  );
  for (const iv of interviewsToday) {
    const time = iv.scheduledAt.slice(11, 16);
    const name = iv.candidateName ?? "—";
    tasks.push({
      id: `interview_${iv.id}`,
      titleKey: "dash_task_confirm_interview",
      href: "/interviews",
      count: 1,
      detail: `${name} — ${time}`,
      actions: [
        { labelKey: "dash_act_open", href: "/interviews" },
        { labelKey: "dash_act_reschedule", href: "/interviews" },
        { labelKey: "dash_act_start", href: "/interviews" },
      ],
    });
  }

  if (statusCounts.new > 0) {
    decisions.push({
      id: "review_candidate",
      titleKey: "dash_dec_interview_wait",
      href: "/candidates",
      count: statusCounts.new,
      actions: [{ labelKey: "dash_act_open", href: "/candidates" }],
    });
  }
  if (assessedAwaitingDecision > 0) {
    decisions.push({
      id: "review_test",
      titleKey: "dash_dec_test_done",
      href: "/candidates",
      count: assessedAwaitingDecision,
      actions: [{ labelKey: "dash_act_decide", href: "/candidates" }],
    });
  }
  if (statusCounts.trial_admitted > 0 && trialDecisionNeeded === 0) {
    decisions.push({
      id: "ready_trial",
      titleKey: "dash_dec_ready_trial",
      href: "/trial",
      count: statusCounts.trial_admitted,
      actions: [{ labelKey: "dash_act_open", href: "/trial" }],
    });
  }
  if (trialDecisionNeeded > 0) {
    decisions.push({
      id: "trial_decision",
      titleKey: "dash_dec_trial_done",
      href: "/trial",
      count: trialDecisionNeeded,
      actions: [{ labelKey: "dash_act_decide", href: "/trial" }],
    });
  }
  if (attestationDue > 0) {
    decisions.push({
      id: "ready_attest",
      titleKey: "dash_dec_ready_attest",
      href: "/attestation",
      count: attestationDue,
      actions: [
        { labelKey: "dash_act_open", href: "/attestation" },
        { labelKey: "dash_act_start", href: "/attestation" },
      ],
    });
  }
  if (behindProgram > 0) {
    decisions.push({
      id: "behind",
      titleKey: "dash_dec_behind",
      href: "/learning?focus=overdue",
      count: behindProgram,
      actions: [{ labelKey: "dash_act_open", href: "/learning?focus=overdue" }],
    });
  }
  if (submittedReports.length > 0) {
    tasks.push({
      id: "check_intern",
      titleKey: "dash_task_check_intern_work",
      href: "/interns",
      count: submittedReports.length,
      actions: [
        { labelKey: "dash_act_open", href: "/interns" },
        { labelKey: "dash_act_start", href: "/interns" },
      ],
    });
  }
  if (mentorshipsWithoutMentor > 0) {
    tasks.push({
      id: "assign_mentor",
      titleKey: "dash_task_assign_mentor",
      href: "/mentors",
      count: mentorshipsWithoutMentor,
      actions: [
        { labelKey: "dash_act_assign", href: "/mentors" },
        { labelKey: "dash_act_open", href: "/employees?tab=people" },
      ],
    });
  }
  if (upcomingAttestations > 0 || attestationDue > 0) {
    tasks.push({
      id: "run_attestation",
      titleKey: "dash_task_run_attestation",
      href: "/attestation",
      count: Math.max(upcomingAttestations, attestationDue),
      actions: [
        { labelKey: "dash_act_open", href: "/attestation" },
        { labelKey: "dash_act_reschedule", href: "/attestation" },
        { labelKey: "dash_act_start", href: "/attestation" },
      ],
    });
  }
  if (overdueEmployeeAssignments > 0) {
    tasks.push({
      id: "fix_overdue",
      titleKey: "dash_task_fix_overdue",
      href: "/learning?focus=overdue",
      count: overdueEmployeeAssignments,
      actions: [
        { labelKey: "dash_act_open", href: "/learning?focus=overdue" },
        { labelKey: "dash_act_start", href: "/learning?focus=overdue" },
      ],
    });
  }

  const warnings: DashboardActionItem[] = [];
  if (mentorshipsWithoutMentor > 0) {
    warnings.push({
      id: "intern_no_mentor",
      titleKey: "dash_warn_intern_no_mentor",
      href: "/mentors",
      count: mentorshipsWithoutMentor,
    });
  }
  if (openTestAttempts > 0 || statusCounts.test_assigned > 0) {
    warnings.push({
      id: "test_incomplete",
      titleKey: "dash_warn_test_incomplete",
      href: "/candidates",
      count: Math.max(openTestAttempts, statusCounts.test_assigned),
    });
  }
  if (statusCounts.interview_passed > 0 && statusCounts.test_assigned === 0) {
    warnings.push({
      id: "test_unassigned",
      titleKey: "dash_warn_test_unassigned",
      href: "/candidates",
      count: statusCounts.interview_passed,
    });
  }
  if (submittedReports.length > 0) {
    warnings.push({
      id: "lesson_unreviewed",
      titleKey: "dash_warn_lesson_unreviewed",
      href: "/interns",
      count: submittedReports.length,
    });
  }
  if (overdueEmployeeAssignments + overdueReports > 0) {
    warnings.push({
      id: "overdue",
      titleKey: "dash_warn_overdue",
      href: "/learning?focus=overdue",
      count: overdueEmployeeAssignments + overdueReports,
    });
  }
  if (behindProgram > 0) {
    warnings.push({
      id: "no_program",
      titleKey: "dash_warn_no_program",
      href: "/learning",
      count: behindProgram,
    });
    warnings.push({
      id: "behind_program",
      titleKey: "dash_warn_behind_program",
      href: "/learning",
      count: behindProgram,
    });
  }
  if (attestationDue > 0) {
    warnings.push({
      id: "attestation_due",
      titleKey: "dash_warn_attestation_due",
      href: "/attestation",
      count: attestationDue,
    });
  }

  const byDay = [1, 2, 3, 4, 5].map((day) => ({ day, count: 0 }));
  let endingToday = 0;
  for (const m of activeMentorships) {
    const start = m.trialStartsAt ? new Date(m.trialStartsAt).getTime() : NaN;
    if (Number.isFinite(start)) {
      const dayNum = Math.min(
        5,
        Math.max(1, Math.floor((now - start) / 86_400_000) + 1),
      );
      const bucket = byDay.find((row) => row.day === dayNum);
      if (bucket) bucket.count += 1;
    }
    if ((m.trialEndsAt || "").slice(0, 10) === today) endingToday += 1;
  }

  const hiredTrial = endedMentorships.filter((m) => m.status === "hired").length;
  const rejectedTrial = endedMentorships.filter(
    (m) => m.status === "ended" || m.status === "other_role",
  ).length;

  // Learning progress buckets (approx by program presence / level)
  const onLearning = learningEmployeeIds.size;
  const noProgram = behindProgram;
  const middle = confirmedMiddle;
  const readyAttestation = Math.max(upcomingAttestations, attestationDue);
  const lagging = behindProgram;
  // Split remaining learners evenly-ish for desk chart until full % tracking is wired
  const rest = Math.max(0, onLearning - lagging);
  const learningBlock = {
    onLearning,
    bucket025: Math.round(rest * 0.25) + (lagging > 0 ? Math.min(lagging, 3) : 0),
    bucket2650: Math.round(rest * 0.25),
    bucket5175: Math.round(rest * 0.25),
    bucket7699: Math.max(0, rest - Math.round(rest * 0.75)),
    readyAttestation,
    middle,
    lagging,
    noProgram,
  };

  const events: HrDashboardStats["events"] = [];
  for (const iv of interviewsToday.slice(0, 8)) {
    events.push({
      id: `ev-iv-${iv.id}`,
      kind: "interview",
      title: iv.candidateName ?? "—",
      when: iv.scheduledAt,
      href: "/interviews",
    });
  }
  for (const a of allAttestations
    .filter((row) => row.isActive)
    .slice(0, 8)) {
    const when = a.startsAt || a.scheduledAt;
    if (!when) continue;
    events.push({
      id: `ev-at-${when}`,
      kind: "attestation",
      title: "Аттестация",
      when,
      href: "/attestation",
    });
  }
  events.sort((a, b) => a.when.localeCompare(b.when));

  const totalCand = allCandidates.length || 1;
  const companyMetrics = {
    conversionHirePct: Math.round((statusCounts.hired / totalCand) * 1000) / 10,
    testPassPct:
      Math.round(
        (completedCandidateIds.size /
          Math.max(1, statusCounts.test_assigned + completedCandidateIds.size)) *
          1000,
      ) / 10,
    trialHirePct:
      Math.round(
        (hiredTrial / Math.max(1, hiredTrial + rejectedTrial + activeMentorships.length)) *
          1000,
      ) / 10,
    overdueTasks: overdueEmployeeAssignments + overdueReports,
    avgDaysToMiddle: null as number | null,
  };

  let integrations: HrDashboardStats["integrations"] = [
    {
      id: "telegram",
      labelKey: "dash_int_telegram",
      status: "unset",
      href: "/integrations/telegram",
    },
    {
      id: "verifix",
      labelKey: "dash_int_verifix",
      status: "unset",
      href: "/integrations/verifix",
    },
    {
      id: "bitrix",
      labelKey: "dash_int_bitrix",
      status: "unset",
      href: "/integrations/bitrix",
    },
    {
      id: "drive",
      labelKey: "dash_int_drive",
      status: "unset",
      href: "/integrations/storage",
    },
    {
      id: "smtp",
      labelKey: "dash_int_smtp",
      status: "unset",
      href: "/integrations/smtp",
    },
    {
      id: "openai",
      labelKey: "dash_int_openai",
      status: "unset",
      href: "/integrations",
    },
  ];
  try {
    const { getIntegrationsOverview } = await import("./integrations");
    const overview = await getIntegrationsOverview();
    integrations = integrations.map((item) => {
      const found = overview.items.find((row) => row.system === item.id);
      if (!found) return item;
      return {
        ...item,
        status: found.configured ? ("ok" as const) : ("unset" as const),
      };
    });
  } catch {
    // keep unset
  }

  const departments = [
    ...new Set(
      allEmployees
        .map((e) => e.department)
        .filter((d): d is string => Boolean(d && d.trim())),
    ),
  ].sort((a, b) => a.localeCompare(b, "ru"));

  return {
    kpis,
    funnel,
    decisions,
    tasks,
    warnings,
    hiringExtra: {
      rejected: statusCounts.rejected,
      reserve: statusCounts.reserve,
    },
    trialBlock: {
      active: activeMentorships.length,
      reportsPending: submittedReports.length,
      overdue: overdueReports,
      endingToday,
      hired: hiredTrial,
      rejected: rejectedTrial,
      byDay,
    },
    learningBlock,
    events: events.slice(0, 12),
    companyMetrics,
    integrations,
    departments,
  };
}

export type ResultPerson = {
  personId: number;
  personName: string;
  meta: string;
  avatarHue: number;
  resultCount: number;
  latestAt: string;
  latestScore: number;
  latestLevel: string;
};

export type PersonTestResult = {
  resultId: number;
  assessmentId: number;
  assessmentTitle: string;
  competencyName: string;
  score: number;
  levelCode: string;
  completedAt: string;
  profileJson: string;
};

export function matchAudienceStrict(
  competencyName: string,
  group: ResultsGroup,
): boolean {
  const n = competencyName.toLowerCase();
  if (group === "interns") return /стаж|intern|стажер|стажёр/.test(n);
  if (group === "candidates") return /кандидат|candidate|вакант/.test(n);
  // сотрудники: всё, что не стажёрский тест
  return !/стаж|intern|стажер|стажёр/.test(n);
}

export async function getResultsGroupCounts() {
  await ensureDb();
  const [peopleEmployees, peopleInterns, peopleCandidates] = await Promise.all([
    getResultPeople("employees"),
    getResultPeople("interns"),
    getResultPeople("candidates"),
  ]);
  return {
    employees: peopleEmployees.length,
    interns: peopleInterns.length,
    candidates: peopleCandidates.length,
  };
}

export type ObserverPersonRow = {
  id: number;
  name: string;
  roleTitle: string;
  department: string;
  avatarHue: number;
  resultCount: number;
  avgScore: number | null;
  latestScore: number | null;
  latestLevel: string | null;
  latestAt: string | null;
};

export type ObserverDepartmentBlock = {
  department: string;
  employeeCount: number;
  assessedCount: number;
  avgScore: number | null;
  people: ObserverPersonRow[];
};

export type ObserverDashboard = {
  summary: {
    employeesCount: number;
    employeesAssessed: number;
    employeesAvgScore: number | null;
    internsCount: number;
    internsAssessed: number;
    internsAvgScore: number | null;
    candidatesTotal: number;
    candidatesAssessed: number;
    candidatesAvgScore: number | null;
  };
  departments: ObserverDepartmentBlock[];
  interns: ObserverPersonRow[];
  candidates: ObserverPersonRow[];
};

function isInternRole(roleTitle: string) {
  return /стаж|intern|стажер|стажёр/i.test(roleTitle);
}

function avg(nums: number[]) {
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}

export async function getObserverDashboard(): Promise<ObserverDashboard> {
  await ensureDb();

  const allEmployees = await db
    .select()
    .from(employees)
    .orderBy(asc(employees.department), asc(employees.name));

  const allCandidates = await db.select().from(candidates);

  const employeeResultRows = await db
    .select({
      employeeId: results.employeeId,
      score: results.score,
      levelCode: results.levelCode,
      completedAt: results.completedAt,
      competencyName: competencies.name,
    })
    .from(results)
    .innerJoin(assessments, eq(results.assessmentId, assessments.id))
    .innerJoin(competencies, eq(assessments.competencyId, competencies.id))
    .orderBy(desc(results.completedAt));

  const candidateResultRows = await db
    .select({
      candidateId: candidateResults.candidateId,
      score: candidateResults.score,
      levelCode: candidateResults.levelCode,
      completedAt: candidateResults.completedAt,
      roleTitle: vacancies.roleTitle,
      department: vacancies.department,
      name: candidates.name,
      avatarHue: candidates.avatarHue,
    })
    .from(candidateResults)
    .innerJoin(candidates, eq(candidateResults.candidateId, candidates.id))
    .innerJoin(vacancies, eq(candidates.vacancyId, vacancies.id))
    .orderBy(desc(candidateResults.completedAt));

  type ScoreBag = {
    scores: number[];
    latestScore: number;
    latestLevel: string;
    latestAt: string;
  };

  const empScores = new Map<number, ScoreBag>();
  for (const r of employeeResultRows) {
    // For staff/intern person stats use all their employee results
    const cur = empScores.get(r.employeeId);
    if (!cur) {
      empScores.set(r.employeeId, {
        scores: [r.score],
        latestScore: r.score,
        latestLevel: r.levelCode,
        latestAt: r.completedAt,
      });
    } else {
      cur.scores.push(r.score);
      if (new Date(r.completedAt) > new Date(cur.latestAt)) {
        cur.latestAt = r.completedAt;
        cur.latestScore = r.score;
        cur.latestLevel = r.levelCode;
      }
    }
  }

  const candScores = new Map<number, ScoreBag>();
  for (const r of candidateResultRows) {
    const cur = candScores.get(r.candidateId);
    if (!cur) {
      candScores.set(r.candidateId, {
        scores: [r.score],
        latestScore: r.score,
        latestLevel: r.levelCode,
        latestAt: r.completedAt,
      });
    } else {
      cur.scores.push(r.score);
      if (new Date(r.completedAt) > new Date(cur.latestAt)) {
        cur.latestAt = r.completedAt;
        cur.latestScore = r.score;
        cur.latestLevel = r.levelCode;
      }
    }
  }

  function toPersonRow(
    id: number,
    name: string,
    roleTitle: string,
    department: string,
    avatarHue: number,
    bag: ScoreBag | undefined,
  ): ObserverPersonRow {
    return {
      id,
      name,
      roleTitle,
      department,
      avatarHue,
      resultCount: bag?.scores.length ?? 0,
      avgScore: bag ? avg(bag.scores) : null,
      latestScore: bag?.latestScore ?? null,
      latestLevel: bag?.latestLevel ?? null,
      latestAt: bag?.latestAt ?? null,
    };
  }

  const staff = allEmployees.filter((e) => !isInternRole(e.roleTitle));
  const internList = allEmployees.filter((e) => isInternRole(e.roleTitle));

  const staffRows = staff.map((e) =>
    toPersonRow(
      e.id,
      e.name,
      e.roleTitle,
      e.department,
      e.avatarHue,
      empScores.get(e.id),
    ),
  );
  const internRows = internList.map((e) =>
    toPersonRow(
      e.id,
      e.name,
      e.roleTitle,
      e.department,
      e.avatarHue,
      empScores.get(e.id),
    ),
  );

  const candidateRows: ObserverPersonRow[] = [];
  const seenCand = new Set<number>();

  for (const r of candidateResultRows) {
    if (seenCand.has(r.candidateId)) continue;
    seenCand.add(r.candidateId);
    candidateRows.push(
      toPersonRow(
        r.candidateId,
        r.name,
        r.roleTitle,
        r.department,
        r.avatarHue,
        candScores.get(r.candidateId),
      ),
    );
  }
  for (const c of allCandidates) {
    if (seenCand.has(c.id)) continue;
    candidateRows.push({
      id: c.id,
      name: c.name,
      roleTitle: "",
      department: "",
      avatarHue: c.avatarHue,
      resultCount: 0,
      avgScore: null,
      latestScore: null,
      latestLevel: null,
      latestAt: null,
    });
  }

  const candWithVacancy = await db
    .select({
      id: candidates.id,
      roleTitle: vacancies.roleTitle,
      department: vacancies.department,
    })
    .from(candidates)
    .innerJoin(vacancies, eq(candidates.vacancyId, vacancies.id));
  const vacMeta = new Map(candWithVacancy.map((c) => [c.id, c]));
  for (const row of candidateRows) {
    const m = vacMeta.get(row.id);
    if (m) {
      if (!row.roleTitle) row.roleTitle = m.roleTitle;
      if (!row.department) row.department = m.department;
    }
  }

  const byDept = new Map<string, ObserverPersonRow[]>();
  for (const p of staffRows) {
    const list = byDept.get(p.department) ?? [];
    list.push(p);
    byDept.set(p.department, list);
  }

  const departments: ObserverDepartmentBlock[] = [...byDept.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ru"))
    .map(([department, people]) => {
      const assessed = people.filter((p) => p.avgScore != null);
      return {
        department,
        employeeCount: people.length,
        assessedCount: assessed.length,
        avgScore: avg(assessed.map((p) => p.avgScore!)),
        people,
      };
    });

  const staffAssessed = staffRows.filter((p) => p.avgScore != null);
  const internAssessed = internRows.filter((p) => p.avgScore != null);
  const candAssessed = candidateRows.filter((p) => p.avgScore != null);

  return {
    summary: {
      employeesCount: staffRows.length,
      employeesAssessed: staffAssessed.length,
      employeesAvgScore: avg(staffAssessed.map((p) => p.avgScore!)),
      internsCount: internRows.length,
      internsAssessed: internAssessed.length,
      internsAvgScore: avg(internAssessed.map((p) => p.avgScore!)),
      candidatesTotal: allCandidates.length,
      candidatesAssessed: candAssessed.length,
      candidatesAvgScore: avg(candAssessed.map((p) => p.avgScore!)),
    },
    departments,
    interns: internRows,
    candidates: candidateRows.sort((a, b) =>
      a.name.localeCompare(b.name, "ru"),
    ),
  };
}

export async function getResultPeople(
  group: ResultsGroup,
): Promise<ResultPerson[]> {
  await ensureDb();

  if (group === "candidates") {
    const rows = await db
      .select({
        personId: candidateResults.candidateId,
        personName: candidates.name,
        meta: vacancies.roleTitle,
        avatarHue: candidates.avatarHue,
        score: candidateResults.score,
        levelCode: candidateResults.levelCode,
        completedAt: candidateResults.completedAt,
        competencyName: competencies.name,
      })
      .from(candidateResults)
      .innerJoin(candidates, eq(candidateResults.candidateId, candidates.id))
      .innerJoin(vacancies, eq(candidates.vacancyId, vacancies.id))
      .innerJoin(assessments, eq(candidateResults.assessmentId, assessments.id))
      .innerJoin(competencies, eq(assessments.competencyId, competencies.id))
      .orderBy(desc(candidateResults.completedAt));

    return aggregatePeople(
      rows.map((r) => ({
        personId: r.personId,
        personName: r.personName,
        meta: r.meta,
        avatarHue: r.avatarHue,
        score: r.score,
        levelCode: r.levelCode,
        completedAt: r.completedAt,
      })),
    );
  }

  const rows = await db
    .select({
      personId: results.employeeId,
      personName: employees.name,
      meta: employees.roleTitle,
      department: employees.department,
      avatarHue: employees.avatarHue,
      score: results.score,
      levelCode: results.levelCode,
      completedAt: results.completedAt,
      competencyName: competencies.name,
    })
    .from(results)
    .innerJoin(employees, eq(results.employeeId, employees.id))
    .innerJoin(assessments, eq(results.assessmentId, assessments.id))
    .innerJoin(competencies, eq(assessments.competencyId, competencies.id))
    .orderBy(desc(results.completedAt));

  const filtered = rows.filter((r) =>
    matchAudienceStrict(r.competencyName, group),
  );

  return aggregatePeople(
    filtered.map((r) => ({
      personId: r.personId,
      personName: r.personName,
      meta: `${r.meta} · ${r.department}`,
      avatarHue: r.avatarHue,
      score: r.score,
      levelCode: r.levelCode,
      completedAt: r.completedAt,
    })),
  );
}

function aggregatePeople(
  rows: {
    personId: number;
    personName: string;
    meta: string;
    avatarHue: number;
    score: number;
    levelCode: string;
    completedAt: string;
  }[],
): ResultPerson[] {
  const map = new Map<number, ResultPerson>();
  for (const r of rows) {
    const cur = map.get(r.personId);
    if (!cur) {
      map.set(r.personId, {
        personId: r.personId,
        personName: r.personName,
        meta: r.meta,
        avatarHue: r.avatarHue,
        resultCount: 1,
        latestAt: r.completedAt,
        latestScore: r.score,
        latestLevel: r.levelCode,
      });
    } else {
      cur.resultCount += 1;
      if (new Date(r.completedAt) > new Date(cur.latestAt)) {
        cur.latestAt = r.completedAt;
        cur.latestScore = r.score;
        cur.latestLevel = r.levelCode;
      }
    }
  }
  return [...map.values()].sort((a, b) =>
    a.personName.localeCompare(b.personName, "ru"),
  );
}

export async function getPersonTestResults(
  group: ResultsGroup,
  personId: number,
): Promise<{ personName: string; meta: string; tests: PersonTestResult[] } | null> {
  await ensureDb();

  if (group === "candidates") {
    const [person] = await db
      .select({
        name: candidates.name,
        meta: vacancies.roleTitle,
      })
      .from(candidates)
      .innerJoin(vacancies, eq(candidates.vacancyId, vacancies.id))
      .where(eq(candidates.id, personId));
    if (!person) return null;

    const tests = await db
      .select({
        resultId: candidateResults.id,
        assessmentId: candidateResults.assessmentId,
        assessmentTitle: assessments.title,
        competencyName: competencies.name,
        score: candidateResults.score,
        levelCode: candidateResults.levelCode,
        completedAt: candidateResults.completedAt,
        profileJson: candidateResults.profileJson,
      })
      .from(candidateResults)
      .innerJoin(assessments, eq(candidateResults.assessmentId, assessments.id))
      .innerJoin(competencies, eq(assessments.competencyId, competencies.id))
      .where(eq(candidateResults.candidateId, personId))
      .orderBy(desc(candidateResults.completedAt));

    return {
      personName: person.name,
      meta: person.meta,
      tests: tests.map((t) => ({
        ...t,
        profileJson: t.profileJson || "{}",
      })),
    };
  }

  const [person] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, personId));
  if (!person) return null;

  const rows = await db
    .select({
      resultId: results.id,
      assessmentId: results.assessmentId,
      assessmentTitle: assessments.title,
      competencyName: competencies.name,
      score: results.score,
      levelCode: results.levelCode,
      completedAt: results.completedAt,
      profileJson: results.profileJson,
    })
    .from(results)
    .innerJoin(assessments, eq(results.assessmentId, assessments.id))
    .innerJoin(competencies, eq(assessments.competencyId, competencies.id))
    .where(eq(results.employeeId, personId))
    .orderBy(desc(results.completedAt));

  const tests = rows
    .filter((t) => matchAudienceStrict(t.competencyName, group))
    .map((t) => ({
      ...t,
      profileJson: t.profileJson || "{}",
    }));

  return {
    personName: person.name,
    meta: `${person.roleTitle} · ${person.department}`,
    tests,
  };
}

export async function getPersonResultDetail(
  group: ResultsGroup,
  personId: number,
  resultId: number,
): Promise<
  | (PersonTestResult & {
      personName: string;
      meta: string;
    })
  | null
> {
  const pack = await getPersonTestResults(group, personId);
  if (!pack) return null;
  const test = pack.tests.find((t) => t.resultId === resultId);
  if (!test) return null;
  return {
    ...test,
    personName: pack.personName,
    meta: pack.meta,
  };
}

export async function getVacancies() {
  await ensureDb();
  return db
    .select()
    .from(vacancies)
    .where(eq(vacancies.status, "open"))
    .orderBy(asc(vacancies.department));
}

export async function getEmployees() {
  await ensureDb();
  return db.select().from(employees).orderBy(asc(employees.name));
}

export async function getEmployeesDirectory() {
  await ensureDb();
  const [
    allEmployees,
    allUsers,
    allResults,
    allAssignments,
    matrixRows,
    progressRows,
  ] = await Promise.all([
    db.select().from(employees).orderBy(asc(employees.name)),
    db
      .select({
        id: platformUsers.id,
        displayName: platformUsers.displayName,
        employeeId: platformUsers.employeeId,
      })
      .from(platformUsers),
    db
      .select({
        employeeId: results.employeeId,
        id: results.id,
      })
      .from(results),
    db
      .select({
        employeeId: assignments.employeeId,
        status: assignments.status,
      })
      .from(assignments),
    db
      .select({
        employeeId: employeeCompetencies.employeeId,
        status: employeeCompetencies.status,
      })
      .from(employeeCompetencies),
    db
      .select({
        employeeId: lessonProgress.employeeId,
      })
      .from(lessonProgress),
  ]);

  const {
    employeeProgressPercent,
    nextCareerLevel,
  } = await import("../lib/employee-profile");

  const nameById = new Map(allEmployees.map((e) => [e.id, e.name] as const));
  const employeeById = new Map(allEmployees.map((e) => [e.id, e] as const));
  const mentorNameById = new Map(
    allUsers.map((u) => [u.id, u.displayName] as const),
  );

  const bump = (map: Map<number, number>, key: number | null) => {
    if (key == null) return;
    map.set(key, (map.get(key) ?? 0) + 1);
  };
  const testsByEmployee = new Map<number, number>();
  for (const row of allResults) bump(testsByEmployee, row.employeeId);
  const pendingByEmployee = new Map<number, number>();
  for (const row of allAssignments) {
    if (row.status === "pending") bump(pendingByEmployee, row.employeeId);
  }
  const lessonsByEmployee = new Map<number, number>();
  for (const row of progressRows) bump(lessonsByEmployee, row.employeeId);
  const matrixTotalByEmployee = new Map<number, number>();
  const matrixConfirmedByEmployee = new Map<number, number>();
  const confirmedStatuses = new Set([
    "junior",
    "junior_plus",
    "middle_minus",
    "middle",
  ]);
  for (const row of matrixRows) {
    bump(matrixTotalByEmployee, row.employeeId);
    if (confirmedStatuses.has(row.status)) {
      bump(matrixConfirmedByEmployee, row.employeeId);
    }
  }

  return allEmployees
    .filter((employee) => !/стаж|intern/i.test(employee.roleTitle))
    .map((employee) => {
      const completedTests = testsByEmployee.get(employee.id) ?? 0;
      const pendingTests = pendingByEmployee.get(employee.id) ?? 0;
      const completedLessons = lessonsByEmployee.get(employee.id) ?? 0;
      const matrixTotal = matrixTotalByEmployee.get(employee.id) ?? 0;
      const matrixConfirmed = matrixConfirmedByEmployee.get(employee.id) ?? 0;
      const startingLevel = employee.startingLevel || employee.currentLevel;
      const targetLevel =
        employee.targetLevel || nextCareerLevel(employee.currentLevel);
      const progress = employeeProgressPercent({
        completedLessons,
        assignedLessons: Math.max(completedLessons, 5),
        completedTests,
        pendingTests,
        matrixConfirmed,
        matrixTotal: Math.max(matrixTotal, 1),
      });
      return {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        telegram: employee.telegram,
        department: employee.department,
        roleTitle: employee.roleTitle,
        currentLevel: employee.currentLevel,
        startingLevel,
        targetLevel,
        status: employee.status || "active",
        hiredAt: employee.hiredAt,
        nextCheckAt: employee.nextCheckAt,
        avatarHue: employee.avatarHue,
        managerName: employee.managerEmployeeId
          ? nameById.get(employee.managerEmployeeId) ?? null
          : null,
        managerRoleTitle: employee.managerEmployeeId
          ? employeeById.get(employee.managerEmployeeId)?.roleTitle ?? null
          : null,
        managerDepartment: employee.managerEmployeeId
          ? employeeById.get(employee.managerEmployeeId)?.department ?? null
          : null,
        mentorUserId: employee.mentorUserId,
        mentorName: employee.mentorUserId
          ? mentorNameById.get(employee.mentorUserId) ?? null
          : null,
        progress,
      };
    });
}

export async function getEmployeeCompetencyMatrix(employeeId: number) {
  await ensureDb();
  const [catalog, rows] = await Promise.all([
    db
      .select()
      .from(competencies)
      .where(and(eq(competencies.kind, "skill"), eq(competencies.isActive, true)))
      .orderBy(asc(competencies.category), asc(competencies.name)),
    db
      .select()
      .from(employeeCompetencies)
      .where(eq(employeeCompetencies.employeeId, employeeId)),
  ]);
  const byCompetency = new Map(rows.map((row) => [row.competencyId, row]));
  return catalog.map((item) => {
    const row = byCompetency.get(item.id);
    return {
      competencyId: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      status: row?.status ?? "not_checked",
      note: row?.note ?? "",
      rowId: row?.id ?? null,
    };
  });
}

export async function upsertEmployeeCompetency(input: {
  employeeId: number;
  competencyId: number;
  status: string;
  note?: string;
  updatedByUserId?: number | null;
}) {
  await ensureDb();
  const { isEmployeeCompetencyStatus } = await import(
    "../lib/employee-profile"
  );
  if (!isEmployeeCompetencyStatus(input.status)) {
    throw new Error("Некорректный статус компетенции");
  }
  const now = new Date().toISOString();
  const [existing] = await db
    .select()
    .from(employeeCompetencies)
    .where(
      and(
        eq(employeeCompetencies.employeeId, input.employeeId),
        eq(employeeCompetencies.competencyId, input.competencyId),
      ),
    )
    .limit(1);
  if (existing) {
    const [row] = await db
      .update(employeeCompetencies)
      .set({
        status: input.status,
        note: input.note?.trim() ?? existing.note,
        updatedAt: now,
        updatedByUserId: input.updatedByUserId ?? null,
      })
      .where(eq(employeeCompetencies.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(employeeCompetencies)
    .values({
      employeeId: input.employeeId,
      competencyId: input.competencyId,
      status: input.status,
      note: input.note?.trim() ?? "",
      updatedAt: now,
      updatedByUserId: input.updatedByUserId ?? null,
    })
    .returning();
  return row;
}

export async function updateEmployeeProfile(input: {
  employeeId: number;
  phone?: string;
  telegram?: string;
  workSchedule?: string;
  startingLevel?: string;
  targetLevel?: string;
  currentLevel?: string;
  status?: string;
  department?: string;
  roleTitle?: string;
  managerEmployeeId?: number | null;
  mentorUserId?: number | null;
  nextCheckAt?: string | null;
  notes?: string;
  hiredAt?: string | null;
}) {
  await ensureDb();
  const { isEmployeeHrStatus } = await import("../lib/employee-profile");
  const patch: Partial<typeof employees.$inferInsert> = {};
  if (input.phone !== undefined) patch.phone = input.phone.trim();
  if (input.telegram !== undefined) patch.telegram = input.telegram.trim();
  if (input.workSchedule !== undefined) {
    patch.workSchedule = input.workSchedule.trim();
  }
  if (input.startingLevel !== undefined) {
    patch.startingLevel = input.startingLevel;
  }
  if (input.targetLevel !== undefined) patch.targetLevel = input.targetLevel;
  if (input.currentLevel !== undefined) patch.currentLevel = input.currentLevel;
  if (input.department !== undefined) {
    patch.department = input.department.trim();
  }
  if (input.roleTitle !== undefined) patch.roleTitle = input.roleTitle.trim();
  if (input.status !== undefined) {
    if (!isEmployeeHrStatus(input.status)) {
      throw new Error("Некорректный статус сотрудника");
    }
    patch.status = input.status;
  }
  if (input.managerEmployeeId !== undefined) {
    patch.managerEmployeeId = input.managerEmployeeId;
  }
  if (input.mentorUserId !== undefined) patch.mentorUserId = input.mentorUserId;
  if (input.nextCheckAt !== undefined) patch.nextCheckAt = input.nextCheckAt;
  if (input.notes !== undefined) patch.notes = input.notes.trim();
  if (input.hiredAt !== undefined) patch.hiredAt = input.hiredAt;

  const [row] = await db
    .update(employees)
    .set(patch)
    .where(eq(employees.id, input.employeeId))
    .returning();
  return row ?? null;
}

/** Deduped per request: several pages read it twice via nested loaders. */
export const getStaffingPositions = cache(async () => {
  await ensureDb();
  return db
    .select({
      id: staffingPositions.id,
      code: staffingPositions.code,
      role: staffingPositions.roleTitle,
      department: staffingPositions.department,
      positionEmail: staffingPositions.email,
      employeeId: staffingPositions.employeeId,
      isPrimary: staffingPositions.isPrimary,
      sortOrder: staffingPositions.sortOrder,
      name: employees.name,
      employeeEmail: employees.email,
      currentLevel: employees.currentLevel,
      avatarHue: employees.avatarHue,
    })
    .from(staffingPositions)
    .leftJoin(employees, eq(staffingPositions.employeeId, employees.id))
    .where(eq(staffingPositions.isActive, true))
    .orderBy(asc(staffingPositions.sortOrder));
});

export async function hireInternIntoPosition(
  employeeId: number,
  positionId: number,
) {
  await ensureDb();
  const [target] = await db
    .select()
    .from(staffingPositions)
    .where(eq(staffingPositions.id, positionId));
  if (!target || target.employeeId) {
    throw new Error("Должность уже занята или не найдена");
  }

  const occupied = await db
    .select()
    .from(staffingPositions)
    .where(eq(staffingPositions.employeeId, employeeId));
  const [person] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId));
  if (
    !person ||
    (!/стаж|intern/i.test(person.roleTitle) &&
      !occupied.some((p) => /стаж|intern/i.test(p.roleTitle)))
  ) {
    throw new Error("Сотрудник не найден среди стажёров");
  }

  for (const position of occupied) {
    if (/стаж|intern/i.test(position.roleTitle)) {
      await db
        .update(staffingPositions)
        .set({
          employeeId: null,
          isPrimary: false,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(staffingPositions.id, position.id));
    } else if (position.isPrimary) {
      await db
        .update(staffingPositions)
        .set({ isPrimary: false, updatedAt: new Date().toISOString() })
        .where(eq(staffingPositions.id, position.id));
    }
  }

  await db
    .update(staffingPositions)
    .set({
      employeeId,
      isPrimary: true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(staffingPositions.id, positionId));

  await db
    .update(employees)
    .set({
      roleTitle: target.roleTitle,
      department: target.department,
      currentLevel:
        person.currentLevel === "intern" ? "junior" : person.currentLevel,
    })
    .where(eq(employees.id, employeeId));

  await syncEmployeeAccountType(employeeId);

  const { getActiveMentorship } = await import("./mentorship");
  const active = await getActiveMentorship(employeeId);
  if (active) {
    await db
      .update(internMentorships)
      .set({
        status: "hired",
        decidedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(internMentorships.id, active.id));
  }

  void (async () => {
    try {
      const { syncHireToVerifix } = await import("./integrations");
      await syncHireToVerifix({
        employeeId,
        name: person.name,
        status: "hired",
      });
    } catch {
      /* logged in integration journal */
    }
  })();
}

export async function assignExistingEmployeePosition(input: {
  employeeId: number;
  positionId: number;
  mode: "move" | "additional";
}) {
  await ensureDb();
  const [target] = await db
    .select()
    .from(staffingPositions)
    .where(eq(staffingPositions.id, input.positionId));
  if (!target || (target.employeeId && target.employeeId !== input.employeeId)) {
    throw new Error("Должность уже занята или не найдена");
  }

  if (input.mode === "move") {
    const current = await db
      .select()
      .from(staffingPositions)
      .where(
        and(
          eq(staffingPositions.employeeId, input.employeeId),
          eq(staffingPositions.isPrimary, true),
        ),
      );
    for (const position of current) {
      if (position.id === input.positionId) continue;
      await db
        .update(staffingPositions)
        .set({
          employeeId: null,
          isPrimary: false,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(staffingPositions.id, position.id));
    }

    await db
      .update(staffingPositions)
      .set({
        employeeId: input.employeeId,
        isPrimary: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(staffingPositions.id, input.positionId));

    await db
      .update(employees)
      .set({
        roleTitle: target.roleTitle,
        department: target.department,
      })
      .where(eq(employees.id, input.employeeId));
    await syncEmployeeAccountType(input.employeeId);
  } else {
    await db
      .update(staffingPositions)
      .set({
        employeeId: input.employeeId,
        isPrimary: false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(staffingPositions.id, input.positionId));
  }
}

export async function dismissStaffingPosition(positionId: number) {
  await ensureDb();
  const [position] = await db
    .select()
    .from(staffingPositions)
    .where(eq(staffingPositions.id, positionId));
  if (!position?.employeeId) {
    throw new Error("Должность уже свободна");
  }

  const employeeId = position.employeeId;
  await db
    .update(staffingPositions)
    .set({
      employeeId: null,
      isPrimary: false,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(staffingPositions.id, positionId));

  if (!position.isPrimary) return;

  const [replacement] = await db
    .select()
    .from(staffingPositions)
    .where(eq(staffingPositions.employeeId, employeeId))
    .orderBy(asc(staffingPositions.sortOrder))
    .limit(1);

  if (replacement) {
    await db
      .update(staffingPositions)
      .set({ isPrimary: true, updatedAt: new Date().toISOString() })
      .where(eq(staffingPositions.id, replacement.id));
    await db
      .update(employees)
      .set({
        roleTitle: replacement.roleTitle,
        department: replacement.department,
      })
      .where(eq(employees.id, employeeId));
    await syncEmployeeAccountType(employeeId);
  } else {
    await db
      .update(platformUsers)
      .set({ isActive: false })
      .where(eq(platformUsers.employeeId, employeeId));
  }
}

export async function getEmployeeById(id: number) {
  await ensureDb();
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, id));
  if (!employee) return null;

  const [
    employeeResults,
    pendingAll,
    levelRows,
    platformAccess,
    manager,
    mentor,
    matrix,
    learning,
    mentorship,
    trialReports,
    peers,
    assessmentsForAssign,
  ] = await Promise.all([
    db
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
      .where(eq(results.employeeId, id))
      .orderBy(desc(results.completedAt)),
    db
      .select({
        id: assignments.id,
        status: assignments.status,
        dueAt: assignments.dueAt,
        assessmentTitle: assessments.title,
        assessmentId: assessments.id,
        assessmentSource: assessments.source,
      })
      .from(assignments)
      .innerJoin(assessments, eq(assignments.assessmentId, assessments.id))
      .where(eq(assignments.employeeId, id)),
    db
      .select()
      .from(levelDefinitions)
      .where(eq(levelDefinitions.code, employee.currentLevel)),
    getPlatformUserByEmployeeId(id),
    employee.managerEmployeeId
      ? db
          .select({ id: employees.id, name: employees.name })
          .from(employees)
          .where(eq(employees.id, employee.managerEmployeeId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    employee.mentorUserId
      ? db
          .select({
            id: platformUsers.id,
            displayName: platformUsers.displayName,
          })
          .from(platformUsers)
          .where(eq(platformUsers.id, employee.mentorUserId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    getEmployeeCompetencyMatrix(id),
    (async () => {
      try {
        const { getCompletedLessonIds, listAttestationsForEmployee } =
          await import("./learning");
        const [lessonIds, att] = await Promise.all([
          getCompletedLessonIds(id),
          listAttestationsForEmployee({
            employeeId: id,
            department: employee.department,
            roleTitle: employee.roleTitle,
          }),
        ]);
        return {
          completedLessonsCount: lessonIds.size,
          attestations: att.map((item) => ({
            id: item.id,
            title: item.title,
            status: item.result
              ? "completed"
              : item.windowStatus || (item.isActive ? "open" : "closed"),
            scheduledAt: item.startsAt ?? item.scheduledAt ?? null,
          })),
        };
      } catch {
        // learning module optional on cold start
        return {
          completedLessonsCount: 0,
          attestations: [] as {
            id: number;
            title: string;
            status: string;
            scheduledAt: string | null;
          }[],
        };
      }
    })(),
    db
      .select()
      .from(internMentorships)
      .where(eq(internMentorships.internEmployeeId, id))
      .orderBy(desc(internMentorships.updatedAt))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({
        id: internDailyReports.id,
        reportDate: internDailyReports.reportDate,
        status: internDailyReports.status,
        score: internDailyReports.score,
      })
      .from(internDailyReports)
      .where(eq(internDailyReports.internEmployeeId, id))
      .orderBy(desc(internDailyReports.reportDate))
      .limit(10),
    db
      .select({
        id: employees.id,
        name: employees.name,
        department: employees.department,
      })
      .from(employees)
      .orderBy(asc(employees.name)),
    db
      .select({
        id: assessments.id,
        title: assessments.title,
      })
      .from(assessments)
      .where(
        and(
          eq(assessments.isActive, true),
          ne(assessments.source, "attestation"),
        ),
      )
      .orderBy(asc(assessments.title))
      .limit(200),
  ]);

  const pending = pendingAll.filter((a) => a.status === "pending");
  const level = levelRows[0];
  const { completedLessonsCount, attestations } = learning;

  let entranceSnapshot: Record<string, unknown> | null = null;
  if (mentorship?.entranceSnapshotJson) {
    try {
      entranceSnapshot = JSON.parse(mentorship.entranceSnapshotJson) as Record<
        string,
        unknown
      >;
    } catch {
      entranceSnapshot = null;
    }
  }

  return {
    employee,
    employeeResults,
    pending,
    level,
    platformAccess,
    manager,
    mentor,
    matrix,
    completedLessonsCount,
    attestations,
    entranceSnapshot,
    trialReports,
    peers,
    assessmentsForAssign,
  };
}

export async function getAssessments(
  kind?: "candidate" | "trial" | "intern" | "level",
) {
  await ensureDb();
  const rows = await db
    .select({
      id: assessments.id,
      title: assessments.title,
      description: assessments.description,
      durationMinutes: assessments.durationMinutes,
      passScore: assessments.passScore,
      isActive: assessments.isActive,
      source: assessments.source,
      competencyName: competencies.name,
      competencyCategory: competencies.category,
      questionCount: sql<number>`(select count(*) from questions q where q.assessment_id = ${assessments.id})`,
    })
    .from(assessments)
    .innerJoin(competencies, eq(assessments.competencyId, competencies.id))
    .where(
      and(
        ne(assessments.source, "attestation"),
        ne(assessments.source, "learning"),
      ),
    );

  if (!kind) return rows;

  return rows.filter((row) => {
    if (row.source === kind) return true;
    // Older Drive imports used source=library — keep them under «Уровень».
    if (kind === "level" && (row.source === "library" || !row.source)) {
      return true;
    }
    return false;
  });
}

export async function getAssignments() {
  await ensureDb();
  return db
    .select({
      id: assignments.id,
      status: assignments.status,
      assignedAt: assignments.assignedAt,
      dueAt: assignments.dueAt,
      employeeName: employees.name,
      employeeId: employees.id,
      assessmentTitle: assessments.title,
      assessmentId: assessments.id,
    })
    .from(assignments)
    .innerJoin(employees, eq(assignments.employeeId, employees.id))
    .innerJoin(assessments, eq(assignments.assessmentId, assessments.id))
    .orderBy(desc(assignments.assignedAt));
}

export async function getCompetenciesWithLevels() {
  await ensureDb();
  const comps = await db
    .select()
    .from(competencies)
    .where(eq(competencies.kind, "skill"))
    .orderBy(asc(competencies.category), asc(competencies.name));
  const levels = await db
    .select()
    .from(levelDefinitions)
    .orderBy(asc(levelDefinitions.sortOrder));
  return { comps, levels };
}

export async function getAssignmentForTake(assignmentId: number) {
  await ensureDb();
  const [row] = await db
    .select({
      id: assignments.id,
      status: assignments.status,
      employeeId: assignments.employeeId,
      assessmentId: assignments.assessmentId,
      employeeName: employees.name,
      assessmentTitle: assessments.title,
      assessmentDescription: assessments.description,
      competencyName: competencies.name,
      durationMinutes: assessments.durationMinutes,
    })
    .from(assignments)
    .innerJoin(employees, eq(assignments.employeeId, employees.id))
    .innerJoin(assessments, eq(assignments.assessmentId, assessments.id))
    .where(eq(assignments.id, assignmentId));

  if (!row) return null;

  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.assessmentId, row.assessmentId));

  return {
    ...row,
    questions: qs.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: (q.type || "single") as "single" | "multiple" | "text",
      options: JSON.parse(q.optionsJson || "[]") as string[],
    })),
  };
}

export async function createEmployee(input: {
  name: string;
  email: string;
  department: string;
  roleTitle: string;
  currentLevel?: string;
}) {
  await ensureDb();
  const level = input.currentLevel ?? "junior";
  const [row] = await db
    .insert(employees)
    .values({
      name: input.name,
      email: input.email,
      department: input.department,
      roleTitle: input.roleTitle,
      currentLevel: level,
      startingLevel: level,
      targetLevel: level === "intern" ? "junior" : "middle",
      status: /стаж|intern/i.test(input.roleTitle) ? "probation" : "active",
      avatarHue: Math.floor(Math.random() * 360),
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

export async function updateEmployeeHiredAt(
  employeeId: number,
  hiredAt: string | null,
) {
  await ensureDb();
  const [row] = await db
    .update(employees)
    .set({ hiredAt })
    .where(eq(employees.id, employeeId))
    .returning();
  return row ?? null;
}

export async function assignAssessment(input: {
  employeeId: number;
  assessmentId: number;
  dueAt?: string;
}) {
  await ensureDb();
  const [row] = await db
    .insert(assignments)
    .values({
      employeeId: input.employeeId,
      assessmentId: input.assessmentId,
      status: "pending",
      assignedAt: new Date().toISOString(),
      dueAt: input.dueAt ?? null,
    })
    .returning();
  return row;
}

export async function submitAssessment(
  assignmentId: number,
  answers: Record<string, AnswerValue>,
) {
  await ensureDb();
  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, assignmentId));
  if (!assignment || assignment.status === "completed") {
    throw new Error("Assignment not available");
  }

  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.assessmentId, assignment.assessmentId));

  const { score, profile } = scoreAnswers(qs, answers);
  const levelCode = profile.levelCode;

  const [resultRow] = await db
    .insert(results)
    .values({
      assignmentId,
      employeeId: assignment.employeeId,
      assessmentId: assignment.assessmentId,
      score,
      levelCode,
      answersJson: JSON.stringify(answers),
      profileJson: JSON.stringify(profile),
      completedAt: new Date().toISOString(),
    })
    .returning();

  await db
    .update(assignments)
    .set({ status: "completed" })
    .where(eq(assignments.id, assignmentId));

  const { syncAttestationReviewForResult } = await import(
    "./attestation-reviews"
  );
  await syncAttestationReviewForResult({
    employeeId: assignment.employeeId,
    assessmentId: assignment.assessmentId,
    resultId: resultRow.id,
    score,
  });

  const { createPromotionRequestIfEligible } = await import("./promotions");
  await createPromotionRequestIfEligible({
    employeeId: assignment.employeeId,
    assessmentId: assignment.assessmentId,
    resultId: resultRow.id,
    score,
  });

  const [level] = await db
    .select()
    .from(levelDefinitions)
    .where(eq(levelDefinitions.code, levelCode));

  return { score, levelCode, level, profile };
}

function hueFromName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * 17) % 360;
  return h;
}

export async function getCandidates() {
  await ensureDb();
  const rows = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      phone: candidates.phone,
      email: candidates.email,
      telegram: candidates.telegram,
      source: candidates.source,
      status: candidates.status,
      currentLevel: candidates.currentLevel,
      claimedLevel: candidates.claimedLevel,
      interviewResult: candidates.interviewResult,
      avatarHue: candidates.avatarHue,
      photoUrl: candidates.photoUrl,
      notes: candidates.notes,
      archived: candidates.archived,
      createdAt: candidates.createdAt,
      vacancyId: candidates.vacancyId,
      hrOwnerUserId: candidates.hrOwnerUserId,
      roleTitle: vacancies.roleTitle,
      department: vacancies.department,
      vacancyCode: vacancies.code,
      portalLogin: candidates.portalLogin,
      portalEnabled: candidates.portalEnabled,
      hrOwnerName: platformUsers.displayName,
    })
    .from(candidates)
    .innerJoin(vacancies, eq(candidates.vacancyId, vacancies.id))
    .leftJoin(platformUsers, eq(candidates.hrOwnerUserId, platformUsers.id))
    .orderBy(desc(candidates.createdAt));

  const latestResults = await db
    .select({
      candidateId: candidateResults.candidateId,
      score: candidateResults.score,
      levelCode: candidateResults.levelCode,
      completedAt: candidateResults.completedAt,
    })
    .from(candidateResults)
    .orderBy(desc(candidateResults.completedAt));

  const resultByCandidate = new Map<
    number,
    { score: number; levelCode: string; completedAt: string }
  >();
  for (const r of latestResults) {
    if (!resultByCandidate.has(r.candidateId)) {
      resultByCandidate.set(r.candidateId, {
        score: r.score,
        levelCode: r.levelCode,
        completedAt: r.completedAt,
      });
    }
  }

  return rows.map((row) => {
    const status = normalizeCandidateStatus(row.status);
    const test = resultByCandidate.get(row.id) ?? null;
    return {
      ...row,
      status,
      testScore: test?.score ?? null,
      testLevel: test?.levelCode ?? null,
      invited: [
        "invited",
        "interview_confirmed",
        "interview_declined",
        "interview_passed",
        "test_assigned",
        "test_completed",
        "trial_admitted",
        "hired",
      ].includes(status),
    };
  });
}

export async function getCandidateDetail(candidateId: number) {
  await ensureDb();
  const list = await getCandidates();
  const base = list.find((c) => c.id === candidateId);
  if (!base) return null;

  const [full] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId));
  if (!full) return null;

  const [events, assigns, results, hrUsers] = await Promise.all([
    db
      .select()
      .from(candidateEvents)
      .where(eq(candidateEvents.candidateId, candidateId))
      .orderBy(desc(candidateEvents.createdAt)),
    db
      .select({
        id: candidateAssignments.id,
        status: candidateAssignments.status,
        dueAt: candidateAssignments.dueAt,
        assignedAt: candidateAssignments.assignedAt,
        startedAt: candidateAssignments.startedAt,
        expiresAt: candidateAssignments.expiresAt,
        assessmentTitle: assessments.title,
        assessmentId: assessments.id,
      })
      .from(candidateAssignments)
      .innerJoin(
        assessments,
        eq(candidateAssignments.assessmentId, assessments.id),
      )
      .where(eq(candidateAssignments.candidateId, candidateId))
      .orderBy(desc(candidateAssignments.assignedAt)),
    db
      .select({
        id: candidateResults.id,
        score: candidateResults.score,
        levelCode: candidateResults.levelCode,
        completedAt: candidateResults.completedAt,
        assessmentTitle: assessments.title,
        profileJson: candidateResults.profileJson,
        telemetryJson: candidateResults.telemetryJson,
      })
      .from(candidateResults)
      .innerJoin(
        assessments,
        eq(candidateResults.assessmentId, assessments.id),
      )
      .where(eq(candidateResults.candidateId, candidateId))
      .orderBy(desc(candidateResults.completedAt)),
    db
      .select({
        id: platformUsers.id,
        displayName: platformUsers.displayName,
        role: platformUsers.role,
      })
      .from(platformUsers)
      .where(eq(platformUsers.role, "admin")),
  ]);

  let profile: Record<string, string> = {};
  try {
    profile = JSON.parse(full.profileJson || "{}") as Record<string, string>;
  } catch {
    profile = {};
  }

  return {
    ...base,
    birthDate: full.birthDate,
    address: full.address,
    desiredSalary: full.desiredSalary,
    availableFrom: full.availableFrom,
    profileJson: full.profileJson,
    profile,
    events,
    assigns,
    results,
    hrUsers,
  };
}

export async function appendCandidateEvent(input: {
  candidateId: number;
  kind: string;
  title: string;
  body?: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorUserId?: number | null;
}) {
  await ensureDb();
  const [row] = await db
    .insert(candidateEvents)
    .values({
      candidateId: input.candidateId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? "",
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      actorUserId: input.actorUserId ?? null,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

export async function updateCandidateProfile(input: {
  candidateId: number;
  name?: string;
  phone?: string;
  email?: string;
  telegram?: string;
  source?: string;
  vacancyId?: number;
  claimedLevel?: string;
  interviewResult?: string;
  hrOwnerUserId?: number | null;
  birthDate?: string | null;
  address?: string;
  desiredSalary?: string;
  availableFrom?: string | null;
  notes?: string;
  archived?: boolean;
  profile?: Record<string, string>;
}) {
  await ensureDb();
  const [existing] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, input.candidateId));
  if (!existing) throw new Error("Кандидат не найден");

  let profileJson = existing.profileJson;
  if (input.profile) {
    let prev: Record<string, string> = {};
    try {
      prev = JSON.parse(existing.profileJson || "{}") as Record<string, string>;
    } catch {
      prev = {};
    }
    profileJson = JSON.stringify({ ...prev, ...input.profile });
  }

  await db
    .update(candidates)
    .set({
      name: input.name ?? existing.name,
      phone: input.phone ?? existing.phone,
      email: input.email ?? existing.email,
      telegram: input.telegram ?? existing.telegram,
      source: input.source ?? existing.source,
      vacancyId: input.vacancyId ?? existing.vacancyId,
      claimedLevel: input.claimedLevel ?? existing.claimedLevel,
      interviewResult: input.interviewResult ?? existing.interviewResult,
      hrOwnerUserId:
        input.hrOwnerUserId === undefined
          ? existing.hrOwnerUserId
          : input.hrOwnerUserId,
      birthDate:
        input.birthDate === undefined ? existing.birthDate : input.birthDate,
      address: input.address ?? existing.address,
      desiredSalary: input.desiredSalary ?? existing.desiredSalary,
      availableFrom:
        input.availableFrom === undefined
          ? existing.availableFrom
          : input.availableFrom,
      notes: input.notes ?? existing.notes,
      archived: input.archived ?? existing.archived,
      profileJson,
    })
    .where(eq(candidates.id, input.candidateId));
}

export async function setCandidateStatus(
  candidateId: number,
  nextStatus: CandidateStatus,
  opts?: { comment?: string; actorUserId?: number | null },
) {
  await ensureDb();
  const [existing] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId));
  if (!existing) throw new Error("Кандидат не найден");

  const from = normalizeCandidateStatus(existing.status);
  const archived = ["hired", "rejected", "reserve"].includes(nextStatus);
  const now = new Date().toISOString();

  await db
    .update(candidates)
    .set({
      status: nextStatus,
      archived,
      ...(nextStatus === "rejected" && opts?.comment
        ? { rejectionReason: opts.comment }
        : {}),
    })
    .where(eq(candidates.id, candidateId));

  if (
    (nextStatus === "hired" || nextStatus === "rejected") &&
    existing.vacancyId
  ) {
    const [vacancy] = await db
      .select({ id: vacancies.id, closedAt: vacancies.closedAt })
      .from(vacancies)
      .where(eq(vacancies.id, existing.vacancyId))
      .limit(1);
    if (vacancy && !vacancy.closedAt && nextStatus === "hired") {
      await db
        .update(vacancies)
        .set({ status: "filled", closedAt: now })
        .where(eq(vacancies.id, vacancy.id));
    }
  }

  await appendCandidateEvent({
    candidateId,
    kind: "status_change",
    title: `Статус: ${from} → ${nextStatus}`,
    body: opts?.comment ?? "",
    fromStatus: from,
    toStatus: nextStatus,
    actorUserId: opts?.actorUserId ?? null,
  });

  if (
    nextStatus === "hired" ||
    nextStatus === "trial_admitted" ||
    nextStatus === "new"
  ) {
    void (async () => {
      try {
        const { syncCandidateToVerifix, syncHireToVerifix } = await import(
          "./integrations"
        );
        const [vacancy] = existing.vacancyId
          ? await db
              .select({ roleTitle: vacancies.roleTitle })
              .from(vacancies)
              .where(eq(vacancies.id, existing.vacancyId))
              .limit(1)
          : [null];
        if (nextStatus === "hired") {
          await syncHireToVerifix({
            candidateId,
            name: existing.name,
            status: nextStatus,
          });
        } else {
          await syncCandidateToVerifix({
            candidateId,
            name: existing.name,
            phone: existing.phone,
            telegram: existing.telegram,
            status: nextStatus,
            vacancyTitle: vacancy?.roleTitle,
          });
        }
      } catch {
        /* logged in integration journal */
      }
    })();
  }
}

/** Light list for "hire intern" pickers — avoids the full intern dashboard load. */
export async function listInternOptions() {
  await ensureDb();
  const rows = await db
    .select({
      id: employees.id,
      name: employees.name,
      roleTitle: employees.roleTitle,
    })
    .from(employees)
    .orderBy(asc(employees.name));
  return rows.filter((row) => /стаж|intern/i.test(row.roleTitle));
}

export async function getInternManagementData() {
  await ensureDb();
  const { dayNumberFromMentorship, tashkentDate } = await import(
    "./intern-reports"
  );
  const {
    clampTrialDay,
    trialProgressPercent,
    trialThemeForDay,
  } = await import("../lib/trial-period");

  const [allEmployees, allCandidates, mentorships, reports, mentors] =
    await Promise.all([
      db.select().from(employees).orderBy(asc(employees.name)),
      getCandidates(),
      db.select().from(internMentorships),
      db
        .select({
          id: internDailyReports.id,
          internEmployeeId: internDailyReports.internEmployeeId,
          status: internDailyReports.status,
          reportDate: internDailyReports.reportDate,
        })
        .from(internDailyReports),
      db
        .select({
          id: platformUsers.id,
          displayName: platformUsers.displayName,
        })
        .from(platformUsers),
    ]);

  const mentorName = new Map(
    mentors.map((m) => [m.id, m.displayName] as const),
  );
  const today = tashkentDate();

  const activeMentorshipByIntern = new Map<
    number,
    (typeof mentorships)[number]
  >();
  for (const row of mentorships) {
    if (!["active", "extended"].includes(row.status)) continue;
    const prev = activeMentorshipByIntern.get(row.internEmployeeId);
    if (!prev || row.updatedAt > prev.updatedAt) {
      activeMentorshipByIntern.set(row.internEmployeeId, row);
    }
  }

  const interns = allEmployees
    .filter((employee) => /стаж|intern/i.test(employee.roleTitle))
    .map((employee) => {
      const mentorship = activeMentorshipByIntern.get(employee.id) ?? null;
      const currentDay = clampTrialDay(
        mentorship
          ? dayNumberFromMentorship(mentorship.trialStartsAt, today)
          : 1,
      );
      const internReports = reports.filter(
        (r) => r.internEmployeeId === employee.id,
      );
      const reportsDone = internReports.length;
      const reportsReviewed = internReports.filter(
        (r) => r.status === "reviewed",
      ).length;
      let entrance: {
        score: number | null;
        level: string;
        weakTopics: string[];
        recommendation: string;
        assessmentTitle: string;
      } = {
        score: null,
        level: "",
        weakTopics: [],
        recommendation: "",
        assessmentTitle: "",
      };
      if (mentorship?.entranceSnapshotJson) {
        try {
          const snap = JSON.parse(mentorship.entranceSnapshotJson) as {
            score?: number;
            entranceLevel?: string;
            levelCode?: string;
            weakTopics?: string[];
            recommendation?: string;
            assessmentTitle?: string;
          };
          entrance = {
            score: typeof snap.score === "number" ? snap.score : null,
            level: String(snap.entranceLevel || snap.levelCode || ""),
            weakTopics: Array.isArray(snap.weakTopics)
              ? snap.weakTopics.map(String)
              : [],
            recommendation: String(snap.recommendation || ""),
            assessmentTitle: String(snap.assessmentTitle || ""),
          };
        } catch {
          // ignore bad snapshot
        }
      }
      const theme = trialThemeForDay(currentDay);
      return {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        roleTitle: employee.roleTitle,
        currentLevel: employee.currentLevel,
        avatarHue: employee.avatarHue,
        mentorshipId: mentorship?.id ?? null,
        mentorName: mentorship?.mentorUserId
          ? mentorName.get(mentorship.mentorUserId) ?? null
          : null,
        trialStartsAt: mentorship?.trialStartsAt ?? null,
        trialEndsAt: mentorship?.trialEndsAt ?? null,
        mentorshipStatus: mentorship?.status ?? "none",
        decisionComment: mentorship?.decisionComment ?? null,
        currentDay,
        dayThemeKey: theme.titleKey,
        progress: trialProgressPercent({
          currentDay,
          reportsDone,
          reportsReviewed,
        }),
        reportsDone,
        reportsReviewed,
        entrance,
      };
    });

  return {
    interns,
    readyCandidates: allCandidates.filter(
      (candidate) =>
        normalizeCandidateStatus(candidate.status) === "trial_admitted" &&
        !candidate.archived,
    ),
  };
}

export async function moveCandidateToInternship(candidateId: number) {
  await ensureDb();
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId));
  if (!candidate) throw new Error("Кандидат не найден");
  const status = normalizeCandidateStatus(candidate.status);
  if (status !== "test_completed" && candidate.status !== "assessed") {
    throw new Error("Сначала кандидат должен завершить тест");
  }
  await setCandidateStatus(candidateId, "trial_admitted");
}

export async function createInternFromCandidate(candidateId: number) {
  await ensureDb();
  const [candidate] = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      email: candidates.email,
      status: candidates.status,
      currentLevel: candidates.currentLevel,
      roleTitle: vacancies.roleTitle,
      department: vacancies.department,
    })
    .from(candidates)
    .innerJoin(vacancies, eq(candidates.vacancyId, vacancies.id))
    .where(eq(candidates.id, candidateId));

  const status = candidate
    ? normalizeCandidateStatus(candidate.status)
    : null;
  if (
    !candidate ||
    (status !== "trial_admitted" && candidate.status !== "internship_ready")
  ) {
    throw new Error("Кандидат не допущен к пробному периоду");
  }

  const existingEmails = new Set(
    (await db.select({ email: employees.email }).from(employees)).map((row) =>
      row.email.toLowerCase(),
    ),
  );
  let email = candidate.email.trim().toLowerCase();
  if (!email || existingEmails.has(email)) {
    email = `intern-${candidate.id}@akela.group`;
    let suffix = 1;
    while (existingEmails.has(email)) {
      email = `intern-${candidate.id}-${suffix++}@akela.group`;
    }
  }

  const startLevel =
    candidate.currentLevel && candidate.currentLevel !== "unassessed"
      ? candidate.currentLevel
      : "intern";

  const employee = await createEmployee({
    name: candidate.name,
    email,
    department: candidate.department,
    roleTitle: `Стажёр · ${candidate.roleTitle}`,
    currentLevel: startLevel === "not_confirmed" ? "intern" : startLevel,
  });
  await setCandidateStatus(candidateId, "trial_admitted", {
    comment: "Создан сотрудник-стажёр",
  });

  const [latestResult] = await db
    .select({
      score: candidateResults.score,
      levelCode: candidateResults.levelCode,
      profileJson: candidateResults.profileJson,
      completedAt: candidateResults.completedAt,
      assessmentTitle: assessments.title,
    })
    .from(candidateResults)
    .innerJoin(assessments, eq(candidateResults.assessmentId, assessments.id))
    .where(eq(candidateResults.candidateId, candidateId))
    .orderBy(desc(candidateResults.completedAt))
    .limit(1);

  let entranceSnapshot: Record<string, unknown> = {};
  if (latestResult) {
    let profile: Record<string, unknown> = {};
    try {
      profile = JSON.parse(latestResult.profileJson || "{}") as Record<
        string,
        unknown
      >;
    } catch {
      profile = {};
    }
    entranceSnapshot = {
      score: latestResult.score,
      levelCode: latestResult.levelCode,
      entranceLevel: profile.entranceLevel ?? latestResult.levelCode,
      recommendation: profile.recommendation ?? "",
      weakTopics: Array.isArray(profile.weakTopics) ? profile.weakTopics : [],
      assessmentTitle: latestResult.assessmentTitle,
      completedAt: latestResult.completedAt,
    };
  }

  const { ensureInternMentorship } = await import("./mentorship");
  await ensureInternMentorship({
    internEmployeeId: employee.id,
    trialStartsAt: employee.hiredAt || employee.createdAt,
    sourceCandidateId: candidateId,
    entranceSnapshot,
  });

  return employee;
}

export type InterviewEvaluation = {
  appearance?: string;
  communication?: string;
  motivation?: string;
  adequacy?: string;
  experience?: string;
  leaveReasons?: string;
  salaryExpectations?: string;
  professionalConfidence?: string;
  valuesFit?: string;
  risks?: string;
  comment?: string;
  recommendation?: string;
};

export async function getInterviewsData() {
  await ensureDb();
  const [rows, candList, hrUsers] = await Promise.all([
    db
      .select({
        id: interviews.id,
        candidateId: interviews.candidateId,
        vacancyId: interviews.vacancyId,
        scheduledAt: interviews.scheduledAt,
        durationMinutes: interviews.durationMinutes,
        format: interviews.format,
        address: interviews.address,
        geoUrl: interviews.geoUrl,
        room: interviews.room,
        hrOwnerUserId: interviews.hrOwnerUserId,
        interviewerName: interviews.interviewerName,
        departmentHead: interviews.departmentHead,
        commentToCandidate: interviews.commentToCandidate,
        confirmStatus: interviews.confirmStatus,
        status: interviews.status,
        evaluationJson: interviews.evaluationJson,
        decision: interviews.decision,
        decisionComment: interviews.decisionComment,
        notifyJson: interviews.notifyJson,
        createdAt: interviews.createdAt,
        candidateName: candidates.name,
        candidatePhone: candidates.phone,
        candidateTelegram: candidates.telegram,
        roleTitle: vacancies.roleTitle,
        department: vacancies.department,
        vacancyCode: vacancies.code,
        hrOwnerName: platformUsers.displayName,
      })
      .from(interviews)
      .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
      .leftJoin(vacancies, eq(interviews.vacancyId, vacancies.id))
      .leftJoin(platformUsers, eq(interviews.hrOwnerUserId, platformUsers.id))
      .orderBy(asc(interviews.scheduledAt)),
    getCandidates(),
    db
      .select({
        id: platformUsers.id,
        displayName: platformUsers.displayName,
        role: platformUsers.role,
      })
      .from(platformUsers)
      .where(eq(platformUsers.role, "admin")),
  ]);

  return {
    interviews: rows.map((r) => {
      let evaluation: InterviewEvaluation = {};
      try {
        evaluation = JSON.parse(r.evaluationJson || "{}") as InterviewEvaluation;
      } catch {
        evaluation = {};
      }
      let notify: Record<string, unknown> = {};
      try {
        notify = JSON.parse(r.notifyJson || "{}") as Record<string, unknown>;
      } catch {
        notify = {};
      }
      return { ...r, evaluation, notify };
    }),
    candidates: candList.filter((c) => !c.archived),
    hrUsers,
  };
}

export async function createInterview(input: {
  candidateId: number;
  scheduledAt: string;
  durationMinutes?: number;
  format?: string;
  address?: string;
  geoUrl?: string;
  room?: string;
  hrOwnerUserId?: number | null;
  interviewerName?: string;
  departmentHead?: string;
  commentToCandidate?: string;
  sendNotify?: boolean;
}) {
  await ensureDb();
  const [candidate] = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      vacancyId: candidates.vacancyId,
      telegram: candidates.telegram,
      phone: candidates.phone,
    })
    .from(candidates)
    .where(eq(candidates.id, input.candidateId));
  if (!candidate) throw new Error("Кандидат не найден");

  let hrContact = "";
  if (input.hrOwnerUserId) {
    const [hr] = await db
      .select({ displayName: platformUsers.displayName })
      .from(platformUsers)
      .where(eq(platformUsers.id, input.hrOwnerUserId));
    hrContact = hr?.displayName ?? "";
  }

  const now = new Date().toISOString();
  const [row] = await db
    .insert(interviews)
    .values({
      candidateId: input.candidateId,
      vacancyId: candidate.vacancyId,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes ?? 60,
      format: input.format ?? "office",
      address: input.address ?? "",
      geoUrl: input.geoUrl ?? "",
      room: input.room ?? "",
      hrOwnerUserId: input.hrOwnerUserId ?? null,
      interviewerName: input.interviewerName ?? "",
      departmentHead: input.departmentHead ?? "",
      commentToCandidate: input.commentToCandidate ?? "",
      confirmStatus: "pending",
      status: "scheduled",
      notifyJson: JSON.stringify({ status: input.sendNotify ? "queued" : "skipped" }),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  let notify: Record<string, unknown> = { status: "skipped" };
  if (input.sendNotify && row) {
    const { notifyInterviewCreated } = await import("./integrations");
    notify = await notifyInterviewCreated({
      interviewId: row.id,
      candidateName: candidate.name,
      candidateTelegram: candidate.telegram,
      scheduledAt: input.scheduledAt,
      address: input.address ?? "",
      geoUrl: input.geoUrl ?? "",
      hrContact,
      comment: input.commentToCandidate ?? "",
    });
    await db
      .update(interviews)
      .set({ notifyJson: JSON.stringify(notify), updatedAt: new Date().toISOString() })
      .where(eq(interviews.id, row.id));
  }

  await setCandidateStatus(input.candidateId, "invited", {
    comment: `Собеседование ${input.scheduledAt}`,
  });

  await appendCandidateEvent({
    candidateId: input.candidateId,
    kind: "invite",
    title: "Приглашение на собеседование",
    body: input.scheduledAt,
    toStatus: "invited",
  });

  return row;
}

export async function setInterviewConfirmStatus(
  interviewId: number,
  confirmStatus: "confirmed" | "declined" | "reschedule" | "pending",
) {
  await ensureDb();
  const [row] = await db
    .select()
    .from(interviews)
    .where(eq(interviews.id, interviewId));
  if (!row) throw new Error("Собеседование не найдено");

  await db
    .update(interviews)
    .set({ confirmStatus, updatedAt: new Date().toISOString() })
    .where(eq(interviews.id, interviewId));

  if (confirmStatus === "confirmed") {
    await setCandidateStatus(row.candidateId, "interview_confirmed");
  } else if (confirmStatus === "declined") {
    await setCandidateStatus(row.candidateId, "interview_declined");
  } else if (confirmStatus === "reschedule") {
    await setCandidateStatus(row.candidateId, "awaiting_invite", {
      comment: "Кандидат просит перенести собеседование",
    });
  }
}

export async function saveInterviewEvaluation(input: {
  interviewId: number;
  evaluation: InterviewEvaluation;
  decision?: string | null;
  decisionComment?: string;
}) {
  await ensureDb();
  const [row] = await db
    .select()
    .from(interviews)
    .where(eq(interviews.id, input.interviewId));
  if (!row) throw new Error("Собеседование не найдено");

  const decision = input.decision || null;
  await db
    .update(interviews)
    .set({
      evaluationJson: JSON.stringify(input.evaluation),
      decision,
      decisionComment: input.decisionComment ?? "",
      status: "completed",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(interviews.id, input.interviewId));

  await setCandidateStatus(row.candidateId, "interview_passed", {
    comment: input.evaluation.recommendation || input.decisionComment || "",
  });

  if (decision === "assign_test") {
    const auto = await autoAssignCandidateTest(row.candidateId);
    const note = input.decisionComment?.trim() ?? "";
    if (auto.assigned) {
      await appendCandidateEvent({
        candidateId: row.candidateId,
        kind: "decision",
        title: "Решение: назначить входной тест",
        body: [
          auto.alreadyPending
            ? `Тест уже был назначен: ${auto.assessmentTitle}`
            : `Назначен тест: ${auto.assessmentTitle}`,
          note,
        ]
          .filter(Boolean)
          .join("\n"),
        fromStatus: "interview_passed",
        toStatus: "test_assigned",
      });
    } else {
      await appendCandidateEvent({
        candidateId: row.candidateId,
        kind: "decision",
        title: "Решение: назначить входной тест",
        body: [
          auto.reason === "no_matching_test"
            ? `Не найден входной тест для должности «${auto.roleTitle}»`
            : "Автоназначение теста не удалось",
          note,
        ]
          .filter(Boolean)
          .join("\n"),
        toStatus: "interview_passed",
      });
    }
  } else if (decision === "extra_interview") {
    await setCandidateStatus(row.candidateId, "awaiting_invite", {
      comment: "Дополнительное собеседование",
    });
  } else if (decision === "other_role") {
    await setCandidateStatus(row.candidateId, "reviewing", {
      comment: "Рассмотреть на другую должность",
    });
  } else if (decision === "reserve") {
    await setCandidateStatus(row.candidateId, "reserve");
  } else if (decision === "reject") {
    await setCandidateStatus(row.candidateId, "rejected");
  }

  return { ok: true };
}

export async function getCandidateAudienceAssessments() {
  await ensureDb();
  const rows = await db
    .select({
      id: assessments.id,
      title: assessments.title,
      competencyName: competencies.name,
    })
    .from(assessments)
    .innerJoin(competencies, eq(assessments.competencyId, competencies.id))
    .where(
      and(eq(assessments.isActive, true), eq(assessments.source, "candidate")),
    )
    .orderBy(asc(assessments.title));

  return rows;
}

export async function findAssessmentForVacancyRole(roleTitle: string) {
  const options = await getCandidateAudienceAssessments();
  return pickBestRoleMatch(roleTitle, options, 50);
}

export async function autoAssignCandidateTest(candidateId: number) {
  await ensureDb();

  const [candidate] = await db
    .select({
      id: candidates.id,
      roleTitle: vacancies.roleTitle,
    })
    .from(candidates)
    .innerJoin(vacancies, eq(candidates.vacancyId, vacancies.id))
    .where(eq(candidates.id, candidateId));

  if (!candidate) {
    return { assigned: false as const, reason: "candidate_not_found" as const };
  }

  const match = await findAssessmentForVacancyRole(candidate.roleTitle);
  if (!match) {
    return {
      assigned: false as const,
      reason: "no_matching_test" as const,
      roleTitle: candidate.roleTitle,
    };
  }

  const existing = await db
    .select({ id: candidateAssignments.id })
    .from(candidateAssignments)
    .where(
      and(
        eq(candidateAssignments.candidateId, candidateId),
        eq(candidateAssignments.assessmentId, match.id),
        eq(candidateAssignments.status, "pending"),
      ),
    );

  if (existing.length > 0) {
    return {
      assigned: true as const,
      assessmentId: match.id,
      assessmentTitle: match.title,
      alreadyPending: true as const,
    };
  }

  await assignCandidateAssessment({
    candidateId,
    assessmentId: match.id,
  });

  return {
    assigned: true as const,
    assessmentId: match.id,
    assessmentTitle: match.title,
    alreadyPending: false as const,
  };
}

export async function getCandidateByPortalLogin(login: string) {
  await ensureDb();
  const [row] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.portalLogin, login.trim().toLowerCase()));
  return row ?? null;
}

export async function setCandidatePortalCredentials(input: {
  candidateId: number;
  portalLogin: string;
  portalPasswordHash: string;
  portalEnabled: boolean;
}) {
  await ensureDb();
  const login = input.portalLogin.trim().toLowerCase();
  const [row] = await db
    .update(candidates)
    .set({
      portalLogin: login,
      portalPasswordHash: input.portalPasswordHash,
      portalEnabled: input.portalEnabled,
    })
    .where(eq(candidates.id, input.candidateId))
    .returning();
  return row ?? null;
}

export async function getCandidatePortalHome(candidateId: number) {
  await ensureDb();
  const [person] = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      status: candidates.status,
      currentLevel: candidates.currentLevel,
      portalLogin: candidates.portalLogin,
      portalEnabled: candidates.portalEnabled,
      roleTitle: vacancies.roleTitle,
      department: vacancies.department,
      vacancyCode: vacancies.code,
    })
    .from(candidates)
    .innerJoin(vacancies, eq(candidates.vacancyId, vacancies.id))
    .where(eq(candidates.id, candidateId));

  if (!person || !person.portalEnabled) return null;

  const assignments = await db
    .select({
      id: candidateAssignments.id,
      status: candidateAssignments.status,
      assignedAt: candidateAssignments.assignedAt,
      dueAt: candidateAssignments.dueAt,
      assessmentTitle: assessments.title,
    })
    .from(candidateAssignments)
    .innerJoin(
      assessments,
      eq(candidateAssignments.assessmentId, assessments.id),
    )
    .where(eq(candidateAssignments.candidateId, candidateId))
    .orderBy(desc(candidateAssignments.assignedAt));

  const pending = assignments.find((a) => a.status === "pending") ?? null;
  const latestDone = assignments.find((a) => a.status === "completed") ?? null;

  return { person, pending, latestDone, assignments };
}

export async function getCandidateAssignmentForPortal(
  assignmentId: number,
  candidateId: number,
) {
  const data = await getCandidateAssignmentForTake(assignmentId);
  if (!data || data.candidateId !== candidateId) return null;
  return data;
}

export async function getParticipantAssignmentForTake(
  assignmentId: number,
  session: SessionUser,
) {
  if (session.participantKind === "candidate" && session.candidateId) {
    const data = await getCandidateAssignmentForPortal(
      assignmentId,
      session.candidateId,
    );
    if (!data) return null;
    return {
      id: data.id,
      status: data.status,
      personName: data.candidateName,
      assessmentTitle: data.assessmentTitle,
      durationMinutes: data.durationMinutes,
      roleTitle: data.roleTitle,
      expiresAt: data.expiresAt,
      questions: data.questions,
      showResultToCandidate: data.showResultToCandidate,
      mode: "candidate" as const,
    };
  }

  if (
    (session.participantKind === "employee" ||
      session.participantKind === "intern") &&
    session.employeeId
  ) {
    const data = await getAssignmentForTake(assignmentId);
    if (!data || data.employeeId !== session.employeeId) return null;
    const [emp] = await db
      .select({ roleTitle: employees.roleTitle })
      .from(employees)
      .where(eq(employees.id, session.employeeId));
    return {
      id: data.id,
      status: data.status,
      personName: data.employeeName,
      assessmentTitle: data.assessmentTitle,
      durationMinutes: data.durationMinutes,
      roleTitle: emp?.roleTitle ?? "",
      questions: data.questions,
      mode: "employee" as const,
    };
  }

  return null;
}

export async function createCandidate(input: {
  name: string;
  phone?: string;
  email?: string;
  telegram?: string;
  source?: string;
  vacancyId: number;
  notes?: string;
}) {
  await ensureDb();
  const [row] = await db
    .insert(candidates)
    .values({
      name: input.name,
      phone: input.phone ?? "",
      email: input.email ?? "",
      telegram: input.telegram ?? "",
      source: input.source ?? "manual",
      vacancyId: input.vacancyId,
      notes: input.notes ?? "",
      status: "new",
      currentLevel: "unassessed",
      avatarHue: hueFromName(input.name),
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

export async function getCandidateAssignments() {
  await ensureDb();
  return db
    .select({
      id: candidateAssignments.id,
      status: candidateAssignments.status,
      assignedAt: candidateAssignments.assignedAt,
      dueAt: candidateAssignments.dueAt,
      candidateId: candidates.id,
      candidateName: candidates.name,
      assessmentId: assessments.id,
      assessmentTitle: assessments.title,
      roleTitle: vacancies.roleTitle,
    })
    .from(candidateAssignments)
    .innerJoin(
      candidates,
      eq(candidateAssignments.candidateId, candidates.id),
    )
    .innerJoin(vacancies, eq(candidates.vacancyId, vacancies.id))
    .innerJoin(
      assessments,
      eq(candidateAssignments.assessmentId, assessments.id),
    )
    .orderBy(desc(candidateAssignments.assignedAt));
}

export async function assignCandidateAssessment(input: {
  candidateId: number;
  assessmentId: number;
  dueAt?: string;
}) {
  await ensureDb();
  const [roleCheck] = await db
    .select({
      roleTitle: vacancies.roleTitle,
      assessmentTitle: assessments.title,
      assessmentDescription: assessments.description,
      competencyName: competencies.name,
      source: assessments.source,
    })
    .from(candidates)
    .innerJoin(vacancies, eq(candidates.vacancyId, vacancies.id))
    .innerJoin(assessments, eq(assessments.id, input.assessmentId))
    .innerJoin(competencies, eq(assessments.competencyId, competencies.id))
    .where(eq(candidates.id, input.candidateId));
  if (
    !roleCheck ||
    roleCheck.source !== "candidate" ||
    Math.max(
      roleMatchScore(roleCheck.roleTitle, roleCheck.assessmentTitle),
      roleMatchScore(roleCheck.roleTitle, roleCheck.assessmentDescription),
      roleMatchScore(roleCheck.roleTitle, roleCheck.competencyName),
    ) < 50
  ) {
    throw new Error("Кандидату можно назначить только входной тест его должности");
  }
  const availableQuestions = await db
    .select()
    .from(questions)
    .where(
      and(
        eq(questions.assessmentId, input.assessmentId),
        eq(questions.isActive, true),
      ),
    );
  const { getSettingsSection } = await import("./system-settings");
  const defaults = await getSettingsSection("tests");
  const selectedQuestions = selectEntranceQuestions(
    availableQuestions,
    0,
    defaults.questionCount,
    defaults.randomOrder,
  );
  if (selectedQuestions.length < defaults.questionCount) {
    throw new Error(
      `Входной тест должен содержать не менее ${defaults.questionCount} активных вопросов`,
    );
  }
  const invalidOptions = selectedQuestions.some((question) => {
    try {
      const options = JSON.parse(question.optionsJson || "[]") as unknown;
      return !Array.isArray(options) || options.length !== 4;
    } catch {
      return true;
    }
  });
  if (invalidOptions) {
    throw new Error("У каждого вопроса входного теста должно быть 4 варианта ответа");
  }
  const [row] = await db
    .insert(candidateAssignments)
    .values({
      candidateId: input.candidateId,
      assessmentId: input.assessmentId,
      status: "pending",
      assignedAt: new Date().toISOString(),
      dueAt: input.dueAt ?? null,
    })
    .returning();

  await db
    .update(candidates)
    .set({ status: "test_assigned" })
    .where(eq(candidates.id, input.candidateId));

  return row;
}

export async function getCandidateAssignmentForTake(assignmentId: number) {
  await ensureDb();
  const [row] = await db
    .select({
      id: candidateAssignments.id,
      status: candidateAssignments.status,
      candidateId: candidateAssignments.candidateId,
      assessmentId: candidateAssignments.assessmentId,
      candidateName: candidates.name,
      assessmentTitle: assessments.title,
      assessmentDescription: assessments.description,
      durationMinutes: assessments.durationMinutes,
      roleTitle: vacancies.roleTitle,
      startedAt: candidateAssignments.startedAt,
      expiresAt: candidateAssignments.expiresAt,
    })
    .from(candidateAssignments)
    .innerJoin(
      candidates,
      eq(candidateAssignments.candidateId, candidates.id),
    )
    .innerJoin(vacancies, eq(candidates.vacancyId, vacancies.id))
    .innerJoin(
      assessments,
      eq(candidateAssignments.assessmentId, assessments.id),
    )
    .where(eq(candidateAssignments.id, assignmentId));

  if (!row) return null;

  const { getSettingsSection } = await import("./system-settings");
  const testSettings = await getSettingsSection("tests");
  const durationMinutes = Math.max(
    1,
    testSettings.durationMinutes || Number(row.durationMinutes) || 25,
  );
  const startedAt = row.startedAt ?? new Date().toISOString();
  const expiresAt =
    row.expiresAt ??
    new Date(new Date(startedAt).getTime() + durationMinutes * 60_000).toISOString();
  if (!row.startedAt || !row.expiresAt) {
    await db
      .update(candidateAssignments)
      .set({ startedAt, expiresAt, status: "in_progress" })
      .where(eq(candidateAssignments.id, assignmentId));
  }

  const qs = await db
    .select()
    .from(questions)
    .where(
      and(
        eq(questions.assessmentId, row.assessmentId),
        eq(questions.isActive, true),
      ),
    );
  const entranceQuestions = selectEntranceQuestions(
    qs,
    assignmentId,
    testSettings.questionCount,
    testSettings.randomOrder,
  );

  return {
    ...row,
    durationMinutes,
    startedAt,
    expiresAt,
    showResultToCandidate: testSettings.showResultToCandidate,
    questions: entranceQuestions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: (q.type || "single") as "single" | "multiple" | "text",
      options: JSON.parse(q.optionsJson || "[]") as string[],
    })),
  };
}

export async function submitCandidateAssessment(
  assignmentId: number,
  answers: Record<string, AnswerValue>,
  options?: Partial<EntranceTestTelemetry>,
) {
  await ensureDb();
  const [assignment] = await db
    .select()
    .from(candidateAssignments)
    .where(eq(candidateAssignments.id, assignmentId));
  if (!assignment || assignment.status === "completed") {
    throw new Error("Assignment not available");
  }

  if (
    !options?.timedOut &&
    assignment.expiresAt &&
    Date.now() > new Date(assignment.expiresAt).getTime()
  ) {
    throw new Error("Время истекло");
  }

  const qs = await db
    .select()
    .from(questions)
    .where(
      and(
        eq(questions.assessmentId, assignment.assessmentId),
        eq(questions.isActive, true),
      ),
    );

  const previousAttempts = await db
    .select({ id: candidateResults.id })
    .from(candidateResults)
    .where(eq(candidateResults.candidateId, assignment.candidateId));
  const { getSettingsSection } = await import("./system-settings");
  const defaults = await getSettingsSection("tests");
  if (previousAttempts.length >= defaults.maxAttempts) {
    throw new Error("Превышено число попыток");
  }
  const entranceQuestions = selectEntranceQuestions(
    qs,
    assignmentId,
    defaults.questionCount,
    defaults.randomOrder,
  );
  const { score, profile: baseProfile } = scoreAnswers(entranceQuestions, answers);
  const entranceLevel = entranceLevelForScore(score);
  const [testSettings] = await db
    .select({ passScore: assessments.passScore })
    .from(assessments)
    .where(eq(assessments.id, assignment.assessmentId));
  const passScore = testSettings?.passScore ?? defaults.passScore ?? 60;
  const recommendation =
    score >= passScore
      ? entranceLevel.recommendation
      : `Проходной порог ${passScore}% не достигнут. ${entranceLevel.recommendation}`;
  const completedAt = new Date();
  const startedAt = assignment.startedAt
    ? new Date(assignment.startedAt)
    : completedAt;
  const skippedCount = entranceQuestions.filter(
    (question) => answers[String(question.id)] === undefined,
  ).length;
  const telemetry: EntranceTestTelemetry = {
    answerChanges: Math.max(0, Number(options?.answerChanges) || 0),
    pageExits: Math.max(0, Number(options?.pageExits) || 0),
    timedOut: Boolean(options?.timedOut),
    userAgent: options?.userAgent ? String(options.userAgent).slice(0, 500) : undefined,
    attemptNumber: previousAttempts.length + 1,
    durationSeconds: Math.max(
      0,
      Math.round((completedAt.getTime() - startedAt.getTime()) / 1000),
    ),
  };
  const correctCount = baseProfile.autoCorrect;
  const incorrectCount = Math.max(
    0,
    baseProfile.autoTotal - correctCount - skippedCount,
  );
  const verifixSummary = [
    "Входной тест завершён.",
    `Результат: ${correctCount} из ${baseProfile.autoTotal}.`,
    `Процент: ${score}%.`,
    `Уровень: ${entranceLevel.label}.`,
    entranceLevel.confirmation,
    `Рекомендация: ${recommendation}`,
  ].join("\n");
  const profile: EntranceTestProfile = {
    ...baseProfile,
    levelCode:
      entranceLevel.code === "middle"
        ? "middle"
        : entranceLevel.code === "intern"
          ? "intern"
          : "junior",
    entranceLevel: entranceLevel.label,
    recommendation,
    correctCount,
    incorrectCount,
    skippedCount,
    weakTopics: baseProfile.gaps,
    telemetry,
    verifixSummary,
  };
  const levelCode = entranceLevel.code;

  await db.insert(candidateResults).values({
    assignmentId,
    candidateId: assignment.candidateId,
    assessmentId: assignment.assessmentId,
    score,
    levelCode,
    answersJson: JSON.stringify(answers),
    profileJson: JSON.stringify(profile),
    telemetryJson: JSON.stringify(telemetry),
    completedAt: completedAt.toISOString(),
  });

  await db
    .update(candidateAssignments)
    .set({ status: "completed" })
    .where(eq(candidateAssignments.id, assignmentId));

  await db
    .update(candidates)
    .set({ currentLevel: levelCode, status: "test_completed" })
    .where(eq(candidates.id, assignment.candidateId));

  await appendCandidateEvent({
    candidateId: assignment.candidateId,
    kind: "test",
    title: "Входной тест завершён",
    body: `Результат: ${score}% · уровень ${levelCode}`,
    fromStatus: "test_assigned",
    toStatus: "test_completed",
  });

  void (async () => {
    try {
      const { syncTestResultToVerifix } = await import("./integrations");
      const [person] = await db
        .select({ name: candidates.name })
        .from(candidates)
        .where(eq(candidates.id, assignment.candidateId))
        .limit(1);
      await syncTestResultToVerifix({
        candidateId: assignment.candidateId,
        name: person?.name ?? "",
        score,
        level: levelCode,
        summary: verifixSummary,
      });
    } catch {
      /* logged in integration journal */
    }
  })();

  const [level] = await db
    .select()
    .from(levelDefinitions)
    .where(eq(levelDefinitions.code, levelCode));

  return { score, levelCode, level, profile };
}

export async function ensureTestAudiences() {
  await ensureDb();
  const wanted = [
    {
      name: "для сотрудников",
      description: "Тесты, которые назначают сотрудникам компании.",
      category: "аудитория",
      kind: "audience" as const,
    },
    {
      name: "для стажёров",
      description: "Тесты для стажёров и практики.",
      category: "аудитория",
      kind: "audience" as const,
    },
    {
      name: "для кандидатов",
      description: "Тесты для кандидатов на вакансии.",
      category: "аудитория",
      kind: "audience" as const,
    },
  ];

  for (const item of wanted) {
    const [byName] = await db
      .select()
      .from(competencies)
      .where(eq(competencies.name, item.name))
      .limit(1);
    if (byName) {
      await db
        .update(competencies)
        .set({
          description: item.description,
          category: item.category,
          kind: "audience",
          isActive: true,
        })
        .where(eq(competencies.id, byName.id));
    } else {
      await db.insert(competencies).values({
        name: item.name,
        description: item.description,
        category: item.category,
        kind: "audience",
        isActive: true,
      });
    }
  }
}

/** Test audiences only (not skill competencies). */
export async function getCompetencyOptions() {
  await ensureTestAudiences();
  return db
    .select()
    .from(competencies)
    .where(eq(competencies.kind, "audience"))
    .orderBy(asc(competencies.id));
}

export async function createAssessment(input: {
  title: string;
  description: string;
  competencyId: number;
  durationMinutes: number;
  passScore?: number;
  driveFileId?: string | null;
  driveModifiedAt?: string | null;
  source?:
    | "library"
    | "attestation"
    | "learning"
    | "candidate"
    | "trial"
    | "intern"
    | "level";
}) {
  await ensureDb();
  const [row] = await db
    .insert(assessments)
    .values({
      title: input.title,
      description: input.description,
      competencyId: input.competencyId,
      durationMinutes: input.durationMinutes,
      passScore: input.passScore ?? 60,
      isActive: true,
      driveFileId: input.driveFileId ?? null,
      driveModifiedAt: input.driveModifiedAt ?? null,
      source: input.source ?? "library",
    })
    .returning();
  return row;
}

/** Импорт «Тест HR-рекрутера (50 вопросов)» из data/hr-recruiter-test.ts */
export async function ensureHrRecruiterTest() {
  await ensureDb();
  await ensureTestAudiences();

  const [existing] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.title, HR_RECRUITER_TEST.title))
    .limit(1);

  if (existing) {
    const qs = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.assessmentId, existing.id));
    if (qs.length >= HR_RECRUITER_TEST.questions.length) {
      return existing;
    }
  }

  const comps = await getCompetencyOptions();
  const competencyId = comps[0]?.id;
  if (!competencyId) {
    throw new Error("Нет аудитории тестов — сначала ensureTestAudiences()");
  }

  let assessment = existing;
  if (!assessment) {
    assessment = await createAssessment({
      title: HR_RECRUITER_TEST.title,
      description: HR_RECRUITER_TEST.description,
      competencyId,
      durationMinutes: HR_RECRUITER_TEST.durationMinutes,
    });
  } else {
    // дочищаем неполный набор
    await db.delete(questions).where(eq(questions.assessmentId, assessment.id));
  }

  for (const q of HR_RECRUITER_TEST.questions) {
    await addQuestion({
      assessmentId: assessment.id,
      prompt: q.prompt,
      type: q.type,
      options: q.options ?? [],
      correctIndexes:
        q.type === "single" && typeof q.correctIndex === "number"
          ? [q.correctIndex]
          : [],
      keywords: q.keywords ?? [],
      weight: q.weight,
      knowledgeKind: q.knowledgeKind,
      section: q.section,
    });
  }

  return assessment;
}

export async function getAssessmentDetail(id: number) {
  await ensureDb();
  const [row] = await db
    .select({
      id: assessments.id,
      title: assessments.title,
      description: assessments.description,
      durationMinutes: assessments.durationMinutes,
      passScore: assessments.passScore,
      isActive: assessments.isActive,
      competencyId: assessments.competencyId,
      competencyName: competencies.name,
      source: assessments.source,
    })
    .from(assessments)
    .innerJoin(competencies, eq(assessments.competencyId, competencies.id))
    .where(eq(assessments.id, id));

  if (!row) return null;

  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.assessmentId, id));

  return {
    ...row,
    questions: qs.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: (q.type || "single") as "single" | "multiple" | "text",
      options: JSON.parse(q.optionsJson || "[]") as string[],
      correctIndex: q.correctIndex,
      correctIndexes: (() => {
        try {
          const arr = JSON.parse(q.correctIndexesJson || "[]") as number[];
          return Array.isArray(arr) && arr.length ? arr : [q.correctIndex];
        } catch {
          return [q.correctIndex];
        }
      })(),
      keywords: (() => {
        try {
          const arr = JSON.parse(q.keywordsJson || "[]") as string[];
          return Array.isArray(arr) ? arr : [];
        } catch {
          return [] as string[];
        }
      })(),
      weight: q.weight,
      difficulty: q.difficulty || "junior",
      knowledgeKind: q.knowledgeKind || "knowledge",
      section: q.section || "Общий",
      isActive: q.isActive,
    })),
  };
}

export async function addQuestion(input: {
  assessmentId: number;
  prompt: string;
  type: "single" | "multiple" | "text";
  options: string[];
  correctIndexes: number[];
  keywords: string[];
  weight?: number;
  difficulty?: string;
  knowledgeKind?: string;
  section?: string;
  isActive?: boolean;
}) {
  await ensureDb();
  const correctIndexes =
    input.type === "text"
      ? []
      : input.correctIndexes.length
        ? input.correctIndexes
        : [0];
  const [row] = await db
    .insert(questions)
    .values({
      assessmentId: input.assessmentId,
      prompt: input.prompt,
      type: input.type,
      optionsJson: JSON.stringify(
        input.type === "text" ? [] : input.options.filter((o) => o.trim()),
      ),
      correctIndex: correctIndexes[0] ?? 0,
      correctIndexesJson: JSON.stringify(correctIndexes),
      keywordsJson: JSON.stringify(
        input.type === "text"
          ? input.keywords.map((k) => k.trim()).filter(Boolean)
          : [],
      ),
      weight: input.weight ?? 1,
      difficulty: input.difficulty ?? "junior",
      knowledgeKind: input.knowledgeKind ?? "knowledge",
      section: input.section?.trim() || "Общий",
      isActive: input.isActive ?? true,
    })
    .returning();
  return row;
}

export async function updateAssessment(input: {
  id: number;
  title: string;
  description: string;
  competencyId: number;
  durationMinutes: number;
  passScore?: number;
}) {
  await ensureDb();
  const [row] = await db
    .update(assessments)
    .set({
      title: input.title,
      description: input.description,
      competencyId: input.competencyId,
      durationMinutes: input.durationMinutes,
      passScore: input.passScore ?? 60,
    })
    .where(eq(assessments.id, input.id))
    .returning();
  return row;
}

export async function updateQuestion(input: {
  id: number;
  prompt: string;
  type: "single" | "multiple" | "text";
  options: string[];
  correctIndexes: number[];
  keywords: string[];
  weight?: number;
  difficulty?: string;
  knowledgeKind?: string;
  section?: string;
  isActive?: boolean;
}) {
  await ensureDb();
  const correctIndexes =
    input.type === "text"
      ? []
      : input.correctIndexes.length
        ? input.correctIndexes
        : [0];
  const [row] = await db
    .update(questions)
    .set({
      prompt: input.prompt,
      type: input.type,
      optionsJson: JSON.stringify(
        input.type === "text" ? [] : input.options.filter((o) => o.trim()),
      ),
      correctIndex: correctIndexes[0] ?? 0,
      correctIndexesJson: JSON.stringify(correctIndexes),
      keywordsJson: JSON.stringify(
        input.type === "text"
          ? input.keywords.map((k) => k.trim()).filter(Boolean)
          : [],
      ),
      weight: input.weight ?? 1,
      difficulty: input.difficulty ?? "junior",
      knowledgeKind: input.knowledgeKind ?? "knowledge",
      section: input.section?.trim() || "Общий",
      isActive: input.isActive ?? true,
    })
    .where(eq(questions.id, input.id))
    .returning();
  return row;
}

export async function deleteQuestion(id: number) {
  await ensureDb();
  await db.delete(questions).where(eq(questions.id, id));
}

export async function getRoleHomePage(audience: RoleHomeAudience) {
  await ensureDb();
  const [row] = await db
    .select()
    .from(roleHomePages)
    .where(eq(roleHomePages.audience, audience))
    .limit(1);
  if (!row) return emptyRoleHomeDocument();
  return parseRoleHomeDocument(row.documentJson);
}

export async function getAllRoleHomePages(): Promise<RoleHomePagesMap> {
  await ensureDb();
  const rows = await db.select().from(roleHomePages);
  const pages = emptyRoleHomePages();
  for (const row of rows) {
    if (!isRoleHomeAudience(row.audience)) continue;
    pages[row.audience] = parseRoleHomeDocument(row.documentJson);
  }
  return pages;
}

export async function upsertRoleHomePage(input: {
  audience: RoleHomeAudience;
  document: RoleHomeDocument;
  userId: number;
}) {
  await ensureDb();
  const now = new Date().toISOString();
  const documentJson = JSON.stringify(input.document);
  const [existing] = await db
    .select()
    .from(roleHomePages)
    .where(eq(roleHomePages.audience, input.audience))
    .limit(1);

  if (existing) {
    const [row] = await db
      .update(roleHomePages)
      .set({
        documentJson,
        version: existing.version + 1,
        updatedAt: now,
        updatedByUserId: input.userId,
      })
      .where(eq(roleHomePages.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(roleHomePages)
    .values({
      audience: input.audience,
      documentJson,
      version: 1,
      updatedAt: now,
      updatedByUserId: input.userId,
    })
    .returning();
  return row;
}

export async function getVisualContentPage(pageKey: OnboardingVisualPageKey) {
  await ensureDb();
  const [row] = await db
    .select()
    .from(visualContentPages)
    .where(eq(visualContentPages.pageKey, pageKey))
    .limit(1);
  return row
    ? parseRoleHomeDocument(row.documentJson)
    : emptyRoleHomeDocument();
}

export async function getAllOnboardingVisualPages() {
  await ensureDb();
  const rows = await db.select().from(visualContentPages);
  const pages = emptyOnboardingVisualPages();
  for (const row of rows) {
    if (row.pageKey in pages) {
      pages[row.pageKey as OnboardingVisualPageKey] =
        parseRoleHomeDocument(row.documentJson);
    }
  }
  return pages;
}

export async function upsertVisualContentPage(input: {
  pageKey: OnboardingVisualPageKey;
  document: RoleHomeDocument;
  userId: number;
}) {
  await ensureDb();
  const now = new Date().toISOString();
  const documentJson = JSON.stringify(input.document);
  const [existing] = await db
    .select()
    .from(visualContentPages)
    .where(eq(visualContentPages.pageKey, input.pageKey))
    .limit(1);

  if (existing) {
    const [row] = await db
      .update(visualContentPages)
      .set({
        documentJson,
        version: existing.version + 1,
        updatedAt: now,
        updatedByUserId: input.userId,
      })
      .where(eq(visualContentPages.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(visualContentPages)
    .values({
      pageKey: input.pageKey,
      documentJson,
      version: 1,
      updatedAt: now,
      updatedByUserId: input.userId,
    })
    .returning();
  return row;
}

export async function setPreferredLocale(userId: number, locale: Locale) {
  await ensureDb();
  await db
    .update(platformUsers)
    .set({ preferredLocale: locale })
    .where(eq(platformUsers.id, userId));
}

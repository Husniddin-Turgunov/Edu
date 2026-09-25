import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "./index";
import {
  assessments,
  attestations,
  competencies,
  learningLessons,
  roleCompetencies,
  roleProfiles,
  staffingPositions,
  vacancies,
} from "./schema";
import {
  lessonAssignedToStaffRole,
  pickBestRoleMatch,
  staffRoleBase,
} from "../lib/role-match";

async function ready() {
  const { ensureDb } = await import("./queries");
  await ensureDb();
}

export type JuniorRequirements = {
  basicKnowledge: string;
  standardTasks: string;
  byInstruction: string;
  requiredPrograms: string;
  minKpi: string;
};

export type MiddleRequirements = {
  independentTasks: string;
  complexSituations: string;
  analysis: string;
  errorPrevention: string;
  responsibility: string;
  processImprovement: string;
  communication: string;
};

const EMPTY_JUNIOR: JuniorRequirements = {
  basicKnowledge: "",
  standardTasks: "",
  byInstruction: "",
  requiredPrograms: "",
  minKpi: "",
};

const EMPTY_MIDDLE: MiddleRequirements = {
  independentTasks: "",
  complexSituations: "",
  analysis: "",
  errorPrevention: "",
  responsibility: "",
  processImprovement: "",
  communication: "",
};

function parseJsonArray(raw: string | null | undefined): string[] {
  try {
    const value = JSON.parse(raw || "[]");
    return Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function parseJunior(raw: string | null | undefined): JuniorRequirements {
  try {
    const value = JSON.parse(raw || "{}") as Partial<JuniorRequirements>;
    return { ...EMPTY_JUNIOR, ...value };
  } catch {
    return { ...EMPTY_JUNIOR };
  }
}

function parseMiddle(raw: string | null | undefined): MiddleRequirements {
  try {
    const value = JSON.parse(raw || "{}") as Partial<MiddleRequirements>;
    return { ...EMPTY_MIDDLE, ...value };
  } catch {
    return { ...EMPTY_MIDDLE };
  }
}

export function roleProfileKey(department: string, roleTitle: string) {
  return `${department.trim().toLowerCase()}::${staffRoleBase(roleTitle)
    .trim()
    .toLowerCase()}`;
}

export function makeRoleCode(department: string, roleTitle: string) {
  const dept = department
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  const role = staffRoleBase(roleTitle)
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${dept || "dept"}__${role || "role"}`.toLowerCase();
}

/** Pull unique roles from staffing seats into role_profiles (idempotent). */
export async function syncRoleProfilesFromStaffing() {
  await ready();
  const seats = await db
    .select()
    .from(staffingPositions)
    .where(eq(staffingPositions.isActive, true))
    .orderBy(asc(staffingPositions.sortOrder));

  const existing = await db.select().from(roleProfiles);
  const byKey = new Map(
    existing.map((row) => [roleProfileKey(row.department, row.roleTitle), row]),
  );
  const byCode = new Map(existing.map((row) => [row.code, row]));

  let sortOrder = 0;
  const seen = new Set<string>();
  const pendingInserts: Array<{
    code: string;
    roleTitle: string;
    department: string;
    sortOrder: number;
  }> = [];

  for (const seat of seats) {
    const title = staffRoleBase(seat.roleTitle).trim() || seat.roleTitle.trim();
    if (!title) continue;
    const key = roleProfileKey(seat.department, title);
    if (seen.has(key)) continue;
    seen.add(key);

    const code = makeRoleCode(seat.department, title);
    const found = byKey.get(key) ?? byCode.get(code);
    if (found) {
      if (found.sortOrder !== sortOrder || !found.isActive) {
        await db
          .update(roleProfiles)
          .set({
            sortOrder,
            isActive: true,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(roleProfiles.id, found.id));
      }
    } else if (!byCode.has(code)) {
      byCode.set(code, {
        id: -1,
        code,
        roleTitle: title,
        department: seat.department,
      } as (typeof existing)[number]);
      pendingInserts.push({
        code,
        roleTitle: title,
        department: seat.department,
        sortOrder,
      });
    }
    sortOrder += 1;
  }

  if (pendingInserts.length > 0) {
    await db.insert(roleProfiles).values(
      pendingInserts.map((row) => ({
        ...row,
        isActive: true,
        updatedAt: new Date().toISOString(),
      })),
    );
  }
}

export type RoleProfileBrief = {
  id: number;
  roleTitle: string;
  department: string;
  description: string;
  duties: string;
  requirements: string;
  programs: string[];
  tools: string[];
};

export async function getRoleProfileBriefForStaff(input: {
  department: string;
  roleTitle: string;
}): Promise<RoleProfileBrief | null> {
  await ready();
  const rows = await db.select().from(roleProfiles);
  if (rows.length === 0) return null;
  const key = roleProfileKey(input.department, input.roleTitle);
  const titleKey = staffRoleBase(input.roleTitle).trim().toLowerCase();
  const match =
    rows.find((row) => roleProfileKey(row.department, row.roleTitle) === key) ??
    rows.find(
      (row) => staffRoleBase(row.roleTitle).trim().toLowerCase() === titleKey,
    );
  if (!match) return null;
  return {
    id: match.id,
    roleTitle: match.roleTitle,
    department: match.department,
    description: match.description.trim(),
    duties: match.duties.trim(),
    requirements: match.requirements.trim(),
    programs: parseJsonArray(match.programsJson),
    tools: parseJsonArray(match.toolsJson),
  };
}

export async function listRoleCatalog(includeArchived = false) {
  await ready();

  const [{ count: profileCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(roleProfiles);
  // Bootstrap only once; regular page loads must stay read-only.
  if (Number(profileCount) === 0) {
    await syncRoleProfilesFromStaffing();
  }

  const profiles = includeArchived
    ? await db
        .select()
        .from(roleProfiles)
        .orderBy(asc(roleProfiles.sortOrder), asc(roleProfiles.roleTitle))
    : await db
        .select()
        .from(roleProfiles)
        .where(eq(roleProfiles.isActive, true))
        .orderBy(asc(roleProfiles.sortOrder), asc(roleProfiles.roleTitle));

  const [seats, openVacancies, links, skills] = await Promise.all([
    db.select().from(staffingPositions).where(eq(staffingPositions.isActive, true)),
    db.select().from(vacancies).where(eq(vacancies.status, "open")),
    db.select().from(roleCompetencies),
    db
      .select()
      .from(competencies)
      .where(and(eq(competencies.kind, "skill"), eq(competencies.isActive, true))),
  ]);

  const skillCountByRole = new Map<number, number>();
  for (const link of links) {
    skillCountByRole.set(
      link.roleProfileId,
      (skillCountByRole.get(link.roleProfileId) ?? 0) + 1,
    );
  }

  const seatStats = new Map<string, { total: number; filled: number }>();
  for (const seat of seats) {
    const key = roleProfileKey(seat.department, seat.roleTitle);
    const stat = seatStats.get(key) ?? { total: 0, filled: 0 };
    stat.total += 1;
    if (seat.employeeId != null) stat.filled += 1;
    seatStats.set(key, stat);
  }

  const vacancyByKey = new Map<string, number>();
  const vacancyByTitle = new Map<string, number>();
  for (const row of openVacancies) {
    const key = roleProfileKey(row.department, row.roleTitle);
    vacancyByKey.set(key, (vacancyByKey.get(key) ?? 0) + 1);
    const title = staffRoleBase(row.roleTitle).toLowerCase();
    vacancyByTitle.set(title, (vacancyByTitle.get(title) ?? 0) + 1);
  }

  return profiles.map((profile) => {
    const key = roleProfileKey(profile.department, profile.roleTitle);
    const stat = seatStats.get(key) ?? { total: 0, filled: 0 };
    const filled = stat.filled;
    const vacantSeats = stat.total - filled;
    const title = staffRoleBase(profile.roleTitle).toLowerCase();
    const hiringVacancies =
      vacancyByKey.get(key) ?? vacancyByTitle.get(title) ?? 0;

    return {
      id: profile.id,
      code: profile.code,
      roleTitle: profile.roleTitle,
      department: profile.department,
      managerName: profile.managerName,
      description: profile.description,
      isActive: profile.isActive,
      seatCount: stat.total,
      filledCount: filled,
      vacantSeats,
      activeVacancies: vacantSeats + hiringVacancies,
      competencyCount: skillCountByRole.get(profile.id) ?? 0,
      skillCatalogSize: skills.length,
    };
  });
}

export async function getRoleProfileDetail(id: number) {
  await ready();
  const [profile] = await db
    .select()
    .from(roleProfiles)
    .where(eq(roleProfiles.id, id))
    .limit(1);
  if (!profile) return null;

  const [links, allSkills, seats, openVacancies, allAssessments, allAttestations, lessonRows] =
    await Promise.all([
      db
        .select()
        .from(roleCompetencies)
        .where(eq(roleCompetencies.roleProfileId, id)),
      db
        .select()
        .from(competencies)
        .where(and(eq(competencies.kind, "skill"), eq(competencies.isActive, true)))
        .orderBy(asc(competencies.category), asc(competencies.name)),
      db.select().from(staffingPositions).where(eq(staffingPositions.isActive, true)),
      db.select().from(vacancies).where(eq(vacancies.status, "open")),
      db.select().from(assessments).where(eq(assessments.isActive, true)),
      db.select().from(attestations),
      db
        .select({
          id: learningLessons.id,
          slug: learningLessons.slug,
          title: learningLessons.title,
          // Only the flag: `practice` bodies across all lessons are megabytes.
          hasPractice: sql<number>`CASE WHEN trim(coalesce(${learningLessons.practice}, '')) = '' THEN 0 ELSE 1 END`,
          programMonth: learningLessons.programMonth,
          roleFamiliesJson: learningLessons.roleFamiliesJson,
        })
        .from(learningLessons)
        .where(
          and(
            eq(learningLessons.isActive, true),
            ne(learningLessons.roleFamiliesJson, "[]"),
          ),
        ),
    ]);

  const lessons = lessonRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    hasPractice: Number(row.hasPractice) === 1,
    programMonth: row.programMonth,
    roleFamilies: parseJsonArray(row.roleFamiliesJson),
  }));

  const linkedIds = new Set(links.map((row) => row.competencyId));
  const skillById = new Map(allSkills.map((row) => [row.id, row]));
  const roleSkills = links
    .map((link) => {
      const skill = skillById.get(link.competencyId);
      if (!skill) return null;
      return {
        linkId: link.id,
        competencyId: skill.id,
        name: skill.name,
        category: skill.category,
        description: skill.description,
        levelScope: link.levelScope || skill.levelScope,
        verificationMethod: skill.verificationMethod,
        isRequired: link.isRequired,
        weight: link.weight,
        isCriticalError: skill.isCriticalError,
      };
    })
    .filter(Boolean) as Array<{
    linkId: number;
    competencyId: number;
    name: string;
    category: string;
    description: string;
    levelScope: string;
    verificationMethod: string;
    isRequired: boolean;
    weight: number;
    isCriticalError: boolean;
  }>;

  const key = roleProfileKey(profile.department, profile.roleTitle);
  const seatRows = seats.filter(
    (seat) => roleProfileKey(seat.department, seat.roleTitle) === key,
  );
  const vacantSeats = seatRows.filter((seat) => seat.employeeId == null).length;
  const hiringVacancies = openVacancies.filter(
    (row) =>
      roleProfileKey(row.department, row.roleTitle) === key ||
      staffRoleBase(row.roleTitle).toLowerCase() ===
        staffRoleBase(profile.roleTitle).toLowerCase(),
  ).length;

  const roleLessons = lessons.filter((lesson) =>
    lessonAssignedToStaffRole(lesson.roleFamilies, profile.roleTitle),
  );
  const fiveDay = roleLessons.filter(
    (lesson) =>
      lesson.programMonth === 0 ||
      /trial|5.?day|пятиднев|стаж/i.test(lesson.slug) ||
      /trial|5.?day|пятиднев|стаж/i.test(lesson.title),
  );
  const threeMonth = roleLessons.filter((lesson) => lesson.programMonth > 0);
  const practice = roleLessons.filter((lesson) => lesson.hasPractice);

  const entrance = pickBestRoleMatch(profile.roleTitle, allAssessments);
  const relatedAttestations = allAttestations.filter((row) => {
    const titles = parseJsonArray(row.positionTitlesJson);
    if (titles.length === 0) return false;
    return titles.some(
      (title) =>
        staffRoleBase(title).toLowerCase() ===
          staffRoleBase(profile.roleTitle).toLowerCase() ||
        lessonAssignedToStaffRole([title], profile.roleTitle),
    );
  });

  return {
    profile: {
      id: profile.id,
      code: profile.code,
      roleTitle: profile.roleTitle,
      department: profile.department,
      managerName: profile.managerName,
      description: profile.description,
      duties: profile.duties,
      requirements: profile.requirements,
      programs: parseJsonArray(profile.programsJson),
      tools: parseJsonArray(profile.toolsJson),
      junior: parseJunior(profile.juniorReqJson),
      middle: parseMiddle(profile.middleReqJson),
      isActive: profile.isActive,
      seatCount: seatRows.length,
      filledCount: seatRows.length - vacantSeats,
      vacantSeats,
      activeVacancies: vacantSeats + hiringVacancies,
    },
    competencies: roleSkills,
    availableSkills: allSkills.filter((skill) => !linkedIds.has(skill.id)),
    materials: {
      entranceTest: entrance
        ? { id: entrance.id, title: entrance.title, source: entrance.source }
        : null,
      fiveDayLessons: fiveDay.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        slug: lesson.slug,
      })),
      threeMonthLessons: threeMonth.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        slug: lesson.slug,
        month: lesson.programMonth,
      })),
      practiceLessons: practice.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        slug: lesson.slug,
      })),
      attestations: relatedAttestations.map((row) => ({
        id: row.id,
        title: row.title,
        department: row.department,
      })),
    },
  };
}

export async function createRoleProfile(input: {
  code?: string;
  roleTitle: string;
  department: string;
  managerName?: string;
  description?: string;
}) {
  await ready();
  const roleTitle = staffRoleBase(input.roleTitle).trim() || input.roleTitle.trim();
  const department = input.department.trim();
  if (!roleTitle || !department) throw new Error("Укажите должность и подразделение");

  const code =
    input.code?.trim() || makeRoleCode(department, roleTitle);
  const [existing] = await db
    .select()
    .from(roleProfiles)
    .where(eq(roleProfiles.code, code))
    .limit(1);
  if (existing) throw new Error("Должность с таким кодом уже есть");

  const [row] = await db
    .insert(roleProfiles)
    .values({
      code,
      roleTitle,
      department,
      managerName: input.managerName?.trim() ?? "",
      description: input.description?.trim() ?? "",
      updatedAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

export async function updateRoleProfile(input: {
  id: number;
  roleTitle?: string;
  department?: string;
  managerName?: string;
  description?: string;
  duties?: string;
  requirements?: string;
  programs?: string[];
  tools?: string[];
  junior?: Partial<JuniorRequirements>;
  middle?: Partial<MiddleRequirements>;
  isActive?: boolean;
}) {
  await ready();
  const [current] = await db
    .select()
    .from(roleProfiles)
    .where(eq(roleProfiles.id, input.id))
    .limit(1);
  if (!current) throw new Error("Должность не найдена");

  const junior = {
    ...parseJunior(current.juniorReqJson),
    ...(input.junior ?? {}),
  };
  const middle = {
    ...parseMiddle(current.middleReqJson),
    ...(input.middle ?? {}),
  };

  const [row] = await db
    .update(roleProfiles)
    .set({
      roleTitle:
        input.roleTitle !== undefined
          ? staffRoleBase(input.roleTitle).trim() || input.roleTitle.trim()
          : current.roleTitle,
      department:
        input.department !== undefined
          ? input.department.trim()
          : current.department,
      managerName:
        input.managerName !== undefined
          ? input.managerName.trim()
          : current.managerName,
      description:
        input.description !== undefined
          ? input.description.trim()
          : current.description,
      duties: input.duties !== undefined ? input.duties.trim() : current.duties,
      requirements:
        input.requirements !== undefined
          ? input.requirements.trim()
          : current.requirements,
      programsJson:
        input.programs !== undefined
          ? JSON.stringify(input.programs.map((x) => x.trim()).filter(Boolean))
          : current.programsJson,
      toolsJson:
        input.tools !== undefined
          ? JSON.stringify(input.tools.map((x) => x.trim()).filter(Boolean))
          : current.toolsJson,
      juniorReqJson: JSON.stringify(junior),
      middleReqJson: JSON.stringify(middle),
      isActive: input.isActive ?? current.isActive,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(roleProfiles.id, input.id))
    .returning();
  return row;
}

export async function archiveRoleProfile(id: number, archive = true) {
  return updateRoleProfile({ id, isActive: !archive ? true : false });
}

export async function createSkillCompetency(input: {
  name: string;
  description?: string;
  category?: string;
  levelScope?: string;
  verificationMethod?: string;
  isRequired?: boolean;
  weight?: number;
  isCriticalError?: boolean;
}) {
  await ready();
  const name = input.name.trim();
  if (!name) throw new Error("Укажите название компетенции");
  const [row] = await db
    .insert(competencies)
    .values({
      name,
      description: input.description?.trim() ?? "",
      category: input.category?.trim() || "общая",
      kind: "skill",
      levelScope: input.levelScope || "all",
      verificationMethod: input.verificationMethod || "test",
      isRequired: input.isRequired ?? true,
      weight: input.weight ?? 1,
      isCriticalError: input.isCriticalError ?? false,
      isActive: true,
    })
    .returning();
  return row;
}

export async function updateSkillCompetency(input: {
  id: number;
  name?: string;
  description?: string;
  category?: string;
  levelScope?: string;
  verificationMethod?: string;
  isRequired?: boolean;
  weight?: number;
  isCriticalError?: boolean;
  isActive?: boolean;
}) {
  await ready();
  const [current] = await db
    .select()
    .from(competencies)
    .where(and(eq(competencies.id, input.id), eq(competencies.kind, "skill")))
    .limit(1);
  if (!current) throw new Error("Компетенция не найдена");

  const [row] = await db
    .update(competencies)
    .set({
      name: input.name?.trim() ?? current.name,
      description: input.description?.trim() ?? current.description,
      category: input.category?.trim() ?? current.category,
      levelScope: input.levelScope ?? current.levelScope,
      verificationMethod: input.verificationMethod ?? current.verificationMethod,
      isRequired: input.isRequired ?? current.isRequired,
      weight: input.weight ?? current.weight,
      isCriticalError: input.isCriticalError ?? current.isCriticalError,
      isActive: input.isActive ?? current.isActive,
    })
    .where(eq(competencies.id, input.id))
    .returning();
  return row;
}

export async function linkCompetencyToRole(input: {
  roleProfileId: number;
  competencyId: number;
  isRequired?: boolean;
  weight?: number;
  levelScope?: string;
}) {
  await ready();
  const [existing] = await db
    .select()
    .from(roleCompetencies)
    .where(
      and(
        eq(roleCompetencies.roleProfileId, input.roleProfileId),
        eq(roleCompetencies.competencyId, input.competencyId),
      ),
    )
    .limit(1);
  if (existing) {
    const [row] = await db
      .update(roleCompetencies)
      .set({
        isRequired: input.isRequired ?? existing.isRequired,
        weight: input.weight ?? existing.weight,
        levelScope: input.levelScope ?? existing.levelScope,
      })
      .where(eq(roleCompetencies.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(roleCompetencies)
    .values({
      roleProfileId: input.roleProfileId,
      competencyId: input.competencyId,
      isRequired: input.isRequired ?? true,
      weight: input.weight ?? 1,
      levelScope: input.levelScope || "all",
    })
    .returning();
  return row;
}

export async function unlinkCompetencyFromRole(linkId: number) {
  await ready();
  await db.delete(roleCompetencies).where(eq(roleCompetencies.id, linkId));
}

/** Copy lesson roleFamilies from source role title onto target role title. */
export async function copyLessonProgramBetweenRoles(
  sourceRoleTitle: string,
  targetRoleTitle: string,
) {
  await ready();
  const { listLearningLessonsAdmin, assignLessonToRole } = await import("./learning");
  const lessons = await listLearningLessonsAdmin();
  const source = staffRoleBase(sourceRoleTitle);
  const target = staffRoleBase(targetRoleTitle);
  if (!source || !target) throw new Error("Укажите должности для копирования");

  let copied = 0;
  for (const lesson of lessons) {
    if (!lessonAssignedToStaffRole(lesson.roleFamilies, source)) continue;
    if (lessonAssignedToStaffRole(lesson.roleFamilies, target)) continue;
    await assignLessonToRole(lesson.dbId, target);
    copied += 1;
  }
  return copied;
}

export async function listSkillCompetencies() {
  await ready();
  return db
    .select()
    .from(competencies)
    .where(and(eq(competencies.kind, "skill"), eq(competencies.isActive, true)))
    .orderBy(asc(competencies.category), asc(competencies.name));
}

export async function importRoleProfilesFromRows(
  rows: Array<Record<string, unknown>>,
) {
  await ready();
  let created = 0;
  let updated = 0;

  for (const raw of rows) {
    const get = (...keys: string[]) => {
      for (const key of keys) {
        const hit = Object.entries(raw).find(
          ([k]) => k.trim().toLowerCase() === key.toLowerCase(),
        );
        if (hit && hit[1] != null && String(hit[1]).trim()) {
          return String(hit[1]).trim();
        }
      }
      return "";
    };

    const roleTitle = get("должность", "role", "roleTitle", "название");
    const department = get("подразделение", "department", "отдел", "dept");
    if (!roleTitle || !department) continue;

    const code = get("код", "code") || makeRoleCode(department, roleTitle);
    const [existing] = await db
      .select()
      .from(roleProfiles)
      .where(eq(roleProfiles.code, code))
      .limit(1);

    const payload = {
      roleTitle: staffRoleBase(roleTitle) || roleTitle,
      department,
      managerName: get("руководитель", "manager", "managerName"),
      description: get("описание", "description"),
      duties: get("обязанности", "duties"),
      requirements: get("требования", "requirements"),
      programs: get("программы", "programs")
        .split(/[;|,]/)
        .map((x) => x.trim())
        .filter(Boolean),
      tools: get("инструменты", "tools")
        .split(/[;|,]/)
        .map((x) => x.trim())
        .filter(Boolean),
      junior: {
        basicKnowledge: get("junior базовые", "junior.basicKnowledge", "базовые знания"),
        standardTasks: get("junior задачи", "junior.standardTasks", "стандартные задачи"),
        byInstruction: get("junior инструкция", "junior.byInstruction"),
        requiredPrograms: get("junior программы", "junior.requiredPrograms"),
        minKpi: get("junior kpi", "junior.minKpi", "мин kpi"),
      },
      middle: {
        independentTasks: get("middle задачи", "middle.independentTasks"),
        complexSituations: get("middle сложные", "middle.complexSituations"),
        analysis: get("middle анализ", "middle.analysis"),
        errorPrevention: get("middle ошибки", "middle.errorPrevention"),
        responsibility: get("middle ответственность", "middle.responsibility"),
        processImprovement: get("middle процесс", "middle.processImprovement"),
        communication: get("middle коммуникация", "middle.communication"),
      },
      isActive: true,
    };

    if (existing) {
      await updateRoleProfile({ id: existing.id, ...payload });
      updated += 1;
    } else {
      const createdRow = await createRoleProfile({
        code,
        roleTitle: payload.roleTitle,
        department: payload.department,
        managerName: payload.managerName,
        description: payload.description,
      });
      await updateRoleProfile({ id: createdRow.id, ...payload });
      created += 1;
    }
  }

  return { created, updated };
}

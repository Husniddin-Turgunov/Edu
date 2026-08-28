import "server-only";
import { and, asc, desc, eq, inArray, isNull, like, ne, sql } from "drizzle-orm";
import { db } from "./index";
import {
  assessments,
  assignments,
  attestations,
  learningLessons,
  learningTests,
  lessonProgress,
  questions,
  results,
} from "./schema";
import type { Lesson, LessonLevel } from "@/lib/lessons";
import type {
  VerificationQuestion,
  VerificationTest,
} from "@/lib/verification-tests";
import { buildDefaultVerificationQuestions } from "@/lib/verification-tests";
import {
  lessonAssignedToStaffRole,
  isFiveDayInternProgramSlug,
  staffRoleBase,
} from "@/lib/role-match";
import { inferProgramMonth } from "@/lib/learning-program";
import {
  attestationWindowStatus,
  employeeMatchesAttestation,
  parsePositionTitles,
} from "@/lib/attestation";

async function ready() {
  const { ensureDb } = await import("./queries");
  await ensureDb();
}

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.map((x) => String(x)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function parseQuestions(raw: string): VerificationQuestion[] {
  try {
    const parsed = JSON.parse(raw) as VerificationQuestion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function rowToLesson(row: typeof learningLessons.$inferSelect): Lesson & {
  dbId: number;
  content: string;
  contentFormat: "text" | "html";
  driveFileId: string | null;
  goal: string;
  material: string;
  example: string;
  instruction: string;
  practice: string;
  criteria: string;
  programMonth: number;
  track: string;
  completed?: boolean;
  status?: string;
} {
  return {
    dbId: row.id,
    id: row.slug,
    title: row.title,
    summary: row.summary,
    content: row.content,
    contentFormat: row.contentFormat === "html" ? "html" : "text",
    driveFileId: row.driveFileId,
    goal: row.goal ?? "",
    material: row.material ?? "",
    example: row.example ?? "",
    instruction: row.instruction ?? "",
    practice: row.practice ?? "",
    criteria: row.criteria ?? "",
    programMonth: row.programMonth ?? 0,
    track: row.track ?? "basic",
    level: row.level as LessonLevel,
    roleFamilies: parseJsonArray(row.roleFamiliesJson),
    topics: parseJsonArray(row.topicsJson),
    durationMin: row.durationMin,
  };
}

export function rowToVerificationTest(
  row: typeof learningTests.$inferSelect,
  lessonSlug: string,
  lessonTitle: string,
): VerificationTest & {
  dbId: number;
  lessonDbId: number;
  assessmentId: number | null;
  lessonCompleted?: boolean;
  unlocked?: boolean;
} {
  return {
    dbId: row.id,
    lessonDbId: row.lessonId,
    assessmentId: row.assessmentId,
    id: row.slug,
    lessonId: lessonSlug,
    lessonTitle,
    title: row.title,
    summary: row.summary,
    level: row.level as LessonLevel,
    roleFamilies: parseJsonArray(row.roleFamiliesJson),
    topics: parseJsonArray(row.topicsJson),
    durationMin: row.durationMin,
    questions: parseQuestions(row.questionsJson),
  };
}

export async function listLearningLessonsAdmin(options?: { limit?: number }) {
  await ready();
  const query = db
    .select({
      id: learningLessons.id,
      slug: learningLessons.slug,
      title: learningLessons.title,
      contentFormat: learningLessons.contentFormat,
      level: learningLessons.level,
      roleFamiliesJson: learningLessons.roleFamiliesJson,
      topicsJson: learningLessons.topicsJson,
      durationMin: learningLessons.durationMin,
      isActive: learningLessons.isActive,
      sortOrder: learningLessons.sortOrder,
      driveFileId: learningLessons.driveFileId,
      driveModifiedAt: learningLessons.driveModifiedAt,
      testId: learningTests.id,
      testSlug: learningTests.slug,
      testActive: learningTests.isActive,
    })
    .from(learningLessons)
    .leftJoin(learningTests, eq(learningTests.lessonId, learningLessons.id))
    .orderBy(asc(learningLessons.sortOrder), asc(learningLessons.id));
  const limitedRows =
    options?.limit != null
      ? await query.limit(options.limit)
      : await query;

  return limitedRows.map((row) => {
    return {
      dbId: row.id,
      id: row.slug,
      title: row.title,
      summary: "",
      content: "",
      contentFormat: row.contentFormat === "html" ? ("html" as const) : ("text" as const),
      driveFileId: row.driveFileId,
      level: row.level as LessonLevel,
      roleFamilies: parseJsonArray(row.roleFamiliesJson),
      topics: parseJsonArray(row.topicsJson),
      durationMin: row.durationMin,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      driveModifiedAt: row.driveModifiedAt,
      hasTest: Boolean(row.testId),
      linkedTestSlug: row.testSlug,
      linkedTestActive: row.testActive ?? false,
    };
  });
}

export async function getLearningLessonStatsAdmin() {
  await ready();
  const [totals, lessonRows, missingTests] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`sum(case when ${learningLessons.isActive} = 1 then 1 else 0 end)`,
      })
      .from(learningLessons),
    db
      .select({
        roleFamiliesJson: learningLessons.roleFamiliesJson,
        slug: learningLessons.slug,
      })
      .from(learningLessons)
      .where(eq(learningLessons.isActive, true)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(learningLessons)
      .leftJoin(
        learningTests,
        eq(learningTests.lessonId, learningLessons.id),
      )
      .where(
        and(
          eq(learningLessons.isActive, true),
          isNull(learningTests.id),
        ),
      ),
  ]);

  const grouped = new Map<
    string,
    { roleFamilies: string[]; count: number; kind: "employees" | "interns" }
  >();
  for (const row of lessonRows) {
    const kind = isFiveDayInternProgramSlug(row.slug)
      ? "interns"
      : "employees";
    const key = `${kind}::${row.roleFamiliesJson}`;
    const current = grouped.get(key);
    if (current) {
      current.count += 1;
      continue;
    }
    grouped.set(key, {
      roleFamilies: parseJsonArray(row.roleFamiliesJson),
      count: 1,
      kind,
    });
  }

  return {
    total: Number(totals[0]?.total ?? 0),
    active: Number(totals[0]?.active ?? 0),
    withoutTest: Number(missingTests[0]?.count ?? 0),
    roleGroups: [...grouped.values()],
  };
}

export async function listInternProgramRolesAdmin() {
  await ready();
  const { getStaffingPositions } = await import("./queries");
  const [rows, positions] = await Promise.all([
    db
      .select({
        roleFamiliesJson: learningLessons.roleFamiliesJson,
        slug: learningLessons.slug,
      })
      .from(learningLessons)
      .where(eq(learningLessons.isActive, true)),
    getStaffingPositions(),
  ]);

  const deptByRole = new Map<string, string>();
  for (const position of positions) {
    const label = staffRoleBase(position.role).trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (!deptByRole.has(key)) {
      deptByRole.set(key, position.department || "Стажёры · 5 дней");
    }
  }

  const roles = new Map<string, { id: string; label: string; department: string }>();
  for (const row of rows) {
    if (!isFiveDayInternProgramSlug(row.slug)) continue;
    for (const role of parseJsonArray(row.roleFamiliesJson)) {
      const label = staffRoleBase(role).trim() || role.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (roles.has(key)) continue;
      roles.set(key, {
        id: label,
        label,
        department: deptByRole.get(key) ?? "Стажёры · 5 дней",
      });
    }
  }

  return [...roles.values()].sort((a, b) => {
    const byDept = a.department.localeCompare(b.department, "ru");
    if (byDept) return byDept;
    return a.label.localeCompare(b.label, "ru");
  });
}

export async function listLearningLessonsForRoleAdmin(
  roleTitle: string,
  audience: "employees" | "interns" = "employees",
) {
  await ready();
  const rows = await db
    .select({
      id: learningLessons.id,
      slug: learningLessons.slug,
      title: learningLessons.title,
      contentFormat: learningLessons.contentFormat,
      level: learningLessons.level,
      roleFamiliesJson: learningLessons.roleFamiliesJson,
      topicsJson: learningLessons.topicsJson,
      durationMin: learningLessons.durationMin,
      isActive: learningLessons.isActive,
      sortOrder: learningLessons.sortOrder,
      driveFileId: learningLessons.driveFileId,
      driveModifiedAt: learningLessons.driveModifiedAt,
      testId: learningTests.id,
      testSlug: learningTests.slug,
      testActive: learningTests.isActive,
    })
    .from(learningLessons)
    .leftJoin(learningTests, eq(learningTests.lessonId, learningLessons.id))
    .where(
      and(
        eq(learningLessons.isActive, true),
        like(learningLessons.roleFamiliesJson, `%"${roleTitle}"%`),
      ),
    )
    .orderBy(asc(learningLessons.sortOrder), asc(learningLessons.id));

  const matched = rows.filter((row) => {
    if (!lessonAssignedToStaffRole(parseJsonArray(row.roleFamiliesJson), roleTitle)) {
      return false;
    }
    const isIntern = isFiveDayInternProgramSlug(row.slug);
    return audience === "interns" ? isIntern : !isIntern;
  });
  return matched.map((row) => ({
    dbId: row.id,
    id: row.slug,
    title: row.title,
    summary: "",
    content: "",
    contentFormat:
      row.contentFormat === "html" ? ("html" as const) : ("text" as const),
    driveFileId: row.driveFileId,
    level: row.level as LessonLevel,
    roleFamilies: parseJsonArray(row.roleFamiliesJson),
    topics: parseJsonArray(row.topicsJson),
    durationMin: row.durationMin,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    driveModifiedAt: row.driveModifiedAt,
    hasTest: Boolean(row.testId),
    linkedTestSlug: row.testSlug,
    linkedTestActive: row.testActive ?? false,
  }));
}

export async function getLearningLessonContentAdmin(id: number) {
  await ready();
  const [row] = await db
    .select({
      summary: learningLessons.summary,
      content: learningLessons.content,
      contentFormat: learningLessons.contentFormat,
    })
    .from(learningLessons)
    .where(eq(learningLessons.id, id))
    .limit(1);
  if (!row) return null;
  return {
    summary: row.summary,
    content: row.content,
    contentFormat:
      row.contentFormat === "html" ? ("html" as const) : ("text" as const),
  };
}

export async function ensureLinkedTestForLesson(lesson: {
  id: number;
  slug: string;
  title: string;
  summary: string;
  level: string;
  roleFamiliesJson: string;
  topicsJson: string;
  durationMin: number;
}) {
  await ready();
  const [existing] = await db
    .select({ id: learningTests.id })
    .from(learningTests)
    .where(eq(learningTests.lessonId, lesson.id))
    .limit(1);
  if (existing) {
    await db
      .update(learningTests)
      .set({
        title: `Проверка: ${lesson.title}`,
        summary: `Проверьте, что усвоили материал урока «${lesson.title}». ${lesson.summary}`,
        level: lesson.level,
        roleFamiliesJson: lesson.roleFamiliesJson,
        topicsJson: lesson.topicsJson,
        durationMin: Math.max(8, Math.round(lesson.durationMin / 2)),
        isActive: true,
      })
      .where(eq(learningTests.id, existing.id));
    return { created: false, testId: existing.id };
  }

  let slug = `check-${lesson.slug}`;
  const [clash] = await db
    .select({ id: learningTests.id })
    .from(learningTests)
    .where(eq(learningTests.slug, slug))
    .limit(1);
  if (clash) slug = `check-${lesson.slug}-${lesson.id}`;

  const topics = parseJsonArray(lesson.topicsJson);
  const [row] = await db
    .insert(learningTests)
    .values({
      slug,
      lessonId: lesson.id,
      title: `Проверка: ${lesson.title}`,
      summary: `Проверьте, что усвоили материал урока «${lesson.title}». ${lesson.summary}`,
      level: lesson.level,
      roleFamiliesJson: lesson.roleFamiliesJson,
      topicsJson: lesson.topicsJson,
      durationMin: Math.max(8, Math.round(lesson.durationMin / 2)),
      questionsJson: JSON.stringify(
        buildDefaultVerificationQuestions({
          id: lesson.slug,
          title: lesson.title,
          topics,
          level: lesson.level,
        }),
      ),
      assessmentId: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return { created: true, testId: row.id };
}

/**
 * Bulk variant of {@link ensureLinkedTestForLesson} for Drive imports.
 * A per-lesson round trip is too slow for workbooks with hundreds of rows.
 */
export async function ensureLinkedTestsForLessons(
  lessons: (typeof learningLessons.$inferSelect)[],
) {
  if (!lessons.length) return { created: 0, updated: 0 };
  await ready();

  const existing = await db
    .select({
      id: learningTests.id,
      slug: learningTests.slug,
      lessonId: learningTests.lessonId,
      title: learningTests.title,
      isActive: learningTests.isActive,
    })
    .from(learningTests);
  const byLessonId = new Map(existing.map((row) => [row.lessonId, row]));
  const usedSlugs = new Set(existing.map((row) => row.slug));

  const pending: (typeof learningTests.$inferInsert)[] = [];
  let updated = 0;

  for (const lesson of lessons) {
    const title = `Проверка: ${lesson.title}`;
    const summary = `Проверьте, что усвоили материал урока «${lesson.title}». ${lesson.summary}`;
    const durationMin = Math.max(8, Math.round(lesson.durationMin / 2));
    const current = byLessonId.get(lesson.id);

    if (current) {
      if (current.title === title && current.isActive) continue;
      await db
        .update(learningTests)
        .set({
          title,
          summary,
          level: lesson.level,
          roleFamiliesJson: lesson.roleFamiliesJson,
          topicsJson: lesson.topicsJson,
          durationMin,
          isActive: true,
        })
        .where(eq(learningTests.id, current.id));
      updated += 1;
      continue;
    }

    let slug = `check-${lesson.slug}`;
    if (usedSlugs.has(slug)) slug = `check-${lesson.slug}-${lesson.id}`;
    usedSlugs.add(slug);

    pending.push({
      slug,
      lessonId: lesson.id,
      title,
      summary,
      level: lesson.level,
      roleFamiliesJson: lesson.roleFamiliesJson,
      topicsJson: lesson.topicsJson,
      durationMin,
      questionsJson: JSON.stringify(
        buildDefaultVerificationQuestions({
          id: lesson.slug,
          title: lesson.title,
          topics: parseJsonArray(lesson.topicsJson),
          level: lesson.level,
        }),
      ),
      assessmentId: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  }

  for (let i = 0; i < pending.length; i += 40) {
    await db.insert(learningTests).values(pending.slice(i, i + 40));
  }

  return { created: pending.length, updated };
}

/** Create missing verification tests for every active lesson. */
export async function ensureAllLessonTests() {
  await ready();
  const lessons = await db
    .select()
    .from(learningLessons)
    .where(eq(learningLessons.isActive, true));
  const existing = await db
    .select({ lessonId: learningTests.lessonId })
    .from(learningTests);
  const have = new Set(existing.map((row) => row.lessonId));
  const missing = lessons.filter((lesson) => !have.has(lesson.id));

  const { created } = await ensureLinkedTestsForLessons(missing);

  return {
    lessons: lessons.length,
    missingBefore: missing.length,
    created,
    stillMissing: Math.max(0, missing.length - created),
  };
}

export async function getLessonLinkedTest(lessonDbId: number) {
  await ready();
  const [row] = await db
    .select()
    .from(learningTests)
    .where(
      and(
        eq(learningTests.lessonId, lessonDbId),
        eq(learningTests.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function setLessonRoleFamilies(
  lessonId: number,
  roleFamilies: string[],
) {
  await ready();
  const unique = [...new Set(roleFamilies.map((x) => x.trim()).filter(Boolean))];
  const [row] = await db
    .update(learningLessons)
    .set({ roleFamiliesJson: JSON.stringify(unique) })
    .where(eq(learningLessons.id, lessonId))
    .returning();

  if (row) {
    await db
      .update(learningTests)
      .set({ roleFamiliesJson: JSON.stringify(unique) })
      .where(eq(learningTests.lessonId, lessonId));
  }
  return row;
}

export async function assignLessonToRole(lessonId: number, roleId: string) {
  await ready();
  const [row] = await db
    .select()
    .from(learningLessons)
    .where(eq(learningLessons.id, lessonId))
    .limit(1);
  if (!row) return null;
  const roles = parseJsonArray(row.roleFamiliesJson);
  if (!roles.includes(roleId)) roles.push(roleId);
  return setLessonRoleFamilies(lessonId, roles);
}

export async function unassignLessonFromRole(lessonId: number, roleId: string) {
  await ready();
  const [row] = await db
    .select()
    .from(learningLessons)
    .where(eq(learningLessons.id, lessonId))
    .limit(1);
  if (!row) return null;
  const roles = parseJsonArray(row.roleFamiliesJson).filter((r) => r !== roleId);
  return setLessonRoleFamilies(lessonId, roles);
}

export async function listLearningTestsAdmin() {
  await ready();
  const rows = await db
    .select({
      id: learningTests.id,
      slug: learningTests.slug,
      lessonId: learningTests.lessonId,
      title: learningTests.title,
      summary: learningTests.summary,
      level: learningTests.level,
      roleFamiliesJson: learningTests.roleFamiliesJson,
      topicsJson: learningTests.topicsJson,
      durationMin: learningTests.durationMin,
      questionsJson: learningTests.questionsJson,
      assessmentId: learningTests.assessmentId,
      isActive: learningTests.isActive,
      lessonSlug: learningLessons.slug,
      lessonTitle: learningLessons.title,
    })
    .from(learningTests)
    .innerJoin(learningLessons, eq(learningTests.lessonId, learningLessons.id))
    .orderBy(asc(learningTests.id));
  return rows.map((row) => ({
    dbId: row.id,
    lessonDbId: row.lessonId,
    assessmentId: row.assessmentId,
    id: row.slug,
    lessonId: row.lessonSlug,
    lessonTitle: row.lessonTitle,
    title: row.title,
    summary: row.summary,
    level: row.level as LessonLevel,
    roleFamilies: parseJsonArray(row.roleFamiliesJson),
    topics: parseJsonArray(row.topicsJson),
    durationMin: row.durationMin,
    questions: parseQuestions(row.questionsJson),
    isActive: row.isActive,
  }));
}

function compactTestRow(row: {
  id: number;
  slug: string;
  lessonId: number;
  title: string;
  level: string;
  roleFamiliesJson: string;
  assessmentId: number | null;
  isActive: boolean;
  lessonSlug: string;
  lessonTitle: string;
}) {
  return {
    dbId: row.id,
    lessonDbId: row.lessonId,
    assessmentId: row.assessmentId,
    id: row.slug,
    lessonId: row.lessonSlug,
    lessonTitle: row.lessonTitle,
    title: row.title,
    summary: "",
    level: row.level,
    roleFamilies: parseJsonArray(row.roleFamiliesJson),
    topics: [] as string[],
    durationMin: 0,
    isActive: row.isActive,
  };
}

export async function listLearningTestsAdminCompact(limit = 250) {
  await ready();
  const rows = await db
    .select({
      id: learningTests.id,
      slug: learningTests.slug,
      lessonId: learningTests.lessonId,
      title: learningTests.title,
      level: learningTests.level,
      roleFamiliesJson: learningTests.roleFamiliesJson,
      assessmentId: learningTests.assessmentId,
      isActive: learningTests.isActive,
      lessonSlug: learningLessons.slug,
      lessonTitle: learningLessons.title,
    })
    .from(learningTests)
    .innerJoin(learningLessons, eq(learningTests.lessonId, learningLessons.id))
    .orderBy(asc(learningTests.id))
    .limit(limit);
  return rows.map(compactTestRow);
}

export async function getLearningTestStatsAdmin() {
  await ready();
  const [totals, testRows, missingLessons] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`sum(case when ${learningTests.isActive} = 1 then 1 else 0 end)`,
      })
      .from(learningTests),
    db
      .select({
        roleFamiliesJson: learningTests.roleFamiliesJson,
        slug: learningTests.slug,
        lessonSlug: learningLessons.slug,
      })
      .from(learningTests)
      .innerJoin(learningLessons, eq(learningTests.lessonId, learningLessons.id))
      .where(eq(learningTests.isActive, true)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(learningLessons)
      .leftJoin(learningTests, eq(learningTests.lessonId, learningLessons.id))
      .where(
        and(
          eq(learningLessons.isActive, true),
          isNull(learningTests.id),
        ),
      ),
  ]);

  const grouped = new Map<
    string,
    { roleFamilies: string[]; count: number; kind: "employees" | "interns" }
  >();
  for (const row of testRows) {
    const kind = isFiveDayInternProgramSlug(row.lessonSlug || row.slug)
      ? "interns"
      : "employees";
    const key = `${kind}::${row.roleFamiliesJson}`;
    const current = grouped.get(key);
    if (current) {
      current.count += 1;
      continue;
    }
    grouped.set(key, {
      roleFamilies: parseJsonArray(row.roleFamiliesJson),
      count: 1,
      kind,
    });
  }

  return {
    total: Number(totals[0]?.total ?? 0),
    active: Number(totals[0]?.active ?? 0),
    missingLessons: Number(missingLessons[0]?.count ?? 0),
    roleGroups: [...grouped.values()],
  };
}

export async function listLearningTestsForRoleAdmin(
  roleTitle: string,
  audience: "employees" | "interns" = "employees",
) {
  await ready();
  const rows = await db
    .select({
      id: learningTests.id,
      slug: learningTests.slug,
      lessonId: learningTests.lessonId,
      title: learningTests.title,
      level: learningTests.level,
      roleFamiliesJson: learningTests.roleFamiliesJson,
      assessmentId: learningTests.assessmentId,
      isActive: learningTests.isActive,
      lessonSlug: learningLessons.slug,
      lessonTitle: learningLessons.title,
    })
    .from(learningTests)
    .innerJoin(learningLessons, eq(learningTests.lessonId, learningLessons.id))
    .where(
      and(
        eq(learningTests.isActive, true),
        like(learningTests.roleFamiliesJson, `%"${roleTitle}"%`),
      ),
    )
    .orderBy(asc(learningTests.id));
  return rows
    .filter((row) => {
      if (
        !lessonAssignedToStaffRole(
          parseJsonArray(row.roleFamiliesJson),
          roleTitle,
        )
      ) {
        return false;
      }
      const isIntern = isFiveDayInternProgramSlug(row.lessonSlug);
      return audience === "interns" ? isIntern : !isIntern;
    })
    .map(compactTestRow);
}

export async function createLearningLesson(input: {
  slug: string;
  title: string;
  summary: string;
  content: string;
  level: string;
  roleFamilies: string[];
  topics: string[];
  durationMin: number;
  createLinkedTest?: boolean;
}) {
  await ready();
  const slug = input.slug.trim().toLowerCase().replace(/\s+/g, "-");
  const [row] = await db
    .insert(learningLessons)
    .values({
      slug,
      title: input.title.trim(),
      summary: input.summary.trim(),
      content: input.content.trim(),
      contentFormat: "text",
      level: input.level,
      roleFamiliesJson: JSON.stringify(input.roleFamilies),
      topicsJson: JSON.stringify(input.topics),
      durationMin: input.durationMin,
      isActive: true,
      sortOrder: 999,
      createdAt: new Date().toISOString(),
    })
    .returning();

  if (input.createLinkedTest !== false) {
    const lessonShape = {
      id: slug,
      title: row.title,
      topics: input.topics,
      level: input.level,
    };
    await db.insert(learningTests).values({
      slug: `check-${slug}`,
      lessonId: row.id,
      title: `Проверка: ${row.title}`,
      summary: `Проверьте, что усвоили материал урока «${row.title}». ${row.summary}`,
      level: input.level,
      roleFamiliesJson: JSON.stringify(input.roleFamilies),
      topicsJson: JSON.stringify(input.topics),
      durationMin: Math.max(8, Math.round(input.durationMin / 2)),
      questionsJson: JSON.stringify(
        buildDefaultVerificationQuestions(lessonShape),
      ),
      assessmentId: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  }

  return row;
}

export async function updateLearningLesson(input: {
  id: number;
  title: string;
  summary: string;
  content: string;
  level: string;
  roleFamilies: string[];
  topics: string[];
  durationMin: number;
  isActive: boolean;
}) {
  await ready();
  const [row] = await db
    .update(learningLessons)
    .set({
      title: input.title.trim(),
      summary: input.summary.trim(),
      content: input.content.trim(),
      level: input.level,
      roleFamiliesJson: JSON.stringify(input.roleFamilies),
      topicsJson: JSON.stringify(input.topics),
      durationMin: input.durationMin,
      isActive: input.isActive,
    })
    .where(eq(learningLessons.id, input.id))
    .returning();
  return row;
}

export async function deleteLearningLesson(id: number) {
  await ready();
  await db.delete(lessonProgress).where(eq(lessonProgress.lessonId, id));
  await db.delete(learningTests).where(eq(learningTests.lessonId, id));
  await db.delete(learningLessons).where(eq(learningLessons.id, id));
}

export async function createLearningTest(input: {
  slug: string;
  lessonId: number;
  title: string;
  summary: string;
  level: string;
  roleFamilies: string[];
  topics: string[];
  durationMin: number;
  questions: VerificationQuestion[];
  assessmentId: number | null;
}) {
  await ready();
  const slug = input.slug.trim().toLowerCase().replace(/\s+/g, "-");
  const [row] = await db
    .insert(learningTests)
    .values({
      slug,
      lessonId: input.lessonId,
      title: input.title.trim(),
      summary: input.summary.trim(),
      level: input.level,
      roleFamiliesJson: JSON.stringify(input.roleFamilies),
      topicsJson: JSON.stringify(input.topics),
      durationMin: input.durationMin,
      questionsJson: JSON.stringify(input.questions),
      assessmentId: input.assessmentId,
      isActive: true,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

export async function updateLearningTest(input: {
  id: number;
  lessonId: number;
  title: string;
  summary: string;
  level: string;
  roleFamilies: string[];
  topics: string[];
  durationMin: number;
  questions: VerificationQuestion[];
  assessmentId: number | null;
  isActive: boolean;
}) {
  await ready();
  const [row] = await db
    .update(learningTests)
    .set({
      lessonId: input.lessonId,
      title: input.title.trim(),
      summary: input.summary.trim(),
      level: input.level,
      roleFamiliesJson: JSON.stringify(input.roleFamilies),
      topicsJson: JSON.stringify(input.topics),
      durationMin: input.durationMin,
      questionsJson: JSON.stringify(input.questions),
      assessmentId: input.assessmentId,
      isActive: input.isActive,
    })
    .where(eq(learningTests.id, input.id))
    .returning();
  return row;
}

/** Materialize embedded verification questions into an editable assessment. */
export async function ensureLearningTestAssessment(testId: number) {
  await ready();
  const [row] = await db
    .select()
    .from(learningTests)
    .where(eq(learningTests.id, testId))
    .limit(1);
  if (!row) throw new Error("Тест не найден");

  if (row.assessmentId) {
    const [existing] = await db
      .select({ id: assessments.id })
      .from(assessments)
      .where(eq(assessments.id, row.assessmentId))
      .limit(1);
    if (existing) return existing.id;
  }

  const { getCompetencyOptions, createAssessment, addQuestion } = await import(
    "./queries"
  );
  const comps = await getCompetencyOptions();
  const competencyId =
    comps.find((c) => /сотрудник/i.test(c.name))?.id ?? comps[0]?.id;
  if (!competencyId) {
    throw new Error("Нет компетенций для теста обучения");
  }

  const assessment = await createAssessment({
    title: row.title,
    description: row.summary || "Проверка по уроку",
    competencyId,
    durationMinutes: Math.max(5, row.durationMin || 10),
    source: "learning",
  });

  for (const question of parseQuestions(row.questionsJson)) {
    await addQuestion({
      assessmentId: assessment.id,
      prompt: question.prompt,
      type: "single",
      options: question.options,
      correctIndexes: [question.correctIndex],
      keywords: [],
      difficulty: row.level,
      knowledgeKind: "knowledge",
      section: "Проверка",
    });
  }

  await db
    .update(learningTests)
    .set({ assessmentId: assessment.id })
    .where(eq(learningTests.id, testId));

  return assessment.id;
}

export async function deleteLearningTest(id: number) {
  await ready();
  await db.delete(learningTests).where(eq(learningTests.id, id));
}

export type CatalogScope = {
  /** Keep only items assigned to this staff role. */
  roleTitle?: string;
  /** Keep only these ids (intern program restrictions). */
  ids?: Iterable<number>;
};

type CatalogKeyRow = { id: number; roleFamiliesJson: string };

const CATALOG_KEY_TTL_MS = 60_000;
const catalogKeyCache = new Map<
  "lessons" | "tests",
  { loadedAt: number; rows: CatalogKeyRow[] }
>();

async function loadCatalogKeys(kind: "lessons" | "tests") {
  const cached = catalogKeyCache.get(kind);
  const now = Date.now();
  if (cached && now - cached.loadedAt < CATALOG_KEY_TTL_MS) return cached.rows;
  const rows =
    kind === "lessons"
      ? await db
          .select({
            id: learningLessons.id,
            roleFamiliesJson: learningLessons.roleFamiliesJson,
          })
          .from(learningLessons)
          .where(eq(learningLessons.isActive, true))
      : await db
          .select({
            id: learningTests.id,
            roleFamiliesJson: learningTests.roleFamiliesJson,
          })
          .from(learningTests)
          .where(eq(learningTests.isActive, true));
  catalogKeyCache.set(kind, { loadedAt: now, rows });
  return rows;
}

/**
 * Resolves the visible ids before loading text-heavy columns: the full catalog
 * holds thousands of rows, while a single participant sees a few dozen.
 */
function scopeCatalogIds(
  rows: { id: number; roleFamiliesJson: string }[],
  scope: CatalogScope,
) {
  const allowed = scope.ids ? new Set(scope.ids) : null;
  return rows
    .filter((row) => {
      if (allowed) return allowed.has(row.id);
      if (!scope.roleTitle) return true;
      return lessonAssignedToStaffRole(
        parseJsonArray(row.roleFamiliesJson),
        scope.roleTitle,
      );
    })
    .map((row) => row.id);
}

export async function getActiveLessonsForCatalog(scope: CatalogScope = {}) {
  await ready();
  const scoped = Boolean(scope.ids || scope.roleTitle);
  let idFilter: number[] | null = null;
  if (scoped) {
    idFilter = scopeCatalogIds(await loadCatalogKeys("lessons"), scope);
    if (idFilter.length === 0) return [];
  }

  const rows = await db
    .select({
      id: learningLessons.id,
      slug: learningLessons.slug,
      title: learningLessons.title,
      summary: learningLessons.summary,
      level: learningLessons.level,
      roleFamiliesJson: learningLessons.roleFamiliesJson,
      topicsJson: learningLessons.topicsJson,
      durationMin: learningLessons.durationMin,
    })
    .from(learningLessons)
    .where(
      idFilter
        ? and(
            eq(learningLessons.isActive, true),
            inArray(learningLessons.id, idFilter),
          )
        : eq(learningLessons.isActive, true),
    )
    .orderBy(asc(learningLessons.sortOrder), asc(learningLessons.id));
  return rows.map((row) => ({
    dbId: row.id,
    id: row.slug,
    title: row.title,
    summary: row.summary,
    content: "",
    contentFormat: "text" as const,
    driveFileId: null,
    level: row.level as LessonLevel,
    roleFamilies: parseJsonArray(row.roleFamiliesJson),
    topics: parseJsonArray(row.topicsJson),
    durationMin: row.durationMin,
  }));
}

export async function getActiveTestsForCatalog(scope: CatalogScope = {}) {
  await ready();
  const scoped = Boolean(scope.ids || scope.roleTitle);
  let idFilter: number[] | null = null;
  if (scoped) {
    idFilter = scopeCatalogIds(await loadCatalogKeys("tests"), scope);
    if (idFilter.length === 0) return [];
  }

  const rows = await db
    .select({
      id: learningTests.id,
      slug: learningTests.slug,
      lessonId: learningTests.lessonId,
      title: learningTests.title,
      summary: learningTests.summary,
      level: learningTests.level,
      roleFamiliesJson: learningTests.roleFamiliesJson,
      topicsJson: learningTests.topicsJson,
      durationMin: learningTests.durationMin,
      assessmentId: learningTests.assessmentId,
      lessonSlug: learningLessons.slug,
      lessonTitle: learningLessons.title,
      lessonProgramMonth: learningLessons.programMonth,
    })
    .from(learningTests)
    .innerJoin(learningLessons, eq(learningTests.lessonId, learningLessons.id))
    .where(
      idFilter
        ? and(
            eq(learningTests.isActive, true),
            inArray(learningTests.id, idFilter),
          )
        : eq(learningTests.isActive, true),
    )
    .orderBy(asc(learningTests.id));
  return rows.map((row) => ({
    dbId: row.id,
    lessonDbId: row.lessonId,
    assessmentId: row.assessmentId,
    id: row.slug,
    lessonId: row.lessonSlug,
    lessonTitle: row.lessonTitle,
    programMonth: inferProgramMonth({
      programMonth: row.lessonProgramMonth,
      slug: row.lessonSlug,
    }),
    title: row.title,
    summary: row.summary,
    level: row.level as LessonLevel,
    roleFamilies: parseJsonArray(row.roleFamiliesJson),
    topics: parseJsonArray(row.topicsJson),
    durationMin: row.durationMin,
    // Questions are only needed on the take page, never in the catalog list.
    questions: [] as VerificationQuestion[],
  }));
}

export async function getLessonBySlug(slug: string) {
  await ready();
  const asId = Number(slug);
  if (Number.isFinite(asId) && asId > 0 && String(asId) === slug) {
    const [byId] = await db
      .select()
      .from(learningLessons)
      .where(eq(learningLessons.id, asId))
      .limit(1);
    if (byId) return rowToLesson(byId);
  }
  const [row] = await db
    .select()
    .from(learningLessons)
    .where(eq(learningLessons.slug, slug))
    .limit(1);
  return row ? rowToLesson(row) : null;
}

export async function getLearningTestBySlug(slug: string) {
  await ready();
  const asId = Number(slug);
  const idFilter =
    Number.isFinite(asId) && asId > 0 && String(asId) === slug
      ? eq(learningTests.id, asId)
      : eq(learningTests.slug, slug);
  const [row] = await db
    .select({
      test: learningTests,
      lessonSlug: learningLessons.slug,
      lessonTitle: learningLessons.title,
    })
    .from(learningTests)
    .innerJoin(learningLessons, eq(learningTests.lessonId, learningLessons.id))
    .where(idFilter)
    .limit(1);
  if (!row) return null;
  return rowToVerificationTest(row.test, row.lessonSlug, row.lessonTitle);
}

export async function markLessonLearned(employeeId: number, lessonDbId: number) {
  await ready();
  const { upsertLessonWorkflow } = await import("./learning-programs");
  return upsertLessonWorkflow({
    employeeId,
    lessonId: lessonDbId,
    status: "studying",
  }).then(async () =>
    upsertLessonWorkflow({
      employeeId,
      lessonId: lessonDbId,
      status: "credited",
    }),
  );
}

export async function getCompletedLessonIds(employeeId: number) {
  await ready();
  const rows = await db
    .select({
      lessonId: lessonProgress.lessonId,
      status: lessonProgress.status,
    })
    .from(lessonProgress)
    .where(eq(lessonProgress.employeeId, employeeId));
  return new Set(
    rows
      .filter(
        (r) => r.status === "credited" || r.status === "accepted",
      )
      .map((r) => r.lessonId),
  );
}

function mapAttestation(
  row: typeof attestations.$inferSelect,
  questionCount = 0,
  linkedTest: { source: string; title: string } | null = null,
) {
  const startsAt = row.startsAt || row.scheduledAt;
  const endsAt = row.endsAt || startsAt;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    department: row.department,
    positionTitles: parsePositionTitles(row.positionTitlesJson),
    scheduledAt: startsAt,
    startsAt,
    endsAt,
    durationMinutes: row.durationMinutes,
    passingScore: row.passingScore,
    assessmentId: row.assessmentId,
    usesLibraryTest: linkedTest ? linkedTest.source !== "attestation" : false,
    libraryTestTitle:
      linkedTest && linkedTest.source !== "attestation" ? linkedTest.title : null,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
    questionCount,
    windowStatus: attestationWindowStatus(startsAt, endsAt),
  };
}

async function questionCountsByAssessment(ids: number[]) {
  const counts = new Map<number, number>();
  if (ids.length === 0) return counts;
  const rows = await db
    .select({
      assessmentId: questions.assessmentId,
      id: questions.id,
    })
    .from(questions);
  for (const row of rows) {
    if (!ids.includes(row.assessmentId)) continue;
    counts.set(row.assessmentId, (counts.get(row.assessmentId) ?? 0) + 1);
  }
  return counts;
}

async function createHiddenAttestationAssessment(input: {
  title: string;
  description: string;
  durationMinutes: number;
}) {
  const { getCompetencyOptions, createAssessment } = await import("./queries");
  const comps = await getCompetencyOptions();
  const competencyId =
    comps.find((c) => /сотрудник/i.test(c.name))?.id ?? comps[0]?.id;
  if (!competencyId) {
    throw new Error("Нет компетенций для теста аттестации");
  }
  return createAssessment({
    title: input.title,
    description: input.description,
    competencyId,
    durationMinutes: input.durationMinutes,
    source: "attestation",
  });
}

async function linkedTestsByAssessment(ids: number[]) {
  const map = new Map<number, { source: string; title: string }>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({
      id: assessments.id,
      title: assessments.title,
      source: assessments.source,
    })
    .from(assessments);
  for (const row of rows) {
    if (!ids.includes(row.id)) continue;
    map.set(row.id, { source: row.source, title: row.title });
  }
  return map;
}

async function findLibraryAssessment(id: number) {
  const [row] = await db
    .select()
    .from(assessments)
    .where(and(eq(assessments.id, id), ne(assessments.source, "attestation")))
    .limit(1);
  if (!row) throw new Error("Тест из библиотеки не найден");
  return row;
}

export async function listAttestationsAdmin() {
  await ready();
  const rows = await db
    .select()
    .from(attestations)
    .orderBy(desc(attestations.id));
  const linkedIds = rows
    .map((row) => row.assessmentId)
    .filter((id): id is number => Boolean(id));
  const counts = await questionCountsByAssessment(linkedIds);
  const linked = await linkedTestsByAssessment(linkedIds);
  return rows.map((row) =>
    mapAttestation(
      row,
      row.assessmentId ? (counts.get(row.assessmentId) ?? 0) : 0,
      row.assessmentId ? (linked.get(row.assessmentId) ?? null) : null,
    ),
  );
}

export async function getAttestationById(id: number) {
  await ready();
  const [row] = await db
    .select()
    .from(attestations)
    .where(eq(attestations.id, id))
    .limit(1);
  if (!row) return null;
  if (!row.assessmentId) {
    const created = await createHiddenAttestationAssessment({
      title: row.title,
      description: row.description || row.title,
      durationMinutes: row.durationMinutes || 40,
    });
    const [updated] = await db
      .update(attestations)
      .set({
        assessmentId: created.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(attestations.id, row.id))
      .returning();
    return mapAttestation(updated ?? row, 0, {
      source: "attestation",
      title: created.title,
    });
  }
  const count = await getAssessmentQuestionCount(row.assessmentId);
  const linked = await linkedTestsByAssessment([row.assessmentId]);
  return mapAttestation(row, count, linked.get(row.assessmentId) ?? null);
}

export async function createAttestation(input: {
  title: string;
  description: string;
  department: string;
  positionTitles: string[];
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  passingScore: number;
  isActive: boolean;
  libraryAssessmentId?: number | null;
}) {
  await ready();
  const title = input.title.trim() || "Аттестация";
  const description = input.description.trim();
  const durationMinutes = Math.max(5, Math.round(input.durationMinutes) || 40);
  const library = input.libraryAssessmentId
    ? await findLibraryAssessment(input.libraryAssessmentId)
    : null;
  const assessment =
    library ??
    (await createHiddenAttestationAssessment({
      title,
      description: description || title,
      durationMinutes,
    }));
  const [row] = await db
    .insert(attestations)
    .values({
      title,
      description,
      department: input.department.trim(),
      positionTitlesJson: JSON.stringify(
        [...new Set(input.positionTitles.map((x) => x.trim()).filter(Boolean))],
      ),
      scheduledAt: input.startsAt,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      durationMinutes,
      passingScore: Math.min(100, Math.max(1, Math.round(input.passingScore) || 70)),
      assessmentId: assessment.id,
      isActive: input.isActive,
      updatedAt: new Date().toISOString(),
    })
    .returning();
  return mapAttestation(
    row,
    library ? await getAssessmentQuestionCount(library.id) : 0,
    { source: library ? "library" : "attestation", title: assessment.title },
  );
}

export async function updateAttestation(input: {
  id: number;
  title: string;
  description: string;
  department: string;
  positionTitles: string[];
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  passingScore: number;
  isActive: boolean;
  libraryAssessmentId?: number | null;
}) {
  await ready();
  const current = await getAttestationById(input.id);
  if (!current) throw new Error("Аттестация не найдена");
  const title = input.title.trim() || "Аттестация";
  const description = input.description.trim();
  const durationMinutes = Math.max(5, Math.round(input.durationMinutes) || 40);
  const passingScore = Math.min(
    100,
    Math.max(1, Math.round(input.passingScore) || 70),
  );

  const library = input.libraryAssessmentId
    ? await findLibraryAssessment(input.libraryAssessmentId)
    : null;

  let assessmentId = current.assessmentId;
  if (library) {
    assessmentId = library.id;
  } else if (!assessmentId || current.usesLibraryTest) {
    const created = await createHiddenAttestationAssessment({
      title,
      description: description || title,
      durationMinutes,
    });
    assessmentId = created.id;
  } else {
    await db
      .update(assessments)
      .set({
        title,
        description: description || title,
        durationMinutes,
        source: "attestation",
        isActive: input.isActive,
      })
      .where(eq(assessments.id, assessmentId));
  }

  const [row] = await db
    .update(attestations)
    .set({
      title,
      description,
      department: input.department.trim(),
      positionTitlesJson: JSON.stringify(
        [...new Set(input.positionTitles.map((x) => x.trim()).filter(Boolean))],
      ),
      scheduledAt: input.startsAt,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      durationMinutes,
      passingScore,
      assessmentId,
      isActive: input.isActive,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(attestations.id, input.id))
    .returning();
  const linked = assessmentId
    ? await linkedTestsByAssessment([assessmentId])
    : new Map<number, { source: string; title: string }>();
  return mapAttestation(
    row,
    assessmentId ? await getAssessmentQuestionCount(assessmentId) : 0,
    assessmentId ? (linked.get(assessmentId) ?? null) : null,
  );
}

export async function listAttestationsForEmployee(input: {
  department: string;
  roleTitle: string;
  employeeId: number;
}) {
  await ready();
  const rows = await listAttestationsAdmin();
  const eligible = rows.filter(
    (row) =>
      row.isActive &&
      employeeMatchesAttestation({
        department: input.department,
        roleTitle: input.roleTitle,
        attestationDepartment: row.department,
        positionTitles: row.positionTitles,
      }),
  );

  const resultsByAssessment = new Map<
    number,
    { score: number; completedAt: string }
  >();
  if (eligible.length > 0) {
    const done = await db
      .select({
        assessmentId: results.assessmentId,
        score: results.score,
        completedAt: results.completedAt,
      })
      .from(results)
      .where(eq(results.employeeId, input.employeeId))
      .orderBy(desc(results.completedAt));
    for (const row of done) {
      if (!resultsByAssessment.has(row.assessmentId)) {
        resultsByAssessment.set(row.assessmentId, {
          score: row.score,
          completedAt: row.completedAt,
        });
      }
    }
  }

  return eligible.map((row) => {
    const result = row.assessmentId
      ? resultsByAssessment.get(row.assessmentId) ?? null
      : null;
    const passed =
      result != null ? result.score >= row.passingScore : null;
    return {
      ...row,
      result,
      passed,
      canStart:
        row.windowStatus === "open" &&
        Boolean(row.assessmentId) &&
        row.questionCount > 0 &&
        !result,
    };
  });
}

export async function ensureAttestationAssignment(input: {
  employeeId: number;
  assessmentId: number;
  dueAt?: string | null;
}) {
  await ready();
  const [existing] = await db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.employeeId, input.employeeId),
        eq(assignments.assessmentId, input.assessmentId),
      ),
    )
    .limit(1);
  if (existing) {
    if (input.dueAt && existing.status === "pending") {
      await db
        .update(assignments)
        .set({ dueAt: input.dueAt })
        .where(eq(assignments.id, existing.id));
    }
    return existing;
  }
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

export async function listAssessmentsForSelect() {
  await ready();
  return db
    .select({
      id: assessments.id,
      title: assessments.title,
    })
    .from(assessments)
    .where(
      and(
        eq(assessments.isActive, true),
        ne(assessments.source, "attestation"),
        ne(assessments.source, "learning"),
      ),
    )
    .orderBy(desc(assessments.id));
}

export async function getAssessmentQuestionCount(assessmentId: number) {
  await ready();
  const rows = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.assessmentId, assessmentId));
  return rows.length;
}

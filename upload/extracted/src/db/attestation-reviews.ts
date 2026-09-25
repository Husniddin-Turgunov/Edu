import "server-only";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db } from "./index";
import {
  assessments,
  attestationReviews,
  attestations,
  competencies,
  employeeCompetencies,
  employees,
  platformUsers,
  results,
} from "./schema";
import {
  attestationFinalScore,
  isAttestationDecision,
  isAttestationType,
  type AttestationDecision,
  type AttestationType,
} from "@/lib/attestation";

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

export async function listAttestationEmployees() {
  await ready();
  const rows = await db
    .select({
      id: employees.id,
      name: employees.name,
      roleTitle: employees.roleTitle,
      department: employees.department,
      currentLevel: employees.currentLevel,
      targetLevel: employees.targetLevel,
    })
    .from(employees)
    .where(ne(employees.status, "left"))
    .orderBy(asc(employees.name));
  return rows.filter((row) => !/стаж|intern/i.test(row.roleTitle));
}

export async function listAttestationReviewers() {
  await ready();
  return db
    .select({
      id: platformUsers.id,
      displayName: platformUsers.displayName,
      role: platformUsers.role,
      department: platformUsers.profileDepartment,
    })
    .from(platformUsers)
    .orderBy(asc(platformUsers.displayName));
}

export async function listEmployeeAttestationReviews(employeeId: number) {
  await ready();
  return db
    .select({
      id: attestationReviews.id,
      type: attestationReviews.type,
      status: attestationReviews.status,
      scheduledAt: attestationReviews.scheduledAt,
      finalScore: attestationReviews.finalScore,
      testScore: attestationReviews.testScore,
      decision: attestationReviews.decision,
      protocolNumber: attestationReviews.protocolNumber,
      completedAt: attestationReviews.completedAt,
      mentorComment: attestationReviews.mentorComment,
      managerComment: attestationReviews.managerComment,
      commissionComment: attestationReviews.commissionComment,
      weakCompetenciesJson: attestationReviews.weakCompetenciesJson,
      nextCheckAt: attestationReviews.nextCheckAt,
      attestationTitle: attestations.title,
    })
    .from(attestationReviews)
    .innerJoin(attestations, eq(attestationReviews.attestationId, attestations.id))
    .where(eq(attestationReviews.employeeId, employeeId))
    .orderBy(desc(attestationReviews.scheduledAt), desc(attestationReviews.id));
}

async function writebackWeakCompetencies(
  employeeId: number,
  weakNames: string[],
) {
  if (weakNames.length === 0) return;
  const catalog = await db.select().from(competencies);
  const { upsertEmployeeCompetency } = await import("./queries");
  const nowNote = "Отмечено на аттестации";
  for (const raw of weakNames) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const match =
      catalog.find((item) => item.name.toLowerCase() === key) ??
      catalog.find(
        (item) =>
          item.name.toLowerCase().includes(key) ||
          key.includes(item.name.toLowerCase()),
      );
    if (!match) continue;
    await upsertEmployeeCompetency({
      employeeId,
      competencyId: match.id,
      status: "needs_recheck",
      note: nowNote,
    });
  }
}

async function syncPromotionWithAttestationDecision(input: {
  employeeId: number;
  attestationId: number;
  resultId?: number | null;
  decision: AttestationDecision;
  score: number | null;
}) {
  const { syncPromotionWithAttestationDecision: sync } = await import(
    "./promotions"
  );
  await sync(input);
}

export async function createAttestationReview(input: {
  attestationId: number;
  employeeId: number;
  type: string;
  scheduledAt?: string | null;
  commission?: string[];
}) {
  await ready();
  if (!isAttestationType(input.type)) {
    throw new Error("Некорректный вид аттестации");
  }
  const [attestation, employee] = await Promise.all([
    db
      .select()
      .from(attestations)
      .where(eq(attestations.id, input.attestationId))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select()
      .from(employees)
      .where(eq(employees.id, input.employeeId))
      .limit(1)
      .then((rows) => rows[0]),
  ]);
  if (!attestation || !employee) throw new Error("Данные аттестации не найдены");

  const existing = await db
    .select({ id: attestationReviews.id, status: attestationReviews.status })
    .from(attestationReviews)
    .where(
      and(
        eq(attestationReviews.attestationId, input.attestationId),
        eq(attestationReviews.employeeId, input.employeeId),
      ),
    )
    .orderBy(desc(attestationReviews.id))
    .limit(1)
    .then((rows) => rows[0]);
  if (existing && existing.status !== "completed") return existing;

  const now = new Date().toISOString();
  const scheduledAt =
    input.scheduledAt || attestation.startsAt || attestation.scheduledAt || now;
  const [row] = await db
    .insert(attestationReviews)
    .values({
      attestationId: input.attestationId,
      employeeId: input.employeeId,
      type: input.type,
      scheduledAt,
      commissionJson: JSON.stringify(input.commission ?? []),
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: attestationReviews.id });
  return row;
}

export async function listAttestationReviews(attestationId: number) {
  await ready();
  return db
    .select({
      id: attestationReviews.id,
      type: attestationReviews.type,
      status: attestationReviews.status,
      scheduledAt: attestationReviews.scheduledAt,
      finalScore: attestationReviews.finalScore,
      decision: attestationReviews.decision,
      protocolNumber: attestationReviews.protocolNumber,
      employeeId: employees.id,
      employeeName: employees.name,
      roleTitle: employees.roleTitle,
      department: employees.department,
      currentLevel: employees.currentLevel,
      targetLevel: employees.targetLevel,
    })
    .from(attestationReviews)
    .innerJoin(employees, eq(attestationReviews.employeeId, employees.id))
    .where(eq(attestationReviews.attestationId, attestationId))
    .orderBy(desc(attestationReviews.scheduledAt), desc(attestationReviews.id));
}

export async function getAttestationReview(id: number) {
  await ready();
  const row = await db
    .select({
      review: attestationReviews,
      attestation: attestations,
      employee: employees,
      assessmentTitle: assessments.title,
    })
    .from(attestationReviews)
    .innerJoin(attestations, eq(attestationReviews.attestationId, attestations.id))
    .innerJoin(employees, eq(attestationReviews.employeeId, employees.id))
    .leftJoin(assessments, eq(attestations.assessmentId, assessments.id))
    .where(eq(attestationReviews.id, id))
    .limit(1)
    .then((rows) => rows[0]);
  if (!row) return null;

  const [latestResult, weakRows] = await Promise.all([
    row.attestation.assessmentId
      ? db
          .select({
            id: results.id,
            score: results.score,
            levelCode: results.levelCode,
            profileJson: results.profileJson,
            completedAt: results.completedAt,
          })
          .from(results)
          .where(
            and(
              eq(results.employeeId, row.employee.id),
              eq(results.assessmentId, row.attestation.assessmentId),
            ),
          )
          .orderBy(desc(results.completedAt))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    db
      .select({
        status: employeeCompetencies.status,
      })
      .from(employeeCompetencies)
      .where(eq(employeeCompetencies.employeeId, row.employee.id)),
  ]);

  return {
    ...row,
    review: {
      ...row.review,
      commission: parseList(row.review.commissionJson),
      signatures: parseList(row.review.signaturesJson),
      weakCompetencies: parseList(row.review.weakCompetenciesJson),
      testScore: row.review.testScore ?? latestResult?.score ?? null,
    },
    latestResult,
    matrixSummary: {
      checked: weakRows.length,
      weak: weakRows.filter((item) =>
        ["not_checked", "does_not_know", "partial", "recheck"].includes(
          item.status,
        ),
      ).length,
    },
  };
}

type ReviewScoreKey =
  | "practicalScore"
  | "projectScore"
  | "defenseScore"
  | "independenceScore"
  | "disciplineScore"
  | "mentorScore"
  | "managerScore";

export async function saveAttestationReview(input: {
  id: number;
  type: string;
  status: string;
  scheduledAt: string;
  commission: string[];
  signatures: string[];
  weakCompetencies: string[];
  scores: Record<ReviewScoreKey, number | null>;
  mentorComment: string;
  managerComment: string;
  commissionComment: string;
  decision: string;
  nextCheckAt?: string | null;
}) {
  await ready();
  if (!isAttestationType(input.type)) {
    throw new Error("Некорректный вид аттестации");
  }
  if (
    !["scheduled", "in_progress", "awaiting_commission", "completed"].includes(
      input.status,
    )
  ) {
    throw new Error("Некорректный статус аттестации");
  }
  if (input.status === "completed" && !isAttestationDecision(input.decision)) {
    throw new Error("Для завершения выберите решение комиссии");
  }

  const current = await getAttestationReview(input.id);
  if (!current) throw new Error("Карточка аттестации не найдена");
  const testScore = current.review.testScore;
  const finalScore = attestationFinalScore([
    testScore,
    ...Object.values(input.scores),
  ]);
  const now = new Date().toISOString();
  const completed = input.status === "completed";
  const protocolNumber =
    current.review.protocolNumber ||
    (completed
      ? `AKELA-AT-${new Date().getFullYear()}-${String(input.id).padStart(5, "0")}`
      : null);

  await db
    .update(attestationReviews)
    .set({
      type: input.type,
      status: input.status,
      scheduledAt: input.scheduledAt,
      commissionJson: JSON.stringify(input.commission),
      signaturesJson: JSON.stringify(input.signatures),
      testScore,
      ...input.scores,
      finalScore,
      weakCompetenciesJson: JSON.stringify(input.weakCompetencies),
      mentorComment: input.mentorComment.trim(),
      managerComment: input.managerComment.trim(),
      commissionComment: input.commissionComment.trim(),
      decision: completed ? input.decision : "",
      nextCheckAt: input.nextCheckAt || null,
      protocolNumber,
      completedAt: completed ? current.review.completedAt || now : null,
      resultId: current.latestResult?.id ?? current.review.resultId,
      updatedAt: now,
    })
    .where(eq(attestationReviews.id, input.id));

  if (completed) {
    const decision = input.decision as AttestationDecision;
    const employeeUpdate: {
      currentLevel?: string;
      status?: string;
      nextCheckAt?: string | null;
    } = { nextCheckAt: input.nextCheckAt || null };
    if (decision === "middle_confirmed") {
      employeeUpdate.currentLevel =
        current.employee.targetLevel || "middle";
      employeeUpdate.status = "active";
    } else if (decision === "additional_learning") {
      employeeUpdate.status = "learning";
    } else if (decision === "keep_junior") {
      employeeUpdate.currentLevel = "junior";
    }
    await db
      .update(employees)
      .set(employeeUpdate)
      .where(eq(employees.id, current.employee.id));

    await writebackWeakCompetencies(
      current.employee.id,
      input.weakCompetencies,
    );
    await syncPromotionWithAttestationDecision({
      employeeId: current.employee.id,
      attestationId: current.attestation.id,
      resultId: current.latestResult?.id ?? current.review.resultId,
      decision,
      score: finalScore,
    });
  }

  return getAttestationReview(input.id);
}

export async function syncAttestationReviewForResult(input: {
  employeeId: number;
  assessmentId: number;
  resultId: number;
  score: number;
}) {
  await ready();
  const attestation = await db
    .select()
    .from(attestations)
    .where(eq(attestations.assessmentId, input.assessmentId))
    .orderBy(desc(attestations.id))
    .limit(1)
    .then((rows) => rows[0]);
  if (!attestation) return null;

  let review = await db
    .select({ id: attestationReviews.id })
    .from(attestationReviews)
    .where(
      and(
        eq(attestationReviews.attestationId, attestation.id),
        eq(attestationReviews.employeeId, input.employeeId),
      ),
    )
    .orderBy(desc(attestationReviews.id))
    .limit(1)
    .then((rows) => rows[0]);
  if (!review) {
    review = await createAttestationReview({
      attestationId: attestation.id,
      employeeId: input.employeeId,
      type: "final_3_months",
      scheduledAt: attestation.startsAt || attestation.scheduledAt,
    });
  }
  await db
    .update(attestationReviews)
    .set({
      resultId: input.resultId,
      testScore: input.score,
      status: "awaiting_commission",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(attestationReviews.id, review.id));
  return review;
}

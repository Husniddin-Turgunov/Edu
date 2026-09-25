import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./index";
import {
  attestations,
  employees,
  levelPromotionRequests,
} from "./schema";
import { managerOwnsDepartment } from "@/lib/attestation";
import type { AttestationDecision } from "@/lib/attestation";
import { nextLevel, staffLevel } from "@/lib/levels";

async function ready() {
  const { ensureDb } = await import("./queries");
  await ensureDb();
}

export type PromotionStatus = "pending" | "approved" | "rejected";

export type PromotionView = {
  id: number;
  employeeId: number;
  employeeName: string;
  roleTitle: string;
  department: string;
  fromLevel: string;
  toLevel: string;
  score: number;
  status: PromotionStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewComment: string | null;
};

function mapStatus(raw: string): PromotionStatus {
  if (raw === "approved" || raw === "rejected") return raw;
  return "pending";
}

export async function createPromotionRequestIfEligible(input: {
  employeeId: number;
  assessmentId: number;
  resultId: number;
  score: number;
}) {
  await ready();
  const [attestation] = await db
    .select()
    .from(attestations)
    .where(eq(attestations.assessmentId, input.assessmentId))
    .limit(1);
  if (!attestation) return null;
  if (input.score < attestation.passingScore) return null;

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, input.employeeId))
    .limit(1);
  if (!employee) return null;

  const fromLevel = staffLevel(employee.currentLevel);
  const toLevel = nextLevel(fromLevel);
  if (!toLevel) return null;

  const [pending] = await db
    .select({ id: levelPromotionRequests.id })
    .from(levelPromotionRequests)
    .where(
      and(
        eq(levelPromotionRequests.employeeId, employee.id),
        eq(levelPromotionRequests.status, "pending"),
      ),
    )
    .limit(1);
  if (pending) return pending;

  const [row] = await db
    .insert(levelPromotionRequests)
    .values({
      employeeId: employee.id,
      resultId: input.resultId,
      attestationId: attestation.id,
      fromLevel,
      toLevel,
      department: employee.department,
      score: input.score,
      status: "pending",
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row ?? null;
}

export async function getLatestPromotionForEmployee(employeeId: number) {
  await ready();
  const [row] = await db
    .select()
    .from(levelPromotionRequests)
    .where(eq(levelPromotionRequests.employeeId, employeeId))
    .orderBy(desc(levelPromotionRequests.createdAt))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    fromLevel: row.fromLevel,
    toLevel: row.toLevel,
    score: row.score,
    status: mapStatus(row.status),
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
  };
}

export async function listPendingPromotionsForDepartment(managerDepartment: string) {
  await ready();
  const rows = await db
    .select({
      id: levelPromotionRequests.id,
      employeeId: levelPromotionRequests.employeeId,
      employeeName: employees.name,
      roleTitle: employees.roleTitle,
      department: employees.department,
      fromLevel: levelPromotionRequests.fromLevel,
      toLevel: levelPromotionRequests.toLevel,
      score: levelPromotionRequests.score,
      status: levelPromotionRequests.status,
      createdAt: levelPromotionRequests.createdAt,
      reviewedAt: levelPromotionRequests.reviewedAt,
      reviewComment: levelPromotionRequests.reviewComment,
    })
    .from(levelPromotionRequests)
    .innerJoin(employees, eq(levelPromotionRequests.employeeId, employees.id))
    .where(eq(levelPromotionRequests.status, "pending"))
    .orderBy(desc(levelPromotionRequests.createdAt));

  return rows
    .filter((row) => managerOwnsDepartment(managerDepartment, row.department))
    .map((row) => ({
      ...row,
      status: mapStatus(row.status),
    }));
}

export async function decidePromotionRequest(input: {
  requestId: number;
  reviewerUserId: number;
  managerDepartment: string;
  decision: "approved" | "rejected";
  comment?: string;
}) {
  await ready();
  const [request] = await db
    .select()
    .from(levelPromotionRequests)
    .where(eq(levelPromotionRequests.id, input.requestId))
    .limit(1);
  if (!request || request.status !== "pending") {
    throw new Error("Запрос на повышение не найден");
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, request.employeeId))
    .limit(1);
  if (!employee) throw new Error("Сотрудник не найден");
  if (!managerOwnsDepartment(input.managerDepartment, employee.department)) {
    throw new Error("Этот сотрудник не из вашего отдела");
  }

  if (input.decision === "approved") {
    const current = staffLevel(employee.currentLevel);
    if (current !== staffLevel(request.fromLevel)) {
      throw new Error("Уровень сотрудника уже изменился");
    }
    await db
      .update(employees)
      .set({ currentLevel: request.toLevel })
      .where(eq(employees.id, employee.id));
  }

  const [updated] = await db
    .update(levelPromotionRequests)
    .set({
      status: input.decision,
      reviewerUserId: input.reviewerUserId,
      reviewComment: input.comment?.trim() || null,
      reviewedAt: new Date().toISOString(),
    })
    .where(eq(levelPromotionRequests.id, request.id))
    .returning();
  return updated;
}

/** Close or approve manager promotion queue after commission decision. */
export async function syncPromotionWithAttestationDecision(input: {
  employeeId: number;
  attestationId: number;
  resultId?: number | null;
  decision: AttestationDecision;
  score: number | null;
}) {
  await ready();
  const now = new Date().toISOString();
  const comment =
    input.decision === "middle_confirmed"
      ? "Подтверждено комиссией аттестации"
      : "Не подтверждено комиссией аттестации";

  const [pending] = await db
    .select()
    .from(levelPromotionRequests)
    .where(
      and(
        eq(levelPromotionRequests.employeeId, input.employeeId),
        eq(levelPromotionRequests.status, "pending"),
      ),
    )
    .orderBy(desc(levelPromotionRequests.createdAt))
    .limit(1);

  if (input.decision === "middle_confirmed") {
    if (pending) {
      await db
        .update(levelPromotionRequests)
        .set({
          status: "approved",
          reviewComment: comment,
          reviewedAt: now,
        })
        .where(eq(levelPromotionRequests.id, pending.id));
      return;
    }
    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, input.employeeId))
      .limit(1);
    if (!employee || input.score == null) return;
    const fromLevel = staffLevel(employee.currentLevel);
    const toLevel = employee.targetLevel || nextLevel(fromLevel) || "middle";
    await db.insert(levelPromotionRequests).values({
      employeeId: input.employeeId,
      resultId: input.resultId ?? null,
      attestationId: input.attestationId,
      fromLevel,
      toLevel,
      department: employee.department,
      score: input.score,
      status: "approved",
      reviewComment: comment,
      createdAt: now,
      reviewedAt: now,
    });
    return;
  }

  if (
    pending &&
    (input.decision === "middle_not_confirmed" ||
      input.decision === "keep_junior")
  ) {
    await db
      .update(levelPromotionRequests)
      .set({
        status: "rejected",
        reviewComment: comment,
        reviewedAt: now,
      })
      .where(eq(levelPromotionRequests.id, pending.id));
  }
}

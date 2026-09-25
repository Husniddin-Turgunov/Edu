import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "./index";
import { ensureDb } from "./queries";
import {
  autoAssignCandidateTest,
  getCandidateAssignmentForTake,
  submitCandidateAssessment,
} from "./queries";
import {
  candidateAssignments,
  candidateTerminalQueue,
  candidateTerminalSlots,
  candidates,
  vacancies,
} from "./schema";
import {
  TERMINAL_DURATION_MS,
  terminalExpiresAt,
  terminalWarnAt,
} from "@/lib/terminal-auth";
import type { AnswerValue } from "@/lib/scoring";

const SLOT_NUMBERS = [1, 2, 3, 4, 5] as const;

export async function ensureTerminalSlots() {
  await ensureDb();
  const existing = await db
    .select({ slotNumber: candidateTerminalSlots.slotNumber })
    .from(candidateTerminalSlots);
  const known = new Set(existing.map((row) => row.slotNumber));
  const missing = SLOT_NUMBERS.filter((slot) => !known.has(slot));
  if (missing.length === 0) return;
  await db
    .insert(candidateTerminalSlots)
    .values(
      missing.map((slotNumber) => ({
        slotNumber,
        updatedAt: new Date().toISOString(),
      })),
    )
    .onConflictDoNothing();
}

async function promoteNextActive(slotNumber: number) {
  const active = await db
    .select({ id: candidateTerminalQueue.id })
    .from(candidateTerminalQueue)
    .where(
      and(
        eq(candidateTerminalQueue.slotNumber, slotNumber),
        inArray(candidateTerminalQueue.status, ["active", "testing"]),
      ),
    );

  if (active.length > 0) return;

  const [next] = await db
    .select({ id: candidateTerminalQueue.id })
    .from(candidateTerminalQueue)
    .where(
      and(
        eq(candidateTerminalQueue.slotNumber, slotNumber),
        eq(candidateTerminalQueue.status, "queued"),
      ),
    )
    .orderBy(asc(candidateTerminalQueue.sortOrder), asc(candidateTerminalQueue.id))
    .limit(1);

  if (next) {
    await db
      .update(candidateTerminalQueue)
      .set({ status: "active" })
      .where(eq(candidateTerminalQueue.id, next.id));
  }
}

export async function enqueueCandidateToTerminal(
  slotNumber: number,
  candidateId: number,
) {
  await ensureTerminalSlots();
  if (!SLOT_NUMBERS.includes(slotNumber as (typeof SLOT_NUMBERS)[number])) {
    throw new Error("Номер места должен быть от 1 до 5");
  }

  const [candidate] = await db
    .select({ id: candidates.id })
    .from(candidates)
    .where(eq(candidates.id, candidateId));
  if (!candidate) throw new Error("Вакант не найден");

  const existing = await db
    .select({ id: candidateTerminalQueue.id })
    .from(candidateTerminalQueue)
    .where(
      and(
        eq(candidateTerminalQueue.candidateId, candidateId),
        inArray(candidateTerminalQueue.status, ["queued", "active", "testing"]),
      ),
    );
  if (existing.length > 0) {
    throw new Error("Вакант уже в очереди терминала");
  }

  const [{ maxOrder }] = await db
    .select({
      maxOrder: sql<number>`coalesce(max(${candidateTerminalQueue.sortOrder}), -1)`,
    })
    .from(candidateTerminalQueue)
    .where(
      and(
        eq(candidateTerminalQueue.slotNumber, slotNumber),
        ne(candidateTerminalQueue.status, "done"),
      ),
    );

  const hasActive = await db
    .select({ id: candidateTerminalQueue.id })
    .from(candidateTerminalQueue)
    .where(
      and(
        eq(candidateTerminalQueue.slotNumber, slotNumber),
        inArray(candidateTerminalQueue.status, ["active", "testing"]),
      ),
    )
    .limit(1);

  const status = hasActive.length > 0 ? "queued" : "active";

  const [row] = await db
    .insert(candidateTerminalQueue)
    .values({
      slotNumber,
      candidateId,
      sortOrder: (maxOrder ?? -1) + 1,
      status,
      createdAt: new Date().toISOString(),
    })
    .returning();

  await autoAssignCandidateTest(candidateId);
  return row!;
}

export async function removeCandidateFromTerminalQueue(queueItemId: number) {
  await ensureDb();
  const [item] = await db
    .select()
    .from(candidateTerminalQueue)
    .where(eq(candidateTerminalQueue.id, queueItemId));
  if (!item || item.status === "done") return;

  const wasActive = item.status === "active" || item.status === "testing";

  await db
    .update(candidateTerminalQueue)
    .set({ status: "done" })
    .where(eq(candidateTerminalQueue.id, queueItemId));

  if (wasActive) {
    await promoteNextActive(item.slotNumber);
  }
}

export async function getTerminalQueuesOverview() {
  await ensureTerminalSlots();
  const rows = await db
    .select({
      id: candidateTerminalQueue.id,
      slotNumber: candidateTerminalQueue.slotNumber,
      candidateId: candidateTerminalQueue.candidateId,
      candidateName: candidates.name,
      roleTitle: vacancies.roleTitle,
      status: candidateTerminalQueue.status,
      sortOrder: candidateTerminalQueue.sortOrder,
    })
    .from(candidateTerminalQueue)
    .innerJoin(candidates, eq(candidateTerminalQueue.candidateId, candidates.id))
    .innerJoin(vacancies, eq(candidates.vacancyId, vacancies.id))
    .where(ne(candidateTerminalQueue.status, "done"))
    .orderBy(
      asc(candidateTerminalQueue.slotNumber),
      asc(candidateTerminalQueue.sortOrder),
      asc(candidateTerminalQueue.id),
    );

  const bySlot: Record<
    number,
    {
      active: (typeof rows)[number] | null;
      queued: (typeof rows)[number][];
    }
  > = {};
  for (const slot of SLOT_NUMBERS) {
    bySlot[slot] = { active: null, queued: [] };
  }
  for (const row of rows) {
    if (row.status === "active" || row.status === "testing") {
      bySlot[row.slotNumber].active = row;
    } else {
      bySlot[row.slotNumber].queued.push(row);
    }
  }
  return bySlot;
}

async function getPendingAssignmentId(candidateId: number) {
  const [pending] = await db
    .select({ id: candidateAssignments.id })
    .from(candidateAssignments)
    .where(
      and(
        eq(candidateAssignments.candidateId, candidateId),
        inArray(candidateAssignments.status, ["pending", "in_progress"]),
      ),
    )
    .orderBy(desc(candidateAssignments.assignedAt))
    .limit(1);
  return pending?.id ?? null;
}

export async function expireTerminalAttemptIfNeeded(
  queueItemId: number,
  slotNumber: number,
) {
  await ensureDb();
  const [item] = await db
    .select()
    .from(candidateTerminalQueue)
    .where(eq(candidateTerminalQueue.id, queueItemId));
  if (!item || item.status !== "testing" || !item.expiresAt) return false;

  if (Date.now() <= new Date(item.expiresAt).getTime()) return false;

  if (item.assignmentId) {
    try {
      await submitCandidateAssessment(item.assignmentId, {}, { timedOut: true });
    } catch {
      // already completed
    }
  }

  await db
    .update(candidateTerminalQueue)
    .set({ status: "done" })
    .where(eq(candidateTerminalQueue.id, queueItemId));

  await promoteNextActive(slotNumber);
  return true;
}

export async function confirmTerminalIdentity(
  slotNumber: number,
  queueItemId: number,
) {
  await ensureDb();
  const [item] = await db
    .select()
    .from(candidateTerminalQueue)
    .where(eq(candidateTerminalQueue.id, queueItemId));
  if (!item || item.slotNumber !== slotNumber) {
    throw new Error("Запись очереди не найдена");
  }
  if (item.status !== "active") {
    throw new Error("Этот вакант уже не ожидает подтверждения");
  }

  const assignResult = await autoAssignCandidateTest(item.candidateId);
  const assignmentId =
    item.assignmentId ?? (await getPendingAssignmentId(item.candidateId));

  if (!assignmentId) {
    throw new Error(
      assignResult.reason === "no_matching_test"
        ? `Не найден тест для должности «${assignResult.roleTitle ?? ""}»`
        : "Тест не назначен",
    );
  }

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TERMINAL_DURATION_MS).toISOString();

  await db
    .update(candidateTerminalQueue)
    .set({
      status: "testing",
      assignmentId,
      confirmedAt: now,
      startedAt: now,
      expiresAt,
    })
    .where(eq(candidateTerminalQueue.id, queueItemId));

  await db
    .update(candidateAssignments)
    .set({
      status: "in_progress",
      confirmedAt: now,
      startedAt: now,
      expiresAt,
    })
    .where(eq(candidateAssignments.id, assignmentId));

  return { assignmentId, queueItemId, candidateId: item.candidateId };
}

export async function completeTerminalAttempt(input: {
  slotNumber: number;
  queueItemId: number;
  assignmentId: number;
  answers: Record<string, AnswerValue>;
  timedOut?: boolean;
  answerChanges?: number;
  pageExits?: number;
  userAgent?: string;
}) {
  await ensureDb();
  const [item] = await db
    .select()
    .from(candidateTerminalQueue)
    .where(eq(candidateTerminalQueue.id, input.queueItemId));
  if (!item || item.slotNumber !== input.slotNumber) {
    throw new Error("Сессия терминала недействительна");
  }
  if (item.status === "done") {
    return { alreadyDone: true as const };
  }
  if (item.assignmentId !== input.assignmentId) {
    throw new Error("Неверное назначение");
  }

  if (
    !input.timedOut &&
    item.expiresAt &&
    Date.now() > new Date(item.expiresAt).getTime()
  ) {
    throw new Error("Время истекло");
  }

  const result = await submitCandidateAssessment(
    input.assignmentId,
    input.answers,
    {
      timedOut: input.timedOut,
      answerChanges: input.answerChanges,
      pageExits: input.pageExits,
      userAgent: input.userAgent,
    },
  );

  await db
    .update(candidateTerminalQueue)
    .set({ status: "done" })
    .where(eq(candidateTerminalQueue.id, input.queueItemId));

  await promoteNextActive(input.slotNumber);

  return { alreadyDone: false as const, result };
}

export type TerminalViewState =
  | { phase: "idle"; slotNumber: number; queue: TerminalQueueRow[] }
  | {
      phase: "confirm";
      slotNumber: number;
      queueItemId: number;
      candidate: TerminalCandidateInfo;
      queue: TerminalQueueRow[];
    }
  | {
      phase: "testing";
      slotNumber: number;
      queueItemId: number;
      assignmentId: number;
      candidate: TerminalCandidateInfo;
      take: NonNullable<Awaited<ReturnType<typeof getCandidateAssignmentForTake>>>;
      clock: {
        serverNow: number;
        startedAt: string;
        expiresAt: string;
        warnAt: number;
      };
      queue: TerminalQueueRow[];
    };

type TerminalCandidateInfo = {
  id: number;
  name: string;
  roleTitle: string;
  department: string;
  vacancyCode: string;
  avatarHue: number;
};

type TerminalQueueRow = {
  id: number;
  candidateName: string;
  roleTitle: string;
  status: string;
};

export async function getTerminalViewState(
  slotNumber: number,
): Promise<TerminalViewState> {
  await ensureTerminalSlots();
  if (!SLOT_NUMBERS.includes(slotNumber as (typeof SLOT_NUMBERS)[number])) {
    return { phase: "idle", slotNumber, queue: [] };
  }

  const queueRows = await db
    .select({
      id: candidateTerminalQueue.id,
      status: candidateTerminalQueue.status,
      candidateName: candidates.name,
      roleTitle: vacancies.roleTitle,
      sortOrder: candidateTerminalQueue.sortOrder,
    })
    .from(candidateTerminalQueue)
    .innerJoin(candidates, eq(candidateTerminalQueue.candidateId, candidates.id))
    .innerJoin(vacancies, eq(candidates.vacancyId, vacancies.id))
    .where(
      and(
        eq(candidateTerminalQueue.slotNumber, slotNumber),
        ne(candidateTerminalQueue.status, "done"),
      ),
    )
    .orderBy(asc(candidateTerminalQueue.sortOrder), asc(candidateTerminalQueue.id));

  const queue: TerminalQueueRow[] = queueRows.map((r) => ({
    id: r.id,
    candidateName: r.candidateName,
    roleTitle: r.roleTitle,
    status: r.status,
  }));

  const activeItem = await db
    .select({
      id: candidateTerminalQueue.id,
      status: candidateTerminalQueue.status,
      candidateId: candidateTerminalQueue.candidateId,
      assignmentId: candidateTerminalQueue.assignmentId,
      startedAt: candidateTerminalQueue.startedAt,
      expiresAt: candidateTerminalQueue.expiresAt,
      name: candidates.name,
      avatarHue: candidates.avatarHue,
      roleTitle: vacancies.roleTitle,
      department: vacancies.department,
      vacancyCode: vacancies.code,
    })
    .from(candidateTerminalQueue)
    .innerJoin(candidates, eq(candidateTerminalQueue.candidateId, candidates.id))
    .innerJoin(vacancies, eq(candidates.vacancyId, vacancies.id))
    .where(
      and(
        eq(candidateTerminalQueue.slotNumber, slotNumber),
        inArray(candidateTerminalQueue.status, ["active", "testing"]),
      ),
    )
    .orderBy(asc(candidateTerminalQueue.sortOrder))
    .limit(1);

  const current = activeItem[0];
  if (!current) {
    return { phase: "idle", slotNumber, queue };
  }

  if (current.status === "testing" && current.expiresAt) {
    const expired = await expireTerminalAttemptIfNeeded(current.id, slotNumber);
    if (expired) {
      return getTerminalViewState(slotNumber);
    }
  }

  const candidate: TerminalCandidateInfo = {
    id: current.candidateId,
    name: current.name,
    roleTitle: current.roleTitle,
    department: current.department,
    vacancyCode: current.vacancyCode,
    avatarHue: current.avatarHue,
  };

  if (current.status === "active") {
    return {
      phase: "confirm",
      slotNumber,
      queueItemId: current.id,
      candidate,
      queue,
    };
  }

  if (!current.assignmentId || !current.startedAt || !current.expiresAt) {
    return { phase: "idle", slotNumber, queue };
  }

  const take = await getCandidateAssignmentForTake(current.assignmentId);
  if (!take || take.status === "completed") {
    await db
      .update(candidateTerminalQueue)
      .set({ status: "done" })
      .where(eq(candidateTerminalQueue.id, current.id));
    await promoteNextActive(slotNumber);
    return getTerminalViewState(slotNumber);
  }

  return {
    phase: "testing",
    slotNumber,
    queueItemId: current.id,
    assignmentId: current.assignmentId,
    candidate,
    take,
    clock: {
      serverNow: Date.now(),
      startedAt: current.startedAt,
      expiresAt: current.expiresAt,
      warnAt: terminalWarnAt(current.startedAt),
    },
    queue,
  };
}

export async function getTerminalAttemptClock(queueItemId: number) {
  await ensureDb();
  const [item] = await db
    .select({
      startedAt: candidateTerminalQueue.startedAt,
      expiresAt: candidateTerminalQueue.expiresAt,
      status: candidateTerminalQueue.status,
      slotNumber: candidateTerminalQueue.slotNumber,
    })
    .from(candidateTerminalQueue)
    .where(eq(candidateTerminalQueue.id, queueItemId));
  if (!item || item.status !== "testing" || !item.startedAt || !item.expiresAt) {
    return null;
  }

  if (Date.now() > new Date(item.expiresAt).getTime()) {
    await expireTerminalAttemptIfNeeded(queueItemId, item.slotNumber);
    return { expired: true as const, serverNow: Date.now() };
  }

  return {
    expired: false as const,
    serverNow: Date.now(),
    startedAt: item.startedAt,
    expiresAt: item.expiresAt,
    warnAt: terminalWarnAt(item.startedAt),
    expiresAtMs: terminalExpiresAt(item.startedAt),
  };
}

export async function validateTerminalAssignment(
  slotNumber: number,
  queueItemId: number,
  assignmentId: number,
) {
  const [item] = await db
    .select()
    .from(candidateTerminalQueue)
    .where(eq(candidateTerminalQueue.id, queueItemId));
  if (
    !item ||
    item.slotNumber !== slotNumber ||
    item.status !== "testing" ||
    item.assignmentId !== assignmentId
  ) {
    return false;
  }
  if (item.expiresAt && Date.now() > new Date(item.expiresAt).getTime()) {
    return false;
  }
  return true;
}

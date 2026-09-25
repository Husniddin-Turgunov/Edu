/** Per-employee competency matrix statuses (Phase 6). */

export const EMPLOYEE_COMPETENCY_STATUSES = [
  "not_checked",
  "doesnt_know",
  "partial",
  "junior",
  "junior_plus",
  "middle_minus",
  "middle",
  "needs_recheck",
] as const;

export type EmployeeCompetencyStatus =
  (typeof EMPLOYEE_COMPETENCY_STATUSES)[number];

export const EMPLOYEE_STATUSES = [
  "active",
  "probation",
  "learning",
  "paused",
  "left",
] as const;

export type EmployeeHrStatus = (typeof EMPLOYEE_STATUSES)[number];

export function isEmployeeCompetencyStatus(
  value: string,
): value is EmployeeCompetencyStatus {
  return (EMPLOYEE_COMPETENCY_STATUSES as readonly string[]).includes(value);
}

export function isEmployeeHrStatus(value: string): value is EmployeeHrStatus {
  return (EMPLOYEE_STATUSES as readonly string[]).includes(value);
}

export function nextCareerLevel(current: string): string {
  const order = ["intern", "junior", "middle", "senior", "lead", "expert"];
  const idx = order.indexOf(current);
  if (idx < 0 || idx >= order.length - 1) return "middle";
  return order[idx + 1];
}

export function employeeProgressPercent(input: {
  completedLessons: number;
  assignedLessons: number;
  completedTests: number;
  pendingTests: number;
  matrixConfirmed: number;
  matrixTotal: number;
}) {
  const lessonTotal = Math.max(1, input.assignedLessons);
  const testTotal = Math.max(1, input.completedTests + input.pendingTests);
  const matrixTotal = Math.max(1, input.matrixTotal);
  const lessonShare = Math.min(1, input.completedLessons / lessonTotal);
  const testShare = Math.min(1, input.completedTests / testTotal);
  const matrixShare = Math.min(1, input.matrixConfirmed / matrixTotal);
  return Math.round(
    (lessonShare * 0.35 + testShare * 0.35 + matrixShare * 0.3) * 100,
  );
}

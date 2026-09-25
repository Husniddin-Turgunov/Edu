import { lessonAssignedToStaffRole } from "@/lib/role-match";

/** Next seasonal attestation window: 15 Mar / 15 Sep at 10:00 local. */
export function nextAttestationAt(from = new Date()) {
  const windows = [
    new Date(from.getFullYear(), 2, 15, 10, 0, 0),
    new Date(from.getFullYear(), 8, 15, 10, 0, 0),
    new Date(from.getFullYear() + 1, 2, 15, 10, 0, 0),
  ];
  return windows.find((date) => date.getTime() > from.getTime()) ?? windows[2];
}

export type AttestationWindowStatus = "upcoming" | "open" | "closed";

export const ATTESTATION_TYPES = [
  "after_trial",
  "month_1",
  "month_2",
  "final_3_months",
  "repeat",
  "annual",
  "transfer",
] as const;
export type AttestationType = (typeof ATTESTATION_TYPES)[number];

export const ATTESTATION_DECISIONS = [
  "middle_confirmed",
  "middle_not_confirmed",
  "keep_junior",
  "additional_learning",
  "repeat",
  "transfer",
] as const;
export type AttestationDecision = (typeof ATTESTATION_DECISIONS)[number];

export function isAttestationType(value: string): value is AttestationType {
  return (ATTESTATION_TYPES as readonly string[]).includes(value);
}

export function isAttestationDecision(
  value: string,
): value is AttestationDecision {
  return (ATTESTATION_DECISIONS as readonly string[]).includes(value);
}

export function attestationFinalScore(
  values: Array<number | null | undefined>,
) {
  const scored = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  if (scored.length === 0) return null;
  return Math.round(
    (scored.reduce((total, value) => total + value, 0) / scored.length) * 10,
  ) / 10;
}

export function parsePositionTitles(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function departmentsMatch(employeeDept: string, attestationDept: string) {
  return (
    employeeDept.trim().toLowerCase() === attestationDept.trim().toLowerCase()
  );
}

export function managerOwnsDepartment(managerDept: string, employeeDept: string) {
  if (!managerDept.trim() || !employeeDept.trim()) return false;
  if (departmentsMatch(managerDept, employeeDept)) return true;
  const managerCode = managerDept.match(/AGM\/(\d{3})/i)?.[1];
  const employeeCode = employeeDept.match(/AGM\/(\d{3})/i)?.[1];
  return Boolean(managerCode && employeeCode && managerCode === employeeCode);
}

export function employeeMatchesAttestation(input: {
  department: string;
  roleTitle: string;
  attestationDepartment: string;
  positionTitles: string[];
}) {
  if (!input.attestationDepartment.trim()) return false;
  if (!departmentsMatch(input.department, input.attestationDepartment)) {
    return false;
  }
  return lessonAssignedToStaffRole(input.positionTitles, input.roleTitle);
}

export function attestationWindowStatus(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now = Date.now(),
): AttestationWindowStatus {
  const start = new Date(startsAt || 0).getTime();
  const end = new Date(endsAt || 0).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "closed";
  if (now < start) return "upcoming";
  if (now > end) return "closed";
  return "open";
}

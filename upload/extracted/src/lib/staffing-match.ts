import { departmentsMatch } from "@/lib/attestation";

export type StaffingPositionLike = {
  name?: string | null;
  email?: string | null;
  department: string;
  roleTitle: string;
};

export type EmployeeLike = {
  id: number;
  name: string;
  email: string;
  department: string;
  roleTitle: string;
};

export function employeeImportKey(e: {
  name?: string | null;
  email?: string | null;
  roleTitle?: string;
  role?: string;
  department?: string;
}) {
  const email = String(e.email ?? "")
    .trim()
    .toLowerCase();
  if (email) return `email:${email}`;
  const name = String(e.name ?? "").toLowerCase();
  const role = String(e.roleTitle ?? e.role ?? "").toLowerCase();
  const dept = String(e.department ?? "AKELA GROUP").toLowerCase();
  return `seat:${name}|${dept}|${role}`;
}

export function normalizeStaffName(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/эли?вира/g, "эльвира")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeStaffRole(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

/** Match staffing seat to employee by email, then dept+role, not by name alone. */
export function resolveEmployeeForStaffingPosition(
  position: StaffingPositionLike,
  employees: EmployeeLike[],
): number | null {
  const email = String(position.email ?? "")
    .trim()
    .toLowerCase();
  if (email) {
    const byEmail = employees.find(
      (person) => person.email.trim().toLowerCase() === email,
    );
    if (byEmail) return byEmail.id;
  }

  const normRole = normalizeStaffRole(position.roleTitle);
  const normName = position.name ? normalizeStaffName(position.name) : "";

  const deptMatches = (person: EmployeeLike) =>
    departmentsMatch(person.department, position.department);

  if (normName) {
    const exact = employees.filter(
      (person) =>
        normalizeStaffName(person.name) === normName &&
        deptMatches(person) &&
        normalizeStaffRole(person.roleTitle) === normRole,
    );
    if (exact.length === 1) return exact[0].id;

    const byDeptName = employees.filter(
      (person) =>
        normalizeStaffName(person.name) === normName && deptMatches(person),
    );
    if (byDeptName.length === 1) return byDeptName[0].id;
  }

  const byDeptRole = employees.filter(
    (person) =>
      deptMatches(person) && normalizeStaffRole(person.roleTitle) === normRole,
  );
  if (byDeptRole.length === 1) return byDeptRole[0].id;

  if (normName) {
    const byName = employees.filter(
      (person) => normalizeStaffName(person.name) === normName,
    );
    if (byName.length === 1) return byName[0].id;
  }

  return null;
}

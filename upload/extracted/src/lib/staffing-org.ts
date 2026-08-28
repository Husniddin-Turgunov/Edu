import { employeeAccountTypeForRoleTitle } from "@/lib/auth-core";
import { departmentsMatch } from "@/lib/attestation";

export type StaffingLeader = {
  employeeId: number;
  roleTitle: string;
  department: string;
  agmDepth: number;
};

export function isManagerRoleTitle(roleTitle: string) {
  return employeeAccountTypeForRoleTitle(roleTitle) === "manager";
}

/** AGM/101/02 -> ["101", "02"] */
export function departmentAgmSegments(department: string) {
  const match = department.match(/AGM\/([\d/]+)/i);
  if (!match) return [] as string[];
  return match[1].split("/").filter(Boolean);
}

export function departmentAgmKey(department: string, depth?: number) {
  const segments = departmentAgmSegments(department);
  if (segments.length === 0) return "";
  const size = depth ?? segments.length;
  return `AGM/${segments.slice(0, size).join("/")}`;
}

export function departmentContainsAgmKey(department: string, key: string) {
  if (!key) return false;
  return department.toUpperCase().includes(key.toUpperCase());
}

export function leaderRank(roleTitle: string) {
  const title = roleTitle.toLowerCase().replace(/ё/g, "е");
  if (/(генеральный|исполнительный)\s+директор/.test(title)) return 0;
  if (/(управляющий|коммерческий|финансовый|операционный)\s+директор/.test(title)) {
    return 1;
  }
  if (/начальник/.test(title)) return 2;
  if (/заведующ/.test(title)) return 3;
  return 4;
}

export function buildStaffingLeaders(
  rows: {
    employeeId: number | null;
    roleTitle: string;
    department: string;
  }[],
): StaffingLeader[] {
  const leaders: StaffingLeader[] = [];
  for (const row of rows) {
    if (!row.employeeId || !isManagerRoleTitle(row.roleTitle)) continue;
    leaders.push({
      employeeId: row.employeeId,
      roleTitle: row.roleTitle,
      department: row.department,
      agmDepth: departmentAgmSegments(row.department).length,
    });
  }
  return leaders;
}

export function findDepartmentManagerId(input: {
  employeeId: number;
  department: string;
  leaders: StaffingLeader[];
}) {
  const segments = departmentAgmSegments(input.department);
  const depths =
    segments.length > 0
      ? Array.from({ length: segments.length }, (_, index) => segments.length - index)
      : [0];

  for (const depth of depths) {
    const key = depth > 0 ? departmentAgmKey(input.department, depth) : "";
    const candidates = input.leaders
      .filter((leader) => {
        if (leader.employeeId === input.employeeId) return false;
        if (depth === 0) {
          return departmentsMatch(leader.department, input.department);
        }
        if (departmentsMatch(leader.department, input.department)) return true;
        return departmentContainsAgmKey(leader.department, key);
      })
      .sort((a, b) => {
        const exactA = departmentsMatch(a.department, input.department) ? 0 : 1;
        const exactB = departmentsMatch(b.department, input.department) ? 0 : 1;
        if (exactA !== exactB) return exactA - exactB;
        const depthDiff = b.agmDepth - a.agmDepth;
        if (depthDiff !== 0) return depthDiff;
        return leaderRank(a.roleTitle) - leaderRank(b.roleTitle);
      });
    if (candidates[0]) return candidates[0].employeeId;
  }

  const top = input.leaders
    .filter((leader) => leader.employeeId !== input.employeeId)
    .sort((a, b) => leaderRank(a.roleTitle) - leaderRank(b.roleTitle));
  return top[0]?.employeeId ?? null;
}

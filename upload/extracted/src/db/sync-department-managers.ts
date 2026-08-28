import { and, eq, isNotNull, isNull, ne } from "drizzle-orm";
import { db } from "./index";
import { employees, platformUsers, staffingPositions } from "./schema";
import staffing from "@/data/staffing.json";
import {
  buildStaffingLeaders,
  findDepartmentManagerId,
} from "@/lib/staffing-org";
import { resolveEmployeeForStaffingPosition } from "@/lib/staffing-match";
import { ensureStaffingEmployees } from "./ensure-staffing-employees";

async function staffingRowsFromDb() {
  return db
    .select({
      employeeId: staffingPositions.employeeId,
      roleTitle: staffingPositions.roleTitle,
      department: staffingPositions.department,
      isPrimary: staffingPositions.isPrimary,
      sortOrder: staffingPositions.sortOrder,
    })
    .from(staffingPositions)
    .where(eq(staffingPositions.isActive, true))
    .orderBy(staffingPositions.sortOrder);
}

async function staffingRowsFromJson() {
  const people = await db.select().from(employees);
  return staffing.positions.map((position, index) => ({
    employeeId: resolveEmployeeForStaffingPosition(
      {
        name: position.name,
        email: position.email,
        department: position.department,
        roleTitle: position.role,
      },
      people,
    ),
    roleTitle: position.role,
    department: position.department,
    isPrimary: false,
    sortOrder: index,
  }));
}

export async function syncDepartmentManagers() {
  const { relinkStaffingPositions } = await import("./relink-staffing-positions");
  const ensured = await ensureStaffingEmployees();
  const relink = await relinkStaffingPositions();

  let rows = await staffingRowsFromDb();
  if (rows.length === 0) {
    rows = await staffingRowsFromJson();
  }

  const leaders = buildStaffingLeaders(
    rows.map((row) => ({
      employeeId: row.employeeId,
      roleTitle: row.roleTitle,
      department: row.department,
    })),
  );

  const departmentByEmployee = new Map<number, string>();
  for (const row of rows) {
    if (!row.employeeId) continue;
    if (!departmentByEmployee.has(row.employeeId) || row.isPrimary) {
      departmentByEmployee.set(row.employeeId, row.department);
    }
  }

  const activeEmployees = await db
    .select()
    .from(employees)
    .where(ne(employees.status, "left"));

  const managerUsers = await db
    .select({
      employeeId: platformUsers.employeeId,
      userId: platformUsers.id,
    })
    .from(platformUsers)
    .where(
      and(
        eq(platformUsers.role, "manager"),
        eq(platformUsers.isActive, true),
        isNotNull(platformUsers.employeeId),
      ),
    );
  const mentorByEmployee = new Map<number, number>();
  for (const row of managerUsers) {
    if (row.employeeId != null) {
      mentorByEmployee.set(row.employeeId, row.userId);
    }
  }

  let updatedManagers = 0;
  let updatedMentors = 0;
  let updatedDepartments = 0;

  for (const person of activeEmployees) {
    const department =
      departmentByEmployee.get(person.id) || person.department || "AKELA GROUP";
    const managerId = findDepartmentManagerId({
      employeeId: person.id,
      department,
      leaders,
    });
    const mentorUserId = managerId
      ? mentorByEmployee.get(managerId) ?? person.mentorUserId
      : person.mentorUserId;

    const patch: {
      managerEmployeeId?: number | null;
      mentorUserId?: number | null;
      department?: string;
    } = {};

    if (person.managerEmployeeId !== managerId) {
      patch.managerEmployeeId = managerId;
      updatedManagers += 1;
    }
    if (mentorUserId && person.mentorUserId !== mentorUserId) {
      patch.mentorUserId = mentorUserId;
      updatedMentors += 1;
    }
    if (department && person.department !== department) {
      patch.department = department;
      updatedDepartments += 1;
    }

    if (Object.keys(patch).length > 0) {
      await db.update(employees).set(patch).where(eq(employees.id, person.id));
    }
  }

  for (const leader of leaders) {
    await db
      .update(platformUsers)
      .set({
        role: "manager",
        participantKind: null,
        profileDepartment: leader.department,
        profileJobTitle: leader.roleTitle,
      })
      .where(eq(platformUsers.employeeId, leader.employeeId));
  }

  return {
    employees: activeEmployees.length,
    leaders: leaders.length,
    updatedManagers,
    updatedMentors,
    updatedDepartments,
    ensured,
    relink,
  };
}

export async function syncDepartmentManagersIfNeeded() {
  const [missing] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(ne(employees.status, "left"), isNull(employees.managerEmployeeId)))
    .limit(1);
  if (!missing) return null;
  return syncDepartmentManagers();
}

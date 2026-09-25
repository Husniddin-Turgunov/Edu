import staffing from "@/data/staffing.json";
import { resolveEmployeeForStaffingPosition } from "@/lib/staffing-match";
import { db } from "./index";
import { employees, staffingPositions } from "./schema";

export async function syncStaffingPositionsIfNeeded() {
  const existing = await db
    .select({ id: staffingPositions.id })
    .from(staffingPositions)
    .limit(1);
  if (existing.length > 0) return;

  const people = await db.select().from(employees);
  const primaryAssigned = new Set<number>();

  for (const [index, position] of staffing.positions.entries()) {
    const employee = resolveEmployeeForStaffingPosition(
      {
        name: position.name,
        email: position.email,
        department: position.department,
        roleTitle: position.role,
      },
      people,
    );
    const isPrimary = Boolean(
      employee && !primaryAssigned.has(employee),
    );
    if (employee && isPrimary) primaryAssigned.add(employee);

    await db
      .insert(staffingPositions)
      .values({
        code: position.code,
        roleTitle: position.role,
        department: position.department,
        employeeId: employee,
        email: position.email,
        isPrimary,
        sortOrder: index,
        isActive: true,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoNothing();
  }
}

import { eq } from "drizzle-orm";
import staffing from "@/data/staffing.json";
import { resolveEmployeeForStaffingPosition } from "@/lib/staffing-match";
import { db } from "./index";
import { employees, staffingPositions } from "./schema";

export async function relinkStaffingPositions() {
  const people = await db.select().from(employees);
  const primaryAssigned = new Set<number>();
  let updated = 0;
  let linked = 0;

  for (const [index, position] of staffing.positions.entries()) {
    const employeeId = resolveEmployeeForStaffingPosition(
      {
        name: position.name,
        email: position.email,
        department: position.department,
        roleTitle: position.role,
      },
      people,
    );
    if (employeeId) linked += 1;

    const isPrimary = Boolean(
      employeeId && !primaryAssigned.has(employeeId),
    );
    if (employeeId && isPrimary) primaryAssigned.add(employeeId);

    const [existing] = await db
      .select({ id: staffingPositions.id, employeeId: staffingPositions.employeeId })
      .from(staffingPositions)
      .where(eq(staffingPositions.code, position.code))
      .limit(1);

    if (existing) {
      if (existing.employeeId !== employeeId) updated += 1;
      await db
        .update(staffingPositions)
        .set({
          roleTitle: position.role,
          department: position.department,
          employeeId,
          email: position.email,
          isPrimary,
          sortOrder: index,
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(staffingPositions.id, existing.id));
    } else {
      updated += 1;
      await db.insert(staffingPositions).values({
        code: position.code,
        roleTitle: position.role,
        department: position.department,
        employeeId,
        email: position.email,
        isPrimary,
        sortOrder: index,
        isActive: true,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return {
    positions: staffing.positions.length,
    linked,
    updated,
  };
}

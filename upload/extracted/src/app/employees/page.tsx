import { EmployeesView } from "@/components/EmployeesView";
import { listActiveManagers } from "@/db/mentorship";
import {
  getEmployeesDirectory,
  getStaffingPositions,
  listInternOptions,
} from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const mgrSyncResult =
    params.mgrSync === "1"
      ? {
          employees: Number(params.employees) || 0,
          leaders: Number(params.leaders) || 0,
          created: Number(params.created) || 0,
          relinked: Number(params.relinked) || 0,
          updatedManagers: Number(params.updatedManagers) || 0,
          updatedMentors: Number(params.updatedMentors) || 0,
          updatedDepartments: Number(params.updatedDepartments) || 0,
        }
      : null;

  const [directory, rows, internOptions, managers] = await Promise.all([
    getEmployeesDirectory(),
    getStaffingPositions(),
    listInternOptions(),
    listActiveManagers(),
  ]);
  const positions = rows.map((position) => ({
    id: position.id,
    code: position.code,
    role: position.role,
    department: position.department,
    name: position.name,
    email: position.positionEmail,
    employeeId: position.employeeId,
    isPrimary: position.isPrimary,
    currentLevel: position.currentLevel ?? "junior",
    avatarHue: position.avatarHue ?? 200,
  }));
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const initialTab =
    rawTab === "org" ||
    rawTab === "archive" ||
    rawTab === "history" ||
    rawTab === "competencies" ||
    rawTab === "people"
      ? rawTab
      : "people";

  return (
    <EmployeesView
      directory={directory}
      positions={positions}
      internOptions={internOptions}
      managers={managers}
      mgrSyncResult={mgrSyncResult}
      initialTab={initialTab}
    />
  );
}

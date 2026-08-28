import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { ManagerEmployeeDetailView } from "@/components/ManagerEmployeeDetailView";
import { getManagerEmployeeDetail } from "@/db/manager-cabinet";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManagerEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/observer");

  const { id } = await params;
  const employeeId = Number(id);
  if (!employeeId) redirect("/observer/team");

  const [user, detail] = await Promise.all([
    getPlatformUserById(session.userId),
    getManagerEmployeeDetail(session.userId, employeeId),
  ]);
  if (!detail) redirect("/observer/team");

  return (
    <AppShell
      pathname={`/observer/team/${employeeId}`}
      role="manager"
      themeHue={user?.avatarHue ?? 220}
    >
      <ManagerEmployeeDetailView
        member={detail.member}
        employee={detail.employee}
        openTasks={detail.openTasks}
      />
    </AppShell>
  );
}

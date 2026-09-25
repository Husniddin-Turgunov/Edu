import { redirect } from "next/navigation";
import { EmployeeTasksView } from "@/components/EmployeeTasksView";
import { getEmployeeTasksBoard } from "@/db/employee-home";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EmployeeTasksPage() {
  const session = await getSession();
  if (!session || session.role !== "participant") redirect("/login");
  if (session.participantKind !== "employee") redirect("/my");
  if (!session.employeeId) redirect("/login?error=invalid");

  const [user, board] = await Promise.all([
    getPlatformUserById(session.userId),
    getEmployeeTasksBoard(session.employeeId),
  ]);
  if (!user) redirect("/login?error=invalid");

  return (
    <EmployeeTasksView data={board} themeHue={user.avatarHue ?? 220} />
  );
}

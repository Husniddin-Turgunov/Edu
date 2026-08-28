import { redirect } from "next/navigation";
import { EmployeeCalendarView } from "@/components/EmployeeCalendarView";
import { getEmployeeCalendarPage } from "@/db/employee-home";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EmployeeCalendarPage() {
  const session = await getSession();
  if (!session || session.role !== "participant") redirect("/login");
  if (session.participantKind !== "employee") redirect("/my");
  if (!session.employeeId) redirect("/login?error=invalid");

  const [user, data] = await Promise.all([
    getPlatformUserById(session.userId),
    getEmployeeCalendarPage(session.employeeId),
  ]);
  if (!user) redirect("/login?error=invalid");
  if (!data) redirect("/my");

  return (
    <EmployeeCalendarView data={data} themeHue={user.avatarHue ?? 220} />
  );
}

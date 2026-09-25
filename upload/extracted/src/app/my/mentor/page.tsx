import { redirect } from "next/navigation";
import { EmployeeMentorView } from "@/components/EmployeeMentorView";
import { getEmployeeMentorPage } from "@/db/employee-home";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EmployeeMentorPage() {
  const session = await getSession();
  if (!session || session.role !== "participant") redirect("/login");
  if (session.participantKind !== "employee") redirect("/my");
  if (!session.employeeId) redirect("/login?error=invalid");

  const [user, data] = await Promise.all([
    getPlatformUserById(session.userId),
    getEmployeeMentorPage(session.employeeId),
  ]);
  if (!user) redirect("/login?error=invalid");
  if (!data) redirect("/my");

  return <EmployeeMentorView data={data} themeHue={user.avatarHue ?? 220} />;
}

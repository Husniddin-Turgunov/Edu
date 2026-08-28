import { redirect } from "next/navigation";
import { EmployeeDocsView } from "@/components/EmployeeDocsView";
import { getEmployeeDocsPage } from "@/db/employee-home";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EmployeeDocsPage() {
  const session = await getSession();
  if (!session || session.role !== "participant") redirect("/login");
  if (session.participantKind !== "employee") redirect("/my");
  if (!session.employeeId) redirect("/login?error=invalid");

  const [user, data] = await Promise.all([
    getPlatformUserById(session.userId),
    getEmployeeDocsPage(session.employeeId),
  ]);
  if (!user) redirect("/login?error=invalid");
  if (!data) redirect("/my");

  return <EmployeeDocsView data={data} themeHue={user.avatarHue ?? 220} />;
}

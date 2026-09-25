import { redirect } from "next/navigation";
import { ManagerApprovalsView } from "@/components/ManagerApprovalsView";
import { getPlatformUserById } from "@/db/queries";
import { listPendingPromotionsForDepartment } from "@/db/promotions";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManagerApprovalsPage() {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/observer");

  const user = await getPlatformUserById(session.userId);
  const department = user?.profileDepartment?.trim() ?? "";
  const requests = department
    ? await listPendingPromotionsForDepartment(department)
    : [];

  return (
    <ManagerApprovalsView
      department={department}
      requests={requests}
      themeHue={user?.avatarHue ?? 220}
    />
  );
}

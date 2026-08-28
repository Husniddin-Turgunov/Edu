import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { ManagerTrialView } from "@/components/ManagerTrialView";
import { getManagerTrialPage } from "@/db/manager-cabinet";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManagerTrialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/observer");

  const { id } = await params;
  const internEmployeeId = Number(id);
  if (!internEmployeeId) redirect("/observer/newcomers");

  const [user, page] = await Promise.all([
    getPlatformUserById(session.userId),
    getManagerTrialPage(session.userId, internEmployeeId),
  ]);
  if (!page) redirect("/observer/newcomers");

  return (
    <AppShell
      pathname={`/observer/trial/${internEmployeeId}`}
      role="manager"
      themeHue={user?.avatarHue ?? 220}
    >
      <ManagerTrialView newcomer={page.newcomer} decision={page.decision} />
    </AppShell>
  );
}

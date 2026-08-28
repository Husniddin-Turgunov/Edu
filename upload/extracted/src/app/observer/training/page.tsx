import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { ManagerTrainingView } from "@/components/ManagerTrainingView";
import { getManagerTrainingPage } from "@/db/manager-cabinet";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManagerTrainingPage() {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/observer");

  const [user, page] = await Promise.all([
    getPlatformUserById(session.userId),
    getManagerTrainingPage(session.userId),
  ]);
  if (!page) redirect("/login");

  return (
    <AppShell pathname="/observer/training" role="manager" themeHue={user?.avatarHue ?? 220}>
      <ManagerTrainingView rows={page.rows} />
    </AppShell>
  );
}

import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { ManagerNewcomersView } from "@/components/ManagerNewcomersView";
import { getManagerNewcomersPage } from "@/db/manager-cabinet";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManagerNewcomersPage() {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/observer");

  const [user, page] = await Promise.all([
    getPlatformUserById(session.userId),
    getManagerNewcomersPage(session.userId),
  ]);
  if (!page) redirect("/login");

  return (
    <AppShell pathname="/observer/newcomers" role="manager" themeHue={user?.avatarHue ?? 220}>
      <ManagerNewcomersView newcomers={page.newcomers} />
    </AppShell>
  );
}

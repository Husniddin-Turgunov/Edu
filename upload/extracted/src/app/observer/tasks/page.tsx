import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { ManagerTasksView } from "@/components/ManagerTasksView";
import { getManagerTasksBoard } from "@/db/manager-cabinet";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManagerTasksPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/observer");

  const params = (await searchParams) ?? {};
  const filter = typeof params.filter === "string" ? params.filter : undefined;

  const [user, board] = await Promise.all([
    getPlatformUserById(session.userId),
    getManagerTasksBoard(session.userId),
  ]);
  if (!board) redirect("/login");

  return (
    <AppShell pathname="/observer/tasks" role="manager" themeHue={user?.avatarHue ?? 220}>
      <ManagerTasksView
        team={board.team}
        items={board.items}
        counts={board.counts}
        initialFilter={filter}
      />
    </AppShell>
  );
}

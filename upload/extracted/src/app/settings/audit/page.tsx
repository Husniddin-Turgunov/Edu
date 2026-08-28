import { redirect } from "next/navigation";
import { SettingsAuditView } from "@/components/SettingsAuditView";
import { listAuditLogs } from "@/db/system-settings";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsAuditPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");
  const logs = await listAuditLogs(120);
  return (
    <SettingsAuditView
      logs={logs.map((row) => ({
        id: row.id,
        actorName: row.actorName,
        action: row.action,
        target: row.target,
        result: row.result,
        detail: row.detail,
        createdAt: row.createdAt,
      }))}
    />
  );
}

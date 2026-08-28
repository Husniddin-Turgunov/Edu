import { redirect } from "next/navigation";
import { IntegrationsLogView } from "@/components/IntegrationsLogView";
import { listIntegrationLogs } from "@/db/integrations";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function IntegrationsLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");
  const params = await searchParams;
  const raw = params.system;
  const system = (Array.isArray(raw) ? raw[0] : raw)?.trim() || null;
  const logs = await listIntegrationLogs({ system, limit: 100 });
  return (
    <IntegrationsLogView
      system={system}
      logs={logs.map((row) => ({
        id: row.id,
        system: row.system,
        operation: row.operation,
        result: row.result,
        message: row.message,
        error: row.error,
        createdAt: row.createdAt,
      }))}
    />
  );
}

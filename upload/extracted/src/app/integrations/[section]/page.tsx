import { notFound, redirect } from "next/navigation";
import { IntegrationsSectionView } from "@/components/IntegrationsSectionView";
import {
  getMaskedConfig,
  isIntegrationSystem,
  listIntegrationLogs,
} from "@/db/integrations";
import { getVacancies } from "@/db/queries";
import { getSession } from "@/lib/auth";
import { storageEnvStatus } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export default async function IntegrationSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");
  const { section } = await params;
  if (section === "log") redirect("/integrations/log");
  if (!isIntegrationSystem(section)) notFound();
  const [config, logs, vacancies] = await Promise.all([
    getMaskedConfig(section),
    listIntegrationLogs({ system: section, limit: 8 }),
    section === "telegram" ? getVacancies() : Promise.resolve([]),
  ]);
  return (
    <IntegrationsSectionView
      system={section}
      config={config}
      logs={logs.map((row) => ({
        id: row.id,
        operation: row.operation,
        result: row.result,
        message: row.message,
        error: row.error,
        createdAt: row.createdAt,
      }))}
      extra={{
        vacancies: vacancies.map((row) => ({
          id: row.id,
          roleTitle: row.roleTitle,
        })),
        env: section === "storage" ? storageEnvStatus() : undefined,
      }}
    />
  );
}

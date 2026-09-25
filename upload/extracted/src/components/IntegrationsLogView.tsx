"use client";

import Link from "next/link";
import { AppShell, PageHeader } from "@/components/ui";
import { retryIntegrationLogAction } from "@/db/actions";
import { useI18n } from "@/lib/i18n";

type LogRow = {
  id: number;
  system: string;
  operation: string;
  result: string;
  message: string;
  error: string;
  createdAt: string;
};

export function IntegrationsLogView({
  logs,
  system,
}: {
  logs: LogRow[];
  system: string | null;
}) {
  const { t } = useI18n();
  return (
    <AppShell pathname="/integrations">
      <PageHeader title={t("ig_log_title")} subtitle={t("ig_log_note")} />
      <p>
        <Link href="/integrations">{t("ig_back")}</Link>
      </p>
      <form className="stack-form" method="get" action="/integrations/log">
        <label>
          {t("ig_log_system")}
          <select name="system" defaultValue={system ?? ""}>
            <option value="">{t("reports_filter_all")}</option>
            <option value="telegram">Telegram</option>
            <option value="verifix">Verifix</option>
            <option value="bitrix">Bitrix24</option>
            <option value="smtp">SMTP</option>
            <option value="storage">{t("ig_storage_title")}</option>
          </select>
        </label>
        <button type="submit" className="btn btn-ghost">
          {t("reports_apply")}
        </button>
      </form>
      {logs.length === 0 ? (
        <p className="muted">{t("ig_log_empty")}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("ig_log_date")}</th>
                <th>{t("ig_log_system")}</th>
                <th>{t("ig_log_op")}</th>
                <th>{t("ig_log_result")}</th>
                <th>{t("ig_log_error")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                  <td>{row.system}</td>
                  <td>{row.operation}</td>
                  <td>
                    {row.result}
                    {row.message ? ` · ${row.message}` : ""}
                  </td>
                  <td>{row.error || "—"}</td>
                  <td>
                    {row.result === "error" ? (
                      <form action={retryIntegrationLogAction}>
                        <input type="hidden" name="logId" value={row.id} />
                        <button type="submit" className="btn btn-ghost">
                          {t("ig_retry")}
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

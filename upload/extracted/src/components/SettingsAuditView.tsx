"use client";

import Link from "next/link";
import { AppShell, PageHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

type Row = {
  id: number;
  actorName: string;
  action: string;
  target: string;
  result: string;
  detail: string;
  createdAt: string;
};

export function SettingsAuditView({ logs, embedded = false }: { logs: Row[]; embedded?: boolean }) {
  const { t } = useI18n();
  const body = (
    <>
      {!embedded ? (
        <>
          <PageHeader title={t("st_audit_title")} subtitle={t("st_audit_note")} />
          <p>
            <Link href="/admin/system">{t("st_back")}</Link>
          </p>
        </>
      ) : null}
      {logs.length === 0 ? (
        <p className="muted">{t("ig_log_empty")}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("ig_log_date")}</th>
                <th>{t("st_audit_actor")}</th>
                <th>{t("ig_log_op")}</th>
                <th>{t("st_audit_target")}</th>
                <th>{t("ig_log_result")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                  <td>{row.actorName || "—"}</td>
                  <td>{row.action}</td>
                  <td>
                    {row.target}
                    {row.detail ? ` · ${row.detail}` : ""}
                  </td>
                  <td>{row.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
  if (embedded) return body;
  return <AppShell pathname="/settings">{body}</AppShell>;
}

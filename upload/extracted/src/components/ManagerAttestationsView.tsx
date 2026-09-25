"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import type { ManagerAttestationRow } from "@/db/manager-cabinet";
import { useI18n } from "@/lib/i18n";

type Props = {
  rows: ManagerAttestationRow[];
  pendingPromotions: {
    id: number;
    employeeId: number;
    employeeName: string;
    fromLevel: string;
    toLevel: string;
    score: number;
  }[];
  upcoming: {
    id: number;
    title: string;
    scheduledAt: string;
    department: string;
  }[];
};

export function ManagerAttestationsView({
  rows,
  pendingPromotions,
  upcoming,
}: Props) {
  const { t } = useI18n();

  return (
    <>
      <PageHeader
        title={t("mgr_attest_title")}
        subtitle={t("mgr_attest_note")}
        action={
          <Link href="/observer/approvals" className="btn btn-ghost">
            {t("nav_approvals")}
          </Link>
        }
      />

      {upcoming.length > 0 ? (
        <article className="panel">
          <h2>{t("mgr_attest_upcoming")}</h2>
          <div className="list">
            {upcoming.map((row) => (
              <div key={row.id} className="list-item">
                <strong>{row.title}</strong>
                <div className="muted">{row.scheduledAt.slice(0, 10)}</div>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {pendingPromotions.length > 0 ? (
        <article className="panel" style={{ marginTop: 18 }}>
          <h2>{t("mgr_attest_promotions")}</h2>
          <div className="list">
            {pendingPromotions.map((row) => (
              <div key={row.id} className="list-item">
                <div>
                  <strong>{row.employeeName}</strong>
                  <div className="muted">
                    {row.fromLevel} → {row.toLevel} · {row.score}%
                  </div>
                </div>
                <Link href="/observer/approvals" className="btn btn-primary">
                  {t("mgr_action_decide")}
                </Link>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      <article className="panel" style={{ marginTop: 18 }}>
        <h2>{t("mgr_attest_history")}</h2>
        {rows.length === 0 ? (
          <p className="muted">{t("mgr_attest_empty")}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("mgr_col_employee")}</th>
                  <th>{t("mgr_attest_col_title")}</th>
                  <th>{t("mgr_attest_col_score")}</th>
                  <th>{t("mgr_attest_col_decision")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.employeeId}-${row.attestationId}-${index}`}>
                    <td>{row.employeeName}</td>
                    <td>{row.title}</td>
                    <td>{row.finalScore ?? "—"}</td>
                    <td>{row.decision ?? row.reviewStatus ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </>
  );
}

"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import type { ManagerTrainingRow } from "@/db/manager-cabinet";
import { useI18n } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

export function ManagerTrainingView({ rows }: { rows: ManagerTrainingRow[] }) {
  const { t, locale } = useI18n();

  return (
    <>
      <PageHeader title={t("mgr_training_title")} subtitle={t("mgr_training_note")} />
      {rows.length === 0 ? (
        <p className="muted">{t("mgr_training_empty")}</p>
      ) : (
        <div className="list">
          {rows.map((row) => (
            <article key={row.employeeId} className="panel mgr-training-card">
              <div className="mgr-training-head">
                <div>
                  <h2>{row.name}</h2>
                  <p className="muted">
                    {localizeStaffText(row.roleTitle, locale, "role")} · {row.progressPercent}%
                  </p>
                </div>
                {row.problems.length > 0 ? (
                  <span className="learn-status learn-status-overdue">
                    {t("mgr_training_problem")}
                  </span>
                ) : null}
              </div>
              <div className="mgr-month-bars">
                {row.months.map((month) => (
                  <div key={month.month} className="mgr-month-bar">
                    <span>
                      {t("mgr_month").replace("{n}", String(month.month))}
                    </span>
                    <div className="progress-bar learn-progress-wide">
                      <span style={{ width: `${month.percent}%` }} />
                    </div>
                    <strong>{month.percent}%</strong>
                  </div>
                ))}
              </div>
              <Link href={`/observer/team/${row.employeeId}`} className="btn btn-ghost">
                {t("mgr_action_view")}
              </Link>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { LevelBadge, PageHeader } from "@/components/ui";
import type { ManagerGrowthRow } from "@/db/manager-cabinet";
import { useI18n } from "@/lib/i18n";

export function ManagerGrowthView({ rows }: { rows: ManagerGrowthRow[] }) {
  const { t } = useI18n();

  return (
    <>
      <PageHeader title={t("mgr_growth_title")} subtitle={t("mgr_growth_note")} />
      {rows.length === 0 ? (
        <p className="muted">{t("mgr_growth_empty")}</p>
      ) : (
        <div className="list">
          {rows.map((row) => (
            <article key={row.employeeId} className="panel">
              <div className="mgr-training-head">
                <div>
                  <h2>{row.name}</h2>
                  <p className="muted">
                    <LevelBadge level={row.currentLevel} /> →{" "}
                    <LevelBadge level={row.targetLevel} />
                  </p>
                </div>
                <strong>{row.readyPercent}%</strong>
              </div>
              {row.gaps.length > 0 ? (
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t("mgr_growth_competency")}</th>
                        <th>{t("mgr_growth_current")}</th>
                        <th>{t("mgr_growth_required")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.gaps.map((gap, index) => (
                        <tr key={`${row.employeeId}-${index}`}>
                          <td>{gap.name}</td>
                          <td>
                            {gap.current === "ok"
                              ? t("mgr_growth_ok")
                              : t("mgr_growth_gap")}
                          </td>
                          <td>{t("mgr_growth_required")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">{t("mgr_growth_no_gaps")}</p>
              )}
              <div style={{ marginTop: 12 }}>
                <Link href={`/observer/team/${row.employeeId}`} className="btn btn-ghost">
                  {t("mgr_growth_plan")}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

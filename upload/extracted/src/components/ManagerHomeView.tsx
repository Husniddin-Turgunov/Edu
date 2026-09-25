"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import type { ManagerHomeDashboard } from "@/db/manager-cabinet";
import { useI18n } from "@/lib/i18n";

export function ManagerHomeView({ data }: { data: ManagerHomeDashboard }) {
  const { t } = useI18n();

  return (
    <>
      <PageHeader
        title={t("mgr_home_welcome").replace("{name}", data.managerName)}
        subtitle={data.department || t("mgr_home_note")}
      />

      <section className="stack" style={{ gap: 8, marginBottom: 8 }}>
        <h2 className="dash-section-title">{t("mgr_home_team_title")}</h2>
        <div className="grid-stats dash-kpi-grid dash-kpi-grid-mgr">
          <Link href="/observer/team" className="stat dash-stat-link">
            <span>{t("mgr_kpi_team")}</span>
            <strong>{data.kpis.teamSize}</strong>
          </Link>
          <Link href="/observer/team" className="stat dash-stat-link">
            <span>{t("mgr_kpi_active")}</span>
            <strong>{data.kpis.activeCount}</strong>
          </Link>
          <Link href="/observer/newcomers" className="stat dash-stat-link">
            <span>{t("mgr_kpi_newcomers")}</span>
            <strong>{data.kpis.newcomerCount}</strong>
          </Link>
          <Link href="/observer/tasks?filter=overdue" className="stat dash-stat-link">
            <span>{t("mgr_kpi_overdue")}</span>
            <strong className={data.kpis.overdueTasks > 0 ? "stat-warn" : ""}>
              {data.kpis.overdueTasks}
            </strong>
          </Link>
          <Link href="/observer/training" className="stat dash-stat-link">
            <span>{t("mgr_kpi_learning")}</span>
            <strong>{data.kpis.learningCount}</strong>
          </Link>
          <Link href="/observer/newcomers" className="stat dash-stat-link">
            <span>{t("mgr_kpi_trial")}</span>
            <strong>{data.kpis.trialDecisions}</strong>
          </Link>
          <Link href="/observer/meetings" className="stat dash-stat-link">
            <span>{t("mgr_kpi_meetings")}</span>
            <strong>{data.kpis.meetingsToday}</strong>
          </Link>
        </div>
      </section>

      <section className="panel mgr-actions">
        <h2>{t("mgr_actions_title")}</h2>
        {data.actions.length === 0 ? (
          <p className="muted">{t("mgr_actions_empty")}</p>
        ) : (
          <div className="list">
            {data.actions.map((action) => (
              <div key={action.id} className="list-item mgr-action-item">
                <div>
                  <strong>{action.title}</strong>
                  <div className="muted">{t(action.detailKey)}</div>
                </div>
                <div className="mgr-action-buttons">
                  <Link href={action.href} className="btn btn-primary">
                    {t(action.primaryLabelKey)}
                  </Link>
                  {action.secondaryHref && action.secondaryLabelKey ? (
                    <Link href={action.secondaryHref} className="btn btn-ghost">
                      {t(action.secondaryLabelKey)}
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

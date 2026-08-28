"use client";

import { PageHeader } from "@/components/ui";
import type { ManagerReportSummary } from "@/db/manager-cabinet";
import { useI18n } from "@/lib/i18n";

type Props = {
  summary: ManagerReportSummary;
  kpi?: { plan: number; fact: number; forecast: number };
  tasks?: { open: number; overdue: number; doneToday: number; inProgress: number };
};

export function ManagerReportsView({ summary, kpi, tasks }: Props) {
  const { t } = useI18n();

  return (
    <>
      <PageHeader title={t("mgr_reports_title")} subtitle={t("mgr_reports_note")} />

      <div className="grid-stats dash-kpi-grid dash-kpi-grid-mgr">
        <div className="stat">
          <span>{t("mgr_kpi_team")}</span>
          <strong>{summary.teamSize}</strong>
        </div>
        <div className="stat">
          <span>{t("mgr_reports_turnover")}</span>
          <strong>{summary.turnoverRisk}</strong>
        </div>
        <div className="stat">
          <span>{t("mgr_reports_adaptation")}</span>
          <strong>{summary.adaptationOnTrack}</strong>
        </div>
        <div className="stat">
          <span>{t("mgr_tasks_done_today")}</span>
          <strong>{summary.tasksDone}</strong>
        </div>
        <div className="stat">
          <span>{t("mgr_col_learning")}</span>
          <strong>{summary.learningAvg}%</strong>
        </div>
        <div className="stat">
          <span>{t("mgr_kpi_fact")}</span>
          <strong>{summary.kpiAvg}%</strong>
        </div>
      </div>

      <div className="layout-2" style={{ marginTop: 18 }}>
        <article className="panel">
          <h2>{t("mgr_reports_kpi")}</h2>
          {kpi ? (
            <dl className="docs-contact-dl">
              <dt>{t("mgr_kpi_plan")}</dt>
              <dd>{kpi.plan}%</dd>
              <dt>{t("mgr_kpi_fact")}</dt>
              <dd>{kpi.fact}%</dd>
              <dt>{t("mgr_kpi_forecast")}</dt>
              <dd>{kpi.forecast}%</dd>
            </dl>
          ) : (
            <p className="muted">{t("mgr_reports_no_data")}</p>
          )}
        </article>
        <article className="panel">
          <h2>{t("mgr_reports_tasks")}</h2>
          {tasks ? (
            <dl className="docs-contact-dl">
              <dt>{t("mgr_tasks_open")}</dt>
              <dd>{tasks.open}</dd>
              <dt>{t("mgr_kpi_overdue")}</dt>
              <dd>{tasks.overdue}</dd>
              <dt>{t("mgr_tasks_in_progress")}</dt>
              <dd>{tasks.inProgress}</dd>
            </dl>
          ) : (
            <p className="muted">{t("mgr_reports_no_data")}</p>
          )}
        </article>
      </div>
    </>
  );
}

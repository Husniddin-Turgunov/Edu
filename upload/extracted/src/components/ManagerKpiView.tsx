"use client";

import { PageHeader } from "@/components/ui";
import { upsertKpiTargetAction } from "@/db/actions";
import type { ManagerKpiRow } from "@/db/manager-cabinet";
import { useI18n } from "@/lib/i18n";

type Props = {
  period: string;
  rows: ManagerKpiRow[];
  summary: { plan: number; fact: number; forecast: number };
  team: { id: number; name: string }[];
};

export function ManagerKpiView({ period, rows, summary, team }: Props) {
  const { t } = useI18n();

  return (
    <>
      <PageHeader title={t("mgr_kpi_title")} subtitle={t("mgr_kpi_note")} />

      <div className="grid-stats dash-kpi-grid">
        <div className="stat">
          <span>{t("mgr_kpi_plan")}</span>
          <strong>{summary.plan}%</strong>
        </div>
        <div className="stat">
          <span>{t("mgr_kpi_fact")}</span>
          <strong>{summary.fact}%</strong>
        </div>
        <div className="stat">
          <span>{t("mgr_kpi_forecast")}</span>
          <strong>{summary.forecast}%</strong>
        </div>
      </div>

      <article className="panel" style={{ marginTop: 18 }}>
        <h2>{t("mgr_kpi_team_table")}</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("mgr_col_employee")}</th>
                <th>{t("mgr_kpi_plan")}</th>
                <th>{t("mgr_kpi_fact")}</th>
                <th>{t("mgr_kpi_forecast")}</th>
                <th>{t("mgr_kpi_reasons")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employeeId}>
                  <td>{row.name}</td>
                  <td>{row.plan}%</td>
                  <td>{row.fact}%</td>
                  <td>{row.forecast}%</td>
                  <td className="muted">
                    {row.reasons.length
                      ? row.reasons.map((reason) => t(`mgr_reason_${reason}` as "mgr_reason_overdue_tasks")).join(", ")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel mgr-task-form" style={{ marginTop: 18 }}>
        <h2>{t("mgr_kpi_set")}</h2>
        <form action={upsertKpiTargetAction} className="form-grid">
          <input type="hidden" name="period" value={period} />
          <input type="hidden" name="metricKey" value="overall" />
          <label>
            {t("mgr_col_employee")}
            <select name="employeeId" required>
              <option value="">{t("mgr_select_employee")}</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("mgr_kpi_plan")}
            <input name="planValue" type="number" min={0} max={100} defaultValue={100} />
          </label>
          <label>
            {t("mgr_kpi_fact")}
            <input name="factValue" type="number" min={0} max={100} />
          </label>
          <button type="submit" className="btn btn-primary">
            {t("mgr_kpi_save")}
          </button>
        </form>
      </article>
    </>
  );
}

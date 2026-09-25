"use client";

import Link from "next/link";
import { LevelBadge, PageHeader } from "@/components/ui";
import type { ManagerTeamMember } from "@/db/manager-cabinet";
import { useI18n } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

export function ManagerTeamView({ team }: { team: ManagerTeamMember[] }) {
  const { t, locale } = useI18n();

  return (
    <>
      <PageHeader title={t("mgr_team_title")} subtitle={t("mgr_team_note")} />
      {team.length === 0 ? (
        <p className="muted">{t("mgr_team_empty")}</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table mgr-team-table">
            <thead>
              <tr>
                <th>{t("mgr_col_employee")}</th>
                <th>{t("mgr_col_role")}</th>
                <th>{t("mgr_col_status")}</th>
                <th>KPI</th>
                <th>{t("mgr_col_learning")}</th>
                <th>{t("mgr_col_tasks")}</th>
              </tr>
            </thead>
            <tbody>
              {team.map((member) => (
                <tr key={member.id}>
                  <td>
                    <Link href={`/observer/team/${member.id}`} className="mgr-emp-link">
                      <strong>{member.name}</strong>
                    </Link>
                    <div className="muted">
                      <LevelBadge level={member.currentLevel} />
                    </div>
                  </td>
                  <td>{localizeStaffText(member.roleTitle, locale, "role")}</td>
                  <td>
                    <span className={`mgr-status mgr-status-${member.status}`}>
                      {t(`mgr_status_${member.status}` as "mgr_status_active")}
                    </span>
                    {member.isIntern && member.trialDay ? (
                      <div className="muted">
                        {t("mgr_trial_day").replace("{day}", String(member.trialDay))}
                      </div>
                    ) : null}
                  </td>
                  <td>{member.kpiPercent ?? "—"}%</td>
                  <td>
                    <div className="progress-bar learn-progress-wide">
                      <span style={{ width: `${member.progressPercent}%` }} />
                    </div>
                    <span className="muted">{member.progressPercent}%</span>
                  </td>
                  <td>
                    {member.openTasks}
                    {member.overdueTasks > 0 ? (
                      <span className="mgr-overdue-badge">{member.overdueTasks}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

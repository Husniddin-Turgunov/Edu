"use client";

import Link from "next/link";
import { LevelBadge, PageHeader } from "@/components/ui";
import type { ManagerTeamMember } from "@/db/manager-cabinet";
import type { Employee, ManagerTask } from "@/db/schema";
import { useI18n } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

export function ManagerEmployeeDetailView({
  member,
  employee,
  openTasks,
}: {
  member: ManagerTeamMember;
  employee: Employee | null;
  openTasks: ManagerTask[];
}) {
  const { t, locale } = useI18n();

  return (
    <>
      <PageHeader
        title={member.name}
        subtitle={`${localizeStaffText(member.roleTitle, locale, "role")} · ${localizeStaffText(member.department, locale, "department")}`}
        action={
          <Link href="/observer/team" className="btn btn-ghost">
            {t("mgr_back_team")}
          </Link>
        }
      />

      <div className="layout-2">
        <article className="panel">
          <h2>{t("mgr_emp_profile")}</h2>
          <dl className="docs-contact-dl">
            <dt>{t("mgr_col_status")}</dt>
            <dd>{t(`mgr_status_${member.status}` as "mgr_status_active")}</dd>
            <dt>{t("mgr_emp_level")}</dt>
            <dd>
              <LevelBadge level={member.currentLevel} /> →{" "}
              <LevelBadge level={member.targetLevel} />
            </dd>
            <dt>{t("mgr_emp_hired")}</dt>
            <dd>{employee?.hiredAt?.slice(0, 10) ?? "—"}</dd>
            <dt>{t("mgr_emp_mentor")}</dt>
            <dd>{member.mentorName ?? "—"}</dd>
          </dl>
        </article>

        <article className="panel">
          <h2>{t("mgr_emp_metrics")}</h2>
          <div className="grid-stats dash-kpi-grid">
            <div className="stat">
              <span>KPI</span>
              <strong>{member.kpiPercent ?? member.progressPercent}%</strong>
            </div>
            <div className="stat">
              <span>{t("mgr_col_learning")}</span>
              <strong>{member.progressPercent}%</strong>
            </div>
            <div className="stat">
              <span>{t("mgr_col_tasks")}</span>
              <strong>{member.openTasks}</strong>
            </div>
          </div>
        </article>
      </div>

      <article className="panel" style={{ marginTop: 18 }}>
        <div className="mgr-section-head">
          <h2>{t("mgr_emp_tasks")}</h2>
          <Link href="/observer/tasks" className="btn btn-ghost">
            {t("mgr_emp_all_tasks")}
          </Link>
        </div>
        {openTasks.length === 0 ? (
          <p className="muted">{t("mgr_tasks_empty")}</p>
        ) : (
          <div className="list">
            {openTasks.map((task) => (
              <div key={task.id} className="list-item">
                <strong>{task.title}</strong>
                <div className="muted">
                  {task.dueAt?.slice(0, 16) ?? t("mgr_no_deadline")}
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </>
  );
}

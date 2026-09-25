"use client";

import Link from "next/link";
import { LevelBadge, PageHeader } from "@/components/ui";
import type { EmployeeHomeDashboard } from "@/db/employee-home";
import { useI18n } from "@/lib/i18n";
import { levelLabel } from "@/lib/levels";
import { localizeStaffText } from "@/lib/staff-localization";

export function EmployeeHomeView({ data }: { data: EmployeeHomeDashboard }) {
  const { t, locale } = useI18n();
  const role = localizeStaffText(data.person.roleTitle, locale, "role");
  const department = localizeStaffText(
    data.person.department,
    locale,
    "department",
  );
  const primaryHref =
    data.tasks[0]?.href ??
    (data.nextLesson ? `/my/learning/${data.nextLesson.lessonId}` : "/my/learning");

  return (
    <>
      <PageHeader
        title={t("eh_welcome").replace("{name}", data.person.name)}
        subtitle={`${role} · ${department} · ${levelLabel(data.person.currentLevel)} → ${levelLabel(data.person.targetLevel)}`}
        action={
          <Link href={primaryHref} className="btn btn-primary">
            {t("eh_continue")}
          </Link>
        }
      />

      <section className="stack" style={{ gap: 8, marginBottom: 8 }}>
        <h2 className="dash-section-title">{t("eh_kpis_title")}</h2>
        <div className="grid-stats dash-kpi-grid dash-kpi-grid-employee">
          <Link href="/my/learning" className="stat dash-stat-link">
            <span>{t("eh_kpi_progress")}</span>
            <strong>{data.kpis.progressPercent}%</strong>
          </Link>
          <Link href="/my/learning" className="stat dash-stat-link">
            <span>{t("eh_kpi_left")}</span>
            <strong>{data.kpis.lessonsLeft}</strong>
          </Link>
          <Link href="/my/learning" className="stat dash-stat-link">
            <span>{t("eh_kpi_overdue")}</span>
            <strong>{data.kpis.overdueCount}</strong>
          </Link>
          <Link href="/my/attestation" className="stat dash-stat-link">
            <span>{t("eh_kpi_attest")}</span>
            <strong>{data.kpis.openAttestations}</strong>
          </Link>
          <Link href="/my/tests" className="stat dash-stat-link">
            <span>{t("eh_kpi_tests")}</span>
            <strong>{data.kpis.pendingTests}</strong>
          </Link>
          <Link href="/my/statistics" className="stat dash-stat-link">
            <span>{t("eh_kpi_score")}</span>
            <strong>
              {data.kpis.latestScore != null ? `${data.kpis.latestScore}%` : "—"}
            </strong>
          </Link>
        </div>
      </section>

      <section className="layout-2" style={{ marginTop: 18 }}>
        <article className="panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
            <h2 style={{ margin: 0 }}>{t("eh_today")}</h2>
            <Link href="/my/tasks" className="btn btn-ghost">
              {t("eh_tasks_all")}
            </Link>
          </div>
          {data.tasks.length === 0 ? (
            <p className="muted">{t("eh_empty_tasks")}</p>
          ) : (
            <div className="list">
              {data.tasks.map((task) => (
                <Link
                  key={task.id}
                  href={task.href}
                  className="list-item dash-action-link"
                >
                  <div>
                    <strong>{t(task.titleKey)}</strong>
                    {task.detail ? (
                      <div className="muted">{task.detail}</div>
                    ) : null}
                  </div>
                  {task.count != null ? (
                    <strong className="dash-action-count">{task.count}</strong>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
          <h2>{t("eh_warnings")}</h2>
          {data.warnings.length === 0 ? (
            <p className="muted">{t("eh_empty_warnings")}</p>
          ) : (
            <div className="list">
              {data.warnings.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="list-item dash-action-link dash-warning-item"
                >
                  <div>
                    <strong>{t(item.titleKey)}</strong>
                  </div>
                  {item.count != null ? (
                    <strong className="dash-action-count">{item.count}</strong>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="layout-2" style={{ marginTop: 18, marginBottom: 22 }}>
        <article className="panel">
          <h2>{t("eh_learning")}</h2>
          {data.nextLesson ? (
            <>
              <p className="muted">{t("eh_next_lesson")}</p>
              <p>
                <strong>{data.nextLesson.title}</strong>
              </p>
              <Link
                href={`/my/learning/${data.nextLesson.lessonId}`}
                className="btn btn-primary"
              >
                {t("eh_continue")}
              </Link>
            </>
          ) : (
            <p className="muted">{t("eh_no_lesson")}</p>
          )}
        </article>

        <article className="panel">
          <h2>{t("eh_events")}</h2>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <LevelBadge level={data.person.currentLevel} />
            <span className="muted">{t("eh_progress_note")}</span>
          </div>
          <div className="dist-track" style={{ marginTop: 12 }}>
            <div
              className="dist-fill"
              style={{ width: `${Math.min(100, data.kpis.progressPercent)}%` }}
            />
          </div>
          <p style={{ marginTop: 10 }}>
            <strong>{data.kpis.progressPercent}%</strong>{" "}
            <span className="muted">
              {levelLabel(data.person.currentLevel)} →{" "}
              {levelLabel(data.person.targetLevel)}
            </span>
          </p>
          {data.nextAttestation ? (
            <p className="muted" style={{ marginTop: 12 }}>
              {t("eh_next_attest")}: {data.nextAttestation.title}
            </p>
          ) : (
            <p className="muted" style={{ marginTop: 12 }}>
              {t("eh_no_attest")}
            </p>
          )}
        </article>
      </section>
    </>
  );
}

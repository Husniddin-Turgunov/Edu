"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import type { ManagerNewcomerRow } from "@/db/manager-cabinet";
import { useI18n } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

export function ManagerNewcomersView({
  newcomers,
}: {
  newcomers: ManagerNewcomerRow[];
}) {
  const { t, locale } = useI18n();

  return (
    <>
      <PageHeader title={t("mgr_newcomers_title")} subtitle={t("mgr_newcomers_note")} />
      {newcomers.length === 0 ? (
        <p className="muted">{t("mgr_newcomers_empty")}</p>
      ) : (
        <div className="mgr-newcomer-grid">
          {newcomers.map((row) => (
            <article key={row.employeeId} className="panel mgr-newcomer-card">
              <div className="mgr-newcomer-head">
                <div>
                  <h2>{row.name}</h2>
                  <p className="muted">
                    {localizeStaffText(row.roleTitle, locale, "role")} ·{" "}
                    {row.trialStartsAt?.slice(0, 10) ?? row.hiredAt?.slice(0, 10) ?? "—"}
                  </p>
                </div>
                {row.needsDecision ? (
                  <span className="learn-status learn-status-overdue">
                    {t("mgr_newcomer_decision")}
                  </span>
                ) : null}
              </div>

              <div className="mgr-checklist">
                <h3>{t("mgr_checklist_title")}</h3>
                <ul>
                  <li className={row.checklist.mentorAssigned ? "is-done" : ""}>
                    {t("mgr_check_mentor")}
                  </li>
                  <li className={row.checklist.planReady ? "is-done" : ""}>
                    {t("mgr_check_plan")}
                  </li>
                  <li className={row.checklist.firstTask ? "is-done" : ""}>
                    {t("mgr_check_task")}
                  </li>
                  <li className={row.checklist.contentAssigned ? "is-done" : ""}>
                    {t("mgr_check_content")}
                  </li>
                </ul>
              </div>

              <div className="mgr-trial-days">
                {row.dailyScores.map((day) => (
                  <div
                    key={day.day}
                    className={`mgr-trial-day ${day.status === "reviewed" ? "is-done" : ""}`}
                  >
                    <span>{t("mgr_day").replace("{n}", String(day.day))}</span>
                    <strong>{day.score != null ? `${Math.round(day.score)}%` : "—"}</strong>
                  </div>
                ))}
              </div>

              <div className="mgr-newcomer-actions">
                <Link href={`/observer/trial/${row.employeeId}`} className="btn btn-primary">
                  {row.needsDecision ? t("mgr_action_decide") : t("mgr_action_view")}
                </Link>
                <Link href="/observer/mentees" className="btn btn-ghost">
                  {t("mgr_assign_mentor")}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { submitTrialDecisionAction } from "@/db/actions";
import type { ManagerNewcomerRow } from "@/db/manager-cabinet";
import type { TrialDecision } from "@/db/schema";
import { useI18n } from "@/lib/i18n";

export function ManagerTrialView({
  newcomer,
  decision,
}: {
  newcomer: ManagerNewcomerRow;
  decision: TrialDecision | null;
}) {
  const { t } = useI18n();
  const avgScore =
    newcomer.dailyScores.filter((row) => row.score != null).length > 0
      ? Math.round(
          newcomer.dailyScores.reduce((sum, row) => sum + (row.score ?? 0), 0) /
            newcomer.dailyScores.filter((row) => row.score != null).length,
        )
      : null;

  return (
    <>
      <PageHeader
        title={newcomer.name}
        subtitle={t("mgr_trial_title")}
        action={
          <Link href="/observer/newcomers" className="btn btn-ghost">
            {t("mgr_back_newcomers")}
          </Link>
        }
      />

      <div className="grid-stats dash-kpi-grid">
        <div className="stat">
          <span>{t("mgr_trial_avg")}</span>
          <strong>{avgScore != null ? `${avgScore}%` : "—"}</strong>
        </div>
        <div className="stat">
          <span>{t("mgr_emp_mentor")}</span>
          <strong>{newcomer.mentorName ?? "—"}</strong>
        </div>
        <div className="stat">
          <span>{t("mgr_trial_day")}</span>
          <strong>
            {newcomer.trialDay
              ? t("mgr_trial_day_of").replace("{day}", String(newcomer.trialDay))
              : "—"}
          </strong>
        </div>
      </div>

      <article className="panel mgr-trial-days" style={{ marginTop: 18 }}>
        <h2>{t("mgr_trial_progress")}</h2>
        <div className="mgr-trial-days">
          {newcomer.dailyScores.map((day) => (
            <div
              key={day.day}
              className={`mgr-trial-day ${day.status === "reviewed" ? "is-done" : ""}`}
            >
              <span>{t("mgr_day").replace("{n}", String(day.day))}</span>
              <strong>{day.score != null ? `${Math.round(day.score)}%` : "—"}</strong>
            </div>
          ))}
        </div>
      </article>

      {decision ? (
        <article className="panel" style={{ marginTop: 18 }}>
          <h2>{t("mgr_trial_decided")}</h2>
          <p>{decision.comment || t("mgr_trial_no_comment")}</p>
        </article>
      ) : (
        <article className="panel mgr-trial-decision" style={{ marginTop: 18 }}>
          <h2>{t("mgr_trial_decision_title")}</h2>
          <form action={submitTrialDecisionAction} className="form-grid">
            <input type="hidden" name="internEmployeeId" value={newcomer.employeeId} />
            <input type="hidden" name="day" value={newcomer.trialDay ?? 5} />
            <input type="hidden" name="score" value={avgScore ?? ""} />
            <label className="span-2">
              {t("mgr_trial_comment")}
              <textarea name="comment" rows={3} />
            </label>
            <div className="mgr-decision-buttons span-2">
              <button type="submit" name="decisionType" value="continue" className="btn btn-primary">
                {t("mgr_trial_continue")}
              </button>
              <button type="submit" name="decisionType" value="extend" className="btn btn-ghost">
                {t("mgr_trial_extend")}
              </button>
              <button type="submit" name="decisionType" value="end" className="btn btn-ghost">
                {t("mgr_trial_end")}
              </button>
            </div>
          </form>
        </article>
      )}
    </>
  );
}

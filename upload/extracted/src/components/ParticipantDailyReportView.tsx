"use client";

import { AppShell, PageHeader } from "@/components/ui";
import { submitInternDailyReportAction } from "@/db/actions";
import { useI18n } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

type ReportFields = {
  studiedToday: string;
  didIndependently: string;
  proofUrl: string;
  errorText: string;
  fixText: string;
  canDoWithoutHelp: string;
  mentorQuestion?: string;
  mentorMiniTask?: string;
  scoreKnowledge?: number | null;
  scorePractice?: number | null;
  scoreIndependence?: number | null;
  conclusion?: string;
  planTomorrow?: string;
};

type ReportRow = {
  id: number;
  reportDate: string;
  status: string;
  submittedAt: string;
  mentorComment: string | null;
  score: number | null;
  dayNumber: number;
  fields: ReportFields;
};

function FieldBlock({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <h3 style={{ marginBottom: 4 }}>{label}</h3>
      <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{value}</p>
    </div>
  );
}

export function ParticipantDailyReportView({
  personName,
  roleTitle,
  department,
  today,
  dayNumber,
  todayReport,
  history,
  themeHue,
}: {
  personName: string;
  roleTitle: string;
  department: string;
  today: string;
  dayNumber: number;
  todayReport: ReportRow | null;
  history: ReportRow[];
  themeHue: number;
}) {
  const { t, locale } = useI18n();
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  const displayName = localizeStaffText(personName, locale, "name");
  const displayRole = localizeStaffText(roleTitle, locale, "role");
  const displayDept = localizeStaffText(department, locale, "department");

  function formatDay(isoDate: string) {
    const date = new Date(`${isoDate}T12:00:00`);
    return date.toLocaleDateString(dateLocale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function scoreLabel(total: number | null) {
    if (total == null) return "—";
    return `${total}/6`;
  }

  function understandingLabel(value?: string | null) {
    if (value === "yes") return t("daily_report_understood_yes");
    if (value === "partly") return t("daily_report_understood_partly");
    if (value === "no") return t("daily_report_understood_no");
    return value ?? "";
  }

  return (
    <AppShell pathname="/my/daily-report" role="intern" themeHue={themeHue}>
      <PageHeader
        title={t("nav_daily_report")}
        subtitle={`${displayName} · ${displayRole} · ${displayDept}`}
      />

      <section className="layout-2" style={{ marginBottom: 16 }}>
        <article className="panel">
          <p className="eyebrow">{t("daily_report_today")}</p>
          <h2>
            {formatDay(today)} · {t("daily_report_day_n").replace("{n}", String(dayNumber))}
          </h2>
          {todayReport ? (
            <>
              <p className="lead">{t("daily_report_submitted")}</p>
              <p className="muted">
                {t("daily_report_status")}:{" "}
                {todayReport.status === "reviewed"
                  ? t("daily_report_status_reviewed")
                  : t("daily_report_status_submitted")}
                {todayReport.score != null
                  ? ` · ${t("daily_report_total")}: ${scoreLabel(todayReport.score)}`
                  : ""}
                {todayReport.fields.conclusion
                  ? ` · ${todayReport.fields.conclusion}`
                  : ""}
              </p>
              <FieldBlock
                label={t("daily_report_can_do")}
                value={understandingLabel(todayReport.fields.canDoWithoutHelp)}
              />
              <FieldBlock
                label={t("daily_report_studied")}
                value={todayReport.fields.studiedToday}
              />
              <FieldBlock
                label={t("daily_report_did")}
                value={todayReport.fields.didIndependently}
              />
              {todayReport.status === "reviewed" ? (
                <>
                  <FieldBlock
                    label={t("daily_report_mentor_question")}
                    value={todayReport.fields.mentorQuestion}
                  />
                  <FieldBlock
                    label={t("daily_report_mentor_task")}
                    value={todayReport.fields.mentorMiniTask}
                  />
                  <div style={{ marginTop: 10 }}>
                    <h3>{t("daily_report_scores")}</h3>
                    <p className="muted" style={{ margin: 0 }}>
                      {t("daily_report_score_knowledge")}:{" "}
                      {todayReport.fields.scoreKnowledge ?? "—"} ·{" "}
                      {t("daily_report_score_practice")}:{" "}
                      {todayReport.fields.scorePractice ?? "—"} ·{" "}
                      {t("daily_report_score_independence")}:{" "}
                      {todayReport.fields.scoreIndependence ?? "—"}
                    </p>
                  </div>
                  <FieldBlock
                    label={t("daily_report_conclusion")}
                    value={todayReport.fields.conclusion}
                  />
                  <FieldBlock
                    label={t("daily_report_plan_tomorrow")}
                    value={todayReport.fields.planTomorrow}
                  />
                </>
              ) : null}
            </>
          ) : (
            <>
              <p className="lead">{t("daily_report_fill_yellow")}</p>
              <form action={submitInternDailyReportAction} className="stack-form">
                <label>
                  {t("daily_report_can_do")}
                  <select name="canDoWithoutHelp" required defaultValue="">
                    <option value="" disabled>
                      {t("select")}
                    </option>
                    <option value="yes">{t("daily_report_understood_yes")}</option>
                    <option value="partly">
                      {t("daily_report_understood_partly")}
                    </option>
                    <option value="no">{t("daily_report_understood_no")}</option>
                  </select>
                </label>
                <label>
                  {t("daily_report_studied")}
                  <textarea
                    name="studiedToday"
                    rows={3}
                    required
                    minLength={10}
                    placeholder={t("daily_report_studied_ph")}
                  />
                </label>
                <label>
                  {t("daily_report_did")}
                  <textarea
                    name="didIndependently"
                    rows={4}
                    required
                    minLength={10}
                    placeholder={t("daily_report_did_ph")}
                  />
                </label>
                <button type="submit" className="btn btn-primary">
                  {t("daily_report_submit")}
                </button>
              </form>
            </>
          )}
        </article>

        <article className="panel">
          <h2>{t("daily_report_history_title")}</h2>
          {history.length === 0 ? (
            <p className="muted">{t("daily_report_history_empty")}</p>
          ) : (
            <div className="list">
              {history.map((row) => (
                <div
                  key={row.id}
                  className="list-item"
                  style={{ alignItems: "flex-start" }}
                >
                  <div>
                    <strong>
                      {formatDay(row.reportDate)} ·{" "}
                      {t("daily_report_day_n").replace(
                        "{n}",
                        String(row.dayNumber),
                      )}
                    </strong>
                    <div className="muted">
                      {row.status === "reviewed"
                        ? t("daily_report_status_reviewed")
                        : t("daily_report_status_submitted")}
                      {row.score != null
                        ? ` · ${scoreLabel(row.score)}`
                        : ""}
                      {row.fields.conclusion
                        ? ` · ${row.fields.conclusion}`
                        : ""}
                    </div>
                    <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                      {row.fields.studiedToday}
                    </p>
                    {row.fields.planTomorrow ? (
                      <p className="muted" style={{ marginTop: 6 }}>
                        {t("daily_report_plan_tomorrow")}:{" "}
                        {row.fields.planTomorrow}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </AppShell>
  );
}

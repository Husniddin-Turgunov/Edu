"use client";

import Link from "next/link";
import { AppShell, LevelBadge, PageHeader } from "@/components/ui";
import {
  KnowledgeProfileCard,
  parseProfileJson,
} from "@/components/KnowledgeProfileCard";
import {
  assignInternContentAction,
  decideMentorshipAction,
  reviewInternDailyReportAction,
  unassignInternContentAction,
} from "@/db/actions";
import { useI18n } from "@/lib/i18n";
import { levelLabel } from "@/lib/levels";
import { localizeStaffText } from "@/lib/staff-localization";

type LessonOption = { dbId: number; title: string; level: string };

type AssignmentRow = {
  id: number;
  itemType: string;
  source: string;
  assignedAt: string;
  lesson: { id: number; title: string; slug: string } | null;
};

type VacancyOption = {
  id: number;
  role: string;
  department: string;
};

type DailyReportRow = {
  id: number;
  reportDate: string;
  score: number | null;
  status: string;
  mentorComment: string | null;
  submittedAt: string;
  dayNumber: number;
  fields: {
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
};

export function ManagerMenteeDetailView({
  intern,
  mentorship,
  results,
  assignments,
  lessonOptions,
  vacancies,
  dailyReports = [],
  themeHue,
}: {
  intern: {
    id: number;
    name: string;
    roleTitle: string;
    department: string;
    currentLevel: string;
  };
  mentorship: {
    id: number;
    trialStartsAt: string;
    trialEndsAt: string;
    status: string;
  };
  results: {
    id: number;
    score: number;
    levelCode: string;
    completedAt: string;
    assessmentTitle: string;
    competencyName: string;
    profileJson?: string | null;
  }[];
  assignments: AssignmentRow[];
  lessonOptions: LessonOption[];
  vacancies: VacancyOption[];
  dailyReports?: DailyReportRow[];
  themeHue: number;
}) {
  const { t, locale } = useI18n();
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  const latestProfile = parseProfileJson(results[0]?.profileJson);
  const understandingLabel = (value: string) => {
    if (value === "yes") return t("daily_report_understood_yes");
    if (value === "partly") return t("daily_report_understood_partly");
    if (value === "no") return t("daily_report_understood_no");
    return value;
  };

  return (
    <AppShell pathname="/observer/mentees" role="manager" themeHue={themeHue}>
      <PageHeader
        title={localizeStaffText(intern.name, locale, "name")}
        subtitle={`${localizeStaffText(intern.roleTitle, locale, "role")} · ${localizeStaffText(intern.department, locale, "department")}`}
        action={
          <Link href="/observer/mentees" className="btn">
            {t("mentor_back")}
          </Link>
        }
      />

      <section className="layout-2" style={{ marginBottom: 16 }}>
        <article className="panel">
          <p className="eyebrow">{t("mentor_trial_title")}</p>
          <h2 style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <LevelBadge level={intern.currentLevel} />
            <span>{levelLabel(intern.currentLevel)}</span>
          </h2>
          <p>
            {t("mentor_trial_window")
              .replace(
                "{start}",
                new Date(mentorship.trialStartsAt).toLocaleDateString(dateLocale),
              )
              .replace(
                "{end}",
                new Date(mentorship.trialEndsAt).toLocaleDateString(dateLocale),
              )}
          </p>
          <p className="muted">
            {t("mentor_status")}: {mentorship.status}
          </p>
        </article>

        <article className="panel">
          <h2>{t("mentor_decision_title")}</h2>
          <p className="muted">{t("mentor_decision_note")}</p>
          <form action={decideMentorshipAction} className="stack-form">
            <input type="hidden" name="mentorshipId" value={mentorship.id} />
            <input type="hidden" name="internEmployeeId" value={intern.id} />
            <label>
              {t("mentor_decision_label")}
              <select name="decision" defaultValue="hired">
                <option value="hired">{t("mentor_decision_hire")}</option>
                <option value="repeat_day">
                  {t("mentor_decision_repeat_day")}
                </option>
                <option value="extended">{t("mentor_decision_extend")}</option>
                <option value="other_role">
                  {t("mentor_decision_other_role")}
                </option>
                <option value="ended">{t("mentor_decision_end")}</option>
              </select>
            </label>
            <label>
              {t("mentor_decision_repeat_day_n")}
              <select name="repeatDay" defaultValue="1">
                {[1, 2, 3, 4, 5].map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("mentor_trial_end")}
              <input
                type="date"
                name="trialEndsAt"
                defaultValue={new Date(mentorship.trialEndsAt)
                  .toISOString()
                  .slice(0, 10)}
              />
            </label>
            <label>
              {t("mentor_hire_position")}
              <select name="positionId" defaultValue="">
                <option value="">{t("mentor_hire_no_position")}</option>
                {vacancies.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.role} · {v.department}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("mentor_decision_comment")}
              <textarea name="comment" rows={3} />
            </label>
            <button type="submit" className="btn btn-primary">
              {t("mentor_decision_save")}
            </button>
          </form>
        </article>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>{t("daily_mentor_title")}</h2>
        <p className="muted">{t("daily_mentor_note")}</p>
        {dailyReports.length === 0 ? (
          <p className="muted">{t("daily_mentor_empty")}</p>
        ) : (
          <div className="list" style={{ marginTop: 12 }}>
            {dailyReports.map((report) => (
              <div
                key={report.id}
                id={`report-${report.id}`}
                className="list-item"
                style={{ alignItems: "flex-start", flexDirection: "column" }}
              >
                <div style={{ width: "100%" }}>
                  <strong>
                    {new Date(
                      `${report.reportDate}T12:00:00`,
                    ).toLocaleDateString(dateLocale)}{" "}
                    ·{" "}
                    {t("daily_report_day_n").replace(
                      "{n}",
                      String(report.dayNumber),
                    )}
                  </strong>
                  <div className="muted">
                    {report.status === "reviewed"
                      ? t("daily_report_status_reviewed")
                      : t("daily_report_status_submitted")}
                    {report.score != null ? ` · ${report.score}/6` : ""}
                    {report.fields.conclusion
                      ? ` · ${report.fields.conclusion}`
                      : ""}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <h3>{t("daily_report_can_do")}</h3>
                    <p style={{ whiteSpace: "pre-wrap" }}>
                      {understandingLabel(report.fields.canDoWithoutHelp)}
                    </p>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <h3>{t("daily_report_studied")}</h3>
                    <p style={{ whiteSpace: "pre-wrap" }}>
                      {report.fields.studiedToday}
                    </p>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <h3>{t("daily_report_did")}</h3>
                    <p style={{ whiteSpace: "pre-wrap" }}>
                      {report.fields.didIndependently}
                    </p>
                  </div>

                  {report.status === "reviewed" ? (
                    <>
                      <div style={{ marginTop: 8 }}>
                        <h3>{t("daily_report_mentor_question")}</h3>
                        <p style={{ whiteSpace: "pre-wrap" }}>
                          {report.fields.mentorQuestion}
                        </p>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <h3>{t("daily_report_mentor_task")}</h3>
                        <p style={{ whiteSpace: "pre-wrap" }}>
                          {report.fields.mentorMiniTask}
                        </p>
                      </div>
                      <p className="muted" style={{ marginTop: 8 }}>
                        {t("daily_report_score_knowledge")}:{" "}
                        {report.fields.scoreKnowledge ?? "—"} ·{" "}
                        {t("daily_report_score_practice")}:{" "}
                        {report.fields.scorePractice ?? "—"} ·{" "}
                        {t("daily_report_score_independence")}:{" "}
                        {report.fields.scoreIndependence ?? "—"}
                      </p>
                      {report.fields.planTomorrow ? (
                        <p className="muted" style={{ marginTop: 6 }}>
                          {t("daily_report_plan_tomorrow")}:{" "}
                          {report.fields.planTomorrow}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>

                {report.status !== "reviewed" ? (
                  <form
                    action={reviewInternDailyReportAction}
                    className="stack-form"
                    style={{ marginTop: 10, width: "100%", maxWidth: 560 }}
                  >
                    <input type="hidden" name="reportId" value={report.id} />
                    <input
                      type="hidden"
                      name="internEmployeeId"
                      value={intern.id}
                    />
                    <label>
                      {t("daily_report_mentor_question")}
                      <textarea name="mentorQuestion" rows={2} required />
                    </label>
                    <label>
                      {t("daily_report_mentor_task")}
                      <textarea name="mentorMiniTask" rows={2} required />
                    </label>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: 8,
                      }}
                    >
                      <label>
                        {t("daily_report_score_knowledge")}
                        <select name="scoreKnowledge" defaultValue="1" required>
                          <option value="0">0</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                        </select>
                      </label>
                      <label>
                        {t("daily_report_score_practice")}
                        <select name="scorePractice" defaultValue="1" required>
                          <option value="0">0</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                        </select>
                      </label>
                      <label>
                        {t("daily_report_score_independence")}
                        <select
                          name="scoreIndependence"
                          defaultValue="1"
                          required
                        >
                          <option value="0">0</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                        </select>
                      </label>
                    </div>
                    <label>
                      {t("daily_report_conclusion")}
                      <select name="conclusion" defaultValue="">
                        <option value="">{t("daily_report_conclusion_auto")}</option>
                        <option value="усвоил">{t("daily_report_learned")}</option>
                        <option value="повторить">
                          {t("daily_report_repeat")}
                        </option>
                        <option value="не усвоил">
                          {t("daily_report_not_learned")}
                        </option>
                      </select>
                    </label>
                    <label>
                      {t("daily_report_plan_tomorrow")}
                      <textarea name="planTomorrow" rows={2} />
                    </label>
                    <label>
                      {t("daily_mentor_comment")}
                      <textarea name="comment" rows={2} />
                    </label>
                    <button type="submit" className="btn btn-primary">
                      {t("daily_mentor_mark_reviewed")}
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="layout-2" style={{ marginBottom: 16 }}>
        <article className="panel">
          <h2>{t("mentor_assign_title")}</h2>
          <p className="muted">{t("mentor_assign_note")}</p>
          <form action={assignInternContentAction} className="stack-form">
            <input type="hidden" name="internEmployeeId" value={intern.id} />
            <label>
              {t("mentor_assign_lesson")}
              <select name="lessonId" defaultValue="">
                <option value="">{t("mentor_assign_pick")}</option>
                {lessonOptions.map((lesson) => (
                  <option key={lesson.dbId} value={lesson.dbId}>
                    {lesson.title} · {levelLabel(lesson.level)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-primary">
              {t("mentor_assign_save")}
            </button>
          </form>

          {assignments.length === 0 ? (
            <p className="muted" style={{ marginTop: 12 }}>
              {t("mentor_assign_empty")}
            </p>
          ) : (
            <div className="list" style={{ marginTop: 12 }}>
              {assignments.map((item) => (
                <div key={item.id} className="list-item">
                  <div>
                    <strong>{item.lesson?.title ?? `#${item.id}`}</strong>
                    <div className="muted">
                      {item.source} ·{" "}
                      {new Date(item.assignedAt).toLocaleDateString(dateLocale)}
                    </div>
                  </div>
                  <form action={unassignInternContentAction}>
                    <input type="hidden" name="assignmentId" value={item.id} />
                    <input
                      type="hidden"
                      name="internEmployeeId"
                      value={intern.id}
                    />
                    <button type="submit" className="btn">
                      {t("mentor_assign_remove")}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
          <h2>{t("mentor_knowledge_title")}</h2>
          {latestProfile ? (
            <KnowledgeProfileCard profile={latestProfile} compact />
          ) : (
            <p className="muted">{t("mentor_knowledge_empty")}</p>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>{t("mentor_results_title")}</h2>
        {results.length === 0 ? (
          <p className="muted">{t("no_history")}</p>
        ) : (
          <div className="list">
            {results.map((r) => (
              <div key={r.id} className="list-item">
                <div>
                  <strong>{r.assessmentTitle}</strong>
                  <div className="muted">
                    {r.competencyName} · {r.score}% ·{" "}
                    {new Date(r.completedAt).toLocaleDateString(dateLocale)}
                  </div>
                </div>
                <LevelBadge level={r.levelCode} />
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

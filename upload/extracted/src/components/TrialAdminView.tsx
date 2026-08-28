"use client";

import Link from "next/link";
import { AppShell, LevelBadge, PageHeader } from "@/components/ui";
import {
  addInternFromCandidateAction,
  decideMentorshipAction,
} from "@/db/actions";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";
import { TRIAL_DAY_THEMES } from "@/lib/trial-period";

type Entrance = {
  score: number | null;
  level: string;
  weakTopics: string[];
  recommendation: string;
  assessmentTitle: string;
};

type InternCard = {
  id: number;
  name: string;
  email: string;
  department: string;
  roleTitle: string;
  currentLevel: string;
  avatarHue: number;
  mentorshipId: number | null;
  mentorName: string | null;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  mentorshipStatus: string;
  decisionComment: string | null;
  currentDay: number;
  dayThemeKey: MessageKey;
  progress: number;
  reportsDone: number;
  reportsReviewed: number;
  entrance: Entrance;
};

type ReadyCandidate = {
  id: number;
  name: string;
  roleTitle: string;
  department: string;
  currentLevel: string;
};

function statusLabel(
  status: string,
  t: (key: MessageKey) => string,
): string {
  if (status === "active") return t("trial_status_active");
  if (status === "extended") return t("trial_status_extended");
  if (status === "hired") return t("trial_status_hired");
  if (status === "other_role") return t("trial_status_other_role");
  if (status === "ended") return t("trial_status_ended");
  return t("trial_status_none");
}

export function TrialAdminView({
  interns,
  readyCandidates,
}: {
  interns: InternCard[];
  readyCandidates: ReadyCandidate[];
}) {
  const { t, locale } = useI18n();
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  const name = (value: string) => localizeStaffText(value, locale, "name");
  const role = (value: string) => localizeStaffText(value, locale, "role");
  const department = (value: string) =>
    localizeStaffText(value, locale, "department");

  const active = interns.filter((item) =>
    ["active", "extended", "none"].includes(item.mentorshipStatus),
  );

  return (
    <AppShell pathname="/trial">
      <PageHeader title={t("nav_trial")} subtitle={t("hub_trial_note")} />

      <section className="stack" style={{ gap: 18, maxWidth: 1100 }}>
        <article className="panel">
          <h2>{t("trial_program_title")}</h2>
          <p className="muted">{t("trial_program_note")}</p>
          <div className="trial-day-grid">
            {TRIAL_DAY_THEMES.map((theme) => (
              <div key={theme.day} className="trial-day-card">
                <strong>
                  {t("daily_report_day_n").replace("{n}", String(theme.day))}
                </strong>
                <span>{t(theme.titleKey)}</span>
                <p className="muted">{t(theme.bodyKey)}</p>
                <ul className="trial-day-items">
                  {theme.items.map((item) => (
                    <li key={item}>{t(item)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>

        <div className="actions-row" style={{ flexWrap: "wrap" }}>
          <Link href="/interns" className="btn btn-ghost">
            {t("hub_trial_interns")}
          </Link>
          <Link href="/assessments/kind/trial" className="btn btn-ghost">
            {t("hub_trial_tests")}
          </Link>
          <Link href="/learning" className="btn btn-ghost">
            {t("hub_trial_learning")}
          </Link>
        </div>

        <article className="panel">
          <h2>
            {t("trial_active_interns")} · {active.length}
          </h2>
          {active.length === 0 ? (
            <p className="muted">{t("no_interns")}</p>
          ) : (
            <div className="trial-intern-grid">
              {active.map((intern) => (
                <article key={intern.id} className="trial-intern-card">
                  <div className="person" style={{ marginBottom: 10 }}>
                    <span
                      className="avatar"
                      style={{
                        background: `hsl(${intern.avatarHue} 42% 38%)`,
                      }}
                    >
                      {name(intern.name)
                        .split(" ")
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <span>
                      <strong>{name(intern.name)}</strong>
                      <span className="muted">{role(intern.roleTitle)}</span>
                    </span>
                  </div>
                  <div className="trial-intern-meta">
                    <span>{department(intern.department)}</span>
                    <LevelBadge level={intern.currentLevel} />
                    <span>
                      {t("trial_mentor")}:{" "}
                      {intern.mentorName
                        ? name(intern.mentorName)
                        : t("trial_mentor_none")}
                    </span>
                    {intern.trialStartsAt && intern.trialEndsAt ? (
                      <span>
                        {new Date(intern.trialStartsAt).toLocaleDateString(
                          dateLocale,
                        )}{" "}
                        —{" "}
                        {new Date(intern.trialEndsAt).toLocaleDateString(
                          dateLocale,
                        )}
                      </span>
                    ) : null}
                    <span>
                      {t("daily_report_day_n").replace(
                        "{n}",
                        String(intern.currentDay),
                      )}{" "}
                      · {t(intern.dayThemeKey)}
                    </span>
                    <span>
                      {t("trial_progress")}: {intern.progress}% ·{" "}
                      {t("trial_reports_count")
                        .replace("{done}", String(intern.reportsDone))
                        .replace(
                          "{reviewed}",
                          String(intern.reportsReviewed),
                        )}
                    </span>
                    <span>
                      {t("mentor_status")}:{" "}
                      {statusLabel(intern.mentorshipStatus, t)}
                    </span>
                  </div>

                  {intern.entrance.score != null ? (
                    <div className="trial-entrance">
                      <strong>{t("trial_entrance_result")}</strong>
                      <span>
                        {Math.round(intern.entrance.score)}%
                        {intern.entrance.level
                          ? ` · ${intern.entrance.level}`
                          : ""}
                      </span>
                      {intern.entrance.weakTopics.length ? (
                        <span className="muted">
                          {t("trial_weak_topics")}:{" "}
                          {intern.entrance.weakTopics.join(", ")}
                        </span>
                      ) : null}
                      {intern.entrance.recommendation ? (
                        <span className="muted">
                          {intern.entrance.recommendation}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="entrance-test-progress" aria-hidden>
                    <span style={{ width: `${intern.progress}%` }} />
                  </div>

                  <div className="actions-row" style={{ marginTop: 10 }}>
                    <Link
                      href={`/employees/${intern.id}`}
                      className="btn btn-ghost"
                    >
                      {t("trial_open_card")}
                    </Link>
                    <Link
                      href={`/observer/mentees/${intern.id}`}
                      className="btn btn-ghost"
                    >
                      {t("trial_open_mentor")}
                    </Link>
                  </div>

                  {intern.mentorshipId ? (
                    <form
                      action={decideMentorshipAction}
                      className="stack-form"
                      style={{ marginTop: 12 }}
                    >
                      <input
                        type="hidden"
                        name="mentorshipId"
                        value={intern.mentorshipId}
                      />
                      <input
                        type="hidden"
                        name="internEmployeeId"
                        value={intern.id}
                      />
                      <input type="hidden" name="returnTo" value="/trial" />
                      <label>
                        {t("mentor_decision_label")}
                        <select name="decision" defaultValue="hired">
                          <option value="hired">
                            {t("mentor_decision_hire")}
                          </option>
                          <option value="repeat_day">
                            {t("mentor_decision_repeat_day")}
                          </option>
                          <option value="extended">
                            {t("mentor_decision_extend")}
                          </option>
                          <option value="other_role">
                            {t("mentor_decision_other_role")}
                          </option>
                          <option value="ended">
                            {t("mentor_decision_end")}
                          </option>
                        </select>
                      </label>
                      <label>
                        {t("mentor_decision_repeat_day_n")}
                        <select
                          name="repeatDay"
                          defaultValue={String(intern.currentDay)}
                        >
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
                          defaultValue={
                            intern.trialEndsAt
                              ? new Date(intern.trialEndsAt)
                                  .toISOString()
                                  .slice(0, 10)
                              : ""
                          }
                        />
                      </label>
                      <label>
                        {t("mentor_decision_comment")}
                        <textarea name="comment" rows={2} />
                      </label>
                      <button type="submit" className="btn btn-primary">
                        {t("mentor_decision_save")}
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
          <h2>{t("add_intern")}</h2>
          <p className="muted">{t("add_intern_note")}</p>
          {readyCandidates.length === 0 ? (
            <p className="muted">{t("no_ready_interns")}</p>
          ) : (
            <form action={addInternFromCandidateAction} className="stack-form">
              <label>
                {t("candidate_for_internship")}
                <select name="candidateId" required defaultValue="">
                  <option value="" disabled>
                    {t("select")}
                  </option>
                  {readyCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {name(candidate.name)} — {role(candidate.roleTitle)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="btn btn-primary">
                {t("add_intern_btn")}
              </button>
            </form>
          )}
        </article>
      </section>
    </AppShell>
  );
}

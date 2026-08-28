"use client";

import Link from "next/link";
import { AppShell, LevelBadge, PageHeader } from "@/components/ui";
import { addInternFromCandidateAction } from "@/db/actions";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

type Intern = {
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
  currentDay: number;
  dayThemeKey: MessageKey;
  progress: number;
  reportsDone: number;
  reportsReviewed: number;
  entrance: {
    score: number | null;
    level: string;
    weakTopics: string[];
    recommendation: string;
    assessmentTitle: string;
  };
};

type ReadyCandidate = {
  id: number;
  name: string;
  roleTitle: string;
  department: string;
  currentLevel: string;
};

export function InternsView({
  interns,
  readyCandidates,
}: {
  interns: Intern[];
  readyCandidates: ReadyCandidate[];
}) {
  const { t, locale } = useI18n();
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  const name = (value: string) => localizeStaffText(value, locale, "name");
  const role = (value: string) => localizeStaffText(value, locale, "role");
  const department = (value: string) =>
    localizeStaffText(value, locale, "department");

  return (
    <AppShell pathname="/interns">
      <PageHeader
        title={t("interns_title")}
        subtitle={t("interns_subtitle")}
        action={
          <Link href="/trial" className="btn btn-ghost">
            {t("nav_trial")}
          </Link>
        }
      />

      <section className="layout-candidates">
        <article className="panel table-wrap">
          <h2>
            {t("interns_list")} · {interns.length}
          </h2>
          {interns.length === 0 ? (
            <p className="muted">{t("no_interns")}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t("full_name")}</th>
                  <th>{t("col_position")}</th>
                  <th>{t("col_department")}</th>
                  <th>{t("trial_mentor")}</th>
                  <th>{t("trial_current_day")}</th>
                  <th>{t("trial_progress")}</th>
                  <th>{t("trial_entrance_result")}</th>
                  <th>{t("col_level")}</th>
                </tr>
              </thead>
              <tbody>
                {interns.map((intern) => (
                  <tr key={intern.id}>
                    <td>
                      <Link
                        href={`/employees/${intern.id}`}
                        className="person"
                      >
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
                          <span className="muted">{intern.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td>{role(intern.roleTitle)}</td>
                    <td>{department(intern.department)}</td>
                    <td>
                      {intern.mentorName
                        ? name(intern.mentorName)
                        : t("trial_mentor_none")}
                    </td>
                    <td>
                      {t("daily_report_day_n").replace(
                        "{n}",
                        String(intern.currentDay),
                      )}
                      <div className="muted">{t(intern.dayThemeKey)}</div>
                      {intern.trialStartsAt && intern.trialEndsAt ? (
                        <div className="muted">
                          {new Date(intern.trialStartsAt).toLocaleDateString(
                            dateLocale,
                          )}{" "}
                          —{" "}
                          {new Date(intern.trialEndsAt).toLocaleDateString(
                            dateLocale,
                          )}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {intern.progress}%
                      <div className="muted">
                        {t("trial_reports_count")
                          .replace("{done}", String(intern.reportsDone))
                          .replace(
                            "{reviewed}",
                            String(intern.reportsReviewed),
                          )}
                      </div>
                    </td>
                    <td>
                      {intern.entrance.score != null
                        ? `${Math.round(intern.entrance.score)}%`
                        : "—"}
                      {intern.entrance.level ? (
                        <div className="muted">{intern.entrance.level}</div>
                      ) : null}
                    </td>
                    <td>
                      <LevelBadge level={intern.currentLevel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

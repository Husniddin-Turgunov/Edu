"use client";

import Link from "next/link";
import { AppShell, LevelBadge, PageHeader } from "@/components/ui";
import {
  addCandidateCommentAction,
  assignCandidateAssessmentAction,
  moveCandidateToInternshipAction,
  setCandidateStatusAction,
  updateCandidateProfileAction,
} from "@/db/actions";
import {
  CANDIDATE_SOURCES,
  CANDIDATE_STATUSES,
  candidateNextActionKey,
  candidateStatusMessageKey,
} from "@/lib/candidate-funnel";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

type Detail = {
  id: number;
  name: string;
  phone: string;
  email: string;
  telegram: string;
  source: string;
  status: string;
  currentLevel: string;
  claimedLevel: string;
  interviewResult: string;
  avatarHue: number;
  archived: boolean;
  createdAt: string;
  vacancyId: number;
  hrOwnerUserId: number | null;
  hrOwnerName: string | null;
  roleTitle: string;
  department: string;
  vacancyCode: string;
  birthDate: string | null;
  address: string;
  desiredSalary: string;
  availableFrom: string | null;
  notes: string;
  testScore: number | null;
  profile: Record<string, string>;
  events: {
    id: number;
    kind: string;
    title: string;
    body: string;
    fromStatus: string | null;
    toStatus: string | null;
    createdAt: string;
  }[];
  assigns: {
    id: number;
    status: string;
    dueAt: string | null;
    assignedAt: string;
    startedAt: string | null;
    expiresAt: string | null;
    assessmentTitle: string;
    assessmentId: number;
  }[];
  results: {
    id: number;
    score: number;
    levelCode: string;
    completedAt: string;
    assessmentTitle: string;
    profileJson: string;
    telemetryJson: string;
  }[];
  hrUsers: { id: number; displayName: string; role: string }[];
};

type Vacancy = {
  id: number;
  code: string;
  roleTitle: string;
  department: string;
};

type Assessment = { id: number; title: string };

type EntranceResult = {
  correctCount?: number;
  incorrectCount?: number;
  skippedCount?: number;
  entranceLevel?: string;
  recommendation?: string;
  weakTopics?: string[];
  verifixSummary?: string;
  sections?: { name: string; pct: number }[];
  telemetry?: {
    answerChanges?: number;
    pageExits?: number;
    timedOut?: boolean;
    userAgent?: string;
    attemptNumber?: number;
    durationSeconds?: number;
  };
};

function parseEntranceResult(value: string): EntranceResult {
  try {
    return JSON.parse(value || "{}") as EntranceResult;
  } catch {
    return {};
  }
}

function sourceKey(source: string): MessageKey {
  if (source === "telegram") return "cand_source_telegram";
  if (source === "verifix") return "cand_source_verifix";
  if (source === "other") return "cand_source_other";
  return "cand_source_manual";
}

export function CandidateDetailView({
  detail,
  vacancies,
  assessments,
}: {
  detail: Detail;
  vacancies: Vacancy[];
  assessments: Assessment[];
}) {
  const { t, locale } = useI18n();
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  const personName = (value: string) =>
    localizeStaffText(value, locale, "name");
  const roleName = (value: string) => localizeStaffText(value, locale, "role");

  return (
    <AppShell pathname="/candidates">
      <PageHeader
        title={personName(detail.name)}
        subtitle={t("cand_detail_title")}
        action={
          <Link href="/candidates" className="btn btn-ghost">
            {t("to_candidates")}
          </Link>
        }
      />

      <div className="cand-detail-grid">
        <section className="panel">
          <h2>{t("cand_section_personal")}</h2>
          <form action={updateCandidateProfileAction} className="stack-form">
            <input type="hidden" name="candidateId" value={detail.id} />
            <label>
              {t("col_candidate")}
              <input name="name" defaultValue={detail.name} required />
            </label>
            <label>
              {t("cand_birth_date")}
              <input
                name="birthDate"
                type="date"
                defaultValue={detail.birthDate ?? ""}
              />
            </label>
            <label>
              {t("phone")}
              <input name="phone" defaultValue={detail.phone} />
            </label>
            <label>
              {t("col_telegram")}
              <input name="telegram" defaultValue={detail.telegram} />
            </label>
            <label>
              {t("email")}
              <input name="email" type="email" defaultValue={detail.email} />
            </label>
            <label>
              {t("cand_address")}
              <input name="address" defaultValue={detail.address} />
            </label>
            <label>
              {t("col_source")}
              <select name="source" defaultValue={detail.source || "manual"}>
                {CANDIDATE_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {t(sourceKey(s))}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("cand_hr_owner")}
              <select
                name="hrOwnerUserId"
                defaultValue={detail.hrOwnerUserId ?? ""}
              >
                <option value="">—</option>
                {detail.hrUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("notes")}
              <input name="notes" defaultValue={detail.notes} />
            </label>
            <label className="cand-check">
              <input
                type="checkbox"
                name="archived"
                value="1"
                defaultChecked={detail.archived}
              />
              {t("filter_archived")}
            </label>

            <h3>{t("cand_section_vacancy")}</h3>
            <label>
              {t("for_vacancy")}
              <select name="vacancyId" defaultValue={detail.vacancyId}>
                {vacancies.map((v) => (
                  <option key={v.id} value={v.id}>
                    {roleName(v.roleTitle)}
                    {v.code ? ` · ${v.code}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("cand_desired_salary")}
              <input
                name="desiredSalary"
                defaultValue={detail.desiredSalary}
              />
            </label>
            <label>
              {t("cand_available_from")}
              <input
                name="availableFrom"
                type="date"
                defaultValue={detail.availableFrom ?? ""}
              />
            </label>

            <h3>{t("cand_section_resume")}</h3>
            <label>
              {t("cand_education")}
              <input
                name="education"
                defaultValue={detail.profile.education ?? ""}
              />
            </label>
            <label>
              {t("cand_experience")}
              <textarea
                name="experience"
                rows={3}
                defaultValue={detail.profile.experience ?? ""}
              />
            </label>
            <label>
              {t("cand_skills")}
              <input name="skills" defaultValue={detail.profile.skills ?? ""} />
            </label>
            <label>
              {t("cand_tools")}
              <input name="tools" defaultValue={detail.profile.tools ?? ""} />
            </label>
            <label>
              {t("cand_languages")}
              <input
                name="languages"
                defaultValue={detail.profile.languages ?? ""}
              />
            </label>
            <label>
              {t("cand_claimed_level")}
              <input name="claimedLevel" defaultValue={detail.claimedLevel} />
            </label>
            <label>
              {t("cand_interview_result")}
              <input
                name="interviewResult"
                defaultValue={detail.interviewResult}
              />
            </label>

            <button type="submit" className="btn btn-primary">
              {t("cand_save_profile")}
            </button>
          </form>
        </section>

        <div className="stack" style={{ gap: 18 }}>
          <article className="panel">
            <h2>{t("status")}</h2>
            <p>
              <span className="level-badge level-unassessed">
                {t(candidateStatusMessageKey(detail.status))}
              </span>
            </p>
            <p className="muted">
              {t("col_next_action")}: {t(candidateNextActionKey(detail.status))}
            </p>
            <p>
              {t("col_confirmed_level")}:{" "}
              <LevelBadge level={detail.currentLevel} />
              {detail.testScore != null
                ? ` · ${Math.round(detail.testScore)}%`
                : null}
            </p>
            <form action={setCandidateStatusAction} className="stack-form">
              <input type="hidden" name="candidateId" value={detail.id} />
              <label>
                {t("cand_change_status")}
                <select name="status" defaultValue={detail.status}>
                  {CANDIDATE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(candidateStatusMessageKey(s))}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("notes")}
                <input name="comment" placeholder="…" />
              </label>
              <button type="submit" className="btn btn-secondary">
                {t("save")}
              </button>
            </form>
          </article>

          <article className="panel">
            <h2>{t("cand_section_actions")}</h2>
            <div className="stack" style={{ gap: 12 }}>
              <form
                action={assignCandidateAssessmentAction}
                className="stack-form"
              >
                <input type="hidden" name="candidateId" value={detail.id} />
                <label>
                  {t("cand_assign_test_btn")}
                  <select name="assessmentId" defaultValue="">
                    <option value="">{t("assign_auto_pick")}</option>
                    {assessments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn btn-primary">
                  {t("assign")}
                </button>
              </form>

              {detail.status === "test_completed" ? (
                <form action={moveCandidateToInternshipAction}>
                  <input type="hidden" name="candidateId" value={detail.id} />
                  <button type="submit" className="btn btn-amber">
                    {t("cand_admit_trial")}
                  </button>
                </form>
              ) : null}

              <form action={addCandidateCommentAction} className="stack-form">
                <input type="hidden" name="candidateId" value={detail.id} />
                <label>
                  {t("cand_add_comment")}
                  <textarea name="body" rows={3} required />
                </label>
                <button type="submit" className="btn btn-ghost">
                  {t("save")}
                </button>
              </form>
            </div>
          </article>

          <article className="panel">
            <h2>{t("cand_section_history")}</h2>
            {detail.events.length === 0 ? (
              <p className="muted">{t("cand_no_history")}</p>
            ) : (
              <div className="list">
                {detail.events.map((e) => (
                  <div key={e.id} className="list-item">
                    <div>
                      <strong>{e.title}</strong>
                      {e.body ? (
                        <div className="muted">{e.body}</div>
                      ) : null}
                      <div className="muted">
                        {new Date(e.createdAt).toLocaleString(dateLocale)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="panel">
            <h2>{t("candidate_assignments")}</h2>
            {detail.assigns.length === 0 && detail.results.length === 0 ? (
              <p className="muted">{t("no_candidate_assignments")}</p>
            ) : (
              <div className="list">
                {detail.results.map((r) => {
                  const report = parseEntranceResult(r.profileJson);
                  return (
                  <div key={`r-${r.id}`} className="list-item entrance-result-card">
                    <div className="stack" style={{ gap: 8 }}>
                      <strong>{r.assessmentTitle}</strong>
                      <div className="muted">
                        {Math.round(r.score)}% ·{" "}
                        {report.entranceLevel || r.levelCode} ·{" "}
                        {new Date(r.completedAt).toLocaleString(dateLocale)}
                      </div>
                      {typeof report.correctCount === "number" ? (
                        <div className="entrance-result-metrics">
                          <span>Верно: {report.correctCount}</span>
                          <span>Неверно: {report.incorrectCount ?? 0}</span>
                          <span>Пропущено: {report.skippedCount ?? 0}</span>
                        </div>
                      ) : null}
                      {report.sections?.length ? (
                        <div>
                          <strong>По компетенциям</strong>
                          <div className="entrance-competencies">
                            {report.sections.map((section) => (
                              <span key={section.name}>
                                {section.name}: {Math.round(section.pct * 100)}%
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {report.weakTopics?.length ? (
                        <div className="muted">
                          Слабые темы: {report.weakTopics.join(", ")}
                        </div>
                      ) : null}
                      {report.recommendation ? (
                        <div>
                          <strong>Рекомендация:</strong>{" "}
                          {report.recommendation}
                        </div>
                      ) : null}
                      {report.telemetry ? (
                        <div className="muted">
                          Изменений ответов: {report.telemetry.answerChanges ?? 0}
                          {" · "}выходов со страницы:{" "}
                          {report.telemetry.pageExits ?? 0}
                          {report.telemetry.timedOut ? " · время истекло" : ""}
                          {report.telemetry.attemptNumber
                            ? ` · попытка: ${report.telemetry.attemptNumber}`
                            : ""}
                          {typeof report.telemetry.durationSeconds === "number"
                            ? ` · длительность: ${Math.floor(
                                report.telemetry.durationSeconds / 60,
                              )} мин ${report.telemetry.durationSeconds % 60} сек`
                            : ""}
                        </div>
                      ) : null}
                      {report.verifixSummary ? (
                        <details>
                          <summary>Краткий результат для Verifix</summary>
                          <pre className="entrance-verifix-summary">
                            {report.verifixSummary}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  </div>
                  );
                })}
                {detail.assigns.map((a) => (
                  <div key={`a-${a.id}`} className="list-item">
                    <div>
                      <strong>{a.assessmentTitle}</strong>
                      <div className="muted">
                        {a.status === "completed"
                          ? t("completed")
                          : t("pending")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </div>
    </AppShell>
  );
}

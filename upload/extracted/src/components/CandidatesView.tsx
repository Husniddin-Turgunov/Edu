"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell, LevelBadge, PageHeader } from "@/components/ui";
import {
  assignCandidateAssessmentAction,
  createCandidateAction,
  enqueueCandidateTerminalAction,
  moveCandidateToInternshipAction,
  removeTerminalQueueAction,
} from "@/db/actions";
import {
  CANDIDATE_SOURCES,
  CANDIDATE_STATUSES,
  candidateNextActionKey,
  candidateStatusMessageKey,
  type CandidateStatus,
} from "@/lib/candidate-funnel";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

type Vacancy = {
  id: number;
  code: string;
  roleTitle: string;
  department: string;
};

type Candidate = {
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
  photoUrl: string | null;
  archived: boolean;
  createdAt: string;
  vacancyId: number;
  hrOwnerUserId: number | null;
  hrOwnerName: string | null;
  roleTitle: string;
  department: string;
  vacancyCode: string;
  portalLogin: string | null;
  portalEnabled: boolean;
  testScore: number | null;
  testLevel: string | null;
  invited: boolean;
};

type Assessment = { id: number; title: string };

type AssignRow = {
  id: number;
  status: string;
  dueAt: string | null;
  candidateId: number;
  candidateName: string;
  assessmentTitle: string;
  roleTitle: string;
};

type QueueRow = {
  id: number;
  slotNumber: number;
  candidateId: number;
  candidateName: string;
  roleTitle: string;
  status: string;
  sortOrder: number;
};

type TerminalQueues = Record<
  number,
  { active: QueueRow | null; queued: QueueRow[] }
>;

function sourceKey(source: string): MessageKey {
  if (source === "telegram") return "cand_source_telegram";
  if (source === "verifix") return "cand_source_verifix";
  if (source === "other") return "cand_source_other";
  return "cand_source_manual";
}

export function CandidatesView({
  list,
  vacancies,
  assessments,
  assigns,
  terminalQueues,
  baseUrl,
}: {
  list: Candidate[];
  vacancies: Vacancy[];
  assessments: Assessment[];
  assigns: AssignRow[];
  terminalQueues: TerminalQueues;
  baseUrl: string;
}) {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<"candidates" | "terminals">(
    "candidates",
  );
  const [statusFilter, setStatusFilter] = useState("");
  const [vacancyFilter, setVacancyFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [hrFilter, setHrFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [invitedFilter, setInvitedFilter] = useState("");
  const [archiveFilter, setArchiveFilter] = useState("active");

  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  const personName = (value: string) =>
    localizeStaffText(value, locale, "name");
  const roleName = (value: string) => localizeStaffText(value, locale, "role");
  const departmentName = (value: string) =>
    localizeStaffText(value, locale, "department");

  const hrOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of list) {
      if (c.hrOwnerUserId && c.hrOwnerName) {
        map.set(c.hrOwnerUserId, c.hrOwnerName);
      }
    }
    return [...map.entries()];
  }, [list]);

  const filtered = useMemo(() => {
    return list.filter((c) => {
      if (archiveFilter === "active" && c.archived) return false;
      if (archiveFilter === "archived" && !c.archived) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (vacancyFilter && String(c.vacancyId) !== vacancyFilter) return false;
      if (sourceFilter && c.source !== sourceFilter) return false;
      if (hrFilter && String(c.hrOwnerUserId ?? "") !== hrFilter) return false;
      if (levelFilter) {
        const lvl = c.testLevel || c.currentLevel;
        if (lvl !== levelFilter) return false;
      }
      if (invitedFilter === "yes" && !c.invited) return false;
      if (invitedFilter === "no" && c.invited) return false;
      return true;
    });
  }, [
    list,
    archiveFilter,
    statusFilter,
    vacancyFilter,
    sourceFilter,
    hrFilter,
    levelFilter,
    invitedFilter,
  ]);

  return (
    <AppShell pathname="/candidates">
      <PageHeader
        title={t("candidates_title")}
        subtitle={t("candidates_subtitle")}
      />

      <div className="candidate-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "candidates"}
          className={
            activeTab === "candidates" ? "candidate-tab active" : "candidate-tab"
          }
          onClick={() => setActiveTab("candidates")}
        >
          {t("terminal_tab_candidates")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "terminals"}
          className={
            activeTab === "terminals" ? "candidate-tab active" : "candidate-tab"
          }
          onClick={() => setActiveTab("terminals")}
        >
          {t("terminal_tab_accounts")}
        </button>
      </div>

      {activeTab === "candidates" ? (
        <>
          <section className="panel cand-filters">
            <div className="cand-filters-grid">
              <label>
                {t("filter_status")}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">{t("filter_all")}</option>
                  {CANDIDATE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(candidateStatusMessageKey(s))}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("filter_vacancy")}
                <select
                  value={vacancyFilter}
                  onChange={(e) => setVacancyFilter(e.target.value)}
                >
                  <option value="">{t("filter_all")}</option>
                  {vacancies.map((v) => (
                    <option key={v.id} value={v.id}>
                      {roleName(v.roleTitle)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("filter_source")}
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                >
                  <option value="">{t("filter_all")}</option>
                  {CANDIDATE_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {t(sourceKey(s))}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("filter_hr")}
                <select
                  value={hrFilter}
                  onChange={(e) => setHrFilter(e.target.value)}
                >
                  <option value="">{t("filter_all")}</option>
                  {hrOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("filter_level")}
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                >
                  <option value="">{t("filter_all")}</option>
                  {["unassessed", "junior", "middle", "senior", "lead", "expert"].map(
                    (lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                {t("filter_invited")}
                <select
                  value={invitedFilter}
                  onChange={(e) => setInvitedFilter(e.target.value)}
                >
                  <option value="">{t("filter_all")}</option>
                  <option value="yes">{t("filter_invited_yes")}</option>
                  <option value="no">{t("filter_invited_no")}</option>
                </select>
              </label>
              <label>
                {t("filter_archive")}
                <select
                  value={archiveFilter}
                  onChange={(e) => setArchiveFilter(e.target.value)}
                >
                  <option value="active">{t("filter_active")}</option>
                  <option value="archived">{t("filter_archived")}</option>
                  <option value="all">{t("filter_all")}</option>
                </select>
              </label>
            </div>
          </section>

          <section className="layout-candidates" style={{ marginBottom: 18 }}>
            <article className="panel table-wrap">
              <h2>
                {t("list")} · {filtered.length}
              </h2>
              {filtered.length === 0 ? (
                <p className="muted">{t("no_candidates")}</p>
              ) : (
                <table className="cand-table">
                  <thead>
                    <tr>
                      <th>{t("col_candidate")}</th>
                      <th>{t("phone")}</th>
                      <th>{t("col_telegram")}</th>
                      <th>{t("col_position")}</th>
                      <th>{t("col_source")}</th>
                      <th>{t("col_submitted")}</th>
                      <th>{t("col_hr")}</th>
                      <th>{t("status")}</th>
                      <th>{t("col_interview")}</th>
                      <th>{t("col_test_result")}</th>
                      <th>{t("col_claimed_level")}</th>
                      <th>{t("col_confirmed_level")}</th>
                      <th>{t("col_next_action")}</th>
                      <th>{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/candidates/${c.id}`} className="person">
                            <span
                              className="avatar"
                              style={{
                                background: `hsl(${c.avatarHue} 42% 38%)`,
                              }}
                            >
                              {personName(c.name)
                                .split(" ")
                                .map((p) => p[0])
                                .slice(0, 2)
                                .join("")}
                            </span>
                            <strong>{personName(c.name)}</strong>
                          </Link>
                        </td>
                        <td>{c.phone || "—"}</td>
                        <td>{c.telegram || "—"}</td>
                        <td>
                          <strong>{roleName(c.roleTitle)}</strong>
                          <div className="muted">
                            {departmentName(c.department)}
                          </div>
                        </td>
                        <td>{t(sourceKey(c.source))}</td>
                        <td className="muted">
                          {c.createdAt
                            ? new Date(c.createdAt).toLocaleDateString(
                                dateLocale,
                              )
                            : "—"}
                        </td>
                        <td>{c.hrOwnerName || "—"}</td>
                        <td>
                          <span className="level-badge level-unassessed">
                            {t(candidateStatusMessageKey(c.status))}
                          </span>
                        </td>
                        <td>{c.interviewResult || "—"}</td>
                        <td>
                          {c.testScore != null
                            ? `${Math.round(c.testScore)}% · ${c.testLevel ?? "—"}`
                            : "—"}
                        </td>
                        <td>{c.claimedLevel || "—"}</td>
                        <td>
                          <LevelBadge level={c.currentLevel} />
                        </td>
                        <td className="muted">
                          {t(
                            candidateNextActionKey(
                              c.status as CandidateStatus,
                            ),
                          )}
                        </td>
                        <td>
                          <div className="stack" style={{ gap: 6 }}>
                            <Link
                              href={`/candidates/${c.id}`}
                              className="btn btn-ghost btn-sm"
                            >
                              {t("open_card")}
                            </Link>
                            {c.status === "test_completed" ? (
                              <form action={moveCandidateToInternshipAction}>
                                <input
                                  type="hidden"
                                  name="candidateId"
                                  value={c.id}
                                />
                                <button
                                  type="submit"
                                  className="btn btn-secondary btn-sm"
                                >
                                  {t("cand_admit_trial")}
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>

            <div className="stack-forms">
              <article className="panel">
                <h2>{t("add_candidate")}</h2>
                <p className="muted">{t("candidate_auto_test_note")}</p>
                <form action={createCandidateAction} className="stack-form">
                  <label>
                    {t("last_name")}
                    <input name="lastName" required autoComplete="family-name" />
                  </label>
                  <label>
                    {t("first_name")}
                    <input name="firstName" required autoComplete="given-name" />
                  </label>
                  <label>
                    {t("for_vacancy")}
                    <select name="vacancyId" required defaultValue="">
                      <option value="" disabled>
                        {t("select")}
                      </option>
                      {vacancies.map((v) => (
                        <option key={v.id} value={v.id}>
                          {roleName(v.roleTitle)}
                          {v.code ? ` · ${v.code}` : ""} —{" "}
                          {departmentName(v.department)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("phone")}
                    <input name="phone" placeholder="+998…" />
                  </label>
                  <label>
                    {t("col_telegram")}
                    <input name="telegram" placeholder="@username" />
                  </label>
                  <label>
                    {t("email")}
                    <input name="email" type="email" />
                  </label>
                  <label>
                    {t("col_source")}
                    <select name="source" defaultValue="manual">
                      {CANDIDATE_SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {t(sourceKey(s))}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("notes")}
                    <input name="notes" />
                  </label>
                  <button type="submit" className="btn btn-primary">
                    {t("save")}
                  </button>
                </form>
              </article>

              <article className="panel">
                <h2>{t("assign_candidate_test")}</h2>
                <p className="muted">{t("assign_auto_by_role")}</p>
                <form
                  action={assignCandidateAssessmentAction}
                  className="stack-form"
                >
                  <label>
                    {t("candidate")}
                    <select name="candidateId" required defaultValue="">
                      <option value="" disabled>
                        {t("select")}
                      </option>
                      {list.map((c) => (
                        <option key={c.id} value={c.id}>
                          {personName(c.name)} — {roleName(c.roleTitle)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("test")} ({t("optional")})
                    <select name="assessmentId" defaultValue="">
                      <option value="">{t("assign_auto_pick")}</option>
                      {assessments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("due")}
                    <input type="date" name="dueAt" />
                  </label>
                  <button type="submit" className="btn btn-primary">
                    {t("assign")}
                  </button>
                </form>
              </article>
            </div>
          </section>

          <section className="panel table-wrap">
            <h2>{t("candidate_assignments")}</h2>
            {assigns.length === 0 ? (
              <p className="muted">{t("no_candidate_assignments")}</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{t("col_candidate")}</th>
                    <th>{t("col_position")}</th>
                    <th>{t("col_assessment")}</th>
                    <th>{t("status")}</th>
                    <th>{t("due")}</th>
                  </tr>
                </thead>
                <tbody>
                  {assigns.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/candidates/${a.candidateId}`}>
                          <strong>{personName(a.candidateName)}</strong>
                        </Link>
                      </td>
                      <td>{roleName(a.roleTitle)}</td>
                      <td>{a.assessmentTitle}</td>
                      <td>
                        {a.status === "completed" ? t("completed") : t("pending")}
                      </td>
                      <td className="muted">
                        {a.dueAt
                          ? new Date(a.dueAt).toLocaleDateString(dateLocale)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="panel terminal-distribution-panel">
            <h2>{t("terminal_assign_title")}</h2>
            <p className="muted">{t("terminal_assign_note")}</p>
            <form
              action={enqueueCandidateTerminalAction}
              className="terminal-distribution-form"
            >
              <label>
                {t("candidate")}
                <select name="candidateId" required defaultValue="">
                  <option value="" disabled>
                    {t("select")}
                  </option>
                  {list.map((c) => (
                    <option key={c.id} value={c.id}>
                      {personName(c.name)} — {roleName(c.roleTitle)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("terminal_account")}
                <select name="slotNumber" required defaultValue="">
                  <option value="" disabled>
                    {t("select")}
                  </option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {t("terminal_account")} {n}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="btn btn-primary">
                {t("terminal_assign_btn")}
              </button>
            </form>
          </section>

          <section className="panel" style={{ marginBottom: 18 }}>
            <h2>{t("terminal_queues_title")}</h2>
            <p className="muted">{t("terminal_queues_note")}</p>
            <div className="terminal-slots-grid">
              {[1, 2, 3, 4, 5].map((slot) => {
                const data = terminalQueues[slot] ?? {
                  active: null,
                  queued: [],
                };
                return (
                  <article key={slot} className="terminal-slot-panel">
                    <div className="terminal-slot-head">
                      <h3>
                        {t("terminal_account")} {slot}
                      </h3>
                      <Link
                        href={`/terminal/${slot}`}
                        className="btn btn-ghost btn-sm"
                        target="_blank"
                      >
                        {t("terminal_open")}
                      </Link>
                    </div>
                    {data.active ? (
                      <div className="terminal-slot-active">
                        <strong>{personName(data.active.candidateName)}</strong>
                        <div className="muted">
                          {roleName(data.active.roleTitle)}
                        </div>
                        <div className="muted">
                          {data.active.status === "testing"
                            ? t("terminal_status_testing")
                            : t("terminal_status_active")}
                        </div>
                        {data.active.status !== "testing" ? (
                          <form action={removeTerminalQueueAction}>
                            <input
                              type="hidden"
                              name="queueItemId"
                              value={data.active.id}
                            />
                            <button
                              type="submit"
                              className="btn btn-ghost btn-sm"
                            >
                              {t("terminal_remove")}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ) : (
                      <p className="muted">{t("terminal_slot_free")}</p>
                    )}
                    {data.queued.length > 0 ? (
                      <ul className="terminal-slot-queue">
                        {data.queued.map((q) => (
                          <li key={q.id}>
                            <span>
                              {personName(q.candidateName)} —{" "}
                              {roleName(q.roleTitle)}
                            </span>
                            <form action={removeTerminalQueueAction}>
                              <input
                                type="hidden"
                                name="queueItemId"
                                value={q.id}
                              />
                              <button
                                type="submit"
                                className="btn btn-ghost btn-sm"
                              >
                                ×
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="muted terminal-slot-url">
                      {baseUrl}/terminal/{slot}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
